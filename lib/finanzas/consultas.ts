import type { Opcion } from "@/lib/catalogos/definiciones";
import type { createClient } from "@/lib/supabase/server";
import { formatearFecha, formatearMoneda } from "@/lib/formato";

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

export const LIMITE_LISTADO = 200;

export async function opcionesCuentas(supabase: ClienteSupabase): Promise<Opcion[]> {
  const { data } = await supabase.from("cuentas_dinero").select("id, nombre, tipo").eq("activo", true).order("nombre");
  return (data ?? []).map((c) => ({ valor: c.id, etiqueta: `${c.nombre} (${c.tipo === "caja" ? "caja" : "banco"})` }));
}

/** Cargos con saldo pendiente de un cliente, del más antiguo al más reciente. */
export async function cargosPendientes(supabase: ClienteSupabase, clienteId: string) {
  const { data } = await supabase
    .from("saldos_cargos")
    .select("id, concepto, fecha, vencimiento, monto, pendiente")
    .eq("cliente_id", clienteId)
    .eq("estado", "vigente")
    .gt("pendiente", 0)
    .order("fecha")
    .order("created_at");
  return data ?? [];
}

export function describirCargo(cargo: { concepto: string | null; fecha: string | null; pendiente: number | null }): string {
  return `${formatearFecha(cargo.fecha)} · pendiente ${formatearMoneda(cargo.pendiente)}`;
}
