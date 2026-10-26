import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { esRol, type Rol } from "./roles";

export type UsuarioActual = {
  id: string;
  nombre: string;
  correo: string | null;
  rol: Rol;
};

type EstadoSesion =
  | { estado: "sin_sesion" }
  | { estado: "inactivo"; correo: string | null }
  | { estado: "activo"; usuario: UsuarioActual };

/**
 * Lee la sesión verificada (getClaims) y el perfil interno una sola vez por
 * solicitud. Es la única fuente de identidad y rol en el servidor.
 */
export const obtenerSesion = cache(async (): Promise<EstadoSesion> => {
  // Siempre en tiempo de solicitud: getClaims() compara la expiración del
  // token con la hora actual, y los datos del ERP no se prerenderizan.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return { estado: "sin_sesion" };

  const correo = typeof data.claims.email === "string" ? data.claims.email : null;
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, rol, activo")
    .eq("id", sub)
    .maybeSingle();

  if (!perfil || !perfil.activo || !esRol(perfil.rol)) {
    return { estado: "inactivo", correo };
  }
  return {
    estado: "activo",
    usuario: { id: perfil.id, nombre: perfil.nombre, correo: perfil.correo, rol: perfil.rol },
  };
});

/** Para páginas: redirige si no hay sesión o si el perfil no está activo. */
export async function requerirUsuario(): Promise<UsuarioActual> {
  const sesion = await obtenerSesion();
  if (sesion.estado === "sin_sesion") redirect("/login");
  if (sesion.estado === "inactivo") redirect("/sin-acceso");
  return sesion.usuario;
}

/** Para Server Actions: devuelve null en lugar de redirigir. */
export async function usuarioActivoOpcional(): Promise<UsuarioActual | null> {
  const sesion = await obtenerSesion();
  return sesion.estado === "activo" ? sesion.usuario : null;
}
