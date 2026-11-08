// Bonos y gastos de un servicio: lectura de las líneas del formulario,
// totales del resultado (en centavos, nunca float), número de voucher e
// importe en letras. Sin dependencias del servidor: se prueba aislado.
import { esUuid } from "@/lib/catalogos/presentacion";
import { aCentavos, centavosATexto } from "@/lib/finanzas/montos";

export const MAX_LINEAS = 20;
export const NOMBRE_CAMPO_LINEAS = "lineas_gasto";
export const METODOS_PAGO = ["efectivo", "transferencia", "tarjeta", "otro"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

/** Línea tal como la edita el formulario (todo texto). */
export type LineaFormulario = {
  /** Clave de idempotencia de la línea: un reintento no la duplica. */
  clave: string;
  categoria: string;
  /** "e:<uuid>" empleado, "c:<uuid>" conductor, "p:<uuid>" proveedor o "". */
  destinatario: string;
  concepto: string;
  monto: string;
  /** Pagada ahora por completo o pendiente para pagarla después. */
  pagarAhora: boolean;
  cuenta: string;
  metodo: string;
  referencia: string;
};

/** Línea lista para public.registrar_gastos_de_servicio. */
export type LineaRpc = {
  idempotencia: string;
  categoria_id: string;
  concepto: string;
  monto: string;
  empleado_id?: string;
  conductor_id?: string;
  proveedor_id?: string;
  pago?: { cuenta_dinero_id: string; metodo: MetodoPago; referencia: string | null; monto: string };
};

export type LecturaLineas = { lineas: LineaRpc[]; error?: undefined } | { lineas?: undefined; error: string };

/** Lee y valida las líneas (campo oculto con JSON). Ausente o vacío = ninguna. */
export function leerLineas(valor: FormDataEntryValue | null): LecturaLineas {
  if (valor === null || valor === "") return { lineas: [] };
  if (typeof valor !== "string") return { error: "Los bonos y gastos no tienen un formato válido." };
  let datos: unknown;
  try {
    datos = JSON.parse(valor);
  } catch {
    return { error: "Los bonos y gastos no tienen un formato válido." };
  }
  if (!Array.isArray(datos)) return { error: "Los bonos y gastos no tienen un formato válido." };
  if (datos.length > MAX_LINEAS) return { error: `Registre como máximo ${MAX_LINEAS} bonos o gastos a la vez.` };

  const lineas: LineaRpc[] = [];
  for (const [indice, bruta] of datos.entries()) {
    const n = indice + 1;
    const l = (bruta ?? {}) as Partial<Record<keyof LineaFormulario, unknown>>;
    const textoDe = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const clave = textoDe(l.clave);
    const categoria = textoDe(l.categoria);
    const destinatario = textoDe(l.destinatario);
    const concepto = textoDe(l.concepto);
    const monto = aCentavos(textoDe(l.monto));
    if (!esUuid(clave)) return { error: "El formulario caducó. Recargue la página e inténtelo de nuevo." };
    if (!esUuid(categoria)) return { error: `Línea ${n}: elija el tipo de gasto.` };
    if (concepto.length === 0) return { error: `Línea ${n}: escriba el concepto.` };
    if (concepto.length > 200) return { error: `Línea ${n}: el concepto admite hasta 200 caracteres.` };
    if (monto === null || monto <= 0) return { error: `Línea ${n}: indique un importe mayor que cero.` };

    const linea: LineaRpc = { idempotencia: clave, categoria_id: categoria, concepto, monto: centavosATexto(monto) };
    if (destinatario !== "") {
      const partes = /^([ecp]):(.+)$/.exec(destinatario);
      if (!partes || !esUuid(partes[2])) return { error: `Línea ${n}: elija a quién se le paga.` };
      const columna = partes[1] === "e" ? "empleado_id" : partes[1] === "c" ? "conductor_id" : "proveedor_id";
      linea[columna] = partes[2];
    }
    if (l.pagarAhora === true) {
      const cuenta = textoDe(l.cuenta);
      const metodo = textoDe(l.metodo) || "efectivo";
      const referencia = textoDe(l.referencia);
      if (!esUuid(cuenta)) return { error: `Línea ${n}: elija de qué caja o banco sale el pago.` };
      if (!(METODOS_PAGO as readonly string[]).includes(metodo)) return { error: `Línea ${n}: método de pago no válido.` };
      if (referencia.length > 80) return { error: `Línea ${n}: la referencia admite hasta 80 caracteres.` };
      linea.pago = { cuenta_dinero_id: cuenta, metodo: metodo as MetodoPago, referencia: referencia || null, monto: linea.monto };
    }
    lineas.push(linea);
  }
  return { lineas };
}

/** Totales de las líneas del formulario (para el resumen en vivo). */
export function totalesLineas(lineas: readonly Pick<LineaFormulario, "monto" | "pagarAhora">[]) {
  let total = 0;
  let pagado = 0;
  for (const l of lineas) {
    const c = aCentavos(l.monto.trim());
    if (c === null || c <= 0) continue;
    total += c;
    if (l.pagarAhora) pagado += c;
  }
  return { total, pagado, pendiente: total - pagado };
}

/** Ingreso menos gastos, en centavos. */
export function ganancia(ingreso: number | string | null | undefined, gastos: readonly (number | string | null | undefined)[]): number {
  const base = aCentavos(ingreso ?? 0) ?? 0;
  return gastos.reduce<number>((resto, g) => resto - (aCentavos(g ?? 0) ?? 0), base);
}

/** 12 → "V-000012". */
export function formatearVoucher(numero: number | null | undefined): string {
  return numero ? `V-${String(numero).padStart(6, "0")}` : "V-—";
}

const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte",
  "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function menorQueMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  let decenas: string;
  if (resto < 30) decenas = UNIDADES[resto];
  else {
    const u = resto % 10;
    decenas = DECENAS[Math.floor(resto / 10)] + (u ? ` y ${UNIDADES[u]}` : "");
  }
  return [CENTENAS[c], decenas].filter(Boolean).join(" ");
}

/** Entero en palabras ("uno" se apocopa a "un" delante de «mil», «millones» y «lempiras»). */
function enteroEnLetras(n: number): string {
  if (n === 0) return "cero";
  const partes: string[] = [];
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const apocopar = (texto: string) => texto.replace(/veintiuno$/, "veintiún").replace(/(^|\s)uno$/, "$1un");
  if (millones > 0) partes.push(millones === 1 ? "un millón" : `${apocopar(enteroEnLetras(millones))} millones`);
  if (miles > 0) partes.push(miles === 1 ? "mil" : `${apocopar(menorQueMil(miles))} mil`);
  if (resto > 0) partes.push(menorQueMil(resto));
  return partes.join(" ");
}

/** 150050 → "Mil quinientos lempiras con 50/100". */
export function importeEnLetras(centavos: number): string {
  const enteros = Math.trunc(Math.abs(centavos) / 100);
  const fraccion = String(Math.abs(centavos) % 100).padStart(2, "0");
  let texto = enteroEnLetras(enteros);
  // «un lempira», «veintiún lempiras», «un millón de lempiras».
  texto = texto.replace(/veintiuno$/, "veintiún").replace(/(^|\s)uno$/, "$1un");
  const moneda = enteros === 1 ? "lempira" : /(millón|millones)$/.test(texto) ? "de lempiras" : "lempiras";
  const frase = `${texto} ${moneda} con ${fraccion}/100`;
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}
