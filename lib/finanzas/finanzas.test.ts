import { describe, expect, it } from "vitest";
import { puede } from "@/lib/auth/roles";
import { validarRegistro } from "@/lib/catalogos/validacion";
import { camposCobro, camposCorreccion, camposGasto, camposTransferencia } from "./definiciones";
import { aCentavos, centavosATexto, sumarMontos } from "./montos";

describe("importes en centavos (sin float)", () => {
  it("convierte texto y números de la base", () => {
    expect(aCentavos("1,250.5")).toBe(125050);
    expect(aCentavos("1500")).toBe(150000);
    expect(aCentavos(0.1)).toBe(10);
    expect(aCentavos(-300)).toBe(-30000);
    expect(aCentavos("999999999999.99")).toBe(99999999999999);
    expect(aCentavos("1.234")).toBeNull();
    expect(aCentavos("abc")).toBeNull();
    expect(aCentavos(null)).toBeNull();
  });

  it("suma exacta donde el float falla", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumarMontos([0.1, 0.2])).toBe("0.30");
    expect(sumarMontos(["1500.00", -500, null, "0.01"])).toBe("1000.01");
    expect(sumarMontos([])).toBe("0.00");
  });

  it("vuelve a texto decimal para PostgreSQL", () => {
    expect(centavosATexto(150000)).toBe("1500.00");
    expect(centavosATexto(5)).toBe("0.05");
    expect(centavosATexto(-30000)).toBe("-300.00");
  });
});

describe("permisos financieros (espejo de las funciones SQL)", () => {
  it("los tres roles registran cobros y aplican saldo a favor", () => {
    for (const rol of ["administrador", "operador", "finanzas"] as const) expect(puede("registrarCobro", rol)).toBe(true);
  });

  it("solo el administrador registra cargos administrativos y corrige", () => {
    expect(puede("registrarCargo", "administrador")).toBe(true);
    expect(puede("registrarCargo", "operador")).toBe(false);
    expect(puede("registrarCargo", "finanzas")).toBe(false);
    expect(puede("corregir", "administrador")).toBe(true);
    expect(puede("corregir", "operador")).toBe(false);
    expect(puede("corregir", "finanzas")).toBe(false);
  });

  it("gastos, transferencias y tesorería: administrador y finanzas", () => {
    for (const permiso of ["gestionarGastos", "transferir", "verTesoreria"] as const) {
      expect(puede(permiso, "administrador")).toBe(true);
      expect(puede(permiso, "finanzas")).toBe(true);
      expect(puede(permiso, "operador")).toBe(false);
    }
  });
});

describe("validación de formularios financieros", () => {
  const hoy = "2026-10-26";
  const cuenta = "3f2a1d6e-1b2c-4d5e-8f90-123456789abc";

  it("cobro válido: importe como texto decimal y cuenta como UUID", () => {
    const r = validarRegistro(
      { campos: camposCobro([], hoy) },
      { monto: "1,500", cuenta_dinero_id: cuenta, fecha: hoy, metodo: "efectivo", referencia: "" },
      hoy,
    );
    expect(r).toEqual({
      ok: true,
      datos: { monto: "1500.00", cuenta_dinero_id: cuenta, fecha: hoy, metodo: "efectivo", referencia: null },
    });
  });

  it("rechaza cuenta que no es UUID, fecha futura y método desconocido", () => {
    const r = validarRegistro(
      { campos: camposCobro([], hoy) },
      { monto: "10", cuenta_dinero_id: "1 or 1=1", fecha: "2026-10-27", metodo: "bitcoin" },
      hoy,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(["cuenta_dinero_id", "fecha", "metodo"]);
  });

  it("gasto sin pago inmediato deja los campos del pago vacíos", () => {
    const r = validarRegistro(
      { campos: camposGasto(hoy, [], [], []) },
      { concepto: "Diésel", monto: "800", categoria_id: cuenta, actividad: "general", fecha: hoy, pago_metodo: "efectivo" },
      hoy,
    );
    expect(r.ok && r.datos.pago_monto === null && r.datos.proveedor_id === null && r.datos.monto === "800.00").toBe(true);
  });

  it("transferencia exige origen y destino", () => {
    const r = validarRegistro({ campos: camposTransferencia([], hoy) }, { monto: "1000", fecha: hoy }, hoy);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toMatchObject({ cuenta_origen_id: expect.any(String), cuenta_destino_id: expect.any(String) });
  });

  it("los reversos exigen motivo", () => {
    const r = validarRegistro({ campos: camposCorreccion("Confirmo") }, { motivo: "  ", confirmar: "on" }, hoy);
    expect(r.ok).toBe(false);
  });
});
