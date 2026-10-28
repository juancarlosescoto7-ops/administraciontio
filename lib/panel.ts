import { sumarMontos } from "@/lib/finanzas/montos";
import { aFechaHoraLocal } from "@/lib/formato";

// Presentación del panel de inicio: sin reglas de negocio, solo orden y textos.

export type TipoServicioProximo = "traslado" | "transporte" | "entrega" | "devolucion";

export const ETIQUETAS_SERVICIO_PROXIMO: Record<TipoServicioProximo, string> = {
  traslado: "Traslado de ambulancia",
  transporte: "Transporte con conductor",
  entrega: "Entrega de alquiler",
  devolucion: "Devolución de alquiler",
};

export type ServicioProximo = {
  tipo: TipoServicioProximo;
  id: string;
  /** Marca de tiempo UTC del evento (inicio, entrega o devolución prevista). */
  momento: string;
  cliente: string | null;
  detalle: string | null;
  /** Código de la unidad o vehículo asignado, si lo hay. */
  codigo: string | null;
  estado: string | null;
  href: string;
};

/** Une las listas de cada módulo y deja los `limite` eventos más cercanos. */
export function ordenarProximos(listas: readonly (readonly ServicioProximo[])[], limite: number): ServicioProximo[] {
  return listas
    .flat()
    .filter((servicio) => !Number.isNaN(new Date(servicio.momento).getTime()))
    .sort((a, b) => new Date(a.momento).getTime() - new Date(b.momento).getTime())
    .slice(0, limite);
}

function sumarDias(fecha: string, dias: number): string {
  return new Date(new Date(`${fecha}T00:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);
}

/** «Hoy 14:30», «Mañana 08:00», «Ayer 17:15» o «28/10 09:00» (hora de Tegucigalpa). */
export function etiquetaMomento(momento: string, hoy: string): string {
  const local = aFechaHoraLocal(momento);
  if (!local) return "—";
  const [fecha, hora] = local.split("T");
  if (fecha === hoy) return `Hoy ${hora}`;
  if (fecha === sumarDias(hoy, 1)) return `Mañana ${hora}`;
  if (fecha === sumarDias(hoy, -1)) return `Ayer ${hora}`;
  const [anio, mes, dia] = fecha.split("-");
  return fecha.slice(0, 4) === hoy.slice(0, 4) ? `${dia}/${mes} ${hora}` : `${dia}/${mes}/${anio} ${hora}`;
}

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export type PuntoSerie = { fecha: string; etiqueta: string; total: number };

/**
 * Totales por día (fecha local AAAA-MM-DD) de los últimos `dias` días hasta
 * hoy, incluidos los días sin movimientos (en cero).
 */
export function serieUltimosDias(
  filas: readonly { fecha: string | null; monto: number | string | null }[],
  hoy: string,
  dias = 7,
): PuntoSerie[] {
  return Array.from({ length: dias }, (_, indice) => {
    const fecha = sumarDias(hoy, indice - dias + 1);
    const dia = new Date(`${fecha}T00:00:00Z`);
    return {
      fecha,
      etiqueta: `${DIAS_CORTOS[dia.getUTCDay()]} ${dia.getUTCDate()}`,
      total: Number(sumarMontos(filas.filter((fila) => fila.fecha === fecha).map((fila) => fila.monto))),
    };
  });
}

/** Desde qué fecha (incluida) consultar para `serieUltimosDias`. */
export function inicioUltimosDias(hoy: string, dias = 7): string {
  return sumarDias(hoy, 1 - dias);
}

/** Origen → destino, omitiendo lo que falte. */
export function recorrido(origen: string | null, destino: string | null): string | null {
  if (origen && destino) return `${origen} → ${destino}`;
  return origen ?? destino ?? null;
}
