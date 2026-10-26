import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requerirConfigSupabase } from "./config";

/**
 * Cliente para Server Components, Server Actions y Route Handlers.
 * Crear uno nuevo por solicitud; no guardarlo en variables globales.
 */
export async function createClient() {
  const { url, publishableKey } = requerirConfigSupabase();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Un Server Component no puede escribir cookies; proxy.ts refresca la sesión.
        }
      },
    },
  });
}
