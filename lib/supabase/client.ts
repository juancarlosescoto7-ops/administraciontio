import { createBrowserClient } from "@supabase/ssr";
import { requerirConfigSupabase } from "./config";
import type { Database } from "./tipos-bd";

/** Cliente para Client Components. Solo usa la clave publicable. */
export function createClient() {
  const { url, publishableKey } = requerirConfigSupabase();
  return createBrowserClient<Database>(url, publishableKey);
}
