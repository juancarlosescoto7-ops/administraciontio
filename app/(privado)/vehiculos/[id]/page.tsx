import Link from "next/link";
import { Suspense } from "react";
import { PaginaDetalle } from "@/components/catalogos/paginas";
import { Datos, Seccion } from "@/components/finanzas/resumen";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { formatearKm } from "@/lib/flota/definiciones";
import { formatearFechaHora } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";

export default function Page({ params, searchParams }: PageProps<"/vehiculos/[id]">) {
  return <>
    <PaginaDetalle clave="vehiculos" params={params} searchParams={searchParams} />
    <Suspense fallback={null}><Kilometraje params={params} /></Suspense>
  </>;
}

// Resumen del módulo de flota; el detalle y los mantenimientos están en /flota/[id].
async function Kilometraje({ params }: Pick<PageProps<"/vehiculos/[id]">, "params">) {
  const [, { id }] = await Promise.all([requerirUsuario(), params]);
  if (!esUuid(id)) return null;
  const supabase = await createClient();
  const { data: v } = await supabase.from("resumen_flota").select("km_actual, ultima_fecha, descuadres").eq("vehiculo_id", id).maybeSingle();
  if (!v) return null;
  return <Seccion titulo="Kilometraje y mantenimiento" abierta>
    <Datos filas={[
      ["Kilometraje actual", v.km_actual === null ? "Sin registros todavía" : formatearKm(v.km_actual)],
      ["Último movimiento", formatearFechaHora(v.ultima_fecha)],
      ["Descuadres", v.descuadres ? <span key="d" className="insignia insignia-peligro">{v.descuadres}</span> : "0"],
    ]} />
    <Link className="boton boton-secundario" href={`/flota/${id}`}>Ver cuadre y mantenimientos</Link>
  </Seccion>;
}
