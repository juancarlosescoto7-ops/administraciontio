import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { ETIQUETAS_CLASE, OPCIONES_CLASE, type ClaseBien } from "@/lib/bienes/definiciones";
import type { Opcion } from "@/lib/catalogos/definiciones";
import { primerValor } from "@/lib/catalogos/presentacion";
import { filtroBusqueda } from "@/lib/catalogos/validacion";
import { LIMITE_LISTADO } from "@/lib/finanzas/consultas";
import { sumarMontos } from "@/lib/finanzas/montos";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { ActualizarDepreciacionesAlAbrir } from "@/components/bienes/actualizar";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { FormularioFiltros, leerFiltros, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { InsigniaFinanciera, ResumenImportes } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";

const ESTADOS = [
  { valor: "activos", etiqueta: "En uso" },
  { valor: "por_pagar", etiqueta: "Con saldo por pagar" },
  { valor: "bajas", etiqueta: "Dados de baja" },
  { valor: "anulados", etiqueta: "Anulados" },
  { valor: "todos", etiqueta: "Todos" },
];

const OPCIONES_CLASE_FILTRO: readonly Opcion[] = [{ valor: "todas", etiqueta: "Todas" }, ...OPCIONES_CLASE];

export default function PaginaBienes({ searchParams }: PageProps<"/finanzas/bienes">) {
  return (
    <>
      <Encabezado
        titulo="Bienes de la empresa"
        descripcion="Vehículos, terrenos, edificios, mobiliario y equipo. Aparecen en el estado de situación financiera; su depreciación mensual, en el estado de resultados."
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
  if (!puede("gestionarBienes", usuario)) return null;
  return (
    <Link href="/finanzas/bienes/nuevo" className="boton boton-primario">
      Registrar bien
    </Link>
  );
}

async function Listado({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("gestionarBienes", usuario)) {
    return <SinPermiso mensaje="Los bienes de la empresa los consultan el administrador y finanzas." />;
  }
  const parametros = await searchParams;
  const filtros = leerFiltros(parametros, ESTADOS);
  const claseParametro = primerValor(parametros.clase);
  const clase = OPCIONES_CLASE_FILTRO.some((c) => c.valor === claseParametro) ? claseParametro! : "todas";

  const supabase = await createClient();
  let consulta = supabase
    .from("saldos_bienes")
    .select("id, nombre, clase, vehiculo_nombre, fecha_registro, costo, depreciacion_acumulada, valor_en_libros, por_pagar, estado")
    .order("fecha_registro", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMITE_LISTADO + 1);
  if (filtros.estado === "activos") consulta = consulta.eq("estado", "activo");
  if (filtros.estado === "por_pagar") consulta = consulta.gt("por_pagar", 0);
  if (filtros.estado === "bajas") consulta = consulta.eq("estado", "dado_de_baja");
  if (filtros.estado === "anulados") consulta = consulta.eq("estado", "anulado");
  if (clase !== "todas") consulta = consulta.eq("clase", clase as ClaseBien);
  if (filtros.busqueda) consulta = consulta.or(filtroBusqueda(["nombre", "descripcion", "vehiculo_nombre"], filtros.busqueda));
  if (filtros.desde) consulta = consulta.gte("fecha_registro", filtros.desde);
  if (filtros.hasta) consulta = consulta.lte("fecha_registro", filtros.hasta);

  // Totales de todos los bienes en uso (no solo de la página filtrada).
  const [{ data, error }, { data: enUso }] = await Promise.all([
    consulta,
    supabase.from("saldos_bienes").select("costo, depreciacion_acumulada, valor_en_libros, por_pagar, estado").neq("estado", "anulado"),
  ]);
  const activos = (enUso ?? []).filter((b) => b.estado === "activo");
  const filas = (data ?? []).slice(0, LIMITE_LISTADO).map((f) => ({ ...f, id: f.id! }));
  const enUsoFilas = filas.filter((f) => f.estado === "activo");

  return (
    <>
      <ActualizarDepreciacionesAlAbrir />
      <ResumenImportes
        importes={[
          { etiqueta: "Costo de los bienes en uso", valor: sumarMontos(activos.map((b) => b.costo)) },
          { etiqueta: "Depreciación acumulada", valor: sumarMontos(activos.map((b) => b.depreciacion_acumulada)) },
          { etiqueta: "Valor en libros", valor: sumarMontos(activos.map((b) => b.valor_en_libros)), destacado: true },
          { etiqueta: "Por pagar por compras", valor: sumarMontos((enUso ?? []).map((b) => b.por_pagar)) },
        ]}
      />
      <FormularioFiltros
        filtros={filtros}
        estados={ESTADOS}
        placeholder="Nombre, descripción o vehículo…"
        extras={[{ nombre: "clase", etiqueta: "Clase", opciones: OPCIONES_CLASE_FILTRO, valor: clase }]}
      />
      {error ? (
        <p role="alert" className="aviso aviso-error">No se pudo cargar el listado.</p>
      ) : (
        <Tabla
          filas={filas}
          enlace={(f) => `/finanzas/bienes/${f.id}`}
          vacio="No hay bienes que coincidan con el filtro."
          columnas={[
            { clave: "nombre", etiqueta: "Bien", celda: (f) => f.nombre },
            { clave: "clase", etiqueta: "Clase", celda: (f) => (f.clase ? ETIQUETAS_CLASE[f.clase] : "—") },
            { clave: "fecha", etiqueta: "Registro", celda: (f) => formatearFecha(f.fecha_registro) },
            { clave: "costo", etiqueta: "Costo", numerica: true, celda: (f) => formatearMoneda(f.costo) },
            { clave: "depreciacion", etiqueta: "Depreciación", numerica: true, celda: (f) => formatearMoneda(f.depreciacion_acumulada) },
            { clave: "libros", etiqueta: "Valor en libros", numerica: true, celda: (f) => formatearMoneda(f.valor_en_libros) },
            { clave: "por_pagar", etiqueta: "Por pagar", numerica: true, celda: (f) => formatearMoneda(f.por_pagar) },
            { clave: "estado", etiqueta: "Estado", celda: (f) => <InsigniaFinanciera estado={f.estado} /> },
          ]}
          totales={{
            costo: formatearMoneda(sumarMontos(enUsoFilas.map((f) => f.costo))),
            libros: formatearMoneda(sumarMontos(filas.map((f) => f.valor_en_libros))),
            por_pagar: formatearMoneda(sumarMontos(filas.map((f) => f.por_pagar))),
          }}
        />
      )}
      {(data?.length ?? 0) > LIMITE_LISTADO && (
        <p className="mt-3 text-sm texto-tenue">Se muestran los primeros {LIMITE_LISTADO}; refine el filtro.</p>
      )}
    </>
  );
}
