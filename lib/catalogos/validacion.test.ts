import { describe, expect, it } from "vitest";
import { CATALOGOS, obtenerDefinicion } from "./definiciones";
import {
  filtroBusqueda,
  limpiarBusqueda,
  validarRegistro,
  valoresDesdeRegistro,
} from "./validacion";

const HOY = "2026-10-25";

describe("validarRegistro", () => {
  it("crea un cliente natural sin RTN ni contacto", () => {
    const resultado = validarRegistro(
      CATALOGOS.clientes,
      { tipo: "natural", nombre: "  María López  ", identificacion: "", activo: "on" },
      HOY,
    );
    expect(resultado).toEqual({
      ok: true,
      datos: {
        tipo: "natural",
        nombre: "María López",
        identificacion: null,
        telefono: null,
        correo: null,
        direccion: null,
        activo: true,
      },
    });
  });

  it("exige los campos obligatorios y valida correo, teléfono y opciones", () => {
    const resultado = validarRegistro(
      CATALOGOS.clientes,
      { tipo: "empresa", nombre: " ", correo: "sin-arroba", telefono: "abc" },
      HOY,
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(Object.keys(resultado.errores).sort()).toEqual(["correo", "nombre", "telefono", "tipo"]);
    }
  });

  it("permite un beneficiario menor sin identidad y rechaza nacimiento futuro", () => {
    expect(
      validarRegistro(CATALOGOS.beneficiarios, { nombre: "Niño Pérez", fecha_nacimiento: "2020-02-29" }, HOY)
        .ok,
    ).toBe(true);
    const futuro = validarRegistro(
      CATALOGOS.beneficiarios,
      { nombre: "Niño Pérez", fecha_nacimiento: "2026-10-26" },
      HOY,
    );
    expect(futuro.ok).toBe(false);
    const inexistente = validarRegistro(
      CATALOGOS.beneficiarios,
      { nombre: "Niño Pérez", fecha_nacimiento: "2021-02-29" },
      HOY,
    );
    expect(inexistente.ok).toBe(false);
  });

  it("normaliza código y placa del vehículo a mayúsculas y valida el año", () => {
    const resultado = validarRegistro(
      CATALOGOS.vehiculos,
      { codigo: " amb-01 ", placa: "hab 1234", tipo: "ambulancia", estado: "operativo", anio: "2019" },
      HOY,
    );
    expect(resultado.ok && resultado.datos).toMatchObject({
      codigo: "AMB-01",
      placa: "HAB 1234",
      anio: 2019,
      marca: null,
      activo: false,
    });
    expect(
      validarRegistro(CATALOGOS.vehiculos, { codigo: "A", tipo: "mixto", estado: "operativo", anio: "1800" }, HOY)
        .ok,
    ).toBe(false);
  });

  it("valida montos como texto decimal de hasta 2 decimales, sin float ni negativos", () => {
    const base = { nombre: "Plan", cupo_mensual: "2", modalidad_cupo: "compartido", dias_gracia: "5" };
    const casos: [string, string | null][] = [
      ["1500", "1500.00"],
      ["1,500.5", "1500.50"],
      ["0", "0.00"],
      ["007.10", "7.10"],
      ["999999999999.99", "999999999999.99"],
      ["-1", null],
      ["1.234", null],
      ["1e3", null],
      ["1000000000000", null],
    ];
    for (const [entrada, esperado] of casos) {
      const resultado = validarRegistro(CATALOGOS.planes, { ...base, precio_mensual: entrada }, HOY);
      if (esperado === null) expect(resultado.ok, entrada).toBe(false);
      else expect(resultado.ok && resultado.datos.precio_mensual, entrada).toBe(esperado);
    }
  });

  it("rechaza cupo y días de gracia negativos o no enteros", () => {
    const base = { nombre: "Plan", precio_mensual: "100", modalidad_cupo: "individual" };
    expect(validarRegistro(CATALOGOS.planes, { ...base, cupo_mensual: "-1", dias_gracia: "0" }, HOY).ok).toBe(false);
    expect(validarRegistro(CATALOGOS.planes, { ...base, cupo_mensual: "1.5", dias_gracia: "0" }, HOY).ok).toBe(false);
    expect(validarRegistro(CATALOGOS.planes, { ...base, cupo_mensual: "0", dias_gracia: "0" }, HOY).ok).toBe(true);
  });

  it("no admite la actividad 'general' en tarifas", () => {
    const resultado = validarRegistro(
      CATALOGOS.tarifas,
      { actividad: "general", nombre: "T", unidad: "dia", precio_base: "10" },
      HOY,
    );
    expect(resultado.ok).toBe(false);
  });
});

describe("valoresDesdeRegistro", () => {
  it("usa los valores predeterminados para un registro nuevo", () => {
    expect(valoresDesdeRegistro(CATALOGOS.clientes, null)).toMatchObject({ tipo: "natural", activo: "on", nombre: "" });
  });

  it("convierte una fila de la base en valores de formulario", () => {
    const valores = valoresDesdeRegistro(CATALOGOS.planes, {
      nombre: "Básico",
      precio_mensual: 350,
      cupo_mensual: 2,
      modalidad_cupo: "compartido",
      dias_gracia: 5,
      activo: false,
    });
    expect(valores).toEqual({
      nombre: "Básico",
      precio_mensual: "350.00",
      cupo_mensual: "2",
      modalidad_cupo: "compartido",
      dias_gracia: "5",
      activo: "",
    });
  });
});

describe("búsqueda", () => {
  it("quita caracteres que alteran el filtro de PostgREST", () => {
    expect(limpiarBusqueda("  Juan, (Pérez)*  %_\"x\" ")).toBe("Juan Pérez x");
    expect(limpiarBusqueda("0801-1990-12345")).toBe("0801-1990-12345");
    expect(limpiarBusqueda(undefined)).toBe("");
    expect(limpiarBusqueda("a".repeat(100))).toHaveLength(60);
  });

  it("arma un filtro or con ilike entre comillas", () => {
    expect(filtroBusqueda(["nombre", "telefono"], "ana")).toBe('nombre.ilike."%ana%",telefono.ilike."%ana%"');
  });
});

describe("obtenerDefinicion", () => {
  it("rechaza catálogos desconocidos o heredados de Object", () => {
    expect(() => obtenerDefinicion("perfiles")).toThrow();
    expect(() => obtenerDefinicion("toString")).toThrow();
    expect(obtenerDefinicion("vehiculos").tabla).toBe("vehiculos");
  });
});
