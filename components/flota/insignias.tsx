import { OPCIONES_ESTADO_VEHICULO } from "@/lib/catalogos/definiciones";
import type { EstadoMantenimiento } from "@/lib/flota/definiciones";

const INSIGNIAS: Record<EstadoMantenimiento, { clase: string; texto: string }> = {
  vencido: { clase: "insignia-peligro", texto: "Vencido" },
  programado: { clase: "insignia-activo", texto: "Al día" },
  sin_programar: { clase: "insignia-inactivo", texto: "Sin programar" },
};

export function InsigniaMantenimiento({ estado }: { estado: EstadoMantenimiento }) {
  const { clase, texto } = INSIGNIAS[estado];
  return <span className={`insignia ${clase}`}>{texto}</span>;
}

/** Estado operativo: operativo en verde, en mantenimiento en amarillo, fuera de servicio en rojo. */
const CLASE_ESTADO_VEHICULO: Record<string, string> = {
  operativo: "insignia-activo",
  mantenimiento: "insignia-advertencia",
  fuera_servicio: "insignia-peligro",
};

export function InsigniaVehiculo({ estado }: { estado: string | null }) {
  if (!estado) return <span className="insignia insignia-inactivo">—</span>;
  const etiqueta = OPCIONES_ESTADO_VEHICULO.find((o) => o.valor === estado)?.etiqueta ?? estado;
  return <span className={`insignia ${CLASE_ESTADO_VEHICULO[estado] ?? "insignia-inactivo"}`}>{etiqueta}</span>;
}
