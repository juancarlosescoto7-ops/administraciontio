import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import type { Opcion } from "@/lib/catalogos/definiciones";
import { primerValor } from "@/lib/catalogos/presentacion";
import { filtroBusqueda } from "@/lib/catalogos/validacion";
import { LIMITE_LISTADO } from "@/lib/finanzas/consultas";
import { ETIQUETAS_ACTIVIDAD } from "@/lib/finanzas/definiciones";
import { sumarMontos } from "@/lib/finanzas/montos";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/tipos-bd";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { FormularioFiltros, leerFiltros, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { InsigniaFinanciera } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";

type Actividad = Database["public"]["Enums"]["actividad"];

const OPCIONES_ACTIVIDAD: readonly Opcion[] = [
  { valor: "todas", etiqueta: "Todas" },
  ...Object.entries(ETIQUETAS_ACTIVIDAD).map(([valor, etiqueta]) => ({ valor, etiqueta })),
];

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
  const parametros = await searchParams;
  const filtros = leerFiltros(parametros, ESTADOS);
  const supabase = await createClient();
  const { data: categorias } = await supabase.from("categorias_gasto").select("id, nombre").order("nombre");
  const opcionesCategoria: Opcion[] = [
    { valor: "todas", etiqueta: "Todas" },
    ...(categorias ?? []).map((c) => ({ valor: c.id, etiqueta: c.nombre })),
  ];
  const categoriaParametro = primerValor(parametros.categoria);
  const categoria = opcionesCategoria.some((c) => c.valor === categoriaParametro) ? categoriaParametro! : "todas";
  const actividadParametro = primerValor(parametros.actividad);
  const actividad = OPCIONES_ACTIVIDAD.some((a) => a.valor === actividadParametro) ? actividadParametro! : "todas";

  let consulta = supabase
    .from("saldos_gastos")
    .select("id, concepto, proveedor_nombre, categoria_nombre, actividad, fecha, vencimiento, monto, pagado, pendiente, estado")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMITE_LISTADO + 1);
  if (filtros.estado === "pendientes") consulta = consulta.eq("estado", "registrado").gt("pendiente", 0);
  if (filtros.estado === "pagados") consulta = consulta.eq("estado", "registrado").eq("pendiente", 0);
  if (filtros.estado === "anulados") consulta = consulta.eq("estado", "anulado");
  if (categoria !== "todas") consulta = consulta.eq("categoria_id", categoria);
  if (actividad !== "todas") consulta = consulta.eq("actividad", actividad as Actividad);
  if (filtros.busqueda) {
    // Los salarios no tienen proveedor: se busca también por el empleado o conductor pagado.
    const { data: personal } = await supabase.from("gastos_personal").select("gasto_id")
      .ilike("nombre_destinatario", `%${filtros.busqueda}%`).limit(LIMITE_LISTADO);
    const ids = (personal ?? []).map((p) => p.gasto_id);
    consulta = consulta.or(filtroBusqueda(["concepto", "proveedor_nombre"], filtros.busqueda) + (ids.length ? `,id.in.(${ids.join(",")})` : ""));
  }
  if (filtros.desde) consulta = consulta.gte("fecha", filtros.desde);
  if (filtros.hasta) consulta = consulta.lte("fecha", filtros.hasta);
  const { data, error } = await consulta;

  const visibles = (data ?? []).slice(0, LIMITE_LISTADO);
  const { data: personal } = visibles.length
    ? await supabase.from("gastos_personal").select("gasto_id, nombre_destinatario").in("gasto_id", visibles.map((f) => f.id!))
    : { data: [] };
  const destinatarios = new Map((personal ?? []).map((p) => [p.gasto_id, p.nombre_destinatario]));
  const filas = visibles.map((fila) => ({ ...fila, id: fila.id!, destinatario: destinatarios.get(fila.id!) ?? fila.proveedor_nombre }));
  return (
    <>
      <FormularioFiltros
        filtros={filtros}
        estados={ESTADOS}
        placeholder="Concepto, proveedor o empleado…"
        extras={[
          { nombre: "categoria", etiqueta: "Categoría", opciones: opcionesCategoria, valor: categoria },
          { nombre: "actividad", etiqueta: "Actividad", opciones: OPCIONES_ACTIVIDAD, valor: actividad },
        ]}
      />
      {error ? (
        <p role="alert" className="aviso aviso-error">No se pudo cargar el listado.</p>
      ) : (
        <Tabla
          filas={filas}
          enlace={(fila) => `/finanzas/gastos/${fila.id}`}
          vacio="No hay gastos que coincidan con el filtro."
          columnas={[
            { clave: "concepto", etiqueta: "Concepto", celda: (f) => f.concepto },
            { clave: "destinatario", etiqueta: "Destinatario", celda: (f) => f.destinatario ?? "—" },
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
