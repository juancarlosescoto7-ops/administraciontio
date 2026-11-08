"use server";

import { redirect } from "next/navigation";
import { correoDeAcceso } from "@/lib/auth/acceso";
import { destinoSeguro } from "@/lib/auth/rutas";
import { leerConfigSupabase } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type EstadoLogin = { error: string | null; correo: string };

export async function iniciarSesion(
  _anterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  // «correo» conserva lo escrito (usuario o correo) para volver a mostrarlo.
  const correo = String(formData.get("correo") ?? "").trim().toLowerCase();
  const contrasena = String(formData.get("contrasena") ?? "");
  const destino = destinoSeguro(formData.get("siguiente"));

  if (!correo || !contrasena) {
    return { error: "Ingrese su usuario o correo y su contraseña.", correo };
  }
  const email = correoDeAcceso(correo);
  if (!email) {
    return { error: "Usuario o contraseña incorrectos.", correo };
  }
  if (leerConfigSupabase().estado !== "ok") {
    return { error: "El sistema no tiene configurada la conexión con Supabase.", correo };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: contrasena,
  });
  if (error || !data.user) {
    // Mensaje genérico: no revela si el usuario existe.
    return { error: "Usuario o contraseña incorrectos.", correo };
  }

  // Solo usuarios con perfil interno activo conservan la sesión.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("activo")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!perfil?.activo) {
    await supabase.auth.signOut();
    return {
      error: "Su usuario no está habilitado. Solicite acceso al administrador.",
      correo,
    };
  }

  redirect(destino);
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
