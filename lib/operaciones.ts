// Esqueleto común de las Server Actions que llaman a funciones SQL de
// operación (finanzas, membresías). Este módulo no es "use server": nada de
// lo que exporta queda expuesto como acción invocable desde el navegador.
import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { puede, type Permiso } from "@/lib/auth/roles";
import { usuarioActivoOpcional } from "@/lib/auth/sesion";
import type { Campo } from "@/lib/catalogos/definiciones";
import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { esUuid } from "@/lib/catalogos/presentacion";
import { leerValores, validarRegistro, type Datos } from "@/lib/catalogos/validacion";
import { createClient } from "@/lib/supabase/server";

export type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

/** Resultado de una operación: error para el formulario o ruta a la que ir. */
export type Fallo = { error: string; errores: Record<string, string> };
export type Resultado = Fallo | { destino: string };

/**
 * Lee y valida los campos, comprueba sesión y rol en el servidor y ejecuta la
 * operación (que la base vuelve a autorizar). La redirección final queda
 * fuera de cualquier try/catch.
 */
export async function procesar(
  anterior: EstadoFormulario,
  formData: FormData,
  campos: readonly Campo[],
  permiso: Permiso,
  operar: (datos: Datos, supabase: ClienteSupabase) => Promise<Resultado>,
): Promise<EstadoFormulario> {
  const valores = leerValores({ campos }, formData);
  const responder = (cambios: Partial<EstadoFormulario>): EstadoFormulario => ({
    revision: anterior.revision + 1,
    valores,
    errores: {},
    error: null,
    similares: null,
    ...cambios,
  });

  const usuario = await usuarioActivoOpcional();
  if (!usuario) {
    return responder({ error: "Su sesión expiró o su usuario no está activo. Inicie sesión de nuevo." });
  }
  if (!puede(permiso, usuario.rol)) {
    return responder({ error: "Su rol no permite realizar esta operación." });
  }

  const validacion = validarRegistro({ campos }, valores);
  if (!validacion.ok) {
    return responder({ errores: validacion.errores, error: "Revise los campos marcados." });
  }

  const resultado = await operar(validacion.datos, await createClient());
  if (!("destino" in resultado)) {
    return responder(resultado);
  }
  // Saldos, panel y listados dependen de cada operación.
  revalidatePath("/", "layout");
  redirect(resultado.destino);
}

export const fallo = (error: string, errores: Record<string, string> = {}): Fallo => ({ error, errores });

/** Los mensajes de negocio de las funciones SQL (22023, P0002) ya están en español. */
export function traducir(error: PostgrestError): Fallo {
  if (error.code === "22023" || error.code === "P0002") return fallo(error.message);
  if (error.code === "42501") return fallo("Su rol no permite realizar esta operación.");
  if (error.code === "22P02") return fallo("Algún dato no tiene un formato válido.");
  console.error("Error en operación", error.code, error.message);
  return fallo("No se pudo registrar la operación. Puede intentarlo de nuevo: no se duplicará.");
}

/** Clave de idempotencia del formulario (campo oculto). */
export function clave(formData: FormData): string | null {
  const valor = formData.get("idempotencia");
  return esUuid(valor) ? valor : null;
}

export const SIN_CLAVE = fallo("El formulario caducó. Recargue la página e inténtelo de nuevo.");

export const texto = (valor: Datos[string]) => (typeof valor === "string" ? valor : null);
