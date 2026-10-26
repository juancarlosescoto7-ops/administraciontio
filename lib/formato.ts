// Presentación: moneda HNL, fechas día/mes/año, zona America/Tegucigalpa.
const ZONA_HORARIA = "America/Tegucigalpa";

const formatoMoneda = new Intl.NumberFormat("es-HN", {
  style: "currency",
  currency: "HNL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatoFechaHora = new Intl.DateTimeFormat("es-HN", {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatearMoneda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) ? formatoMoneda.format(numero) : "—";
}

/** Fecha sin hora (columna `date`, AAAA-MM-DD): no se convierte de zona. */
export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return "—";
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (!coincidencia) return "—";
  const [, anio, mes, dia] = coincidencia;
  return `${dia}/${mes}/${anio}`;
}

/** Marca de tiempo UTC (`timestamptz`) mostrada en hora de Tegucigalpa. */
export function formatearFechaHora(valor: string | null | undefined): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return formatoFechaHora.format(fecha).replace(",", "");
}

// Honduras no aplica horario de verano: America/Tegucigalpa es UTC−6 todo el año.
const DESFASE_TEGUCIGALPA = "-06:00";

/** "2026-10-28T14:30" (hora local de un input datetime-local) → timestamptz con zona. */
export function momentoDesdeLocal(local: string): string {
  return `${local}:00${DESFASE_TEGUCIGALPA}`;
}

/** Marca de tiempo → "AAAA-MM-DDTHH:mm" en hora de Tegucigalpa (para datetime-local). */
export function aFechaHoraLocal(valor: string | Date | null | undefined): string {
  if (!valor) return "";
  const fecha = typeof valor === "string" ? new Date(valor) : valor;
  if (Number.isNaN(fecha.getTime())) return "";
  const local = new Date(fecha.getTime() - 6 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria de la empresa. */
export function hoyEnTegucigalpa(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}
