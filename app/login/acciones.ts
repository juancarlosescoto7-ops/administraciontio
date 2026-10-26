"use server";

import { redirect } from "next/navigation";
import { destinoSeguro } from "@/lib/auth/rutas";
import { leerConfigSupabase } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type EstadoLogin = { error: string | null; correo: string };

export async function iniciarSesion(
  _anterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const correo = String(formData.get("correo") ?? "").trim().toLowerCase();
  const contrasena = String(formData.get("contrasena") ?? "");
  const destino = destinoSeguro(formData.get("siguiente"));

  if (!correo || !contrasena) {
    return { error: "Ingrese su correo y su contraseña.", correo };
  }
  if (leerConfigSupabase().estado !== "ok") {
    return { error: "El sistema no tiene configurada la conexión con Supabase.", correo };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });
  if (error || !data.user) {
    // Mensaje genérico: no revela si el correo existe.
    return { error: "Correo o contraseña incorrectos.", correo };
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
