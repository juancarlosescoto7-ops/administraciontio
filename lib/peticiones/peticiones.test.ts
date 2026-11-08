import { describe, expect, it } from "vitest";
import { esEstadoPeticion, MAXIMO_DESCRIPCION, ordenarPeticiones, validarPeticion } from "./definiciones";

describe("peticiones", () => {
  it("exige descripción y respeta el máximo", () => {
    expect(validarPeticion("   ", "/clientes")).toEqual({ ok: false, error: "Describa qué necesita." });
    expect(validarPeticion(null, null).ok).toBe(false);
    expect(validarPeticion("x".repeat(MAXIMO_DESCRIPCION + 1), null).ok).toBe(false);
    expect(validarPeticion("  Filtrar gastos por mes  ", "/finanzas/gastos")).toEqual({
      ok: true,
      descripcion: "Filtrar gastos por mes",
      pantalla: "/finanzas/gastos",
    });
  });

  it("solo guarda rutas internas como pantalla", () => {
    for (const ruta of ["https://otro.sitio", "//otro.sitio", "", `/${"a".repeat(200)}`, 5]) {
      expect(validarPeticion("Cambio", ruta)).toMatchObject({ ok: true, pantalla: null });
    }
  });

  it("reconoce solo los estados de la tabla", () => {
    expect(["pendiente", "en_proceso", "resuelta", "descartada"].every(esEstadoPeticion)).toBe(true);
    expect(esEstadoPeticion("cerrada")).toBe(false);
    expect(esEstadoPeticion(undefined)).toBe(false);
  });

  it("muestra primero lo abierto y, dentro, lo más reciente", () => {
    const orden = ordenarPeticiones([
      { id: "a", estado: "resuelta", created_at: "2026-11-02T10:00:00Z" },
      { id: "b", estado: "pendiente", created_at: "2026-11-01T10:00:00Z" },
      { id: "c", estado: "en_proceso", created_at: "2026-11-02T09:00:00Z" },
      { id: "d", estado: "descartada", created_at: "2026-10-30T10:00:00Z" },
    ]).map((p) => p.id);
    expect(orden).toEqual(["c", "b", "a", "d"]);
  });
});
