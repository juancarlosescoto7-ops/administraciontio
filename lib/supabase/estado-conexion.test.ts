import { describe, expect, it, vi } from "vitest";
import type { ResultadoConfig } from "./config";
import { verificarConexionSupabase } from "./estado-conexion";

const CONFIG_OK: ResultadoConfig = {
  estado: "ok",
  config: {
    url: "https://proyecto-ficticio.supabase.co",
    publishableKey: "sb_publishable_clave_ficticia_123",
  },
};

function fetchQueResponde(status: number) {
  return vi.fn<typeof fetch>(async () => new Response("{}", { status }));
}

describe("verificarConexionSupabase", () => {
  it("consulta el endpoint de salud de Auth con la clave publicable", async () => {
    const fetchSimulado = fetchQueResponde(200);
    const resultado = await verificarConexionSupabase(CONFIG_OK, fetchSimulado);

    expect(resultado.estado).toBe("conectado");
    expect(fetchSimulado).toHaveBeenCalledOnce();
    const [url, init] = fetchSimulado.mock.calls[0];
    expect(url).toBe("https://proyecto-ficticio.supabase.co/auth/v1/health");
    expect(init?.headers).toEqual({ apikey: "sb_publishable_clave_ficticia_123" });
    expect(init?.cache).toBe("no-store");
  });

  it("no contacta la red si falta configuración", async () => {
    const fetchSimulado = fetchQueResponde(200);
    expect(
      await verificarConexionSupabase({ estado: "sin_configurar" }, fetchSimulado),
    ).toEqual({ estado: "sin_configurar" });
    expect(
      await verificarConexionSupabase(
        { estado: "invalida", motivo: "motivo" },
        fetchSimulado,
      ),
    ).toEqual({ estado: "configuracion_invalida", motivo: "motivo" });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it("distingue clave rechazada de otros errores HTTP", async () => {
    expect(
      (await verificarConexionSupabase(CONFIG_OK, fetchQueResponde(401))).estado,
    ).toBe("clave_rechazada");
    expect(
      await verificarConexionSupabase(CONFIG_OK, fetchQueResponde(503)),
    ).toEqual({
      estado: "error",
      detalle: "Supabase respondió con el código HTTP 503.",
    });
  });

  it("reporta fallos de red y tiempo agotado sin filtrar la URL", async () => {
    const sinRed = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed: proyecto-ficticio.supabase.co");
    });
    const agotado = vi.fn<typeof fetch>(async () => {
      throw new DOMException("timeout", "TimeoutError");
    });

    const resultadoRed = await verificarConexionSupabase(CONFIG_OK, sinRed);
    const resultadoAgotado = await verificarConexionSupabase(CONFIG_OK, agotado);

    expect(resultadoRed).toEqual({
      estado: "error",
      detalle: "No se pudo establecer la conexión.",
    });
    expect(resultadoAgotado).toEqual({
      estado: "error",
      detalle: "Sin respuesta en 5 s.",
    });
    expect(JSON.stringify([resultadoRed, resultadoAgotado])).not.toContain(
      "supabase.co",
    );
  });
});
