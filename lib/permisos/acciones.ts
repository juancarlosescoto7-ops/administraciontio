"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizarDenegados, RUTA_PERMISOS } from "@/lib/auth/permisos";
import { usuarioActivoOpcional } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { createClient } from "@/lib/supabase/server";
import type { EstadoPermisos } from "./estado";

/**
 * Guarda los módulos y funciones apagados de un usuario mediante
 * public.guardar_permisos_usuario, que en la base exige desarrollador activo,
 * rechaza la cuenta de desarrollador y deja registro en la bitácora.
 */
export async function guardarPermisos(
  id: string,
  anterior: EstadoPermisos,
  formData: FormData,
): Promise<EstadoPermisos> {
  const error = (mensaje: string): EstadoPermisos => ({ revision: anterior.revision + 1, error: mensaje });

  const usuario = await usuarioActivoOpcional();
  if (!usuario?.esDesarrollador) return error("Solo el desarrollador puede cambiar los permisos.");
  if (!esUuid(id)) return error("Usuario no válido.");

  const denegados = normalizarDenegados(formData.getAll("denegado"));
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (motivo.length > 300) return error("El motivo admite como máximo 300 caracteres.");

  const supabase = await createClient();
  const { error: fallo } = await supabase.rpc("guardar_permisos_usuario", {
    p_id: id,
    p_denegados: denegados,
    p_motivo: motivo || undefined,
  });
  if (fallo) {
    if (fallo.code === "42501" || fallo.code === "P0002" || fallo.code === "22023") return error(fallo.message);
    console.error("Error al guardar permisos", fallo.code, fallo.message);
    return error("No se pudo guardar. Intente de nuevo.");
  }

  revalidatePath(RUTA_PERMISOS);
  redirect(`${RUTA_PERMISOS}/${id}?guardado=1`);
}
