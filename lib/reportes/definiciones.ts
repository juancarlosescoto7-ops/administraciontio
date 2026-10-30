import { aCentavos } from "@/lib/finanzas/montos";
import type { Periodo } from "@/lib/reportes/periodo";

export const VISTAS = [
  { valor: "resumen", etiqueta: "Resumen" },
  { valor: "actividades", etiqueta: "Por actividad" },
  { valor: "ingresos", etiqueta: "Ingresos" },
  { valor: "gastos", etiqueta: "Gastos" },
  { valor: "cobrar", etiqueta: "Por cobrar" },
  { valor: "pagar", etiqueta: "Por pagar" },
  { valor: "caja", etiqueta: "Caja y bancos" },
  { valor: "resultados", etiqueta: "Estado de resultados" },
  { valor: "situacion", etiqueta: "Situación financiera" },
  { valor: "balanza", etiqueta: "Balanza de comprobación" },
] as const;

export type Vista = (typeof VISTAS)[number]["valor"];

export function leerVista(valor: string | undefined): Vista {
  return VISTAS.some((v) => v.valor === valor) ? (valor as Vista) : "resumen";
}

/** Enlace a una vista conservando el período elegido. */
export function rutaReporte(vista: Vista, periodo: Pick<Periodo, "clave" | "desde" | "hasta">, extra: Record<string, string> = {}): string {
  const consulta = new URLSearchParams({ vista, periodo: periodo.clave });
  if (periodo.clave === "personalizado") {
    consulta.set("desde", periodo.desde);
    consulta.set("hasta", periodo.hasta);
  }
  for (const [clave, valor] of Object.entries(extra)) consulta.set(clave, valor);
  return `/reportes?${consulta.toString()}`;
}

/** Filas de detalle por consulta; los totales vienen siempre de la base. */
export const LIMITE_REPORTE = 500;

export type EstadoPago = "pendiente" | "parcial" | "pagado" | "anulado";

export const ETIQUETAS_ESTADO_PAGO: Record<EstadoPago, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagado: "Pagado",
  anulado: "Anulado",
};

/** Estado de pago de un cargo o gasto a partir de lo pagado y lo pendiente. */
export function estadoPago(documento: {
  anulado: boolean;
  pagado: number | string | null;
  pendiente: number | string | null;
}): EstadoPago {
  if (documento.anulado) return "anulado";
  if ((aCentavos(documento.pendiente) ?? 0) <= 0) return "pagado";
  return (aCentavos(documento.pagado) ?? 0) > 0 ? "parcial" : "pendiente";
}

/** Vencido: con saldo y vencimiento anterior a hoy (el día del vencimiento aún no vence). */
export function estaVencido(vencimiento: string | null, pendiente: number | string | null, hoy: string): boolean {
  return vencimiento !== null && vencimiento < hoy && (aCentavos(pendiente) ?? 0) > 0;
}
