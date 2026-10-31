import { describe, expect, it } from "vitest";
import { duracionDesdeMinutos, formatearDuracion, minutosDesdeDuracion } from "./duracion";
import { proyectarCuotas } from "./membresias/plan-pagos";

describe("Duración y calendario contractual", () => {
  it("convierte minutos, horas y días sin perder fracciones", () => {
    expect(minutosDesdeDuracion("45", "minutos")).toBe(45);
    expect(minutosDesdeDuracion("1.5", "horas")).toBe(90);
    expect(minutosDesdeDuracion("3", "dias")).toBe(4320);
    expect(minutosDesdeDuracion("0.5", "dias")).toBe(720);
  });
  it("rechaza valores inválidos y fracciones menores a un minuto", () => {
    for (const valor of ["", "-1", "0", "Infinity", "1e9", "0.1", "2147483648"]) expect(minutosDesdeDuracion(valor, "minutos")).toBeNull();
  });
  it("preserva minutos exactos al cargar una duración", () => {
    for (const minutos of [1, 90, 120, 1440, 4320, 9001]) {
      const d = duracionDesdeMinutos(minutos);
      expect(minutosDesdeDuracion(d.valor, d.unidad)).toBe(minutos);
    }
    expect(formatearDuracion(3001)).toBe("2 d 2 h 1 min");
  });
  it("día 31: incluye la última cuota y no genera fuera del contrato", () => {
    expect(proyectarCuotas("2027-01-31", 31, "2027-03-30")).toEqual([
      { inicio: "2027-01-31", fin: "2027-02-27" },
      { inicio: "2027-02-28", fin: "2027-03-30" },
    ]);
  });
  it("respeta año bisiesto y excluye un período incompleto", () => {
    expect(proyectarCuotas("2028-01-31", 31, "2028-02-28")).toEqual([{ inicio: "2028-01-31", fin: "2028-02-28" }]);
    expect(proyectarCuotas("2028-01-31", 31, "2028-02-15")).toEqual([]);
  });
});
