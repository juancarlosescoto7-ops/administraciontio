import { describe, expect, it } from "vitest";
import { camposEntrega } from "@/lib/alquileres/definiciones";
import { camposFinalizar } from "@/lib/ambulancias/definiciones";
import { camposFinalizarTransporte } from "@/lib/transportes/definiciones";
import { validarRegistro } from "@/lib/catalogos/validacion";
import { camposKmSalida, camposMantenimiento, estadoMantenimiento, formatearDiferencia, formatearKm, rutaOrigen } from "./definiciones";

describe("flota", () => {
  it("marca vencido por kilometraje o por fecha", () => {
    const hoy = "2026-11-02";
    expect(estadoMantenimiento({ km_para_mantenimiento: 0, proxima_fecha: null }, hoy)).toBe("vencido");
    expect(estadoMantenimiento({ km_para_mantenimiento: -15, proxima_fecha: null }, hoy)).toBe("vencido");
    expect(estadoMantenimiento({ km_para_mantenimiento: 500, proxima_fecha: "2026-11-02" }, hoy)).toBe("vencido");
    expect(estadoMantenimiento({ km_para_mantenimiento: 500, proxima_fecha: "2026-12-01" }, hoy)).toBe("programado");
    expect(estadoMantenimiento({ km_para_mantenimiento: null, proxima_fecha: null }, hoy)).toBe("sin_programar");
  });

  it("formatea kilometraje y diferencias con signo", () => {
    expect(formatearKm(null)).toBe("—");
    expect(formatearKm(1250)).toMatch(/^1.250 km$/);
    expect(formatearDiferencia(0)).toBe("—");
    expect(formatearDiferencia(null)).toBe("—");
    expect(formatearDiferencia(50)).toBe("+50 km");
    expect(formatearDiferencia(-20)).toBe("−20 km");
  });

  it("enlaza cada recorrido con su servicio; los mantenimientos no tienen ficha", () => {
    expect(rutaOrigen("transporte", "a")).toBe("/transportes/a");
    expect(rutaOrigen("traslado", "a")).toBe("/ambulancias/a");
    expect(rutaOrigen("alquiler", "a")).toBe("/alquileres/a");
    expect(rutaOrigen("mantenimiento", "a")).toBeNull();
    expect(rutaOrigen("transporte", null)).toBeNull();
  });

  it("exige kilometraje de salida y deja el motivo de descuadre opcional", () => {
    const campos = camposKmSalida(1100);
    expect(validarRegistro({ campos }, { km_salida: "", motivo_descuadre_km: "" }).ok).toBe(false);
    expect(validarRegistro({ campos }, { km_salida: "1100", motivo_descuadre_km: "" })).toEqual({
      ok: true,
      datos: { km_salida: 1100, motivo_descuadre_km: null },
    });
    expect(campos[0].ayuda).toContain("1");
    expect(camposKmSalida(null)[0].ayuda).toContain("fija la base");
  });

  it("pide kilometraje en todos los servicios con vehículo", () => {
    const entrega = camposEntrega(1300);
    expect(entrega.find((c) => c.nombre === "km")).toMatchObject({ requerido: true, predeterminado: "1300" });
    expect(entrega.some((c) => c.nombre === "motivo_descuadre_km")).toBe(true);
    expect(camposFinalizarTransporte(false, 1000)[0]).toMatchObject({ nombre: "km_llegada", requerido: true });
    expect(camposFinalizar(true, 1000)[0]).toMatchObject({ nombre: "km_llegada", requerido: true });
  });

  it("propone la última llegada como salida del mantenimiento", () => {
    const campos = camposMantenimiento(1410, "2026-11-02T08:00");
    expect(campos.find((c) => c.nombre === "km_salida")?.predeterminado).toBe("1410");
    expect(campos.find((c) => c.nombre === "proximo_km")?.requerido).toBeFalsy();
    expect(camposMantenimiento(null, "2026-11-02T08:00").find((c) => c.nombre === "km_salida")?.predeterminado).toBeUndefined();
  });
});
