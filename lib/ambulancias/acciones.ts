"use server";

import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { esUuid } from "@/lib/catalogos/presentacion";
import { decimal, decimalOpcional, opcional } from "@/lib/finanzas/montos";
import { aFechaHoraLocal } from "@/lib/formato";
import { fallo, procesar, clave, SIN_CLAVE, texto, traducir } from "@/lib/operaciones";
import {
  camposCancelar,
  camposConvertir,
  camposDuracion,
  camposEditar,
  camposFinalizar,
  camposRecursos,
  camposReprogramar,
  camposSolicitud,
  type TipoTraslado,
} from "./definiciones";

const INVALIDA = fallo("Operación no válida.");
const SIN_CONFIRMAR = fallo("Revise los campos marcados.", { confirmar: "Marque la casilla para confirmar." });
const ruta = (id: string) => `/ambulancias/${id}`;
const ahora = () => aFechaHoraLocal(new Date());

/** Solicitud: membresiaId nulo = particular; tarifaId, la tarifa que propuso el precio. */
export async function registrarTraslado(
  clienteId: string,
  membresiaId: string | null,
  tarifaId: string | null,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const tipo: TipoTraslado = membresiaId ? "cubierto" : "particular";
  const campos = camposSolicitud({ tipo, beneficiarios: [], vehiculos: [], conductores: [], ahora: ahora() });
  return procesar(anterior, formData, campos, "gestionarTraslados", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia) return SIN_CLAVE;
    if (!esUuid(clienteId) || (membresiaId !== null && !esUuid(membresiaId)) || (tarifaId !== null && !esUuid(tarifaId))) {
      return INVALIDA;
    }
    const { data, error } = await supabase.rpc("registrar_traslado", {
      p_idempotencia: idempotencia,
      p_tipo: tipo,
      p_cliente_id: clienteId,
      p_membresia_id: opcional(membresiaId),
      p_beneficiario_id: opcional(texto(datos.beneficiario_id)),
      p_pasajero: opcional(texto(datos.pasajero)),
      p_inicio_previsto: String(datos.inicio),
      p_minutos_estimados: Number(datos.minutos),
      p_origen: String(datos.origen),
      p_destino: opcional(texto(datos.destino)),
      p_motivo: opcional(texto(datos.motivo)),
      p_precio: decimalOpcional(texto(datos.precio)),
      p_tarifa_id: opcional(tipo === "particular" ? tarifaId : null),
      p_notas: opcional(texto(datos.notas)),
      p_vehiculo_id: opcional(texto(datos.vehiculo_id)),
      p_conductor_id: opcional(texto(datos.conductor_id)),
      p_programar: datos.programar === true,
    });
    if (error) return traducir(error);
    return { destino: `${ruta(data)}?guardado=1` };
  });
}

/** Acciones sin campos (programar, iniciar, revalidar). */
export async function programarTraslado(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, [], "gestionarTraslados", async (_datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { error } = await supabase.rpc("programar_traslado", { p_traslado_id: id });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?programado=1` };
  });
}

export async function revalidarCobertura(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, [], "gestionarTraslados", async (_datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { error } = await supabase.rpc("revalidar_cobertura_traslado", { p_traslado_id: id });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?revalidado=1` };
  });
}

export async function iniciarTraslado(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, [], "gestionarTraslados", async (_datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { data, error } = await supabase.rpc("iniciar_traslado", { p_traslado_id: id });
    if (error) return traducir(error);
    // Sin cobertura válida no se inicia, pero la revalidación quedó guardada.
    const resultado = data as { iniciado?: boolean } | null;
    return { destino: `${ruta(id)}?${resultado?.iniciado ? "iniciado" : "sin_cobertura"}=1` };
  });
}

export async function asignarRecursos(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposRecursos([], []), "gestionarTraslados", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { error } = await supabase.rpc("asignar_recursos_traslado", {
      p_traslado_id: id,
      p_vehiculo_id: opcional(texto(datos.vehiculo_id)),
      p_conductor_id: opcional(texto(datos.conductor_id)),
      p_motivo: opcional(texto(datos.motivo)),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?recursos=1` };
  });
}

export async function reprogramarTraslado(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposReprogramar(ahora()), "gestionarTraslados", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { error } = await supabase.rpc("reprogramar_traslado", {
      p_traslado_id: id,
      p_inicio_previsto: String(datos.inicio),
      p_minutos_estimados: Number(datos.minutos),
      p_motivo: String(datos.motivo),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?reprogramado=1` };
  });
}

export async function ajustarDuracion(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposDuracion(), "gestionarTraslados", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { error } = await supabase.rpc("ajustar_duracion_traslado", {
      p_traslado_id: id,
      p_minutos_estimados: Number(datos.minutos),
      p_motivo: opcional(texto(datos.motivo)),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?duracion=1` };
  });
}

/** tarifaId: la tarifa de referencia vigente del traslado (se conserva). */
export async function editarTraslado(
  id: string,
  tipo: TipoTraslado,
  tarifaId: string | null,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const campos = camposEditar(tipo === "particular" ? "particular" : "cubierto");
  return procesar(anterior, formData, campos, "gestionarTraslados", async (datos, supabase) => {
    if (!esUuid(id) || (tarifaId !== null && !esUuid(tarifaId))) return INVALIDA;
    const { error } = await supabase.rpc("editar_traslado", {
      p_traslado_id: id,
      p_origen: String(datos.origen),
      p_destino: opcional(texto(datos.destino)),
      p_motivo: opcional(texto(datos.motivo)),
      p_notas: opcional(texto(datos.notas)),
      p_pasajero: opcional(texto(datos.pasajero)),
      p_precio: decimalOpcional(texto(datos.precio_pactado)),
      p_tarifa_id: opcional(tipo === "particular" ? tarifaId : null),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?editado=1` };
  });
}

export async function finalizarTraslado(
  id: string,
  aplicaAnticipo: boolean,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposFinalizar(aplicaAnticipo === true), "gestionarTraslados", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const anticipo = texto(datos.aplicar_anticipo);
    const { error } = await supabase.rpc("finalizar_traslado", {
      p_traslado_id: id,
      p_notas_finales: opcional(texto(datos.notas_finales)),
      ...(anticipo !== null && Number(anticipo) > 0 ? { p_aplicar_anticipo: decimal(anticipo) } : {}),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?completado=1` };
  });
}

export async function cancelarTraslado(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposCancelar(""), "gestionarTraslados", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    if (datos.confirmar !== true) return SIN_CONFIRMAR;
    const { error } = await supabase.rpc("cancelar_traslado", { p_traslado_id: id, p_motivo: String(datos.motivo) });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?cancelado=1` };
  });
}

export async function convertirAParticular(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposConvertir(), "gestionarTraslados", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    if (datos.confirmar !== true) return SIN_CONFIRMAR;
    const { error } = await supabase.rpc("convertir_traslado_a_particular", {
      p_traslado_id: id,
      p_precio: decimal(String(datos.precio)),
      p_motivo: String(datos.motivo),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?convertido=1` };
  });
}

export async function revertirConsumo(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposCancelar(""), "corregirTraslados", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    if (datos.confirmar !== true) return SIN_CONFIRMAR;
    const { error } = await supabase.rpc("revertir_consumo_traslado", { p_traslado_id: id, p_motivo: String(datos.motivo) });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?revertido=1` };
  });
}
