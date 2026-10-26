"use server";

import { revalidatePath } from "next/cache";
import { puede } from "@/lib/auth/roles";
import { usuarioActivoOpcional } from "@/lib/auth/sesion";
import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { esUuid } from "@/lib/catalogos/presentacion";
import { esFechaValida, type Datos } from "@/lib/catalogos/validacion";
import { decimal } from "@/lib/finanzas/montos";
import { clave, fallo, procesar, SIN_CLAVE, texto, traducir } from "@/lib/operaciones";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/tipos-bd";
import {
  camposAgregarBeneficiario,
  camposAltaMembresia,
  camposBaja,
  camposEditarCondiciones,
  describirActualizacion,
  PREFIJO_BENEFICIARIO,
  type ResumenActualizacion,
} from "./definiciones";

type Modalidad = Database["public"]["Enums"]["modalidad_cupo"];

const INVALIDA = fallo("Operación no válida.");
const SIN_CONFIRMAR = fallo("Revise los campos marcados.", { confirmar: "Marque la casilla para confirmar." });

export async function registrarMembresia(
  clienteId: string,
  planId: string,
  fechaInicio: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  // Una casilla por beneficiario ofrecido: beneficiario_<id>.
  const casillas = [...formData.keys()]
    .filter((nombre) => nombre.startsWith(PREFIJO_BENEFICIARIO) && esUuid(nombre.slice(PREFIJO_BENEFICIARIO.length)))
    .map((nombre) => ({ id: nombre.slice(PREFIJO_BENEFICIARIO.length), nombre: "", detalle: null }));
  const usuario = await usuarioActivoOpcional();
  const administrador = usuario !== null && puede("gestionarMembresia", usuario.rol);
  const campos = camposAltaMembresia(casillas, administrador);

  return procesar(anterior, formData, campos, "registrarMembresia", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia) return SIN_CLAVE;
    if (!esUuid(clienteId) || !esUuid(planId) || !esFechaValida(fechaInicio)) return INVALIDA;
    if (datos.confirmar !== true) return SIN_CONFIRMAR;

    const beneficiarios = casillas.map((c) => c.id).filter((id) => datos[`${PREFIJO_BENEFICIARIO}${id}`] === true);
    if (beneficiarios.length === 0) return fallo("Seleccione al menos un beneficiario.");

    const condiciones = administrador ? condicionesParticulares(datos) : null;
    const { data, error } = await supabase.rpc("registrar_membresia", {
      p_idempotencia: idempotencia,
      p_cliente_id: clienteId,
      p_plan_id: planId,
      p_fecha_inicio: fechaInicio,
      p_beneficiarios: beneficiarios,
      p_condiciones: condiciones ?? undefined,
    });
    if (error) return traducir(error);
    return { destino: `/membresias/${data}?guardado=1` };
  });
}

/** Solo los campos escritos: lo vacío conserva la condición del plan. */
function condicionesParticulares(datos: Datos): Record<string, string | number> | null {
  const condiciones: Record<string, string | number> = {};
  if (texto(datos.precio) !== null) condiciones.precio = String(datos.precio);
  if (typeof datos.cupo === "number") condiciones.cupo = datos.cupo;
  if (texto(datos.modalidad) !== null) condiciones.modalidad = String(datos.modalidad);
  if (typeof datos.dias_gracia === "number") condiciones.dias_gracia = datos.dias_gracia;
  return Object.keys(condiciones).length > 0 ? condiciones : null;
}

export async function editarCondiciones(
  membresiaId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposEditarCondiciones(), "gestionarMembresia", async (datos, supabase) => {
    if (!esUuid(membresiaId)) return INVALIDA;
    const { error } = await supabase.rpc("actualizar_condiciones_membresia", {
      p_membresia_id: membresiaId,
      p_precio: decimal(String(datos.precio)),
      p_cupo: Number(datos.cupo),
      p_modalidad: datos.modalidad as Modalidad,
      p_dias_gracia: Number(datos.dias_gracia),
      p_motivo: String(datos.motivo),
    });
    if (error) return traducir(error);
    return { destino: `/membresias/${membresiaId}?condiciones=1` };
  });
}

export async function agregarBeneficiario(
  membresiaId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposAgregarBeneficiario([]), "registrarMembresia", async (datos, supabase) => {
    if (!esUuid(membresiaId)) return INVALIDA;
    const { error } = await supabase.rpc("agregar_beneficiario_membresia", {
      p_membresia_id: membresiaId,
      p_beneficiario_id: String(datos.beneficiario_id),
    });
    if (error) return traducir(error);
    return { destino: `/membresias/${membresiaId}?beneficiario=1` };
  });
}

export async function inactivarBeneficiario(
  membresiaId: string,
  vinculoId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposBaja(""), "registrarMembresia", async (datos, supabase) => {
    if (!esUuid(membresiaId) || !esUuid(vinculoId)) return INVALIDA;
    if (datos.confirmar !== true) return SIN_CONFIRMAR;
    const { error } = await supabase.rpc("inactivar_beneficiario_membresia", {
      p_vinculo_id: vinculoId,
      p_motivo: String(datos.motivo),
    });
    if (error) return traducir(error);
    return { destino: `/membresias/${membresiaId}?baja=1` };
  });
}

export async function cancelarMembresia(
  membresiaId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposBaja(""), "gestionarMembresia", async (datos, supabase) => {
    if (!esUuid(membresiaId)) return INVALIDA;
    if (datos.confirmar !== true) return SIN_CONFIRMAR;
    const { error } = await supabase.rpc("cancelar_membresia", {
      p_membresia_id: membresiaId,
      p_motivo: String(datos.motivo),
    });
    if (error) return traducir(error);
    return { destino: `/membresias/${membresiaId}?cancelada=1` };
  });
}

// --- Actualizar mensualidades ------------------------------------------

export type EstadoActualizacion = { mensaje: string | null; error: string | null };

async function ejecutarActualizacion(membresiaId: string | null): Promise<ResumenActualizacion | string> {
  const usuario = await usuarioActivoOpcional();
  if (!usuario || !puede("actualizarMensualidades", usuario.rol)) return "Su rol no permite realizar esta operación.";
  if (membresiaId !== null && !esUuid(membresiaId)) return "Operación no válida.";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("actualizar_mensualidades", membresiaId ? { p_membresia_id: membresiaId } : {});
  if (error) return traducir(error).error;
  const resumen = data as Record<string, number>;
  return { periodos: resumen.periodos ?? 0, suspendidas: resumen.suspendidas ?? 0, reactivadas: resumen.reactivadas ?? 0 };
}

/** Botón «Actualizar mensualidades» (de una membresía o de todas). */
export async function actualizarMensualidades(membresiaId: string | null): Promise<EstadoActualizacion> {
  const resultado = await ejecutarActualizacion(membresiaId);
  if (typeof resultado === "string") return { mensaje: null, error: resultado };
  revalidatePath("/", "layout");
  return { mensaje: describirActualizacion(resultado), error: null };
}

/**
 * Al abrir el panel (POST desde el navegador, nunca en el GET de la página).
 * Devuelve null si no cambió nada o no se pudo ejecutar.
 */
export async function actualizarAlAbrir(): Promise<ResumenActualizacion | null> {
  const resultado = await ejecutarActualizacion(null);
  if (typeof resultado === "string") return null;
  if (resultado.periodos + resultado.suspendidas + resultado.reactivadas === 0) return null;
  revalidatePath("/", "layout");
  return resultado;
}
