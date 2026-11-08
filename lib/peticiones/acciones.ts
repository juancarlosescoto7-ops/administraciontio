"use server";

import { revalidatePath } from "next/cache";
import { usuarioActivoOpcional } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { createClient } from "@/lib/supabase/server";
import { esEstadoPeticion, validarPeticion, type EstadoEnvioPeticion } from "./definiciones";

const SESION_VENCIDA = "Su sesión expiró o su usuario no está activo. Inicie sesión de nuevo.";

/** Registra una petición desde cualquier pantalla. La RLS exige usuario activo. */
export async function registrarPeticion(anterior: EstadoEnvioPeticion, formData: FormData): Promise<EstadoEnvioPeticion> {
  const respuesta = (cambios: Partial<EstadoEnvioPeticion>): EstadoEnvioPeticion => ({
    revision: anterior.revision + 1,
    error: null,
    mensaje: null,
    ...cambios,
  });
  if (!(await usuarioActivoOpcional())) return respuesta({ error: SESION_VENCIDA });

  const datos = validarPeticion(formData.get("descripcion"), formData.get("pantalla"));
  if (!datos.ok) return respuesta({ error: datos.error });

  const supabase = await createClient();
  const { error } = await supabase
    .from("peticiones")
    .insert({ descripcion: datos.descripcion, pantalla: datos.pantalla });
  if (error) return respuesta({ error: "No se pudo registrar la petición. Intente de nuevo." });

  revalidatePath("/peticiones");
  return respuesta({ mensaje: "Petición registrada." });
}

/** Cambia el estado de una petición; es lo único editable de ella. */
export async function cambiarEstadoPeticion(
  id: string,
  anterior: EstadoEnvioPeticion,
  formData: FormData,
): Promise<EstadoEnvioPeticion> {
  const respuesta = (cambios: Partial<EstadoEnvioPeticion>): EstadoEnvioPeticion => ({
    revision: anterior.revision + 1,
    error: null,
    mensaje: null,
    ...cambios,
  });
  if (!(await usuarioActivoOpcional())) return respuesta({ error: SESION_VENCIDA });

  const estado = formData.get("estado");
  if (!esUuid(id) || !esEstadoPeticion(estado)) return respuesta({ error: "Estado no válido." });

  const supabase = await createClient();
  const { data, error } = await supabase.from("peticiones").update({ estado }).eq("id", id).select("id");
  if (error || !data?.length) return respuesta({ error: "No se pudo cambiar el estado." });

  revalidatePath("/peticiones");
  return respuesta({ mensaje: "Estado actualizado." });
}
