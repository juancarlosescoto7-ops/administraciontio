import { afterEach, describe, expect, it, vi } from "vitest";
import {
  leerConfigSupabase,
  requerirConfigSupabase,
  validarConfigSupabase,
} from "./config";

const URL_FICTICIA = "https://proyecto-ficticio.supabase.co";
const CLAVE_FICTICIA = "sb_publishable_clave_ficticia_123";

function jwtFicticio(payload: object) {
  const codificar = (valor: object) =>
    Buffer.from(JSON.stringify(valor)).toString("base64url");
  return `${codificar({ alg: "HS256", typ: "JWT" })}.${codificar(payload)}.firma`;
}

describe("validarConfigSupabase", () => {
  it("acepta URL https y clave publicable, normalizando la URL", () => {
    expect(validarConfigSupabase(` ${URL_FICTICIA}/ `, CLAVE_FICTICIA)).toEqual({
      estado: "ok",
      config: { url: URL_FICTICIA, publishableKey: CLAVE_FICTICIA },
    });
  });

  it("acepta la clave anon heredada (JWT con rol anon)", () => {
    const anon = jwtFicticio({ role: "anon" });
    expect(validarConfigSupabase(URL_FICTICIA, anon).estado).toBe("ok");
  });

  it("indica sin configurar cuando faltan ambas variables", () => {
    expect(validarConfigSupabase(undefined, undefined)).toEqual({
      estado: "sin_configurar",
    });
    expect(validarConfigSupabase("  ", "")).toEqual({ estado: "sin_configurar" });
  });

  it("rechaza configuración parcial", () => {
    expect(validarConfigSupabase(URL_FICTICIA, undefined).estado).toBe("invalida");
    expect(validarConfigSupabase(undefined, CLAVE_FICTICIA).estado).toBe("invalida");
  });

  it("rechaza URL mal formada o sin https", () => {
    expect(validarConfigSupabase("no-es-url", CLAVE_FICTICIA).estado).toBe("invalida");
    expect(
      validarConfigSupabase("http://proyecto-ficticio.supabase.co", CLAVE_FICTICIA)
        .estado,
    ).toBe("invalida");
  });

  it("rechaza claves secretas nuevas y service_role heredada", () => {
    expect(
      validarConfigSupabase(URL_FICTICIA, "sb_secret_ficticia").estado,
    ).toBe("invalida");
    expect(
      validarConfigSupabase(URL_FICTICIA, jwtFicticio({ role: "service_role" }))
        .estado,
    ).toBe("invalida");
  });

  it("no incluye la clave ni la URL en el motivo de error", () => {
    const secreta = "sb_secret_no_debe_aparecer";
    const resultado = validarConfigSupabase(URL_FICTICIA, secreta);
    expect(resultado.estado).toBe("invalida");
    if (resultado.estado === "invalida") {
      expect(resultado.motivo).not.toContain(secreta);
      expect(resultado.motivo).not.toContain(URL_FICTICIA);
    }
  });
});

describe("leerConfigSupabase / requerirConfigSupabase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lee las variables NEXT_PUBLIC_ del entorno", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_FICTICIA);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", CLAVE_FICTICIA);
    expect(leerConfigSupabase().estado).toBe("ok");
    expect(requerirConfigSupabase().url).toBe(URL_FICTICIA);
  });

  it("lanza un error claro si falta la configuración", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => requerirConfigSupabase()).toThrow(/\.env\.local/);
  });
});
