"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { esRol, puedeAdministrarUsuarios } from "@/lib/auth/roles";
import { usuarioActivoOpcional } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { createClient } from "@/lib/supabase/server";
import type { EstadoUsuario } from "./estado";

/**
 * Cambia nombre, rol o estado de un perfil mediante public.actualizar_perfil,
 * que en la base exige administrador activo, impide el cambio del propio rol o
 * estado, pide motivo y deja registro en la bitácora.
 */
export async function actualizarUsuario(
  id: string,
  anterior: EstadoUsuario,
  formData: FormData,
): Promise<EstadoUsuario> {
  const valores = {
    nombre: String(formData.get("nombre") ?? ""),
    rol: String(formData.get("rol") ?? ""),
    activo: formData.get("activo") === "on" ? "on" : "",
    motivo: String(formData.get("motivo") ?? ""),
  };
  const respuesta = (cambios: Partial<EstadoUsuario>): EstadoUsuario => ({
    revision: anterior.revision + 1,
    valores,
    errores: {},
    error: null,
    ...cambios,
  });

  const usuario = await usuarioActivoOpcional();
  if (!usuario || !puedeAdministrarUsuarios(usuario.rol)) {
    return respuesta({ error: "Solo un administrador activo puede modificar usuarios." });
  }
  if (!esUuid(id)) return respuesta({ error: "Usuario no válido." });

  const supabase = await createClient();
  const { data: actual } = await supabase
    .from("perfiles")
    .select("rol, activo")
    .eq("id", id)
    .maybeSingle();
  if (!actual) return respuesta({ error: "Usuario no encontrado." });

  // En el propio perfil, rol y estado no se envían (controles deshabilitados).
  const esPropio = id === usuario.id;
  const nombre = valores.nombre.trim();
  const rol = esPropio ? actual.rol : valores.rol;
  const activo = esPropio ? actual.activo : valores.activo === "on";
  const motivo = valores.motivo.trim();

  const errores: Record<string, string> = {};
  if (!nombre) errores.nombre = "Este campo es obligatorio.";
  else if (nombre.length > 120) errores.nombre = "Máximo 120 caracteres.";
  if (!esRol(rol)) errores.rol = "Seleccione un rol válido.";
  if (motivo.length > 300) errores.motivo = "Máximo 300 caracteres.";
  const cambiaAcceso = rol !== actual.rol || activo !== actual.activo;
  if (cambiaAcceso && !motivo) errores.motivo = "Indique el motivo del cambio de rol o estado.";
  if (Object.keys(errores).length > 0 || !esRol(rol)) {
    return respuesta({ errores, error: "Revise los campos marcados." });
  }

  const { error } = await supabase.rpc("actualizar_perfil", {
    p_id: id,
    p_nombre: nombre,
    p_rol: rol,
    p_activo: activo,
    p_motivo: motivo || undefined,
  });
  if (error) {
    if (error.code === "22023") return respuesta({ errores: { motivo: error.message }, error: "Revise los campos marcados." });
    if (error.code === "42501" || error.code === "P0002") return respuesta({ error: error.message });
    console.error("Error al actualizar perfil", error.code, error.message);
    return respuesta({ error: "No se pudo guardar. Intente de nuevo." });
  }

  revalidatePath("/configuracion/usuarios");
  redirect(`/configuracion/usuarios/${id}?guardado=1`);
}
