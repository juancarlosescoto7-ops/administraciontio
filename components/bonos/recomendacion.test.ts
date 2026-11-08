import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecomendacionResultado } from "./recomendacion";

function pintar(negativa = false, estimada = false) {
  return renderToStaticMarkup(
    createElement(RecomendacionResultado, {
      titulo: "Viaje completado: resultado del servicio",
      parametro: "completado",
      filas: [
        { etiqueta: "Ingreso del servicio", valor: "L 5,000.00" },
        { etiqueta: "− Bono por servicio (Ana)", valor: "L 500.00" },
      ],
      ganancia: negativa ? "-L 200.00" : "L 4,500.00",
      negativa,
      estimada,
      children: createElement("form", { "data-formulario": "agregar" }),
    }),
  );
}

describe("recomendación al finalizar el servicio", () => {
  it("muestra el resultado y las tres opciones; el formulario aparece solo al elegir agregar", () => {
    const html = pintar();
    expect(html).toContain("<dialog");
    expect(html).toContain("Viaje completado: resultado del servicio");
    expect(html).toContain("Ingreso del servicio");
    expect(html).toContain("− Bono por servicio (Ana)");
    expect(html).toContain("Le ganaste");
    expect(html).toContain("L 4,500.00");
    for (const boton of ["Ahora no", "Ver resultado", "+ Agregar bono o gasto"]) expect(html).toContain(boton);
    expect(html).not.toContain("data-formulario");
  });

  it("marca la ganancia estimada y la pérdida", () => {
    const html = pintar(true, true);
    expect(html).toContain("Ganancia estimada");
    expect(html).toContain("text-[var(--peligro)]");
  });
});
