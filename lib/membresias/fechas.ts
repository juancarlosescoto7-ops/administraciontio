// Fechas de los ciclos de membresía. Espejo de private.siguiente_renovacion:
// la base genera los períodos; aquí solo se calculan para mostrar el resumen
// antes de confirmar una membresía.

function partes(fecha: string): [number, number, number] {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return [anio, mes, dia];
}

function texto(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Inicio del período siguiente: el día de anclaje del mes siguiente o su
 * último día si no existe (31 ene → 28/29 feb → 31 mar). Siempre desde el día
 * de anclaje, nunca desde la fecha ya ajustada.
 */
export function siguienteRenovacion(fecha: string, diaAncla: number): string {
  const [anio, mes] = partes(fecha);
  const siguienteAnio = mes === 12 ? anio + 1 : anio;
  const siguienteMes = mes === 12 ? 1 : mes + 1;
  return texto(siguienteAnio, siguienteMes, Math.min(diaAncla, diasDelMes(siguienteAnio, siguienteMes)));
}

export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = partes(fecha);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return texto(resultado.getUTCFullYear(), resultado.getUTCMonth() + 1, resultado.getUTCDate());
}

/** Primeros períodos [inicio, fin] de una membresía que empieza en `inicio`. */
export function periodosDesde(inicio: string, cantidad: number): { inicio: string; fin: string }[] {
  const diaAncla = partes(inicio)[2];
  const periodos: { inicio: string; fin: string }[] = [];
  let actual = inicio;
  for (let i = 0; i < cantidad; i++) {
    const siguiente = siguienteRenovacion(actual, diaAncla);
    periodos.push({ inicio: actual, fin: sumarDias(siguiente, -1) });
    actual = siguiente;
  }
  return periodos;
}
