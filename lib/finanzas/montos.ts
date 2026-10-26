// Importes en la aplicación. Los cálculos de dinero los hace PostgreSQL
// (numeric(14,2)); aquí solo se suman totales para mostrar y se comparan
// importes del formulario, siempre en centavos enteros, nunca en float.

/** "1,250.5" | 1250.5 → 125050. Devuelve null si no es un importe válido. */
export function aCentavos(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  const texto = (typeof valor === "number" ? valor.toFixed(2) : valor).replace(/,/g, "").trim();
  const partes = /^(-?)(\d{1,12})(?:\.(\d{1,2}))?$/.exec(texto);
  if (!partes) return null;
  const [, signo, enteros, decimales = ""] = partes;
  const centavos = Number(enteros) * 100 + Number(decimales.padEnd(2, "0"));
  return signo === "-" ? -centavos : centavos;
}

/** 125050 → "1250.50" (texto decimal que PostgreSQL convierte a numeric sin pérdida). */
export function centavosATexto(centavos: number): string {
  const signo = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(centavos);
  return `${signo}${Math.trunc(absoluto / 100)}.${String(absoluto % 100).padStart(2, "0")}`;
}

/** Suma importes devueltos por la base (numeric llega como número JSON). */
export function sumarMontos(valores: readonly (string | number | null | undefined)[]): string {
  const total = valores.reduce<number>((suma, valor) => suma + (aCentavos(valor) ?? 0), 0);
  return centavosATexto(total);
}

/**
 * Los tipos generados declaran `number` para los parámetros numeric, pero se
 * envía el texto decimal validado ("1500.00"): PostgREST lo convierte a
 * numeric sin pasar por float.
 */
export function decimal(texto: string): number {
  return texto as unknown as number;
}

/** Como decimal(), para parámetros numeric que aceptan NULL. */
export function decimalOpcional(texto: string | null): number {
  return texto as unknown as number;
}

/**
 * Los tipos generados no marcan como opcionales los parámetros SQL que
 * aceptan NULL (referencia, vencimiento, proveedor…).
 */
export function opcional(valor: string | null): string {
  return valor as string;
}
