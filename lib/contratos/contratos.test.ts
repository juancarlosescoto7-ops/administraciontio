import { describe, expect, it } from "vitest";
import { puede } from "@/lib/auth/roles";
import {
  CONTRATO_SERVICIO,
  esTipoContrato,
  esTipoContratoServicio,
  TIPOS_CONTRATO,
  VARIABLES_CONTRATO,
  variablesDesconocidas,
} from "./definiciones";

describe("contratos por tipo", () => {
  it("cada tipo tiene variables sin repetir y comparte los datos del cliente", () => {
    for (const { valor } of TIPOS_CONTRATO) {
      const nombres = VARIABLES_CONTRATO[valor].map((v) => v.nombre);
      expect(new Set(nombres).size).toBe(nombres.length);
      expect(nombres).toEqual(expect.arrayContaining(["fecha_contrato", "fecha_contrato_letras", "cliente_nombre"]));
    }
  });

  it("detecta las variables desconocidas según el tipo", () => {
    expect(variablesDesconocidas("Hola {{cliente_nombre}} y {{ plan }}", "membresia")).toEqual([]);
    expect(variablesDesconocidas("{{cliente_nonbre}} {{precio}} {{cliente_nonbre}}", "membresia")).toEqual(["cliente_nonbre", "precio"]);
    expect(variablesDesconocidas("{{vehiculo_placa}} {{precio_total}}", "alquiler")).toEqual([]);
    expect(variablesDesconocidas("{{plan}} {{conductor_nombre}}", "alquiler")).toEqual(["plan", "conductor_nombre"]);
    expect(variablesDesconocidas("{{conductor_nombre}} {{origen}}", "transporte")).toEqual([]);
    expect(variablesDesconocidas("{{paciente}} {{motivo}} {{plan}}", "traslado")).toEqual([]);
  });

  it("los tipos de servicio excluyen la membresía y validan valores externos", () => {
    expect(esTipoContrato("membresia")).toBe(true);
    expect(esTipoContratoServicio("membresia")).toBe(false);
    expect(esTipoContratoServicio("traslado")).toBe(true);
    expect(esTipoContrato("otro")).toBe(false);
    expect(esTipoContrato(undefined)).toBe(false);
  });

  it("generan contratos de servicio el administrador y el operador, no finanzas", () => {
    for (const { permiso } of Object.values(CONTRATO_SERVICIO)) {
      expect(puede(permiso, "administrador")).toBe(true);
      expect(puede(permiso, "operador")).toBe(true);
      expect(puede(permiso, "finanzas")).toBe(false);
    }
    expect(puede("gestionarContrato", "operador")).toBe(false);
  });
});
