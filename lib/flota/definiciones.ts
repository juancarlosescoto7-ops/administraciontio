// Flota: kilometraje encadenado por vehículo y mantenimientos. Las reglas
// (coincidencia con la última llegada, descuadres) las aplica la base.
import type { Campo, Opcion } from "@/lib/catalogos/definiciones";

export const KM_MAXIMO = 9_999_999;

export type OrigenRecorrido = "alquiler" | "transporte" | "traslado" | "mantenimiento";

export const ETIQUETAS_ORIGEN: Record<OrigenRecorrido, string> = {
  alquiler: "Alquiler",
  transporte: "Viaje con conductor",
  traslado: "Traslado",
  mantenimiento: "Mantenimiento",
};

export const OPCIONES_TIPO_MANTENIMIENTO: readonly Opcion[] = [
  { valor: "preventivo", etiqueta: "Preventivo" },
  { valor: "correctivo", etiqueta: "Correctivo" },
];

/** Filtro del informe de recorridos de un vehículo. */
export const FILTROS_RECORRIDOS: readonly Opcion[] = [
  { valor: "todos", etiqueta: "Todos los movimientos" },
  { valor: "descuadres", etiqueta: "Solo descuadres" },
  { valor: "mantenimientos", etiqueta: "Solo mantenimientos" },
];

export function formatearKm(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "—" : `${valor.toLocaleString("es-HN")} km`;
}

/** Diferencia con la llegada anterior: +50 km (más) o −20 km (menos). */
export function formatearDiferencia(valor: number | null | undefined): string {
  if (!valor) return "—";
  return `${valor > 0 ? "+" : "−"}${formatearKm(Math.abs(valor))}`;
}

/** Detalle del servicio que originó el recorrido (los mantenimientos no tienen ficha). */
export function rutaOrigen(origen: string | null, id: string | null): string | null {
  if (!id) return null;
  switch (origen) {
    case "alquiler":
      return `/alquileres/${id}`;
    case "transporte":
      return `/transportes/${id}`;
    case "traslado":
      return `/ambulancias/${id}`;
    default:
      return null;
  }
}

export type EstadoMantenimiento = "vencido" | "programado" | "sin_programar";

/** Vencido si se alcanzó el kilometraje o la fecha del próximo mantenimiento. */
export function estadoMantenimiento(
  { km_para_mantenimiento, proxima_fecha }: { km_para_mantenimiento: number | null; proxima_fecha: string | null },
  hoy: string,
): EstadoMantenimiento {
  if ((km_para_mantenimiento !== null && km_para_mantenimiento <= 0) || (proxima_fecha !== null && proxima_fecha <= hoy)) {
    return "vencido";
  }
  return km_para_mantenimiento !== null || proxima_fecha !== null ? "programado" : "sin_programar";
}

const AYUDA_DESCUADRE = "Solo si la lectura no coincide con la última llegada del vehículo; queda señalado en el informe de flota.";

function ayudaSalida(esperado: number | null): string {
  return esperado === null
    ? "Sin recorridos previos registrados: si es el primero del vehículo, esta lectura fija la base."
    : `Debe coincidir con la última llegada registrada: ${formatearKm(esperado)}.`;
}

/** Kilometraje de salida y motivo opcional si no coincide con la última llegada. */
export function camposKmSalida(esperado: number | null): Campo[] {
  return [
    {
      nombre: "km_salida",
      etiqueta: "Kilometraje de salida",
      tipo: "entero",
      requerido: true,
      min: 0,
      max: KM_MAXIMO,
      ayuda: ayudaSalida(esperado),
    },
    { nombre: "motivo_descuadre_km", etiqueta: "Motivo del descuadre", tipo: "texto", max: 300, ayuda: AYUDA_DESCUADRE },
  ];
}

export function campoKmLlegada(salida: number | null): Campo {
  return {
    nombre: "km_llegada",
    etiqueta: "Kilometraje de llegada",
    tipo: "entero",
    requerido: true,
    min: 0,
    max: KM_MAXIMO,
    ayuda: salida === null ? undefined : `Salida: ${formatearKm(salida)}. No puede ser menor.`,
  };
}

export function camposMantenimiento(esperado: number | null, ahora: string): Campo[] {
  return [
    { nombre: "tipo", etiqueta: "Tipo", tipo: "seleccion", requerido: true, opciones: OPCIONES_TIPO_MANTENIMIENTO },
    { nombre: "descripcion", etiqueta: "Trabajo realizado", tipo: "texto", requerido: true, max: 500 },
    { nombre: "salida", etiqueta: "Salida hacia el taller", tipo: "fecha_hora", requerido: true, predeterminado: ahora },
    { nombre: "regreso", etiqueta: "Regreso del taller", tipo: "fecha_hora", requerido: true, predeterminado: ahora },
    {
      nombre: "km_salida",
      etiqueta: "Kilometraje de salida",
      tipo: "entero",
      requerido: true,
      min: 0,
      max: KM_MAXIMO,
      predeterminado: esperado === null ? undefined : String(esperado),
      ayuda: ayudaSalida(esperado),
    },
    { nombre: "km_llegada", etiqueta: "Kilometraje de regreso", tipo: "entero", requerido: true, min: 0, max: KM_MAXIMO },
    { nombre: "motivo_descuadre_km", etiqueta: "Motivo del descuadre", tipo: "texto", max: 300, ayuda: AYUDA_DESCUADRE },
    {
      nombre: "proximo_km",
      etiqueta: "Próximo mantenimiento a los",
      tipo: "entero",
      min: 0,
      max: KM_MAXIMO,
      seccion: "Próximo mantenimiento (opcional)",
      ayuda: "Kilometraje del odómetro en que toca el siguiente.",
    },
    { nombre: "proxima_fecha", etiqueta: "O en la fecha", tipo: "fecha" },
    { nombre: "notas", etiqueta: "Observaciones (taller, repuestos…)", tipo: "texto_largo", max: 1000 },
  ];
}
