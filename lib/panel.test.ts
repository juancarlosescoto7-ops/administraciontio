import { describe, expect, it } from "vitest";
import { formatearFechaLarga } from "./formato";
import { etiquetaMomento, inicioUltimosDias, ordenarProximos, recorrido, serieUltimosDias, type ServicioProximo } from "./panel";

const servicio = (id: string, momento: string): ServicioProximo => ({
  tipo: "traslado", id, momento, cliente: null, detalle: null, codigo: null, estado: null, href: `/ambulancias/${id}`,
});

describe("panel", () => {
  it("ordena los eventos de varios módulos por hora y respeta el límite", () => {
    const resultado = ordenarProximos(
      [
        [servicio("b", "2026-10-27T16:00:00Z"), servicio("d", "2026-10-28T10:00:00Z")],
        [servicio("a", "2026-10-27T14:00:00Z"), servicio("x", "fecha inválida")],
        [servicio("c", "2026-10-27T18:00:00Z")],
      ],
      3,
    );
    expect(resultado.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("describe el momento en hora de Tegucigalpa relativo a hoy", () => {
    const hoy = "2026-10-27";
    expect(etiquetaMomento("2026-10-27T20:30:00Z", hoy)).toBe("Hoy 14:30");
    expect(etiquetaMomento("2026-10-28T05:59:00Z", hoy)).toBe("Hoy 23:59");
    expect(etiquetaMomento("2026-10-28T14:00:00Z", hoy)).toBe("Mañana 08:00");
    expect(etiquetaMomento("2026-10-26T23:15:00Z", hoy)).toBe("Ayer 17:15");
    expect(etiquetaMomento("2026-11-02T15:00:00Z", hoy)).toBe("02/11 09:00");
    expect(etiquetaMomento("2027-01-05T15:00:00Z", hoy)).toBe("05/01/2027 09:00");
    expect(etiquetaMomento("", hoy)).toBe("—");
  });

  it("arma el recorrido con los datos disponibles", () => {
    expect(recorrido("Hospital", "Casa")).toBe("Hospital → Casa");
    expect(recorrido(null, "Casa")).toBe("Casa");
    expect(recorrido(null, null)).toBeNull();
  });

  it("suma por día los últimos 7 días, con ceros donde no hubo movimientos", () => {
    const serie = serieUltimosDias(
      [
        { fecha: "2026-10-27", monto: "100.10" },
        { fecha: "2026-10-27", monto: 0.2 },
        { fecha: "2026-10-23", monto: "50" },
        { fecha: "2026-10-20", monto: "999" },
      ],
      "2026-10-27",
    );
    expect(inicioUltimosDias("2026-10-27")).toBe("2026-10-21");
    expect(serie.map((p) => p.fecha)).toEqual(["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
    expect(serie.map((p) => p.total)).toEqual([0, 0, 50, 0, 0, 0, 100.3]);
    expect(serie[6].etiqueta).toBe("Mar 27");
  });

  it("muestra la fecha larga del día en Tegucigalpa", () => {
    expect(formatearFechaLarga(new Date("2026-10-27T04:00:00Z"))).toBe("Lunes 26 de octubre de 2026");
  });
});
