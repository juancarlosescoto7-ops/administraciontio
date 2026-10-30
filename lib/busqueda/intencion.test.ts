import { describe, expect, it } from "vitest";
import { ejemplosPara, interpretar, opcionesFijas } from "./intencion";

describe("asistente del buscador", () => {
  it("separa la acción del nombre buscado", () => {
    const cobro = interpretar("cobro de Juan Pérez");
    expect(cobro.intencion?.clave).toBe("cobro");
    expect(cobro.texto).toBe("Juan Pérez");

    expect(interpretar("registrar cobro a María").texto).toBe("María");
    expect(interpretar("Nueva membresía para Ana López").intencion?.clave).toBe("membresia");
    expect(interpretar("Nueva membresía para Ana López").texto).toBe("Ana López");
    expect(interpretar("saldo Juan").intencion?.clave).toBe("cuenta");
    expect(interpretar("TRASLADO pérez").intencion?.clave).toBe("traslado");
  });

  it("sin acción reconocida, busca el texto completo", () => {
    expect(interpretar("Juan de la Cruz")).toEqual({ intencion: null, texto: "Juan de la Cruz" });
    expect(interpretar("  HAA-1234 ")).toEqual({ intencion: null, texto: "HAA-1234" });
    // «conductor» y «plan» se buscan en sus catálogos, no son acciones.
    expect(interpretar("conductor Pedro").intencion).toBeNull();
    expect(interpretar("plan familiar").intencion).toBeNull();
  });

  it("la acción sola deja el nombre vacío", () => {
    const solo = interpretar("cobrar");
    expect(solo.intencion?.clave).toBe("cobro");
    expect(solo.texto).toBe("");
  });

  it("solo sugiere acciones que el rol puede hacer", () => {
    expect(ejemplosPara("finanzas")).toEqual(["cobro", "saldo"]);
    expect(ejemplosPara("operador")).toContain("traslado");
    expect(ejemplosPara("administrador")).toHaveLength(6);
  });

  it("convierte menú y accesos en opciones con clave única", () => {
    const opciones = opcionesFijas(
      [{ titulo: "Finanzas", icono: "finanzas", enlaces: [{ href: "/finanzas/cobros", etiqueta: "Cobros" }] }],
      [{ href: "/finanzas/cobros/nuevo", etiqueta: "Registrar cobro", icono: "dinero", tono: "verde" }],
    );
    expect(opciones.map((o) => [o.seccion, o.etiqueta])).toEqual([
      ["Acciones", "Registrar cobro"],
      ["Páginas", "Cobros"],
    ]);
    expect(new Set(opciones.map((o) => o.clave)).size).toBe(opciones.length);
  });
});
