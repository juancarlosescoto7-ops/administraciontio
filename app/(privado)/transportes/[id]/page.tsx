import { formatearDuracion } from "@/lib/duracion";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import type { Opcion } from "@/lib/catalogos/definiciones";
import { camposKmSalida, formatearKm } from "@/lib/flota/definiciones";
import { esUuid } from "@/lib/catalogos/presentacion";
import {
  ajustarDuracionTransporte,
  asignarRecursosTransporte,
  cancelarTransporte,
  editarTransporte,
  finalizarTransporte,
  iniciarTransporte,
  programarTransporte,
  reprogramarTransporte,
} from "@/lib/transportes/acciones";
import {
  accionesTransporte,
  camposCancelarTransporte,
  camposDuracionTransporte,
  camposEditarTransporte,
  camposFinalizarTransporte,
  camposRecursosTransporte,
  camposReprogramarTransporte,
  ETIQUETAS_ESTADO_TRANSPORTE,
} from "@/lib/transportes/definiciones";
import { formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/tipos-bd";
import { ResultadoServicio } from "@/components/bonos/resultado-servicio";
import { Cargando, Encabezado } from "@/components/encabezado";
import { InsigniaFinanciera } from "@/components/ambulancias/insignias";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioOperacion } from "@/components/finanzas/operaciones";
import { PreguntaSaldoAFavor } from "@/components/finanzas/pregunta-saldo";
import { Datos, ResumenImportes, Seccion } from "@/components/finanzas/resumen";
import { BotonAccion, Desplegable, Historial, InsigniaEstado, ListaAvisos } from "@/components/operaciones";

export default function PaginaTransporte({ params, searchParams }: PageProps<"/transportes/[id]">) {
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
  const { data: t } = await supabase.from("saldos_transportes").select("*").eq("id", id).maybeSingle();
  if (!t || !t.estado || !t.cliente_id || !t.inicio_previsto || !t.minutos_estimados) notFound();

  const finPrevisto = new Date(new Date(t.inicio_previsto).getTime() + t.minutos_estimados * 60000).toISOString();
  const sinIniciar = t.estado === "solicitado" || t.estado === "programado";
  const [{ data: saldo }, { data: recursos }, { data: avisos }, { data: historial }, { data: km }, { data: kmEsperado }] = await Promise.all([
    supabase.from("saldos_clientes").select("saldo_a_favor").eq("cliente_id", t.cliente_id).maybeSingle(),
    supabase.rpc("disponibilidad_recursos", {
      p_actividad: "transportes",
      p_inicio: t.inicio_previsto,
      p_fin: finPrevisto,
      p_origen_tipo: "transporte",
      p_origen_id: id,
    }),
    supabase.rpc("avisos_operacion", { p_origen_tipo: "transporte", p_origen_id: id }),
    supabase.rpc("historial_operacion", { p_entidad: "transportes", p_registro_id: id }),
    supabase.from("transportes").select("km_salida, km_llegada, motivo_descuadre_km").eq("id", id).maybeSingle(),
    // Lectura esperada al salir: la última llegada registrada del vehículo.
    sinIniciar && t.vehiculo_id
      ? supabase.rpc("kilometraje_vehiculo", { p_vehiculo_id: t.vehiculo_id })
      : Promise.resolve({ data: null }),
  ]);

  const acciones = accionesTransporte(t.estado, usuario.rol);
  const aFavor = Number(saldo?.saldo_a_favor ?? 0);
  const opciones = (tipo: string): Opcion[] =>
    (recursos ?? [])
      .filter((r) => r.recurso_tipo === tipo)
      .map((r) => ({ valor: r.recurso_id, etiqueta: r.disponible ? r.nombre : `${r.nombre} (ocupado: ${r.detalle})` }));
  const finEstimado = t.inicio_real
    ? new Date(new Date(t.inicio_real).getTime() + t.minutos_estimados * 60000).toISOString()
    : finPrevisto;

  return (
    <>
      <Encabezado
        titulo={`Transporte · ${t.cliente_nombre}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <InsigniaEstado estado={t.estado} etiquetas={ETIQUETAS_ESTADO_TRANSPORTE} atencion={["solicitado"]} finales={["completado", "cancelado"]} />
            <InsigniaFinanciera estado={t.estado_financiero} />
          </span>
        }
        volver={{ href: "/transportes", etiqueta: "Transportes" }}
        acciones={
          <Link href={`/transportes/${id}/contrato`} className="boton boton-secundario">
            Contrato
          </Link>
        }
      />
      <AvisoOperacion
        parametros={parametros}
        mensajes={{
          guardado: "Solicitud registrada.",
          gastos: "Bonos y gastos registrados.",
          programado: "Servicio programado.",
          recursos: "Recursos actualizados.",
          reprogramado: "Servicio reprogramado.",
          duracion: "Duración actualizada.",
          editado: "Datos actualizados.",
          iniciado: "Servicio iniciado.",
          completado: "Servicio completado.",
          aplicado: "Saldo a favor aplicado.",
          cancelado: "Servicio cancelado.",
        }}
      />
      <ListaAvisos avisos={avisos} />

      {(acciones.iniciar || acciones.programar) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {acciones.iniciar && (
            <Desplegable titulo="Iniciar servicio">
              <p className="mb-4 text-sm texto-tenue">
                Registre el kilometraje del vehículo al salir. Debe coincidir con su última llegada; si no, indique el motivo.
              </p>
              <FormularioOperacion
                campos={camposKmSalida(kmEsperado ?? null)}
                accion={iniciarTransporte.bind(null, id)}
                textoEnviar="Confirmar inicio"
                registro={{ km_salida: kmEsperado ?? null, motivo_descuadre_km: null }}
                prefijo="iniciar-"
                tono="exito"
              />
            </Desplegable>
          )}
          {acciones.programar && <BotonAccion accion={programarTransporte.bind(null, id)} texto="Programar" />}
        </div>
      )}

      <Seccion titulo="Datos del servicio">
        <Datos
          filas={[
            ["Cliente", <Link key="c" href={`/clientes/${t.cliente_id}`} className="text-enlace hover:underline">{t.cliente_nombre}</Link>],
            ["Origen", t.origen],
            ["Destino", t.destino],
            ["Observaciones", t.notas],
            ["Registrado", formatearFechaHora(t.created_at)],
            ...(t.estado === "cancelado"
              ? ([["Cancelado", formatearFechaHora(t.cancelado_en)], ["Motivo de cancelación", t.motivo_cancelacion]] as [string, string | null][])
              : []),
          ]}
        />
      </Seccion>

      <Seccion titulo="Horario y asignación">
        <Datos
          filas={[
            ["Programado para", formatearFechaHora(t.inicio_previsto)],
            ["Duración estimada", formatearDuracion(t.minutos_estimados)],
            [t.inicio_real ? "Fin estimado (desde el inicio real)" : "Fin estimado", formatearFechaHora(finEstimado)],
            ["Inicio real", formatearFechaHora(t.inicio_real)],
            ["Fin real", formatearFechaHora(t.fin_real)],
            [
              "Vehículo",
              t.vehiculo_id ? (
                <Link key="v" href={`/flota/${t.vehiculo_id}`} className="text-enlace hover:underline">{t.vehiculo_nombre}</Link>
              ) : (
                "Sin asignar"
              ),
            ],
            ["Conductor", t.conductor_nombre ?? "Sin asignar"],
            ...(km?.km_salida != null
              ? ([
                  ["Kilometraje de salida", formatearKm(km.km_salida)],
                  ["Kilometraje de llegada", formatearKm(km.km_llegada)],
                  ...(km.km_llegada != null ? ([["Recorrido", formatearKm(km.km_llegada - km.km_salida)]] as [string, string][]) : []),
                ] as [string, string][])
              : []),
            ...(km?.motivo_descuadre_km ? ([["Descuadre de kilometraje", km.motivo_descuadre_km]] as [string, string][]) : []),
            ...(t.notas_finales ? ([["Observaciones finales", t.notas_finales]] as [string, string][]) : []),
          ]}
        />
        {acciones.asignar && (
          <Desplegable titulo={t.vehiculo_id && t.conductor_id ? "Cambiar vehículo o conductor" : "Asignar vehículo y conductor"}>
            <p className="mb-4 text-sm texto-tenue">
              Se comprueba en la base que no tengan otro alquiler, traslado o transporte en ese horario. Deje vacío para quitar la asignación.
            </p>
            <FormularioOperacion
              campos={camposRecursosTransporte(opciones("vehiculo"), opciones("conductor"))}
              accion={asignarRecursosTransporte.bind(null, id)}
              textoEnviar="Guardar recursos"
              registro={{ vehiculo_id: t.vehiculo_id, conductor_id: t.conductor_id, motivo: null }}
              prefijo="recursos-"
            />
          </Desplegable>
        )}
        {acciones.reprogramar && (
          <Desplegable titulo="Reprogramar">
            <FormularioOperacion
              campos={camposReprogramarTransporte()}
              accion={reprogramarTransporte.bind(null, id)}
              textoEnviar="Reprogramar"
              registro={{ inicio: t.inicio_previsto, minutos: t.minutos_estimados, motivo: null }}
              prefijo="reprogramar-"
            />
          </Desplegable>
        )}
        {acciones.ajustarDuracion && (
          <Desplegable titulo="Ajustar la duración (servicio en curso)">
            <FormularioOperacion
              campos={camposDuracionTransporte()}
              accion={ajustarDuracionTransporte.bind(null, id)}
              textoEnviar="Guardar duración"
              registro={{ minutos: t.minutos_estimados, motivo: null }}
              prefijo="duracion-"
            />
          </Desplegable>
        )}
      </Seccion>

      <Seccion titulo="Cobros">
        <ResumenImportes
          importes={[
            { etiqueta: "Precio pactado", valor: t.precio_pactado ?? 0, ayuda: t.precio_pactado ? undefined : "Sin precio todavía" },
            { etiqueta: "Pagado", valor: t.aplicado },
            { etiqueta: "Pendiente", valor: t.pendiente, destacado: true, ayuda: t.cargo_id ? undefined : "El cargo se genera al completar" },
            { etiqueta: "Saldo a favor del cliente", valor: aFavor },
          ]}
        />
        <p className="mb-4 flex flex-wrap items-center gap-3">
          {t.cargo_id && (
            <Link href={`/finanzas/cargos/${t.cargo_id}`} className="text-sm text-enlace underline">
              Ver cargo
            </Link>
          )}
          {puede("registrarCobro", usuario.rol) && t.estado !== "cancelado" && (
            <Link href={`/finanzas/cobros/nuevo?cliente=${t.cliente_id}`} className="boton boton-secundario">
              {t.cargo_id ? "Registrar cobro" : "Registrar anticipo"}
            </Link>
          )}
        </p>
        {t.cargo_id && (
          <PreguntaSaldoAFavor
            cargoId={t.cargo_id}
            concepto="Transporte con conductor"
            vigente={t.cargo_estado === "vigente"}
            pendiente={t.pendiente}
            aFavor={aFavor}
            rol={usuario.rol}
            volver={`/transportes/${id}`}
            recienAplicado={parametros.aplicado === "1"}
          />
        )}
      </Seccion>

      <ResultadoServicio
        tipo="transporte"
        id={id}
        rol={usuario.rol}
        conductorId={t.conductor_id}
        estimado={t.estado === "cancelado" ? null : { monto: t.precio_pactado, nota: t.precio_pactado === null ? "Sin precio pactado todavía." : "Precio pactado: se convierte en cargo al completar el viaje." }}
        abierta={parametros.gastos === "1"}
        recomendacion={parametros.completado === "1" ? { titulo: "Viaje completado: resultado del servicio", parametro: "completado" } : null}
      />

      {acciones.finalizar && (
        <Seccion titulo="Finalizar">
          <div className="tarjeta p-4 sm:p-6">
            <p className="mb-4 text-sm">
              Genera un cargo de {formatearMoneda(t.precio_pactado)} al cliente y libera el vehículo y el conductor.
              {aFavor > 0 && ` Puede aplicar hasta ${formatearMoneda(Math.min(aFavor, Number(t.precio_pactado ?? 0)))} de su saldo a favor.`}
            </p>
            <FormularioOperacion
              campos={camposFinalizarTransporte(aFavor > 0, km?.km_salida ?? null)}
              accion={finalizarTransporte.bind(null, id, aFavor > 0)}
              textoEnviar="Finalizar servicio"
              tono="exito"
              prefijo="finalizar-"
            />
          </div>
        </Seccion>
      )}

      {(acciones.editar || acciones.cancelar) && (
        <Seccion titulo="Cambios">
          {acciones.editar && (
            <Desplegable titulo="Editar datos">
              <FormularioOperacion
                campos={camposEditarTransporte()}
                accion={editarTransporte.bind(null, id, t.tarifa_id)}
                textoEnviar="Guardar datos"
                registro={{ origen: t.origen, destino: t.destino, precio_pactado: t.precio_pactado, notas: t.notas }}
                prefijo="editar-"
              />
            </Desplegable>
          )}
          {acciones.cancelar && (
            <Desplegable titulo="Cancelar servicio" peligro>
              <p className="mb-4 text-sm texto-tenue">Libera el vehículo y el conductor. No genera cargo; los anticipos quedan como saldo a favor.</p>
              <FormularioOperacion campos={camposCancelarTransporte()} accion={cancelarTransporte.bind(null, id)} textoEnviar="Cancelar servicio" prefijo="cancelar-" tono="peligro" />
            </Desplegable>
          )}
        </Seccion>
      )}

      <Seccion titulo="Historial">
        <Historial eventos={historial} acciones={ACCIONES} describir={describir} />
      </Seccion>
    </>
  );
}

const ACCIONES: Record<string, string> = {
  registrar_transporte: "Solicitud registrada",
  programar_transporte: "Programado",
  asignar_recursos: "Recursos asignados",
  reprogramar_transporte: "Reprogramado",
  ajustar_duracion: "Duración ajustada",
  editar_transporte: "Datos editados",
  iniciar_transporte: "Iniciado",
  finalizar_transporte: "Completado",
  cancelar_transporte: "Cancelado",
};

function describir(accion: string, despues: Json): string | null {
  const d = (despues ?? {}) as Record<string, Json>;
  switch (accion) {
    case "reprogramar_transporte":
      return `Nueva hora: ${formatearFechaHora(String(d.inicio_previsto))} (${d.minutos_estimados} min).`;
    case "iniciar_transporte":
      return d.km_salida != null ? `Kilometraje de salida ${formatearKm(Number(d.km_salida))}.` : null;
    case "finalizar_transporte":
      return `${d.km_llegada != null ? `Llegada ${formatearKm(Number(d.km_llegada))}. ` : ""}Cargo generado${d.anticipo_aplicado ? `, saldo a favor aplicado ${formatearMoneda(String(d.anticipo_aplicado))}` : ""}.`;
    default:
      return null;
  }
}
