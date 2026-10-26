import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { esRutaPublica } from "@/lib/auth/rutas";
import { leerConfigSupabase } from "./config";

/**
 * Refresca la sesión de Supabase Auth, propaga las cookies actualizadas y
 * redirige al login cuando no hay sesión válida. Es una comprobación
 * optimista: cada página, Server Action y la RLS vuelven a verificar el acceso.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;

  const resultado = leerConfigSupabase();
  if (resultado.estado !== "ok") {
    // Sin configuración no hay forma de autenticar: el login explica el problema.
    return esRutaPublica(pathname) ? response : redirigir(request, response, "/login");
  }
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
  const { data } = await supabase.auth.getClaims();
  const autenticado = Boolean(data?.claims?.sub);

  if (!autenticado && !esRutaPublica(pathname)) {
    const siguiente = pathname === "/" ? null : `${pathname}${search}`;
    return redirigir(request, response, "/login", siguiente);
  }
  if (autenticado && pathname === "/login") {
    return redirigir(request, response, "/");
  }

  return response;
}

function redirigir(
  request: NextRequest,
  response: NextResponse,
  destino: string,
  siguiente: string | null = null,
) {
  const url = request.nextUrl.clone();
  url.pathname = destino;
  url.search = "";
  if (siguiente) url.searchParams.set("siguiente", siguiente);

  // Conserva las cookies de sesión refrescadas (o eliminadas) en la redirección.
  const redireccion = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie));
  return redireccion;
}
