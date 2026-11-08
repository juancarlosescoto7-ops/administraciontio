import { describe, expect, it } from "vitest";
import { puede } from "@/lib/auth/roles";
import { formatearVoucher, ganancia, importeEnLetras, leerLineas, totalesLineas } from "./lineas";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base = { clave: U(1), categoria: U(2), destinatario: `e:${U(3)}`, concepto: "Bono por servicio", monto: "500", pagarAhora: false, cuenta: "", metodo: "efectivo", referencia: "" };

describe("líneas de bonos y gastos del servicio", () => {
  it("sin líneas no registra nada", () => {
    expect(leerLineas(null)).toEqual({ lineas: [] });
    expect(leerLineas("")).toEqual({ lineas: [] });
    expect(leerLineas("[]")).toEqual({ lineas: [] });
  });

  it("convierte destinatario, importe y pago inmediato", () => {
    const r = leerLineas(JSON.stringify([
      { ...base, pagarAhora: true, cuenta: U(9), referencia: " R-1 " },
      { ...base, clave: U(4), destinatario: `p:${U(5)}`, monto: "1,250.5" },
      { ...base, clave: U(6), destinatario: "" },
    ]));
    expect(r.error).toBeUndefined();
    expect(r.lineas![0]).toEqual({
      idempotencia: U(1), categoria_id: U(2), concepto: "Bono por servicio", monto: "500.00", empleado_id: U(3),
      pago: { cuenta_dinero_id: U(9), metodo: "efectivo", referencia: "R-1", monto: "500.00" },
    });
    expect(r.lineas![1]).toMatchObject({ proveedor_id: U(5), monto: "1250.50" });
    expect(r.lineas![1].pago).toBeUndefined();
    expect(r.lineas![2]).not.toHaveProperty("empleado_id");
  });

  it("rechaza datos incompletos con el número de línea", () => {
    const una = (cambios: object) => leerLineas(JSON.stringify([base, { ...base, clave: U(7), ...cambios }])).error;
    expect(una({ monto: "0" })).toBe("Línea 2: indique un importe mayor que cero.");
    expect(una({ monto: "1.234" })).toMatch(/Línea 2: indique un importe/);
    expect(una({ concepto: "  " })).toBe("Línea 2: escriba el concepto.");
    expect(una({ categoria: "" })).toBe("Línea 2: elija el tipo de gasto.");
    expect(una({ destinatario: "x:123" })).toBe("Línea 2: elija a quién se le paga.");
    expect(una({ pagarAhora: true, cuenta: "" })).toBe("Línea 2: elija de qué caja o banco sale el pago.");
    expect(una({ pagarAhora: true, cuenta: U(9), metodo: "cheque" })).toBe("Línea 2: método de pago no válido.");
    expect(una({ clave: "no" })).toMatch(/caducó/);
    expect(leerLineas("{").error).toMatch(/formato/);
    expect(leerLineas(JSON.stringify(Array.from({ length: 21 }, () => base))).error).toMatch(/máximo 20/);
  });

  it("totales y ganancia en centavos exactos", () => {
    expect(totalesLineas([{ monto: "0.10", pagarAhora: true }, { monto: "0.20", pagarAhora: false }, { monto: "x", pagarAhora: true }]))
      .toEqual({ total: 30, pagado: 10, pendiente: 20 });
    expect(ganancia("5000", [500, "800.00"])).toBe(370000);
    expect(ganancia(1000, [1500])).toBe(-50000);
    expect(ganancia(null, [])).toBe(0);
  });
});

describe("voucher", () => {
  it("numera con seis cifras", () => {
    expect(formatearVoucher(12)).toBe("V-000012");
    expect(formatearVoucher(1234567)).toBe("V-1234567");
  });

  it("escribe el importe en letras", () => {
    expect(importeEnLetras(50000)).toBe("Quinientos lempiras con 00/100");
    expect(importeEnLetras(100)).toBe("Un lempira con 00/100");
    expect(importeEnLetras(150050)).toBe("Mil quinientos lempiras con 50/100");
    expect(importeEnLetras(2100)).toBe("Veintiún lempiras con 00/100");
    expect(importeEnLetras(10000)).toBe("Cien lempiras con 00/100");
    expect(importeEnLetras(10100)).toBe("Ciento un lempiras con 00/100");
    expect(importeEnLetras(3575025)).toBe("Treinta y cinco mil setecientos cincuenta lempiras con 25/100");
    expect(importeEnLetras(2100000)).toBe("Veintiún mil lempiras con 00/100");
    expect(importeEnLetras(100000000)).toBe("Un millón de lempiras con 00/100");
    expect(importeEnLetras(250000000)).toBe("Dos millones quinientos mil lempiras con 00/100");
    expect(importeEnLetras(5)).toBe("Cero lempiras con 05/100");
  });
});

describe("permisos de bonos y gastos del servicio", () => {
  it("quien registra el servicio también registra y paga sus bonos", () => {
    expect(puede("gestionarGastosServicio", "operador")).toBe(true);
    expect(puede("gestionarGastosServicio", "administrador")).toBe(true);
    expect(puede("gestionarGastosServicio", "finanzas")).toBe(true);
    // Los gastos generales siguen siendo de administrador y finanzas.
    expect(puede("gestionarGastos", "operador")).toBe(false);
  });
});
