import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { leerConfigSupabase } from "./config";

/**
 * Refresca la sesión de Supabase Auth y propaga las cookies actualizadas.
 * En E0 no redirige ni protege rutas: el control de acceso llega en E1.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const resultado = leerConfigSupabase();
  if (resultado.estado !== "ok") return response;
  const { url, publishableKey } = resultado.config;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([clave, valor]) =>
          response.headers.set(clave, valor),
        );
      },
    },
  });

  // No ejecutar código entre la creación del cliente y getClaims():
  // es lo que valida y refresca el token de la sesión.
  await supabase.auth.getClaims();

  return response;
}
