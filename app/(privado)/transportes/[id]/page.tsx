import { formatearDuracion } from "@/lib/duracion";
import { GastosServicio } from "@/components/finanzas/gastos-servicio";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import type { Opcion } from "@/lib/catalogos/definiciones";
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
import { Cargando, Encabezado } from "@/components/encabezado";
import { InsigniaFinanciera } from "@/components/ambulancias/insignias";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioOperacion } from "@/components/finanzas/operaciones";
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
  const [{ data: saldo }, { data: recursos }, { data: avisos }, { data: historial }] = await Promise.all([
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
      />
      <AvisoOperacion
        parametros={parametros}
        mensajes={{
          guardado: "Solicitud registrada.",
          programado: "Servicio programado.",
          recursos: "Recursos actualizados.",
          reprogramado: "Servicio reprogramado.",
          duracion: "Duración actualizada.",
          editado: "Datos actualizados.",
          iniciado: "Servicio iniciado.",
          completado: "Servicio completado.",
          cancelado: "Servicio cancelado.",
        }}
      />
      <ListaAvisos avisos={avisos} />

      {(acciones.iniciar || acciones.programar) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {acciones.iniciar && <BotonAccion accion={iniciarTransporte.bind(null, id)} texto="Iniciar servicio" />}
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
            ["Vehículo", t.vehiculo_codigo ?? "Sin asignar"],
            ["Conductor", t.conductor_nombre ?? "Sin asignar"],
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
      </Seccion>

      {acciones.finalizar && (
        <Seccion titulo="Finalizar">
          <div className="tarjeta p-4 sm:p-6">
            <p className="mb-4 text-sm">
              Genera un cargo de {formatearMoneda(t.precio_pactado)} al cliente y libera el vehículo y el conductor.
              {aFavor > 0 && ` Puede aplicar hasta ${formatearMoneda(Math.min(aFavor, Number(t.precio_pactado ?? 0)))} de su saldo a favor.`}
            </p>
            <FormularioOperacion
              campos={camposFinalizarTransporte(aFavor > 0)}
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
      <GastosServicio tipo="transporte" id={id} rol={usuario.rol} />
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
    case "finalizar_transporte":
      return `Cargo generado${d.anticipo_aplicado ? `, saldo a favor aplicado ${formatearMoneda(String(d.anticipo_aplicado))}` : ""}.`;
    default:
      return null;
  }
}
