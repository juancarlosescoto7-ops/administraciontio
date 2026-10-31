import Link from "next/link";
import { puede, type Rol } from "@/lib/auth/roles";
import { SERVICIOS_GASTO, type TipoServicioGasto } from "@/lib/finanzas/servicios";
import { createClient } from "@/lib/supabase/server";
import { formatearMoneda } from "@/lib/formato";
import { Seccion } from "./resumen";

export async function GastosServicio({ tipo, id, rol, conductorId = null }: { tipo: TipoServicioGasto; id: string; rol: Rol; conductorId?: string | null }) {
  if (!puede("gestionarGastos", rol)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("gastos_servicio").select("gasto_id, gastos(concepto, monto, estado)").eq(SERVICIOS_GASTO[tipo].columna, id);
  const nuevo = `/finanzas/gastos/nuevo?tipo=${tipo}&servicio=${id}`;
  return <Seccion titulo="Gastos de este servicio">
    <div className="mb-4 flex flex-wrap gap-2">
      <Link className="boton boton-secundario" href={nuevo}>Registrar gasto relacionado</Link>
      {conductorId && <Link className="boton boton-secundario" href={`${nuevo}&conductor=${conductorId}`}>Pagar al conductor</Link>}
    </div>
    {error ? <p role="alert">No se pudieron consultar los gastos.</p> : <ul className="space-y-2">{data?.map((r) => <li key={r.gasto_id}>
      <Link className="text-enlace underline" href={`/finanzas/gastos/${r.gasto_id}`}>{r.gastos?.concepto}</Link>
      {" · "}{formatearMoneda(r.gastos?.monto)}{r.gastos?.estado === "anulado" ? " · Anulado" : ""}
    </li>)}</ul>}
    {!error && !data?.length && <p className="texto-tenue">Sin gastos relacionados.</p>}
  </Seccion>;
}
