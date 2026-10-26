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
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { FormularioFiltros, leerFiltros, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { InsigniaFinanciera } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";

const ESTADOS = [
  { valor: "pendientes", etiqueta: "Con saldo pendiente" },
  { valor: "pagados", etiqueta: "Pagados" },
  { valor: "anulados", etiqueta: "Anulados" },
  { valor: "todos", etiqueta: "Todos" },
];

export default function PaginaGastos({ searchParams }: PageProps<"/finanzas/gastos">) {
  return (
    <>
      <Encabezado
        titulo="Gastos"
        descripcion="Gastos reconocidos y sus pagos. El pendiente es el gasto menos lo pagado."
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
  if (!puede("gestionarGastos", usuario.rol)) return null;
  return (
    <Link href="/finanzas/gastos/nuevo" className="boton boton-primario">
      Registrar gasto
    </Link>
  );
}

async function Listado({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("verTesoreria", usuario.rol)) {
    return <SinPermiso mensaje="Los gastos los consultan el administrador y finanzas." />;
  }
  const filtros = leerFiltros(await searchParams, ESTADOS);
  const supabase = await createClient();

  let consulta = supabase
    .from("saldos_gastos")
    .select("id, concepto, proveedor_nombre, categoria_nombre, actividad, fecha, vencimiento, monto, pagado, pendiente, estado")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMITE_LISTADO + 1);
  if (filtros.estado === "pendientes") consulta = consulta.eq("estado", "registrado").gt("pendiente", 0);
  if (filtros.estado === "pagados") consulta = consulta.eq("estado", "registrado").eq("pendiente", 0);
  if (filtros.estado === "anulados") consulta = consulta.eq("estado", "anulado");
  if (filtros.busqueda) consulta = consulta.or(filtroBusqueda(["concepto", "proveedor_nombre"], filtros.busqueda));
  if (filtros.desde) consulta = consulta.gte("fecha", filtros.desde);
  if (filtros.hasta) consulta = consulta.lte("fecha", filtros.hasta);
  const { data, error } = await consulta;

  const filas = (data ?? []).slice(0, LIMITE_LISTADO).map((fila) => ({ ...fila, id: fila.id! }));
  return (
    <>
      <FormularioFiltros filtros={filtros} estados={ESTADOS} placeholder="Concepto o proveedor…" />
      {error ? (
        <p role="alert" className="aviso aviso-error">No se pudo cargar el listado.</p>
      ) : (
        <Tabla
          filas={filas}
          enlace={(fila) => `/finanzas/gastos/${fila.id}`}
          vacio="No hay gastos que coincidan con el filtro."
          columnas={[
            { clave: "concepto", etiqueta: "Concepto", celda: (f) => f.concepto },
            { clave: "proveedor", etiqueta: "Proveedor", celda: (f) => f.proveedor_nombre ?? "—" },
            { clave: "categoria", etiqueta: "Categoría", celda: (f) => f.categoria_nombre },
            { clave: "actividad", etiqueta: "Actividad", celda: (f) => (f.actividad ? ETIQUETAS_ACTIVIDAD[f.actividad] : "—") },
            { clave: "fecha", etiqueta: "Fecha", celda: (f) => formatearFecha(f.fecha) },
            { clave: "monto", etiqueta: "Total", numerica: true, celda: (f) => formatearMoneda(f.monto) },
            { clave: "pagado", etiqueta: "Pagado", numerica: true, celda: (f) => formatearMoneda(f.pagado) },
            { clave: "pendiente", etiqueta: "Pendiente", numerica: true, celda: (f) => formatearMoneda(f.pendiente) },
            { clave: "estado", etiqueta: "Estado", celda: (f) => <InsigniaFinanciera estado={f.estado} /> },
          ]}
          totales={{
            monto: formatearMoneda(sumarMontos(filas.filter((f) => f.estado === "registrado").map((f) => f.monto))),
            pagado: formatearMoneda(sumarMontos(filas.map((f) => f.pagado))),
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
