import { describe, expect, it } from "vitest";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { estadoPago, estaVencido, leerVista, rutaReporte } from "./definiciones";
import { describirPeriodo, diaAnterior, fechaCorte, resolverPeriodo, ultimoDiaDelMes } from "./periodo";

describe("estado de pago y vencimiento", () => {
  it("pendiente, parcial, pagado y anulado", () => {
    expect(estadoPago({ anulado: false, pagado: 0, pendiente: 1000 })).toBe("pendiente");
    expect(estadoPago({ anulado: false, pagado: 400, pendiente: 600 })).toBe("parcial");
    expect(estadoPago({ anulado: false, pagado: 1000, pendiente: 0 })).toBe("pagado");
    expect(estadoPago({ anulado: true, pagado: 0, pendiente: 0 })).toBe("anulado");
    expect(estadoPago({ anulado: false, pagado: "0.01", pendiente: "999.99" })).toBe("parcial");
  });

  it("vence el día siguiente al vencimiento y solo con saldo", () => {
    expect(estaVencido("2026-10-26", 100, "2026-10-27")).toBe(true);
    expect(estaVencido("2026-10-27", 100, "2026-10-27")).toBe(false);
    expect(estaVencido("2026-10-01", 0, "2026-10-27")).toBe(false);
    expect(estaVencido(null, 100, "2026-10-27")).toBe(false);
  });

  it("los enlaces conservan el período; las fechas solo si es personalizado", () => {
    expect(rutaReporte("gastos", { clave: "mes_anterior", desde: "2026-09-01", hasta: "2026-09-30" })).toBe(
      "/reportes?vista=gastos&periodo=mes_anterior",
    );
    expect(rutaReporte("caja", { clave: "personalizado", desde: "2026-10-01", hasta: "2026-10-05" }, { cuenta: "x" })).toBe(
      "/reportes?vista=caja&periodo=personalizado&desde=2026-10-01&hasta=2026-10-05&cuenta=x",
    );
  });

  it("vista desconocida: resumen", () => {
    expect(leerVista("caja")).toBe("caja");
    expect(leerVista("otra")).toBe("resumen");
    expect(leerVista(undefined)).toBe("resumen");
  });
});

describe("períodos de reportes", () => {
  it("mes actual: del día 1 al último día, ambos incluidos", () => {
    expect(resolverPeriodo({}, "2026-10-27")).toEqual({ clave: "mes_actual", desde: "2026-10-01", hasta: "2026-10-31", aviso: null });
    expect(resolverPeriodo({ periodo: "mes_actual" }, "2028-02-10")).toMatchObject({ desde: "2028-02-01", hasta: "2028-02-29" });
  });

  it("mes anterior: cruza el cambio de año y respeta febrero", () => {
    expect(resolverPeriodo({ periodo: "mes_anterior" }, "2026-01-15")).toMatchObject({ desde: "2025-12-01", hasta: "2025-12-31" });
    expect(resolverPeriodo({ periodo: "mes_anterior" }, "2026-03-31")).toMatchObject({ desde: "2026-02-01", hasta: "2026-02-28" });
    expect(resolverPeriodo({ periodo: "mes_anterior" }, "2024-03-01")).toMatchObject({ desde: "2024-02-01", hasta: "2024-02-29" });
  });

  it("año actual: del 1 de enero al 31 de diciembre", () => {
    expect(resolverPeriodo({ periodo: "anio_actual" }, "2026-10-27")).toMatchObject({ desde: "2026-01-01", hasta: "2026-12-31" });
  });

  it("rango personalizado: se respeta tal cual, incluido el mismo día", () => {
    expect(resolverPeriodo({ periodo: "personalizado", desde: "2026-10-05", hasta: "2026-10-05" }, "2026-10-27")).toEqual({
      clave: "personalizado",
      desde: "2026-10-05",
      hasta: "2026-10-05",
      aviso: null,
    });
  });

  it("rango personalizado inválido: vuelve al mes actual con aviso", () => {
    const hoy = "2026-10-27";
    for (const parametros of [
      { periodo: "personalizado" },
      { periodo: "personalizado", desde: "2026-10-10", hasta: "2026-10-01" },
      { periodo: "personalizado", desde: "2026-02-30", hasta: "2026-03-01" },
      { periodo: "personalizado", desde: "2000-01-01", hasta: "2026-01-01" },
    ]) {
      const periodo = resolverPeriodo(parametros, hoy);
      expect(periodo).toMatchObject({ clave: "mes_actual", desde: "2026-10-01", hasta: "2026-10-31" });
      expect(periodo.aviso).not.toBeNull();
    }
  });

  it("clave desconocida: mes actual sin aviso", () => {
    expect(resolverPeriodo({ periodo: "semana" }, "2026-10-27")).toMatchObject({ clave: "mes_actual", aviso: null });
  });

  it("el día de hoy se toma en Tegucigalpa (UTC−6), no en UTC", () => {
    // 1 de noviembre 03:00 UTC = 31 de octubre 21:00 en Tegucigalpa: aún es octubre.
    const hoy = hoyEnTegucigalpa(new Date("2026-11-01T03:00:00Z"));
    expect(resolverPeriodo({}, hoy)).toMatchObject({ desde: "2026-10-01", hasta: "2026-10-31" });
  });

  it("día anterior (saldo inicial de caja)", () => {
    expect(diaAnterior("2026-10-01")).toBe("2026-09-30");
    expect(diaAnterior("2026-01-01")).toBe("2025-12-31");
    expect(diaAnterior("2028-03-01")).toBe("2028-02-29");
  });

  it("último día del mes", () => {
    expect(ultimoDiaDelMes(2026, 2)).toBe(28);
    expect(ultimoDiaDelMes(2028, 2)).toBe(29);
    expect(ultimoDiaDelMes(2026, 12)).toBe(31);
  });

  it("describe el período en palabras", () => {
    expect(describirPeriodo({ desde: "2026-10-01", hasta: "2026-10-31" })).toBe("octubre de 2026");
    expect(describirPeriodo({ desde: "2026-01-01", hasta: "2026-12-31" })).toBe("año 2026");
    expect(describirPeriodo({ desde: "2026-10-01", hasta: "2026-10-15" })).toBe("01/10/2026 al 15/10/2026");
  });
});

describe("fecha de corte de la situación financiera", () => {
  it("es el último día del período, salvo que sea futuro: entonces hoy", () => {
    expect(fechaCorte({ hasta: "2026-09-30" }, "2026-10-28")).toBe("2026-09-30");
    expect(fechaCorte({ hasta: "2026-10-31" }, "2026-10-28")).toBe("2026-10-28");
    expect(fechaCorte({ hasta: "2026-10-28" }, "2026-10-28")).toBe("2026-10-28");
  });

  it("las vistas nuevas existen y se leen de la URL", () => {
    expect(leerVista("resultados")).toBe("resultados");
    expect(leerVista("situacion")).toBe("situacion");
    expect(leerVista("balanza")).toBe("balanza");
  });
});
