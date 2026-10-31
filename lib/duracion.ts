/** Las unidades de pantalla se convierten a minutos exactos para las reservas. */
export const UNIDADES_DURACION = { minutos: 1, horas: 60, dias: 1440 } as const;
export type UnidadDuracion = keyof typeof UNIDADES_DURACION;

export function minutosDesdeDuracion(valor: string, unidad: UnidadDuracion): number | null {
  if (!/^\d+(\.\d+)?$/.test(valor)) return null;
  const minutos = Number(valor) * UNIDADES_DURACION[unidad];
  const redondeado = Math.round(minutos);
  return Number.isFinite(minutos) && Math.abs(minutos - redondeado) < 0.000001 && redondeado > 0 && redondeado <= 2_147_483_647
    ? redondeado : null;
}

export function duracionDesdeMinutos(minutos: number): { valor: string; unidad: UnidadDuracion } {
  if (minutos > 0 && minutos % 1440 === 0) return { valor: String(minutos / 1440), unidad: "dias" };
  if (minutos > 0 && minutos % 60 === 0) return { valor: String(minutos / 60), unidad: "horas" };
  return { valor: String(minutos), unidad: "minutos" };
}

export function formatearDuracion(minutos: number): string {
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  const resto = minutos % 60;
  return [dias ? `${dias} d` : "", horas ? `${horas} h` : "", resto ? `${resto} min` : ""].filter(Boolean).join(" ") || "0 min";
}
