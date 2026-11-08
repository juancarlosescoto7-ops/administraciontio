import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { filtroBusqueda } from "@/lib/catalogos/validacion";
import { registrarMantenimiento } from "@/lib/flota/acciones";
import {
  camposMantenimiento,
  estadoMantenimiento,
  ETIQUETAS_ORIGEN,
  FILTROS_RECORRIDOS,
  formatearDiferencia,
  formatearKm,
  OPCIONES_TIPO_MANTENIMIENTO,
  rutaOrigen,
  type OrigenRecorrido,
} from "@/lib/flota/definiciones";
import { aFechaHoraLocal, formatearFecha, formatearFechaHora, hoyEnTegucigalpa, momentoDesdeLocal } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import { FormularioFiltros, leerFiltros, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioOperacion } from "@/components/finanzas/operaciones";
import { Datos, Seccion } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";
import { InsigniaMantenimiento, InsigniaVehiculo } from "@/components/flota/insignias";
import { Desplegable } from "@/components/operaciones";

const LIMITE = 300;

export default function PaginaFlotaVehiculo({ params, searchParams }: PageProps<"/flota/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  const parametros = await searchParams;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const { data: v } = await supabase.from("resumen_flota").select("*").eq("vehiculo_id", id).maybeSingle();
  if (!v || !v.codigo) notFound();

  const filtros = leerFiltros(parametros, FILTROS_RECORRIDOS);
  let consulta = supabase
    .from("recorridos_vehiculo")
    .select("*")
    .eq("vehiculo_id", id)
    .order("salida", { ascending: false })
    .order("km_salida", { ascending: false })
    .limit(LIMITE + 1);
  if (filtros.estado === "descuadres") consulta = consulta.neq("diferencia", 0);
  if (filtros.estado === "mantenimientos") consulta = consulta.eq("origen_tipo", "mantenimiento");
  if (filtros.busqueda) consulta = consulta.or(filtroBusqueda(["detalle", "conductor_nombre", "motivo_descuadre_km"], filtros.busqueda));
  if (filtros.desde) consulta = consulta.gte("salida", momentoDesdeLocal(`${filtros.desde}T00:00`));
  if (filtros.hasta) consulta = consulta.lte("salida", momentoDesdeLocal(`${filtros.hasta}T23:59`));

  const [{ data: recorridos, error }, { data: mantenimientos }] = await Promise.all([
    consulta,
    supabase
      .from("mantenimientos_vehiculo")
      .select("id, tipo, descripcion, salida, regreso, km_salida, km_llegada, proximo_km, proxima_fecha, notas")
      .eq("vehiculo_id", id)
      .order("salida", { ascending: false })
      .limit(LIMITE),
  ]);

  const filas = (recorridos ?? []).slice(0, LIMITE).map((r) => ({ ...r, id: `${r.origen_tipo}-${r.origen_id}` }));
  const recorrido = filas.reduce((total, r) => total + (r.recorrido ?? 0), 0);
  const hoy = hoyEnTegucigalpa();
  const estado = estadoMantenimiento({ km_para_mantenimiento: v.km_para_mantenimiento, proxima_fecha: v.proxima_fecha }, hoy);
  const registra = puede("gestionarFlota", usuario.rol) && v.activo;
  const descuadres = v.descuadres ?? 0;

  return (
    <>
      <Encabezado
        titulo={`Flota · ${v.nombre}`}
        descripcion={v.placa ?? undefined}
        volver={{ href: "/flota", etiqueta: "Kilometraje y mantenimiento" }}
        acciones={
          <Link href={`/vehiculos/${id}`} className="boton boton-secundario">
            Ficha del vehículo
          </Link>
        }
      />
      <AvisoOperacion parametros={parametros} mensajes={{ mantenimiento: "Mantenimiento registrado." }} />
      {descuadres > 0 && (
        <p role="status" className="aviso aviso-error mb-4">
          {descuadres === 1 ? "1 recorrido no coincide" : `${descuadres} recorridos no coinciden`} con el kilometraje de llegada anterior.
          Use el filtro «Solo descuadres» para revisarlos.
        </p>
      )}

      <Seccion titulo="Situación">
        <Datos
          filas={[
            ["Estado operativo", <InsigniaVehiculo key="e" estado={v.estado} />],
            ["Kilometraje actual", v.km_actual === null ? "Sin registros todavía" : formatearKm(v.km_actual)],
            ["En recorrido", v.en_recorrido ? "Sí: falta registrar la llegada" : "No"],
            ["Último movimiento", formatearFechaHora(v.ultima_fecha)],
            ["Recorridos registrados", String(v.recorridos ?? 0)],
            ["Último mantenimiento", formatearFechaHora(v.ultimo_mantenimiento)],
            [
              "Próximo mantenimiento",
              <span key="p" className="inline-flex flex-wrap items-center gap-2">
                <InsigniaMantenimiento estado={estado} />
                {v.proximo_km !== null &&
                  `a los ${formatearKm(v.proximo_km)}${v.km_para_mantenimiento !== null && v.km_para_mantenimiento > 0 ? ` (faltan ${formatearKm(v.km_para_mantenimiento)})` : ""}`}
                {v.proximo_km !== null && v.proxima_fecha && " o "}
                {v.proxima_fecha && `el ${formatearFecha(v.proxima_fecha)}`}
              </span>,
            ],
          ]}
        />
        {registra && (
          <Desplegable titulo="Registrar mantenimiento">
            <p className="mb-4 text-sm texto-tenue">
              Regístrelo cuando el vehículo regrese del taller. El kilometraje de salida debe coincidir con la última llegada; el trayecto
              al taller entra en el cuadre. El costo se registra aparte en Gastos (categoría Mantenimiento).
            </p>
            <FormularioOperacion
              campos={camposMantenimiento(v.en_recorrido ? null : v.km_actual, aFechaHoraLocal(new Date()))}
              accion={registrarMantenimiento.bind(null, id)}
              textoEnviar="Registrar mantenimiento"
              prefijo="mantenimiento-"
              tono="exito"
            />
          </Desplegable>
        )}
      </Seccion>

      <Seccion titulo="Cuadre de kilometraje">
        <p className="mb-3 text-sm texto-tenue">
          Del más reciente al más antiguo. «Diferencia» compara la salida con la llegada del movimiento anterior: debe ser cero.
        </p>
        <FormularioFiltros filtros={filtros} estados={FILTROS_RECORRIDOS} placeholder="Servicio, cliente, conductor o motivo…" />
        {error ? (
          <p role="alert" className="aviso aviso-error">No se pudo cargar el informe.</p>
        ) : (
          <Tabla
            filas={filas}
            enlace={(r) => rutaOrigen(r.origen_tipo, r.origen_id)}
            vacio="No hay recorridos que coincidan con el filtro."
            columnas={[
              { clave: "salida", etiqueta: "Salida", celda: (r) => formatearFechaHora(r.salida) },
              {
                clave: "movimiento",
                etiqueta: "Movimiento",
                celda: (r) => (
                  <span className="flex flex-col">
                    <span>{ETIQUETAS_ORIGEN[r.origen_tipo as OrigenRecorrido] ?? r.origen_tipo}</span>
                    <span className="text-sm texto-tenue">{r.detalle}</span>
                  </span>
                ),
              },
              { clave: "conductor", etiqueta: "Conductor", celda: (r) => r.conductor_nombre ?? "—" },
              { clave: "anterior", etiqueta: "Llegada anterior", numerica: true, celda: (r) => formatearKm(r.km_anterior) },
              { clave: "km_salida", etiqueta: "Km salida", numerica: true, celda: (r) => formatearKm(r.km_salida) },
              {
                clave: "diferencia",
                etiqueta: "Diferencia",
                numerica: true,
                celda: (r) =>
                  r.diferencia ? (
                    <span className="flex flex-col items-end gap-1">
                      <span className="insignia insignia-peligro">{formatearDiferencia(r.diferencia)}</span>
                      {r.motivo_descuadre_km && <span className="text-sm texto-tenue">{r.motivo_descuadre_km}</span>}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              {
                clave: "km_llegada",
                etiqueta: "Km llegada",
                numerica: true,
                celda: (r) => (r.km_llegada === null ? "En recorrido" : formatearKm(r.km_llegada)),
              },
              { clave: "recorrido", etiqueta: "Recorrido", numerica: true, celda: (r) => formatearKm(r.recorrido) },
            ]}
            totales={{ recorrido: formatearKm(recorrido) }}
          />
        )}
        {(recorridos?.length ?? 0) > LIMITE && (
          <p className="mt-3 text-sm texto-tenue">Se muestran los primeros {LIMITE}; use las fechas para acotar.</p>
        )}
      </Seccion>

      <Seccion titulo="Mantenimientos">
        <Tabla
          filas={mantenimientos ?? []}
          vacio="Sin mantenimientos registrados."
          columnas={[
            { clave: "fecha", etiqueta: "Salida al taller", celda: (m) => formatearFechaHora(m.salida) },
            {
              clave: "trabajo",
              etiqueta: "Trabajo",
              celda: (m) => (
                <span className="flex flex-col">
                  <span>
                    {OPCIONES_TIPO_MANTENIMIENTO.find((o) => o.valor === m.tipo)?.etiqueta ?? m.tipo}: {m.descripcion}
                  </span>
                  {m.notas && <span className="text-sm texto-tenue">{m.notas}</span>}
                </span>
              ),
            },
            { clave: "regreso", etiqueta: "Regreso", celda: (m) => formatearFechaHora(m.regreso) },
            { clave: "km", etiqueta: "Kilometraje", numerica: true, celda: (m) => `${formatearKm(m.km_salida)} → ${formatearKm(m.km_llegada)}` },
            {
              clave: "proximo",
              etiqueta: "Próximo",
              celda: (m) =>
                [m.proximo_km !== null && formatearKm(m.proximo_km), m.proxima_fecha && formatearFecha(m.proxima_fecha)].filter(Boolean).join(" o ") ||
                "—",
            },
          ]}
        />
      </Seccion>
    </>
  );
}
