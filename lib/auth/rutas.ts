/** Rutas accesibles sin sesión. Todo lo demás exige iniciar sesión. */
const RUTAS_PUBLICAS = ["/login"];

export function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  );
}

/**
 * Devuelve un destino interno seguro para redirigir después del login.
 * Rechaza URLs absolutas, protocolo relativo (//) y barras invertidas para
 * evitar redirecciones abiertas.
 */
export function destinoSeguro(valor: unknown): string {
  if (typeof valor !== "string") return "/";
  const destino = valor.trim();
  if (
    !destino.startsWith("/") ||
    destino.startsWith("//") ||
    destino.includes("\\") ||
    esRutaPublica(destino.split("?")[0])
  ) {
    return "/";
  }
  return destino;
}
