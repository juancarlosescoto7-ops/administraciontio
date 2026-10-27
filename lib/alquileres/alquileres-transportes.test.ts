import { describe, expect, it } from "vitest";
import { validarRegistro } from "@/lib/catalogos/validacion";
import { accionesTransporte } from "@/lib/transportes/definiciones";
import {
  accionesAlquiler,
  camposDevolucion,
  diasAlquiler,
  diferenciaCombustible,
  leerAdicionales,
  precioSugerido,
} from "./definiciones";

describe("precio sugerido de alquiler (bloques de 24 horas iniciados, mínimo 1)", () => {
  const base = "2026-11-10T08:00:00-06:00";
  it("cuenta días por bloques de 24 horas iniciados", () => {
    expect(diasAlquiler(base, "2026-11-10T09:00:00-06:00")).toBe(1);
    expect(diasAlquiler(base, "2026-11-11T08:00:00-06:00")).toBe(1);
    expect(diasAlquiler(base, "2026-11-11T08:01:00-06:00")).toBe(2);
    expect(diasAlquiler(base, "2026-11-13T08:00:00-06:00")).toBe(3);
  });
  it("mínimo un día si el intervalo no es válido", () => {
    expect(diasAlquiler(base, base)).toBe(1);
    expect(diasAlquiler(base, "x")).toBe(1);
  });
  it("tarifa por día × días, en centavos exactos", () => {
    expect(precioSugerido(1200, 3)).toBe("3600.00");
    expect(precioSugerido("333.33", 3)).toBe("999.99");
    expect(precioSugerido(0.1, 3)).toBe("0.30");
  });
});

describe("devolución de alquiler", () => {
  it("diferencia de combustible en cuartos", () => {
    expect(diferenciaCombustible("lleno", "medio")).toBe(-2);
    expect(diferenciaCombustible("cuarto", "lleno")).toBe(3);
    expect(diferenciaCombustible(null, "lleno")).toBeNull();
  });
  it("cada cargo adicional exige concepto e importe a la vez", () => {
    const campos = camposDevolucion(false, false);
    const r = validarRegistro({ campos }, { km: "1200", combustible: "medio", adicional1_concepto: "Lavado", adicional1_monto: "400", adicional2_monto: "50" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { adicionales, errores } = leerAdicionales(r.datos);
    expect(adicionales).toEqual([{ concepto: "Lavado", monto: "400.00" }]);
    expect(errores).toHaveProperty("adicional2_concepto");
  });
  it("el motivo de corrección de kilometraje solo se ofrece al administrador", () => {
    expect(camposDevolucion(false, false).some((c) => c.nombre === "motivo_km")).toBe(false);
    expect(camposDevolucion(false, true).some((c) => c.nombre === "motivo_km")).toBe(true);
  });
});

describe("acciones por estado y rol (espejo de las transiciones de la base)", () => {
  it("alquiler: reservado se entrega, modifica o cancela; entregado solo se devuelve", () => {
    expect(accionesAlquiler("reservado", "operador")).toEqual({ modificar: true, entregar: true, devolver: false, cancelar: true });
    expect(accionesAlquiler("entregado", "operador")).toEqual({ modificar: false, entregar: false, devolver: true, cancelar: false });
    for (const estado of ["devuelto", "cancelado"] as const) {
      expect(Object.values(accionesAlquiler(estado, "administrador")).some(Boolean)).toBe(false);
    }
  });
  it("transporte: en curso no se cancela; completado sin acciones", () => {
    const enCurso = accionesTransporte("en_curso", "operador");
    expect(enCurso.finalizar && enCurso.ajustarDuracion).toBe(true);
    expect(enCurso.cancelar || enCurso.iniciar || enCurso.asignar).toBe(false);
    expect(Object.values(accionesTransporte("completado", "administrador")).some(Boolean)).toBe(false);
  });
  it("finanzas no cambia estados operativos", () => {
    expect(Object.values(accionesAlquiler("reservado", "finanzas")).some(Boolean)).toBe(false);
    expect(Object.values(accionesTransporte("solicitado", "finanzas")).some(Boolean)).toBe(false);
  });
});
