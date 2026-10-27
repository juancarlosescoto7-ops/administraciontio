"use server";

import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { esUuid } from "@/lib/catalogos/presentacion";
import { decimal, decimalOpcional, opcional } from "@/lib/finanzas/montos";
import { aFechaHoraLocal } from "@/lib/formato";
import { clave, fallo, procesar, SIN_CLAVE, texto, traducir } from "@/lib/operaciones";
import {
  camposCancelarTransporte,
  camposDuracionTransporte,
  camposEditarTransporte,
  camposFinalizarTransporte,
  camposRecursosTransporte,
  camposReprogramarTransporte,
  camposSolicitudTransporte,
} from "./definiciones";

const INVALIDA = fallo("Operación no válida.");
const ruta = (id: string) => `/transportes/${id}`;

export async function registrarTransporte(
  clienteId: string,
  tarifaId: string | null,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const campos = camposSolicitudTransporte({ vehiculos: [], conductores: [], ahora: aFechaHoraLocal(new Date()) });
  return procesar(anterior, formData, campos, "gestionarTransportes", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia) return SIN_CLAVE;
    if (!esUuid(clienteId) || (tarifaId !== null && !esUuid(tarifaId))) return INVALIDA;
    const { data, error } = await supabase.rpc("registrar_transporte", {
      p_idempotencia: idempotencia,
      p_cliente_id: clienteId,
      p_inicio_previsto: String(datos.inicio),
      p_minutos_estimados: Number(datos.minutos),
      p_origen: String(datos.origen),
      p_destino: String(datos.destino),
      p_tarifa_id: opcional(tarifaId),
      p_precio: decimalOpcional(texto(datos.precio)),
      p_notas: opcional(texto(datos.notas)),
      p_vehiculo_id: opcional(texto(datos.vehiculo_id)),
      p_conductor_id: opcional(texto(datos.conductor_id)),
      p_programar: datos.programar === true,
    });
    if (error) return traducir(error);
    return { destino: `${ruta(data)}?guardado=1` };
  });
}

export async function programarTransporte(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, [], "gestionarTransportes", async (_datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { error } = await supabase.rpc("programar_transporte", { p_transporte_id: id });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?programado=1` };
  });
}

export async function asignarRecursosTransporte(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposRecursosTransporte([], []), "gestionarTransportes", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { error } = await supabase.rpc("asignar_recursos_transporte", {
      p_transporte_id: id,
      p_vehiculo_id: opcional(texto(datos.vehiculo_id)),
      p_conductor_id: opcional(texto(datos.conductor_id)),
      p_motivo: opcional(texto(datos.motivo)),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?recursos=1` };
  });
}

export async function reprogramarTransporte(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposReprogramarTransporte(), "gestionarTransportes", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { error } = await supabase.rpc("reprogramar_transporte", {
      p_transporte_id: id,
      p_inicio_previsto: String(datos.inicio),
      p_minutos_estimados: Number(datos.minutos),
      p_motivo: String(datos.motivo),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?reprogramado=1` };
  });
}

export async function ajustarDuracionTransporte(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposDuracionTransporte(), "gestionarTransportes", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { error } = await supabase.rpc("ajustar_duracion_transporte", {
      p_transporte_id: id,
      p_minutos_estimados: Number(datos.minutos),
      p_motivo: opcional(texto(datos.motivo)),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?duracion=1` };
  });
}

/** tarifaId: la tarifa de referencia vigente del servicio (se conserva). */
export async function editarTransporte(
  id: string,
  tarifaId: string | null,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposEditarTransporte(), "gestionarTransportes", async (datos, supabase) => {
    if (!esUuid(id) || (tarifaId !== null && !esUuid(tarifaId))) return INVALIDA;
    const { error } = await supabase.rpc("editar_transporte", {
      p_transporte_id: id,
      p_origen: String(datos.origen),
      p_destino: String(datos.destino),
      p_tarifa_id: opcional(tarifaId),
      p_precio: decimalOpcional(texto(datos.precio_pactado)),
      p_notas: opcional(texto(datos.notas)),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?editado=1` };
  });
}

export async function iniciarTransporte(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, [], "gestionarTransportes", async (_datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { error } = await supabase.rpc("iniciar_transporte", { p_transporte_id: id });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?iniciado=1` };
  });
}

export async function finalizarTransporte(
  id: string,
  aplicaAnticipo: boolean,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposFinalizarTransporte(aplicaAnticipo === true), "gestionarTransportes", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const anticipo = texto(datos.aplicar_anticipo);
    const { error } = await supabase.rpc("finalizar_transporte", {
      p_transporte_id: id,
      p_notas_finales: opcional(texto(datos.notas_finales)),
      ...(anticipo !== null && Number(anticipo) > 0 ? { p_aplicar_anticipo: decimal(anticipo) } : {}),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?completado=1` };
  });
}

export async function cancelarTransporte(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposCancelarTransporte(), "gestionarTransportes", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    if (datos.confirmar !== true) return fallo("Revise los campos marcados.", { confirmar: "Marque la casilla para confirmar." });
    const { error } = await supabase.rpc("cancelar_transporte", { p_transporte_id: id, p_motivo: String(datos.motivo) });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?cancelado=1` };
  });
}
