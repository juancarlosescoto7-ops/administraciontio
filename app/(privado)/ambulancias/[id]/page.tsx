import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { requerirUsuario } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import type { Opcion } from "@/lib/catalogos/definiciones";
import { camposKmSalida, formatearKm } from "@/lib/flota/definiciones";
import { esUuid } from "@/lib/catalogos/presentacion";
import {
  ajustarDuracion,
  asignarRecursos,
  cancelarTraslado,
  convertirAParticular,
  editarTraslado,
  finalizarTraslado,
  iniciarTraslado,
  programarTraslado,
  reprogramarTraslado,
  revalidarCobertura,
  revertirConsumo,
} from "@/lib/ambulancias/acciones";
import {
  accionesDisponibles,
  camposCancelar,
  camposConvertir,
  camposDuracion,
  camposEditar,
  camposFinalizar,
  camposRecursos,
  camposReprogramar,
  ETIQUETAS_RESERVA,
  ETIQUETAS_TIPO_TRASLADO,
} from "@/lib/ambulancias/definiciones";
import { aFechaHoraLocal, formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/tipos-bd";
import { ResultadoServicio } from "@/components/bonos/resultado-servicio";
import { Cargando, Encabezado } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioOperacion } from "@/components/finanzas/operaciones";
import { PreguntaSaldoAFavor } from "@/components/finanzas/pregunta-saldo";
import { Datos, ResumenImportes, Seccion } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";
import { InsigniaCobertura, InsigniaFinanciera, InsigniaTraslado } from "@/components/ambulancias/insignias";
import { BotonAccion, Desplegable, Historial, ListaAvisos } from "@/components/operaciones";

export default function PaginaTraslado({ params, searchParams }: PageProps<"/ambulancias/[id]">) {
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
  const { data: t } = await supabase.from("saldos_traslados").select("*").eq("id", id).maybeSingle();
  if (!t || !t.estado || !t.tipo || !t.cliente_id || !t.inicio_previsto || !t.minutos_estimados) notFound();

  const sinIniciar = t.estado === "solicitado" || t.estado === "programado";
  const [{ data: reservas }, { data: saldo }, { data: recursos }, { data: avisos }, { data: historial }, { data: membresia }, { data: km }, { data: kmEsperado }] =
    await Promise.all([
    supabase
      .from("reservas_beneficio")
      .select("id, estado, periodo_inicio, periodo_id, fecha_servicio, motivo_liberacion, created_at, consumida_en, liberada_en")
      .eq("traslado_id", id)
      .order("created_at"),
    supabase.from("saldos_clientes").select("saldo_a_favor").eq("cliente_id", t.cliente_id).maybeSingle(),
    supabase.rpc("recursos_disponibles", { p_inicio: t.inicio_previsto, p_minutos: t.minutos_estimados, p_traslado_id: id }),
    supabase.rpc("avisos_traslado", { p_traslado_id: id }),
    supabase.rpc("historial_traslado", { p_traslado_id: id }),
    t.membresia_id
      ? supabase.from("saldos_membresias").select("id, plan_nombre, estado").eq("id", t.membresia_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("traslados_ambulancia").select("km_salida, km_llegada, motivo_descuadre_km").eq("id", id).maybeSingle(),
    // Lectura esperada al salir: la última llegada registrada de la ambulancia.
    sinIniciar && t.vehiculo_id
      ? supabase.rpc("kilometraje_vehiculo", { p_vehiculo_id: t.vehiculo_id })
      : Promise.resolve({ data: null }),
  ]);

  const acciones = accionesDisponibles({ estado: t.estado, tipo: t.tipo, reservaEstado: t.reserva_estado }, usuario);
  const particular = t.tipo === "particular";
  const aFavor = Number(saldo?.saldo_a_favor ?? 0);
  const opciones = (tipo: string): Opcion[] =>
    (recursos ?? [])
      .filter((r) => r.recurso_tipo === tipo)
      .map((r) => ({ valor: r.recurso_id, etiqueta: r.disponible ? r.nombre : `${r.nombre} (ocupado: ${r.detalle})` }));
  const finEstimado = new Date(new Date(t.inicio_real ?? t.inicio_previsto).getTime() + t.minutos_estimados * 60000).toISOString();

  return (
    <>
      <Encabezado
        titulo={`Traslado · ${t.paciente ?? t.cliente_nombre}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <InsigniaTraslado estado={t.estado} />
            <span>{ETIQUETAS_TIPO_TRASLADO[t.tipo]}</span>
            {t.tipo === "cubierto" && <InsigniaCobertura condicion={t.condicion_cobertura} />}
          </span>
        }
        volver={{ href: "/ambulancias", etiqueta: "Traslados" }}
        acciones={
          <Link href={`/ambulancias/${id}/contrato`} className="boton boton-secundario">
            Contrato
          </Link>
        }
      />
      <AvisoOperacion
        parametros={parametros}
        mensajes={{
          guardado: "Solicitud registrada.",
          gastos: "Bonos y gastos registrados.",
          programado: "Traslado programado.",
          recursos: "Recursos actualizados.",
          reprogramado: "Traslado reprogramado.",
          duracion: "Duración actualizada.",
          editado: "Datos actualizados.",
          revalidado: "Cobertura revalidada.",
          iniciado: "Traslado iniciado.",
          completado: "Traslado completado.",
          aplicado: "Saldo a favor aplicado.",
          cancelado: "Traslado cancelado.",
          convertido: "El traslado pasó a ser particular.",
          revertido: "Beneficio devuelto al período.",
        }}
      />
      {parametros.sin_cobertura === "1" && (
        <p role="alert" className="aviso aviso-advertencia mb-4">
          No se inició: el traslado no tiene cobertura válida ({t.motivo_cobertura}). Puede revalidar cuando se restablezca o, con la
          aceptación del cliente, pasarlo a particular.
        </p>
      )}
      <ListaAvisos avisos={avisos} />

      {(acciones.programar || acciones.iniciar || acciones.revalidar) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {acciones.iniciar && (
            <Desplegable titulo="Iniciar traslado">
              <p className="mb-4 text-sm texto-tenue">
                Registre el kilometraje de la ambulancia al salir. Ya viene la última llegada registrada; si el odómetro marca otra
                cifra, corríjala e indique el motivo.
              </p>
              <FormularioOperacion
                campos={camposKmSalida(kmEsperado ?? null)}
                accion={iniciarTraslado.bind(null, id)}
                textoEnviar="Confirmar inicio"
                registro={{ km_salida: kmEsperado ?? null, motivo_descuadre_km: null }}
                prefijo="iniciar-"
                tono="exito"
              />
            </Desplegable>
          )}
          {acciones.programar && <BotonAccion accion={programarTraslado.bind(null, id)} texto="Programar" />}
          {acciones.revalidar && <BotonAccion accion={revalidarCobertura.bind(null, id)} texto="Revalidar cobertura" />}
        </div>
      )}

      <Seccion titulo="Datos del servicio">
        <Datos
          filas={[
            ["Cliente", <Link key="c" href={`/clientes/${t.cliente_id}`} className="text-enlace hover:underline">{t.cliente_nombre}</Link>],
            [particular ? "Beneficiario o pasajero" : "Beneficiario", t.paciente],
            ...(membresia
              ? ([["Membresía", <Link key="m" href={`/membresias/${membresia.id}`} className="text-enlace hover:underline">{membresia.plan_nombre}</Link>]] as [string, ReactNode][])
              : []),
            ["Origen", t.origen],
            ["Destino", t.destino ?? "Sin indicar (se exige para iniciar)"],
            ["Motivo o descripción", t.motivo],
            ["Observaciones", t.notas],
            ["Registrado", formatearFechaHora(t.created_at)],
            ...(t.estado === "cancelado"
              ? ([["Cancelado", formatearFechaHora(t.cancelado_en)], ["Motivo de cancelación", t.motivo_cancelacion]] as [string, string | null][])
              : []),
          ]}
        />
      </Seccion>

      <Seccion titulo="Horario y recursos">
        <Datos
          filas={[
            ["Programado para", formatearFechaHora(t.inicio_previsto)],
            ["Duración estimada", `${t.minutos_estimados} minutos`],
            [t.inicio_real ? "Fin estimado (desde el inicio real)" : "Fin estimado", formatearFechaHora(finEstimado)],
            ["Inicio real", formatearFechaHora(t.inicio_real)],
            ["Fin real", formatearFechaHora(t.fin_real)],
            [
              "Ambulancia",
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
          <Desplegable titulo={t.vehiculo_id && t.conductor_id ? "Cambiar ambulancia o conductor" : "Asignar ambulancia y conductor"}>
            <p className="mb-4 text-sm texto-tenue">
              Se comprueba en la base que no tengan otro servicio en ese horario. Deje vacío para quitar la asignación.
            </p>
            <FormularioOperacion
              campos={camposRecursos(opciones("vehiculo"), opciones("conductor"))}
              accion={asignarRecursos.bind(null, id)}
              textoEnviar="Guardar recursos"
              registro={{ vehiculo_id: t.vehiculo_id, conductor_id: t.conductor_id, motivo: null }}
              prefijo="recursos-"
            />
          </Desplegable>
        )}
        {acciones.reprogramar && (
          <Desplegable titulo="Reprogramar">
            <p className="mb-4 text-sm texto-tenue">
              Vuelve a comprobar los recursos asignados y la cobertura del período de la nueva fecha. No mueve otros servicios.
            </p>
            <FormularioOperacion
              campos={camposReprogramar(aFechaHoraLocal(t.inicio_previsto))}
              accion={reprogramarTraslado.bind(null, id)}
              textoEnviar="Reprogramar"
              registro={{ inicio: t.inicio_previsto, minutos: t.minutos_estimados, motivo: null }}
              prefijo="reprogramar-"
            />
          </Desplegable>
        )}
        {acciones.ajustarDuracion && (
          <Desplegable titulo="Ajustar la duración (servicio en curso)">
            <FormularioOperacion
              campos={camposDuracion()}
              accion={ajustarDuracion.bind(null, id)}
              textoEnviar="Guardar duración"
              registro={{ minutos: t.minutos_estimados, motivo: null }}
              prefijo="duracion-"
            />
          </Desplegable>
        )}
      </Seccion>

      {t.tipo === "cubierto" && (
        <Seccion titulo="Cobertura">
          <Datos
            filas={[
              ["Condición", <InsigniaCobertura key="c" condicion={t.condicion_cobertura} />],
              ["Detalle", t.motivo_cobertura ?? (t.condicion_cobertura === "valida" ? "Beneficio reservado en el período de la fecha del servicio." : null)],
              ["Beneficio", t.reserva_estado ? ETIQUETAS_RESERVA[t.reserva_estado] : "Sin reserva"],
            ]}
          />
          <Tabla
            filas={reservas ?? []}
            vacio="Sin reservas: el traslado no ha tenido cobertura válida."
            columnas={[
              { clave: "creada", etiqueta: "Registrada", celda: (r) => formatearFechaHora(r.created_at) },
              { clave: "periodo", etiqueta: "Período", celda: (r) => `${formatearFecha(r.periodo_inicio)}${r.periodo_id ? "" : " (provisional)"}` },
              { clave: "estado", etiqueta: "Estado", celda: (r) => ETIQUETAS_RESERVA[r.estado] },
              { clave: "detalle", etiqueta: "Detalle", celda: (r) => r.motivo_liberacion ?? (r.consumida_en ? `Consumido el ${formatearFechaHora(r.consumida_en)}` : "—") },
            ]}
          />
        </Seccion>
      )}

      <Seccion titulo="Datos financieros">
        {particular ? (
          <>
            <ResumenImportes
              importes={[
                { etiqueta: "Precio pactado", valor: t.precio_pactado ?? 0, ayuda: t.precio_pactado ? undefined : "Sin precio todavía" },
                { etiqueta: "Pagado", valor: t.aplicado },
                { etiqueta: "Pendiente", valor: t.pendiente, destacado: true },
                { etiqueta: "Saldo a favor del cliente", valor: aFavor },
              ]}
            />
            <p className="mb-4 flex flex-wrap items-center gap-3">
              <InsigniaFinanciera estado={t.estado_financiero} />
              {t.cargo_id && (
                <Link href={`/finanzas/cargos/${t.cargo_id}`} className="text-sm text-enlace underline">
                  Ver cargo
                </Link>
              )}
              {puede("registrarCobro", usuario) && t.estado !== "cancelado" && (
                <Link href={`/finanzas/cobros/nuevo?cliente=${t.cliente_id}`} className="boton boton-secundario">
                  {t.cargo_id ? "Registrar cobro" : "Registrar anticipo"}
                </Link>
              )}
            </p>
            {t.cargo_id && (
              <PreguntaSaldoAFavor
                cargoId={t.cargo_id}
                concepto="Traslado de ambulancia particular"
                vigente={t.cargo_estado === "vigente"}
                pendiente={t.pendiente}
                aFavor={aFavor}
                rol={usuario}
                volver={`/ambulancias/${id}`}
                recienAplicado={parametros.aplicado === "1"}
              />
            )}
            {!t.cargo_id && t.estado !== "cancelado" && (
              <p className="text-sm texto-tenue">El cargo se genera al completar el servicio, por el precio pactado. Los anticipos quedan como saldo a favor.</p>
            )}
            {t.estado === "cancelado" && aFavor > 0 && (
              <p className="text-sm texto-tenue">El dinero recibido sigue como saldo a favor del cliente hasta que se aplique o se devuelva.</p>
            )}
          </>
        ) : (
          <p className="aviso aviso-info text-sm">Cubierto por la membresía: no genera cargo. El ingreso es la mensualidad.</p>
        )}
      </Seccion>

      <ResultadoServicio
        tipo="traslado"
        id={id}
        rol={usuario}
        conductorId={t.conductor_id}
        estimado={
          t.estado === "cancelado"
            ? null
            : t.tipo === "cubierto"
              ? { monto: 0, nota: "Traslado cubierto por la membresía: su ingreso está en las cuotas." }
              : { monto: t.precio_pactado, nota: "Precio pactado: se convierte en cargo al finalizar el traslado." }
        }
        abierta={parametros.gastos === "1"}
        recomendacion={parametros.completado === "1" ? { titulo: "Traslado finalizado: resultado del servicio", parametro: "completado" } : null}
      />

      {acciones.finalizar && (
        <Seccion titulo="Finalizar">
          <div className="tarjeta p-4 sm:p-6">
            <p className="mb-4 text-sm">
              {particular
                ? `Genera un cargo de ${formatearMoneda(t.precio_pactado)} al cliente${aFavor > 0 ? `; puede aplicar hasta ${formatearMoneda(Math.min(aFavor, Number(t.precio_pactado ?? 0)))} de su saldo a favor` : ""}.`
                : "Consume el beneficio reservado de la membresía. No genera cargo."}
            </p>
            <FormularioOperacion
              campos={camposFinalizar(particular && aFavor > 0, km?.km_salida ?? null)}
              accion={finalizarTraslado.bind(null, id, particular && aFavor > 0)}
              textoEnviar="Finalizar traslado"
              tono="exito"
              prefijo="finalizar-"
            />
          </div>
        </Seccion>
      )}

      {(acciones.editar || acciones.convertir || acciones.cancelar || acciones.revertirConsumo) && (
        <Seccion titulo="Cambios y correcciones">
          {acciones.editar && (
            <Desplegable titulo="Editar datos">
              <FormularioOperacion
                campos={camposEditar(t.tipo)}
                accion={editarTraslado.bind(null, id, t.tipo, t.tarifa_id)}
                textoEnviar="Guardar datos"
                registro={{ origen: t.origen, destino: t.destino, motivo: t.motivo, pasajero: t.pasajero, precio_pactado: t.precio_pactado, notas: t.notas }}
                prefijo="editar-"
              />
            </Desplegable>
          )}
          {acciones.convertir && (
            <Desplegable titulo="Pasar a servicio particular">
              <p className="mb-4 text-sm texto-tenue">
                Solo con la aceptación del cliente. Libera la reserva del beneficio; el historial de cobertura se conserva.
              </p>
              <FormularioOperacion campos={camposConvertir()} accion={convertirAParticular.bind(null, id)} textoEnviar="Pasar a particular" prefijo="convertir-" />
            </Desplegable>
          )}
          {acciones.cancelar && (
            <Desplegable titulo="Cancelar traslado" peligro>
              <p className="mb-4 text-sm texto-tenue">Libera la ambulancia, el conductor y la reserva del beneficio. No genera cargo.</p>
              <FormularioOperacion
                campos={camposCancelar("Confirmo la cancelación del traslado")}
                accion={cancelarTraslado.bind(null, id)}
                textoEnviar="Cancelar traslado"
                prefijo="cancelar-"
                tono="peligro"
              />
            </Desplegable>
          )}
          {acciones.revertirConsumo && (
            <Desplegable titulo="Devolver el beneficio consumido (corrección)" peligro>
              <p className="mb-4 text-sm texto-tenue">
                Para un traslado registrado como cubierto por error. Los importes se corrigen con los reversos de Finanzas.
              </p>
              <FormularioOperacion
                campos={camposCancelar("Confirmo devolver el beneficio al período")}
                accion={revertirConsumo.bind(null, id)}
                textoEnviar="Devolver beneficio"
                prefijo="revertir-"
                tono="peligro"
              />
            </Desplegable>
          )}
        </Seccion>
      )}

      <Seccion titulo="Historial">
        <Historial eventos={historial} acciones={ACCIONES} describir={describirEvento} />
      </Seccion>
    </>
  );
}

const ACCIONES: Record<string, string> = {
  registrar_traslado: "Solicitud registrada",
  programar_traslado: "Programado",
  asignar_recursos: "Recursos asignados",
  reprogramar_traslado: "Reprogramado",
  ajustar_duracion: "Duración ajustada",
  editar_traslado: "Datos editados",
  cambio_cobertura: "Cambio de cobertura",
  iniciar_traslado: "Iniciado",
  finalizar_traslado: "Completado",
  cancelar_traslado: "Cancelado",
  convertir_a_particular: "Pasó a particular",
  revertir_consumo: "Beneficio devuelto (corrección)",
};

function describirEvento(accion: string, despues: Json): string | null {
  const d = (despues ?? {}) as Record<string, Json>;
  switch (accion) {
    case "cambio_cobertura":
      return `Nueva condición: ${String(d.condicion_cobertura).replace("_", " ")}.`;
    case "reprogramar_traslado":
      return `Nueva hora: ${formatearFechaHora(String(d.inicio_previsto))} (${d.minutos_estimados} min).`;
    case "iniciar_traslado":
      return d.km_salida != null ? `Kilometraje de salida ${formatearKm(Number(d.km_salida))}.` : null;
    case "finalizar_traslado":
      return (d.km_llegada != null ? `Llegada ${formatearKm(Number(d.km_llegada))}. ` : "") + (d.beneficio_consumido ? "Se consumió el beneficio de la membresía." : `Cargo generado${d.anticipo_aplicado ? `, saldo a favor aplicado ${formatearMoneda(String(d.anticipo_aplicado))}` : ""}.`);
    case "convertir_a_particular":
      return `Precio pactado: ${formatearMoneda(String(d.precio_pactado))}.`;
    default:
      return null;
  }
}
