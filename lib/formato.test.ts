import { describe, expect, it } from "vitest";
import { formatearFecha, formatearFechaHora, formatearMoneda, hoyEnTegucigalpa } from "./formato";

describe("formato", () => {
  it("muestra montos en HNL con dos decimales (espacio no separable tras L)", () => {
    expect(formatearMoneda(1500)).toBe("L 1,500.00");
    expect(formatearMoneda("350.5")).toBe("L 350.50");
    expect(formatearMoneda(null)).toBe("—");
  });

  it("muestra fechas como día/mes/año sin cambiar de zona", () => {
    expect(formatearFecha("2020-02-29")).toBe("29/02/2020");
    expect(formatearFecha(null)).toBe("—");
  });

  it("convierte marcas UTC a la hora de Tegucigalpa (UTC-6)", () => {
    expect(formatearFechaHora("2026-10-26T02:30:00Z")).toBe("25/10/2026 20:30");
  });

  it("calcula el día actual en Tegucigalpa", () => {
    expect(hoyEnTegucigalpa(new Date("2026-10-26T04:00:00Z"))).toBe("2026-10-25");
    expect(hoyEnTegucigalpa(new Date("2026-10-26T07:00:00Z"))).toBe("2026-10-26");
  });
});
