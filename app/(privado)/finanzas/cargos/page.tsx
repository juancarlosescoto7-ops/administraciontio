import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { filtroBusqueda } from "@/lib/catalogos/validacion";
import { LIMITE_LISTADO } from "@/lib/finanzas/consultas";
import { ETIQUETAS_ACTIVIDAD } from "@/lib/finanzas/definiciones";
import { sumarMontos } from "@/lib/finanzas/montos";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import { FormularioFiltros, leerFiltros, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { InsigniaFinanciera } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";

const ESTADOS = [
  { valor: "pendientes", etiqueta: "Con saldo pendiente" },
  { valor: "pagados", etiqueta: "Pagados" },
  { valor: "anulados", etiqueta: "Anulados" },
  { valor: "todos", etiqueta: "Todos" },
];

export default function PaginaCargos({ searchParams }: PageProps<"/finanzas/cargos">) {
  return (
    <>
      <Encabezado
        titulo="Cargos a clientes"
        descripcion="Obligaciones de los clientes. El pendiente es el cargo menos lo aplicado de sus cobros."
        acciones={
          <Suspense fallback={null}>
            <BotonRegistrar />
          </Suspense>
        }
      />
      <Suspense fallback={<Cargando />}>
        <Listado searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BotonRegistrar() {
  const usuario = await requerirUsuario();
  if (!puede("registrarCargo", usuario.rol)) return null;
  return (
    <Link href="/finanzas/cargos/nuevo" className="boton boton-primario">
      Registrar cargo
    </Link>
  );
}

async function Listado({ searchParams }: { searchParams: ParametrosBusqueda }) {
  await requerirUsuario();
  const filtros = leerFiltros(await searchParams, ESTADOS);
  const supabase = await createClient();

  let consulta = supabase
    .from("saldos_cargos")
    .select("id, cliente_nombre, concepto, actividad, fecha, vencimiento, monto, aplicado, pendiente, estado")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMITE_LISTADO + 1);
  if (filtros.estado === "pendientes") consulta = consulta.eq("estado", "vigente").gt("pendiente", 0);
  if (filtros.estado === "pagados") consulta = consulta.eq("estado", "vigente").eq("pendiente", 0);
  if (filtros.estado === "anulados") consulta = consulta.eq("estado", "anulado");
  if (filtros.busqueda) consulta = consulta.or(filtroBusqueda(["cliente_nombre", "concepto"], filtros.busqueda));
  if (filtros.desde) consulta = consulta.gte("fecha", filtros.desde);
  if (filtros.hasta) consulta = consulta.lte("fecha", filtros.hasta);
  const { data, error } = await consulta;

  const filas = (data ?? []).slice(0, LIMITE_LISTADO).map((fila) => ({ ...fila, id: fila.id! }));
  return (
    <>
      <FormularioFiltros filtros={filtros} estados={ESTADOS} placeholder="Cliente o concepto…" />
      {error ? (
        <p role="alert" className="aviso aviso-error">No se pudo cargar el listado.</p>
      ) : (
        <Tabla
          filas={filas}
          enlace={(fila) => `/finanzas/cargos/${fila.id}`}
          vacio="No hay cargos que coincidan con el filtro."
          columnas={[
            { clave: "concepto", etiqueta: "Concepto", celda: (f) => f.concepto },
            { clave: "cliente", etiqueta: "Cliente", celda: (f) => f.cliente_nombre },
            { clave: "actividad", etiqueta: "Actividad", celda: (f) => (f.actividad ? ETIQUETAS_ACTIVIDAD[f.actividad] : "—") },
            { clave: "fecha", etiqueta: "Fecha", celda: (f) => formatearFecha(f.fecha) },
            { clave: "vencimiento", etiqueta: "Vence", celda: (f) => formatearFecha(f.vencimiento) },
            { clave: "monto", etiqueta: "Total", numerica: true, celda: (f) => formatearMoneda(f.monto) },
            { clave: "aplicado", etiqueta: "Pagado", numerica: true, celda: (f) => formatearMoneda(f.aplicado) },
            { clave: "pendiente", etiqueta: "Pendiente", numerica: true, celda: (f) => formatearMoneda(f.pendiente) },
            { clave: "estado", etiqueta: "Estado", celda: (f) => <InsigniaFinanciera estado={f.estado} /> },
          ]}
          totales={{
            monto: formatearMoneda(sumarMontos(filas.filter((f) => f.estado === "vigente").map((f) => f.monto))),
            aplicado: formatearMoneda(sumarMontos(filas.map((f) => f.aplicado))),
            pendiente: formatearMoneda(sumarMontos(filas.map((f) => f.pendiente))),
          }}
        />
      )}
      {(data?.length ?? 0) > LIMITE_LISTADO && (
        <p className="mt-3 text-sm texto-tenue">Se muestran los primeros {LIMITE_LISTADO}; refine el filtro.</p>
      )}
    </>
  );
}
