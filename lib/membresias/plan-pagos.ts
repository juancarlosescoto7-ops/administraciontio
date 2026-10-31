import { siguienteRenovacion, sumarDias } from "./fechas";

export function proyectarCuotas(inicio: string, diaAncla: number, fechaFin: string): { inicio: string; fin: string }[] {
  const filas = [];
  let actual = inicio;
  while (actual <= fechaFin) {
    const siguiente = siguienteRenovacion(actual, diaAncla);
    const fin = sumarDias(siguiente, -1);
    if (fin > fechaFin) break;
    filas.push({ inicio: actual, fin });
    actual = siguiente;
  }
  return filas;
}
