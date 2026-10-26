import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { filtroBusqueda } from "@/lib/catalogos/validacion";
import { LIMITE_LISTADO } from "@/lib/finanzas/consultas";
import { ETIQUETAS_METODO } from "@/lib/finanzas/definiciones";
import { sumarMontos } from "@/lib/finanzas/montos";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import { FormularioFiltros, leerFiltros, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { InsigniaFinanciera } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";

const ESTADOS = [
  { valor: "confirmado", etiqueta: "Confirmados" },
  { valor: "reversado", etiqueta: "Reversados" },
  { valor: "todos", etiqueta: "Todos" },
];

export default function PaginaCobros({ searchParams }: PageProps<"/finanzas/cobros">) {
  return (
    <>
      <Encabezado
        titulo="Cobros"
        descripcion="Dinero recibido de clientes. Lo no aplicado a cargos queda como saldo a favor."
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
  if (!puede("registrarCobro", usuario.rol)) return null;
  return (
    <Link href="/finanzas/cobros/nuevo" className="boton boton-primario">
      Registrar cobro
    </Link>
  );
}

async function Listado({ searchParams }: { searchParams: ParametrosBusqueda }) {
  await requerirUsuario();
  const filtros = leerFiltros(await searchParams, ESTADOS);
  const supabase = await createClient();

  let consulta = supabase
    .from("saldos_cobros")
    .select("id, fecha, cliente_nombre, cuenta_nombre, metodo, referencia, monto, aplicado, disponible, estado")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMITE_LISTADO + 1);
  if (filtros.estado !== "todos") consulta = consulta.eq("estado", filtros.estado as "confirmado");
  if (filtros.busqueda) consulta = consulta.or(filtroBusqueda(["cliente_nombre", "referencia"], filtros.busqueda));
  if (filtros.desde) consulta = consulta.gte("fecha", filtros.desde);
  if (filtros.hasta) consulta = consulta.lte("fecha", filtros.hasta);
  const { data, error } = await consulta;

  const filas = (data ?? []).slice(0, LIMITE_LISTADO).map((fila) => ({ ...fila, id: fila.id! }));
  return (
    <>
      <FormularioFiltros filtros={filtros} estados={ESTADOS} placeholder="Cliente o referencia…" />
      {error ? (
        <p role="alert" className="aviso aviso-error">No se pudo cargar el listado.</p>
      ) : (
        <Tabla
          filas={filas}
          enlace={(fila) => `/finanzas/cobros/${fila.id}`}
          vacio="No hay cobros que coincidan con el filtro."
          columnas={[
            { clave: "cliente", etiqueta: "Cliente", celda: (f) => f.cliente_nombre },
            { clave: "fecha", etiqueta: "Fecha", celda: (f) => formatearFecha(f.fecha) },
            { clave: "cuenta", etiqueta: "Caja/banco", celda: (f) => f.cuenta_nombre },
            { clave: "metodo", etiqueta: "Método", celda: (f) => (f.metodo ? ETIQUETAS_METODO[f.metodo] : "—") },
            { clave: "monto", etiqueta: "Recibido", numerica: true, celda: (f) => formatearMoneda(f.monto) },
            { clave: "aplicado", etiqueta: "Aplicado", numerica: true, celda: (f) => formatearMoneda(f.aplicado) },
            { clave: "disponible", etiqueta: "Saldo a favor", numerica: true, celda: (f) => formatearMoneda(f.disponible) },
            { clave: "estado", etiqueta: "Estado", celda: (f) => <InsigniaFinanciera estado={f.estado} /> },
          ]}
          totales={{
            monto: formatearMoneda(sumarMontos(filas.map((f) => f.monto))),
            aplicado: formatearMoneda(sumarMontos(filas.map((f) => f.aplicado))),
            disponible: formatearMoneda(sumarMontos(filas.map((f) => f.disponible))),
          }}
        />
      )}
      {(data?.length ?? 0) > LIMITE_LISTADO && (
        <p className="mt-3 text-sm texto-tenue">Se muestran los primeros {LIMITE_LISTADO}; refine el filtro.</p>
      )}
    </>
  );
}
