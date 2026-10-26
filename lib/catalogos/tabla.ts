import type { createClient } from "@/lib/supabase/server";
import type { ClaveCatalogo } from "@/lib/auth/roles";

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Acceso genérico a una tabla de catálogo. Las definiciones de catálogo
 * validan los campos; el tipo concreto de cada tabla no aporta aquí, así que
 * se fija uno representativo para que TypeScript no combine ocho esquemas.
 * La RLS de la base sigue decidiendo qué filas se leen o modifican.
 */
export function tablaCatalogo(supabase: ClienteSupabase, tabla: ClaveCatalogo) {
  return supabase.from(tabla as "clientes");
}

export type Fila = Record<string, unknown> & { id: string; activo: boolean };
