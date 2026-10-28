import { esFechaValida } from "@/lib/catalogos/validacion";

// Períodos de los reportes. Las fechas son días (AAAA-MM-DD) en la zona de la
// empresa (America/Tegucigalpa): "hoy" llega ya calculado en esa zona y ambos
// extremos se incluyen en las consultas (fecha >= desde y fecha <= hasta).

export const PERIODOS = [
  { valor: "mes_actual", etiqueta: "Mes actual" },
  { valor: "mes_anterior", etiqueta: "Mes anterior" },
  { valor: "anio_actual", etiqueta: "Año actual" },
  { valor: "personalizado", etiqueta: "Rango personalizado" },
] as const;

export type ClavePeriodo = (typeof PERIODOS)[number]["valor"];

export type Periodo = {
  clave: ClavePeriodo;
  desde: string;
  hasta: string;
  /** Aviso cuando el rango personalizado no era válido y se usó el mes actual. */
  aviso: string | null;
};

/** Mismo límite que private.exigir_rango en la base. */
const MAXIMO_DIAS = 3660;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function dosCifras(valor: number): string {
  return String(valor).padStart(2, "0");
}

/** Último día del mes (mes 1–12), contando años bisiestos. */
export function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function mes(anio: number, numero: number): { desde: string; hasta: string } {
  return {
    desde: `${anio}-${dosCifras(numero)}-01`,
    hasta: `${anio}-${dosCifras(numero)}-${dosCifras(ultimoDiaDelMes(anio, numero))}`,
  };
}

function diasEntre(desde: string, hasta: string): number {
  return (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000;
}

/** Período a partir de los parámetros de la URL y la fecha de hoy en Tegucigalpa. */
export function resolverPeriodo(
  parametros: { periodo?: string; desde?: string; hasta?: string },
  hoy: string,
): Periodo {
  const anio = Number(hoy.slice(0, 4));
  const numeroMes = Number(hoy.slice(5, 7));
  const clave: ClavePeriodo = PERIODOS.some((p) => p.valor === parametros.periodo)
    ? (parametros.periodo as ClavePeriodo)
    : "mes_actual";

  if (clave === "mes_anterior") {
    const rango = numeroMes === 1 ? mes(anio - 1, 12) : mes(anio, numeroMes - 1);
    return { clave, ...rango, aviso: null };
  }
  if (clave === "anio_actual") {
    return { clave, desde: `${anio}-01-01`, hasta: `${anio}-12-31`, aviso: null };
  }
  if (clave === "personalizado") {
    const { desde, hasta } = parametros;
    if (!desde || !hasta || !esFechaValida(desde) || !esFechaValida(hasta)) {
      return { clave: "mes_actual", ...mes(anio, numeroMes), aviso: "Indique las dos fechas del rango; se muestra el mes actual." };
    }
    if (hasta < desde) {
      return { clave: "mes_actual", ...mes(anio, numeroMes), aviso: "La fecha final es anterior a la inicial; se muestra el mes actual." };
    }
    if (diasEntre(desde, hasta) > MAXIMO_DIAS) {
      return { clave: "mes_actual", ...mes(anio, numeroMes), aviso: "El rango no puede superar diez años; se muestra el mes actual." };
    }
    return { clave, desde, hasta, aviso: null };
  }
  return { clave, ...mes(anio, numeroMes), aviso: null };
}

/** "2026-10-01" → "2026-09-30". */
export function diaAnterior(fecha: string): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** «octubre de 2026», «año 2026» o «01/10/2026 al 15/10/2026». */
export function describirPeriodo(periodo: Pick<Periodo, "desde" | "hasta">): string {
  const { desde, hasta } = periodo;
  const [anioDesde, mesDesde, diaDesde] = desde.split("-").map(Number);
  const [anioHasta, mesHasta, diaHasta] = hasta.split("-").map(Number);
  if (anioDesde === anioHasta && diaDesde === 1) {
    if (mesDesde === mesHasta && diaHasta === ultimoDiaDelMes(anioHasta, mesHasta)) {
      return `${MESES[mesDesde - 1]} de ${anioDesde}`;
    }
    if (mesDesde === 1 && mesHasta === 12 && diaHasta === 31) return `año ${anioDesde}`;
  }
  const corta = (fecha: string) => fecha.split("-").reverse().join("/");
  return `${corta(desde)} al ${corta(hasta)}`;
}
