export const SERVICIOS_GASTO = {
  membresia: { columna: "membresia_id", ruta: "/membresias", actividad: "ambulancias", etiqueta: "Membresía" },
  alquiler: { columna: "alquiler_id", ruta: "/alquileres", actividad: "alquileres", etiqueta: "Alquiler" },
  transporte: { columna: "transporte_id", ruta: "/transportes", actividad: "transportes", etiqueta: "Viaje con chofer" },
  traslado: { columna: "traslado_id", ruta: "/ambulancias", actividad: "ambulancias", etiqueta: "Traslado de ambulancia" },
} as const;
export type TipoServicioGasto = keyof typeof SERVICIOS_GASTO;
export function esTipoServicio(valor: string): valor is TipoServicioGasto {
  return Object.hasOwn(SERVICIOS_GASTO, valor);
}
