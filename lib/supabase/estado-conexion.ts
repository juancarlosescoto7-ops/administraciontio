import { leerConfigSupabase, type ResultadoConfig } from "./config";

export type EstadoConexion =
  | { estado: "sin_configurar" }
  | { estado: "configuracion_invalida"; motivo: string }
  | { estado: "conectado"; latenciaMs: number }
  | { estado: "clave_rechazada" }
  | { estado: "error"; detalle: string };

const TIEMPO_MAXIMO_MS = 5000;

/**
 * Consulta el endpoint de salud de Supabase Auth con la clave publicable.
 * El gateway de Supabase rechaza claves inválidas, así que una respuesta 200
 * confirma que el proyecto es alcanzable y que la clave es aceptada.
 * Debe ejecutarse solo en el servidor. Los resultados nunca incluyen la URL
 * ni la clave.
 */
export async function verificarConexionSupabase(
  resultadoConfig: ResultadoConfig = leerConfigSupabase(),
  fetchImpl: typeof fetch = fetch,
): Promise<EstadoConexion> {
  if (resultadoConfig.estado === "sin_configurar") {
    return { estado: "sin_configurar" };
  }
  if (resultadoConfig.estado === "invalida") {
    return { estado: "configuracion_invalida", motivo: resultadoConfig.motivo };
  }

  const { url, publishableKey } = resultadoConfig.config;
  const inicio = performance.now();

  let respuesta: Response;
  try {
    respuesta = await fetchImpl(`${url}/auth/v1/health`, {
      headers: { apikey: publishableKey },
      cache: "no-store",
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
  } catch (error) {
    const agotado =
      error instanceof DOMException && error.name === "TimeoutError";
    return {
      estado: "error",
      detalle: agotado
        ? `Sin respuesta en ${TIEMPO_MAXIMO_MS / 1000} s.`
        : "No se pudo establecer la conexión.",
    };
  }

  if (respuesta.ok) {
    return {
      estado: "conectado",
      latenciaMs: Math.round(performance.now() - inicio),
    };
  }
  if (respuesta.status === 401 || respuesta.status === 403) {
    return { estado: "clave_rechazada" };
  }
  return {
    estado: "error",
    detalle: `Supabase respondió con el código HTTP ${respuesta.status}.`,
  };
}
