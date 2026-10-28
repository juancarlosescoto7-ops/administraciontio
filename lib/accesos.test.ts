import { describe, expect, it } from "vitest";
import { accesosRapidos, coincide } from "./accesos";

describe("accesos rápidos", () => {
  it("solo ofrece las acciones que el rol puede iniciar", () => {
    const finanzas = accesosRapidos("finanzas").map((a) => a.href);
    expect(finanzas).toContain("/finanzas/cobros/nuevo");
    expect(finanzas).toContain("/finanzas/gastos/nuevo");
    expect(finanzas).not.toContain("/ambulancias/nuevo");

    const operador = accesosRapidos("operador").map((a) => a.href);
    expect(operador).toContain("/ambulancias/nuevo");
    expect(operador).not.toContain("/finanzas/gastos/nuevo");

    expect(accesosRapidos("administrador")).toHaveLength(7);
  });

  it("busca sin distinguir tildes ni mayúsculas y exige todas las palabras", () => {
    expect(coincide("membresia", "Membresías")).toBe(true);
    expect(coincide("nueva tras", "Nueva solicitud de traslado")).toBe(true);
    expect(coincide("cobro gasto", "Registrar cobro")).toBe(false);
    expect(coincide("caja", "Cajas y bancos", "Finanzas")).toBe(true);
    expect(coincide("", "Lo que sea")).toBe(true);
  });
});
