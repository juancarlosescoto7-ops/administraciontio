import { describe, expect, it } from "vitest";
import { puede } from "@/lib/auth/roles";
import { validarRegistro } from "@/lib/catalogos/validacion";
import { aFechaHoraLocal, momentoDesdeLocal } from "@/lib/formato";
import { accionesDisponibles, camposSolicitud, DURACION_PREDETERMINADA, type EstadoTraslado } from "./definiciones";

const acciones = (estado: EstadoTraslado, tipo: "cubierto" | "particular" = "cubierto", reserva: "reservada" | "consumida" | null = null) =>
  accionesDisponibles({ estado, tipo, reservaEstado: reserva }, "operador");

describe("acciones por estado (espejo de las transiciones de la base)", () => {
  it("solicitado: programar, asignar, iniciar, cancelar; no finalizar", () => {
    const a = acciones("solicitado");
    expect([a.programar, a.asignar, a.reprogramar, a.iniciar, a.cancelar, a.revalidar, a.convertir]).toEqual(Array(7).fill(true));
    expect(a.finalizar).toBe(false);
  });

  it("programado: ya no se programa; sí se inicia o cancela", () => {
    const a = acciones("programado");
    expect(a.programar).toBe(false);
    expect(a.iniciar && a.cancelar).toBe(true);
  });

  it("en curso: solo finalizar, ajustar duración y editar; no cancelar ni reprogramar", () => {
    const a = acciones("en_curso");
    expect(a.finalizar && a.ajustarDuracion && a.editar).toBe(true);
    expect(a.cancelar || a.reprogramar || a.iniciar || a.asignar || a.convertir).toBe(false);
  });

  it("completado y cancelado: sin acciones operativas", () => {
    for (const estado of ["completado", "cancelado"] as const) {
      expect(Object.values(acciones(estado)).some(Boolean)).toBe(false);
    }
  });

  it("particular: no se revalida ni se convierte", () => {
    const a = acciones("solicitado", "particular");
    expect(a.revalidar || a.convertir).toBe(false);
  });

  it("revertir un consumo: solo administrador, completado cubierto con beneficio consumido", () => {
    const traslado = { estado: "completado" as const, tipo: "cubierto" as const, reservaEstado: "consumida" as const };
    expect(accionesDisponibles(traslado, "administrador").revertirConsumo).toBe(true);
    expect(accionesDisponibles(traslado, "operador").revertirConsumo).toBe(false);
    expect(accionesDisponibles({ ...traslado, reservaEstado: "reservada" }, "administrador").revertirConsumo).toBe(false);
  });

  it("finanzas consulta y cobra, pero no cambia estados operativos", () => {
    expect(Object.values(accionesDisponibles({ estado: "solicitado", tipo: "cubierto", reservaEstado: null }, "finanzas")).some(Boolean)).toBe(false);
    expect(puede("gestionarTraslados", "finanzas")).toBe(false);
    expect(puede("registrarCobro", "finanzas")).toBe(true);
  });
});

describe("fecha y hora de Tegucigalpa (UTC−6)", () => {
  it("convierte la hora local del formulario a timestamptz y de vuelta", () => {
    expect(momentoDesdeLocal("2026-10-28T14:30")).toBe("2026-10-28T14:30:00-06:00");
    expect(aFechaHoraLocal("2026-10-28T20:30:00+00:00")).toBe("2026-10-28T14:30");
    expect(aFechaHoraLocal("2026-10-29T03:15:00Z")).toBe("2026-10-28T21:15");
    expect(aFechaHoraLocal(null)).toBe("");
  });
});

describe("formulario de solicitud", () => {
  const base = { beneficiarios: [], vehiculos: [], conductores: [], ahora: "2026-10-28T08:00" };
  const id = "11111111-1111-4111-8111-111111111111";

  it("cubierto exige beneficiario; la duración por omisión es 90", () => {
    const campos = camposSolicitud({ ...base, tipo: "cubierto" });
    const sin = validarRegistro({ campos }, { inicio: "2026-10-28T08:00", minutos: "90", origen: "Casa" });
    expect(sin.ok ? {} : sin.errores).toHaveProperty("beneficiario_id");
    expect(campos.find((c) => c.nombre === "minutos")?.predeterminado).toBe(String(DURACION_PREDETERMINADA));
  });

  it("solicitud urgente particular: basta con la hora y el origen", () => {
    const campos = camposSolicitud({ ...base, tipo: "particular" });
    const r = validarRegistro({ campos }, { inicio: "2026-10-28T08:00", minutos: "90", origen: "Casa" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.inicio).toBe("2026-10-28T08:00:00-06:00");
  });

  it("rechaza hora, duración y recursos no válidos", () => {
    const campos = camposSolicitud({ ...base, tipo: "particular" });
    const r = validarRegistro({ campos }, { inicio: "2026-10-28T25:00", minutos: "0", origen: "Casa", vehiculo_id: "x", conductor_id: id });
    expect(r.ok ? {} : r.errores).toMatchObject({ inicio: expect.any(String), minutos: expect.any(String), vehiculo_id: expect.any(String) });
  });
});
