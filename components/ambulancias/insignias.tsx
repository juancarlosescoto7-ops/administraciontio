import {
  ETIQUETAS_COBERTURA,
  ETIQUETAS_ESTADO_TRASLADO,
  ETIQUETAS_FINANCIERO,
  type EstadoTraslado,
} from "@/lib/ambulancias/definiciones";
import type { Database } from "@/lib/supabase/tipos-bd";

type Cobertura = Database["public"]["Enums"]["condicion_cobertura"];

const CLASE_ESTADO: Record<EstadoTraslado, string> = {
  solicitado: "insignia-advertencia",
  programado: "insignia-activo",
  en_curso: "insignia-activo",
  completado: "insignia-inactivo",
  cancelado: "insignia-inactivo",
};

const CLASE_COBERTURA: Record<Cobertura, string> = {
  valida: "insignia-activo",
  pendiente_validacion: "insignia-advertencia",
  no_valida: "insignia-advertencia",
};

export function InsigniaTraslado({ estado }: { estado: EstadoTraslado | null }) {
  if (!estado) return <span className="insignia insignia-inactivo">—</span>;
  return <span className={`insignia ${CLASE_ESTADO[estado]}`}>{ETIQUETAS_ESTADO_TRASLADO[estado]}</span>;
}

/** Condición de cobertura (solo traslados cubiertos). */
export function InsigniaCobertura({ condicion }: { condicion: Cobertura | null }) {
  if (!condicion) return <span className="texto-tenue">—</span>;
  return <span className={`insignia ${CLASE_COBERTURA[condicion]}`}>{ETIQUETAS_COBERTURA[condicion]}</span>;
}

export function InsigniaFinanciera({ estado }: { estado: string | null }) {
  const clase = estado === "pendiente" || estado === "parcial" ? "insignia-advertencia" : estado === "pagado" ? "insignia-activo" : "insignia-inactivo";
  return <span className={`insignia ${clase}`}>{ETIQUETAS_FINANCIERO[estado ?? ""] ?? "—"}</span>;
}
