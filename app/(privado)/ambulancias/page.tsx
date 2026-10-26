import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { primerValor } from "@/lib/catalogos/presentacion";
import { filtroBusqueda } from "@/lib/catalogos/validacion";
import {
  ESTADOS_ACTIVOS,
  ESTADOS_LISTADO,
  ETIQUETAS_TIPO_TRASLADO,
  TIPOS_LISTADO,
  type EstadoTraslado,
} from "@/lib/ambulancias/definiciones";
import { LIMITE_LISTADO } from "@/lib/finanzas/consultas";
import { formatearFechaHora, momentoDesdeLocal } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import { FormularioFiltros, leerFiltros, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { Tabla } from "@/components/finanzas/tabla";
import { InsigniaCobertura, InsigniaTraslado } from "@/components/ambulancias/insignias";

export default function PaginaAmbulancias({ searchParams }: PageProps<"/ambulancias">) {
  return (
    <>
      <Encabezado
        titulo="Traslados de ambulancia"
        descripcion="Solicitudes, programación, ejecución y cobro de servicios cubiertos y particulares."
        acciones={
          <Suspense fallback={null}>
            <BotonNuevo />
          </Suspense>
        }
      />
      <Suspense fallback={<Cargando />}>
        <Listado searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BotonNuevo() {
  const usuario = await requerirUsuario();
  if (!puede("gestionarTraslados", usuario.rol)) return null;
  return (
    <Link href="/ambulancias/nuevo" className="boton boton-primario">
      Nueva solicitud
    </Link>
  );
}

async function Listado({ searchParams }: { searchParams: ParametrosBusqueda }) {
  await requerirUsuario();
  const parametros = await searchParams;
  const filtros = leerFiltros(parametros, ESTADOS_LISTADO);
  const tipoParametro = primerValor(parametros.tipo);
  const tipo = TIPOS_LISTADO.some((t) => t.valor === tipoParametro) ? tipoParametro! : "todos";
  const supabase = await createClient();

  // Los activos se ordenan por la próxima hora; el resto, del más reciente.
  const activos = filtros.estado === "activos";
  let consulta = supabase
    .from("saldos_traslados")
    .select("id, inicio_previsto, cliente_nombre, paciente, tipo, estado, condicion_cobertura, vehiculo_codigo, conductor_nombre, origen, destino")
    .order("inicio_previsto", { ascending: activos })
    .limit(LIMITE_LISTADO + 1);
  if (activos) consulta = consulta.in("estado", ESTADOS_ACTIVOS as EstadoTraslado[]);
  else if (filtros.estado !== "todos") consulta = consulta.eq("estado", filtros.estado as EstadoTraslado);
  if (tipo !== "todos") consulta = consulta.eq("tipo", tipo as "cubierto");
  if (filtros.busqueda) {
    consulta = consulta.or(filtroBusqueda(["cliente_nombre", "paciente", "origen", "destino", "vehiculo_codigo", "conductor_nombre"], filtros.busqueda));
  }
  // Rango por la fecha programada (día completo en Tegucigalpa).
  if (filtros.desde) consulta = consulta.gte("inicio_previsto", momentoDesdeLocal(`${filtros.desde}T00:00`));
  if (filtros.hasta) consulta = consulta.lte("inicio_previsto", momentoDesdeLocal(`${filtros.hasta}T23:59`));
  const { data, error } = await consulta;

  const filas = (data ?? []).slice(0, LIMITE_LISTADO).map((fila) => ({ ...fila, id: fila.id! }));
  return (
    <>
      <FormularioFiltros
        filtros={filtros}
        estados={ESTADOS_LISTADO}
        placeholder="Cliente, paciente, lugar, ambulancia…"
        extras={[{ nombre: "tipo", etiqueta: "Tipo", opciones: TIPOS_LISTADO, valor: tipo }]}
      />
      {error ? (
        <p role="alert" className="aviso aviso-error">No se pudo cargar el listado.</p>
      ) : (
        <Tabla
          filas={filas}
          enlace={(fila) => `/ambulancias/${fila.id}`}
          vacio="No hay traslados que coincidan con el filtro."
          columnas={[
            { clave: "fecha", etiqueta: "Fecha y hora", celda: (f) => formatearFechaHora(f.inicio_previsto) },
            { clave: "cliente", etiqueta: "Cliente", celda: (f) => f.cliente_nombre },
            { clave: "paciente", etiqueta: "Beneficiario o pasajero", celda: (f) => f.paciente ?? "—" },
            { clave: "tipo", etiqueta: "Tipo", celda: (f) => (f.tipo ? ETIQUETAS_TIPO_TRASLADO[f.tipo] : "—") },
            { clave: "estado", etiqueta: "Estado", celda: (f) => <InsigniaTraslado estado={f.estado} /> },
            { clave: "cobertura", etiqueta: "Cobertura", celda: (f) => <InsigniaCobertura condicion={f.condicion_cobertura} /> },
            { clave: "ambulancia", etiqueta: "Ambulancia", celda: (f) => f.vehiculo_codigo ?? "Sin asignar" },
            { clave: "conductor", etiqueta: "Conductor", celda: (f) => f.conductor_nombre ?? "Sin asignar" },
          ]}
        />
      )}
      {(data?.length ?? 0) > LIMITE_LISTADO && (
        <p className="mt-3 text-sm texto-tenue">Se muestran los primeros {LIMITE_LISTADO}; refine el filtro.</p>
      )}
    </>
  );
}
