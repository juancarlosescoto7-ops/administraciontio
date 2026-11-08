import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { leerLineas } from "@/lib/bonos/lineas";
import type { OpcionesLineas } from "@/lib/bonos/servidor";
import { LineasGasto } from "./lineas-gasto";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const opciones: OpcionesLineas = {
  categorias: [{ valor: U(1), etiqueta: "Bonos" }, { valor: U(2), etiqueta: "Combustible" }],
  bonos: U(1),
  empleados: [{ valor: `e:${U(3)}`, etiqueta: "Ana · Ventas" }],
  conductores: [{ valor: `c:${U(4)}`, etiqueta: "Luis" }],
  proveedores: [],
  cuentas: [{ valor: U(5), etiqueta: "Caja (caja)" }],
};

function pintar(props: Partial<Parameters<typeof LineasGasto>[0]> = {}) {
  return renderToStaticMarkup(createElement("form", null, createElement(LineasGasto, { opciones, ...props })));
}

/** Valor del campo oculto que se envía con el formulario. */
function oculto(html: string): string {
  const valor = /name="lineas_gasto" value="([^"]*)"/.exec(html)?.[1] ?? "";
  return valor.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

describe("editor de bonos y gastos", () => {
  it("sin bono inicial envía una lista vacía", () => {
    const html = pintar();
    expect(oculto(html)).toBe("[]");
    expect(leerLineas(oculto(html))).toEqual({ lineas: [] });
    expect(html).toContain("+ Agregar bono");
  });

  it("propone un bono pagado ahora desde la única caja, con el conductor indicado", () => {
    const html = pintar({ claveInicial: U(9), destinatarioInicial: `c:${U(4)}` });
    const [linea] = JSON.parse(oculto(html));
    expect(linea).toMatchObject({ clave: U(9), categoria: U(1), destinatario: `c:${U(4)}`, concepto: "Bono por servicio", pagarAhora: true, cuenta: U(5) });
    expect(html).toContain("¿A quién se le da?");
    expect(html).toContain('label="Empleados"');
    // Sin importe todavía: el servidor la rechazaría con un mensaje claro.
    expect(leerLineas(oculto(html)).error).toBe("Línea 1: indique un importe mayor que cero.");
  });

  it("los controles visibles no se envían sueltos (pertenecen a otro formulario)", () => {
    const html = pintar({ claveInicial: U(9) });
    const controles = html.match(/<(input|select)(?![^>]*type="hidden")[^>]*>/g) ?? [];
    expect(controles.length).toBeGreaterThan(4);
    for (const control of controles) expect(control).toContain('form="lineas-gasto-sin-envio"');
  });

  it("muestra ingreso, gastos y ganancia", () => {
    const html = pintar({ claveInicial: U(9), ingreso: { etiqueta: "Cuota mensual del plan", monto: 600 } });
    expect(html).toContain("Cuota mensual del plan");
    expect(html).toContain("Le queda (ganancia)");
    expect(html).toMatch(/data-ganancia="true">L\s?600\.00/);
  });
});
