import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { rutaPermitida } from "./permisos";
import { esRol, type Rol } from "./roles";
import { CABECERA_RUTA } from "./rutas";

export type UsuarioActual = {
  id: string;
  nombre: string;
  correo: string | null;
  rol: Rol;
  /** Administra los permisos de los demás y nunca tiene restricciones. */
  esDesarrollador: boolean;
  /** Módulos y funciones apagados por el desarrollador (ver lib/auth/permisos.ts). */
  denegados: string[];
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
    .select("id, nombre, correo, rol, activo, es_desarrollador, permisos_denegados")
    .eq("id", sub)
    .maybeSingle();

  if (!perfil || !perfil.activo || !esRol(perfil.rol)) {
    return { estado: "inactivo", correo };
  }
  return {
    estado: "activo",
    usuario: {
      id: perfil.id,
      nombre: perfil.nombre,
      correo: perfil.correo,
      rol: perfil.rol,
      esDesarrollador: perfil.es_desarrollador,
      denegados: perfil.es_desarrollador ? [] : (perfil.permisos_denegados ?? []),
    },
  };
});

/** Ruta de la solicitud actual (la fija el proxy; nunca la del cliente). */
async function rutaActual(): Promise<string | null> {
  return (await headers()).get(CABECERA_RUTA);
}

/**
 * Para páginas: redirige si no hay sesión, si el perfil no está activo o si
 * el desarrollador apagó el módulo de esta ruta para el usuario.
 */
export async function requerirUsuario(): Promise<UsuarioActual> {
  const sesion = await obtenerSesion();
  if (sesion.estado === "sin_sesion") redirect("/login");
  if (sesion.estado === "inactivo") redirect("/sin-acceso");
  const ruta = await rutaActual();
  if (ruta && !rutaPermitida(sesion.usuario, ruta)) redirect("/sin-permiso");
  return sesion.usuario;
}

/**
 * Para Server Actions: devuelve null en lugar de redirigir. Una acción se
 * envía a la ruta de la página que la contiene, así que un módulo apagado
 * también bloquea sus acciones.
 */
export async function usuarioActivoOpcional(): Promise<UsuarioActual | null> {
  const sesion = await obtenerSesion();
  if (sesion.estado !== "activo") return null;
  const ruta = await rutaActual();
  if (ruta && !rutaPermitida(sesion.usuario, ruta)) return null;
  return sesion.usuario;
}
