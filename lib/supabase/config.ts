export type ConfigSupabase = {
  url: string;
  publishableKey: string;
};

export type ResultadoConfig =
  | { estado: "ok"; config: ConfigSupabase }
  | { estado: "sin_configurar" }
  | { estado: "invalida"; motivo: string };

// Roles de JWT heredados que nunca deben llegar al navegador.
const ROLES_JWT_PROHIBIDOS = new Set(["service_role", "supabase_admin"]);

function rolDeJwt(token: string): string | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  try {
    const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload: unknown = JSON.parse(atob(base64));
    if (payload && typeof payload === "object" && "role" in payload) {
      return typeof payload.role === "string" ? payload.role : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Valida la URL y la clave publicable sin incluir sus valores en los mensajes,
 * para que ningún error pueda filtrar la configuración.
 */
export function validarConfigSupabase(
  url: string | undefined,
  publishableKey: string | undefined,
): ResultadoConfig {
  const urlLimpia = url?.trim() ?? "";
  const claveLimpia = publishableKey?.trim() ?? "";

  if (!urlLimpia && !claveLimpia) return { estado: "sin_configurar" };
  if (!urlLimpia) {
    return { estado: "invalida", motivo: "Falta NEXT_PUBLIC_SUPABASE_URL." };
  }
  if (!claveLimpia) {
    return {
      estado: "invalida",
      motivo: "Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    };
  }

  let urlParseada: URL;
  try {
    urlParseada = new URL(urlLimpia);
  } catch {
    return {
      estado: "invalida",
      motivo: "NEXT_PUBLIC_SUPABASE_URL no es una URL válida.",
    };
  }
  if (urlParseada.protocol !== "https:") {
    return {
      estado: "invalida",
      motivo: "NEXT_PUBLIC_SUPABASE_URL debe usar https.",
    };
  }

  const rol = rolDeJwt(claveLimpia);
  if (
    claveLimpia.startsWith("sb_secret_") ||
    (rol !== null && ROLES_JWT_PROHIBIDOS.has(rol))
  ) {
    return {
      estado: "invalida",
      motivo:
        "La clave configurada es secreta. Use únicamente la clave publicable.",
    };
  }

  return {
    estado: "ok",
    config: { url: urlParseada.origin, publishableKey: claveLimpia },
  };
}

/**
 * Las variables se leen de forma literal para que Next.js pueda incrustarlas
 * en el bundle del navegador.
 */
export function leerConfigSupabase(): ResultadoConfig {
  return validarConfigSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function requerirConfigSupabase(): ConfigSupabase {
  const resultado = leerConfigSupabase();
  if (resultado.estado === "ok") return resultado.config;
  throw new Error(
    resultado.estado === "sin_configurar"
      ? "Supabase no está configurado: copie .env.example a .env.local."
      : resultado.motivo,
  );
}
