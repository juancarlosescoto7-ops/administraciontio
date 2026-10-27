import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { filtroBusqueda } from "@/lib/catalogos/validacion";
import { LIMITE_LISTADO } from "@/lib/finanzas/consultas";
import { sumarMontos } from "@/lib/finanzas/montos";
import {
  ESTADOS_ACTIVOS_TRANSPORTE,
  ESTADOS_LISTADO_TRANSPORTE,
  ETIQUETAS_ESTADO_TRANSPORTE,
  type EstadoTransporte,
} from "@/lib/transportes/definiciones";
import { formatearFechaHora, formatearMoneda, momentoDesdeLocal } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import { InsigniaFinanciera } from "@/components/ambulancias/insignias";
import { FormularioFiltros, leerFiltros, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { Tabla } from "@/components/finanzas/tabla";
import { InsigniaEstado } from "@/components/operaciones";

export default function PaginaTransportes({ searchParams }: PageProps<"/transportes">) {
  return (
    <>
      <Encabezado
        titulo="Transporte con conductor"
        descripcion="Servicios de transporte. El cargo se genera al completar el servicio."
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
  if (!puede("gestionarTransportes", usuario.rol)) return null;
  return (
    <Link href="/transportes/nuevo" className="boton boton-primario">
      Nueva solicitud
    </Link>
  );
}

async function Listado({ searchParams }: { searchParams: ParametrosBusqueda }) {
  await requerirUsuario();
  const filtros = leerFiltros(await searchParams, ESTADOS_LISTADO_TRANSPORTE);
  const supabase = await createClient();

  const activos = filtros.estado === "activos";
  let consulta = supabase
    .from("saldos_transportes")
    .select("id, inicio_previsto, cliente_nombre, origen, destino, vehiculo_codigo, conductor_nombre, estado, precio_pactado, pendiente, estado_financiero")
    .order("inicio_previsto", { ascending: activos })
    .limit(LIMITE_LISTADO + 1);
  if (activos) consulta = consulta.in("estado", ESTADOS_ACTIVOS_TRANSPORTE as EstadoTransporte[]);
  else if (filtros.estado !== "todos") consulta = consulta.eq("estado", filtros.estado as EstadoTransporte);
  if (filtros.busqueda) {
    consulta = consulta.or(filtroBusqueda(["cliente_nombre", "origen", "destino", "vehiculo_codigo", "conductor_nombre"], filtros.busqueda));
  }
  if (filtros.desde) consulta = consulta.gte("inicio_previsto", momentoDesdeLocal(`${filtros.desde}T00:00`));
  if (filtros.hasta) consulta = consulta.lte("inicio_previsto", momentoDesdeLocal(`${filtros.hasta}T23:59`));
  const { data, error } = await consulta;

  const filas = (data ?? []).slice(0, LIMITE_LISTADO).map((fila) => ({ ...fila, id: fila.id! }));
  return (
    <>
      <FormularioFiltros filtros={filtros} estados={ESTADOS_LISTADO_TRANSPORTE} placeholder="Cliente, lugar, vehículo o conductor…" />
      {error ? (
        <p role="alert" className="aviso aviso-error">No se pudo cargar el listado.</p>
      ) : (
        <Tabla
          filas={filas}
          enlace={(fila) => `/transportes/${fila.id}`}
          vacio="No hay servicios que coincidan con el filtro."
          columnas={[
            { clave: "fecha", etiqueta: "Fecha y hora", celda: (f) => formatearFechaHora(f.inicio_previsto) },
            { clave: "cliente", etiqueta: "Cliente", celda: (f) => f.cliente_nombre },
            { clave: "ruta", etiqueta: "Origen → destino", celda: (f) => `${f.origen} → ${f.destino}` },
            { clave: "vehiculo", etiqueta: "Vehículo", celda: (f) => f.vehiculo_codigo ?? "Sin asignar" },
            { clave: "conductor", etiqueta: "Conductor", celda: (f) => f.conductor_nombre ?? "Sin asignar" },
            {
              clave: "estado",
              etiqueta: "Estado",
              celda: (f) => (
                <InsigniaEstado estado={f.estado} etiquetas={ETIQUETAS_ESTADO_TRANSPORTE} atencion={["solicitado"]} finales={["completado", "cancelado"]} />
              ),
            },
            { clave: "importe", etiqueta: "Importe", numerica: true, celda: (f) => formatearMoneda(f.precio_pactado) },
            { clave: "financiero", etiqueta: "Cobro", celda: (f) => <InsigniaFinanciera estado={f.estado_financiero} /> },
          ]}
          totales={{ importe: formatearMoneda(sumarMontos(filas.map((f) => f.precio_pactado))) }}
        />
      )}
      {(data?.length ?? 0) > LIMITE_LISTADO && (
        <p className="mt-3 text-sm texto-tenue">Se muestran los primeros {LIMITE_LISTADO}; refine el filtro.</p>
      )}
    </>
  );
}
