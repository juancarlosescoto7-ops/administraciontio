// Consultas y registro de bonos y gastos de un servicio. No es "use server":
// nada de lo exportado queda expuesto como acción invocable.
import type { Fallo, ClienteSupabase } from "@/lib/operaciones";
import { traducir } from "@/lib/operaciones";
import { opcionesCuentas } from "@/lib/finanzas/consultas";
import type { TipoServicioGasto } from "@/lib/finanzas/servicios";
import type { Json } from "@/lib/supabase/tipos-bd";
import type { LineaRpc } from "./lineas";

export type OpcionPersona = { valor: string; etiqueta: string };
export type OpcionesLineas = {
  categorias: { valor: string; etiqueta: string }[];
  /** Categoría Bonos (se propone por omisión y exige destinatario). */
  bonos: string | null;
  empleados: OpcionPersona[];
  conductores: OpcionPersona[];
  proveedores: OpcionPersona[];
  cuentas: { valor: string; etiqueta: string }[];
};

/** Catálogos que necesita el editor de bonos y gastos. */
export async function opcionesLineas(supabase: ClienteSupabase): Promise<OpcionesLineas> {
  const [categorias, empleados, conductores, proveedores, cuentas] = await Promise.all([
    supabase.from("categorias_gasto").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("empleados").select("id, nombre, puesto").eq("activo", true).order("nombre"),
    supabase.from("conductores").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre"),
    opcionesCuentas(supabase),
  ]);
  if ([categorias, empleados, conductores, proveedores].some((r) => r.error)) {
    throw new Error("No se pudieron cargar las opciones de bonos y gastos.");
  }
  const bonos = categorias.data?.find((c) => c.nombre === "Bonos")?.id ?? null;
  return {
    // Bonos primero: es lo más frecuente desde un servicio.
    categorias: (categorias.data ?? [])
      .map((c) => ({ valor: c.id, etiqueta: c.nombre }))
      .sort((a, b) => Number(b.valor === bonos) - Number(a.valor === bonos)),
    bonos,
    empleados: (empleados.data ?? []).map((e) => ({ valor: `e:${e.id}`, etiqueta: e.puesto ? `${e.nombre} · ${e.puesto}` : e.nombre })),
    conductores: (conductores.data ?? []).map((c) => ({ valor: `c:${c.id}`, etiqueta: c.nombre })),
    proveedores: (proveedores.data ?? []).map((p) => ({ valor: `p:${p.id}`, etiqueta: p.nombre })),
    cuentas,
  };
}

/** Registra todas las líneas en una transacción (todas o ninguna). */
export async function registrarLineas(
  supabase: ClienteSupabase,
  tipo: TipoServicioGasto,
  servicioId: string,
  lineas: readonly LineaRpc[],
): Promise<Fallo | null> {
  if (lineas.length === 0) return null;
  const { error } = await supabase.rpc("registrar_gastos_de_servicio", {
    p_tipo: tipo,
    p_servicio_id: servicioId,
    p_lineas: lineas as unknown as Json,
  });
  return error ? traducir(error) : null;
}

/**
 * El servicio ya quedó guardado (su clave lo protege de duplicarse) pero sus
 * bonos o gastos no: se explica y se permite reenviar el mismo formulario.
 */
export function falloTrasServicio(servicio: string, fallo: Fallo): Fallo {
  return {
    error: `Se guardó ${servicio}, pero no sus bonos y gastos: ${fallo.error} Corríjalo y pulse de nuevo el botón; no se duplicará ${servicio}.`,
    errores: {},
  };
}
