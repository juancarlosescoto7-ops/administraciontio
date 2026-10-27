"use server";

import { usuarioActivoOpcional } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { esUuid } from "@/lib/catalogos/presentacion";
import { decimal, opcional } from "@/lib/finanzas/montos";
import { clave, fallo, procesar, SIN_CLAVE, texto, traducir } from "@/lib/operaciones";
import {
  camposCancelarAlquiler,
  camposDevolucion,
  camposEntrega,
  camposModificar,
  camposReserva,
  leerAdicionales,
  type NivelCombustible,
} from "./definiciones";

const INVALIDA = fallo("Operación no válida.");
const ruta = (id: string) => `/alquileres/${id}`;
const esMomento = (valor: string) => !Number.isNaN(Date.parse(valor));

/** Fechas y tarifa se eligieron en el paso anterior (argumentos enlazados, validados aquí). */
export async function registrarAlquiler(
  clienteId: string,
  entrega: string,
  devolucion: string,
  tarifaId: string | null,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposReserva([], null), "gestionarAlquileres", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia) return SIN_CLAVE;
    if (!esUuid(clienteId) || !esMomento(entrega) || !esMomento(devolucion) || (tarifaId !== null && !esUuid(tarifaId))) return INVALIDA;
    const { data, error } = await supabase.rpc("registrar_alquiler", {
      p_idempotencia: idempotencia,
      p_cliente_id: clienteId,
      p_vehiculo_id: String(datos.vehiculo_id),
      p_entrega_prevista: entrega,
      p_devolucion_prevista: devolucion,
      p_tarifa_id: opcional(tarifaId),
      p_precio: decimal(String(datos.precio)),
      p_notas: opcional(texto(datos.notas)),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(data)}?guardado=1` };
  });
}

export async function modificarAlquiler(
  id: string,
  tarifaId: string | null,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposModificar([]), "gestionarAlquileres", async (datos, supabase) => {
    if (!esUuid(id) || (tarifaId !== null && !esUuid(tarifaId))) return INVALIDA;
    const { error } = await supabase.rpc("modificar_alquiler", {
      p_alquiler_id: id,
      p_vehiculo_id: String(datos.vehiculo_id),
      p_entrega_prevista: String(datos.entrega),
      p_devolucion_prevista: String(datos.devolucion),
      p_tarifa_id: opcional(tarifaId),
      p_precio: decimal(String(datos.precio)),
      p_notas: opcional(texto(datos.notas)),
      p_motivo: String(datos.motivo),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?modificado=1` };
  });
}

export async function entregarAlquiler(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposEntrega(), "gestionarAlquileres", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { error } = await supabase.rpc("entregar_alquiler", {
      p_alquiler_id: id,
      p_km_salida: Number(datos.km),
      p_combustible: datos.combustible as NivelCombustible,
      p_notas: opcional(texto(datos.notas)),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?entregado=1` };
  });
}

export async function devolverAlquiler(
  id: string,
  aplicaAnticipo: boolean,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const usuario = await usuarioActivoOpcional();
  const corrigeKm = usuario !== null && puede("corregirKilometraje", usuario.rol);
  return procesar(anterior, formData, camposDevolucion(aplicaAnticipo === true, corrigeKm), "gestionarAlquileres", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { adicionales, errores } = leerAdicionales(datos);
    if (Object.keys(errores).length > 0) return fallo("Revise los campos marcados.", errores);
    const anticipo = texto(datos.aplicar_anticipo);
    const { error } = await supabase.rpc("devolver_alquiler", {
      p_alquiler_id: id,
      p_km_regreso: Number(datos.km),
      p_combustible: datos.combustible as NivelCombustible,
      p_notas: opcional(texto(datos.notas)),
      p_adicionales: adicionales,
      ...(anticipo !== null && Number(anticipo) > 0 ? { p_aplicar_anticipo: decimal(anticipo) } : {}),
      ...(corrigeKm && texto(datos.motivo_km) ? { p_motivo_correccion_km: String(datos.motivo_km) } : {}),
    });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?devuelto=1` };
  });
}

export async function cancelarAlquiler(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposCancelarAlquiler(), "gestionarAlquileres", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    if (datos.confirmar !== true) return fallo("Revise los campos marcados.", { confirmar: "Marque la casilla para confirmar." });
    const { error } = await supabase.rpc("cancelar_alquiler", { p_alquiler_id: id, p_motivo: String(datos.motivo) });
    if (error) return traducir(error);
    return { destino: `${ruta(id)}?cancelado=1` };
  });
}
