import { ETIQUETAS_ESTADO_MEMBRESIA } from "@/lib/membresias/definiciones";
import type { Database } from "@/lib/supabase/tipos-bd";

const CLASES: Record<Database["public"]["Enums"]["estado_membresia"], string> = {
  activa: "insignia-activo",
  suspendida: "insignia-advertencia",
  cancelada: "insignia-inactivo",
};

export function InsigniaMembresia({ estado }: { estado: Database["public"]["Enums"]["estado_membresia"] | null }) {
  if (!estado) return <span className="insignia insignia-inactivo">—</span>;
  return <span className={`insignia ${CLASES[estado]}`}>{ETIQUETAS_ESTADO_MEMBRESIA[estado]}</span>;
}

/** Estado de una cuota: sin cargo, pagada, pendiente (en gracia) o vencida. */
export function InsigniaCuota({
  precio,
  pendiente,
  vencida,
  anulada,
}: {
  precio: number | string | null;
  pendiente: number | string | null;
  vencida: boolean | null;
  anulada: boolean;
}) {
  if (Number(precio) === 0) return <span className="insignia insignia-inactivo">Sin costo</span>;
  if (anulada) return <span className="insignia insignia-inactivo">Cargo anulado</span>;
  if (Number(pendiente) === 0) return <span className="insignia insignia-activo">Pagada</span>;
  if (vencida) return <span className="insignia insignia-advertencia">Vencida</span>;
  return <span className="insignia insignia-inactivo">Pendiente</span>;
}
