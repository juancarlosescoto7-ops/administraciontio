import Link from "next/link";
import { puede, type Rol } from "@/lib/auth/roles";
import { esUuid } from "@/lib/catalogos/presentacion";
import { createClient } from "@/lib/supabase/server";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { Seccion } from "./resumen";

const LIMITE = 50;

// Salarios y remuneraciones pagados a un empleado o conductor (solo administrador y finanzas).
export async function Remuneraciones({ persona, id, rol }: { persona: "empleado" | "conductor"; id: string; rol: Rol }) {
  if (!puede("gestionarGastos", rol) || !esUuid(id)) return null;
  const supabase = await createClient();
  const { data: vinculos, error, count } = await supabase.from("gastos_personal")
    .select("gasto_id, gastos!inner(fecha)", { count: "exact" })
    .eq(`${persona}_id`, id)
    .order("gastos(fecha)", { ascending: false })
    .limit(LIMITE);
  const ids = (vinculos ?? []).map((v) => v.gasto_id);
  const { data, error: errorSaldos } = ids.length
    ? await supabase.from("saldos_gastos").select("id, concepto, fecha, monto, pendiente, estado").in("id", ids).order("fecha", { ascending: false })
    : { data: [], error: null };
  return <Seccion titulo="Salarios y remuneraciones" abierta>
    <Link className="boton boton-secundario mb-4" href={`/finanzas/gastos/nuevo?${persona}=${id}`}>Registrar pago de salario</Link>
    {error || errorSaldos ? <p role="alert">No se pudieron consultar los pagos.</p> : <ul className="space-y-2">{data?.map((g) => <li key={g.id}>
      <Link className="text-enlace underline" href={`/finanzas/gastos/${g.id}`}>{g.concepto}</Link>
      {" · "}{formatearFecha(g.fecha)}{" · "}{formatearMoneda(g.monto)}
      {g.estado === "anulado" ? " · Anulado" : Number(g.pendiente) > 0 ? ` · Pendiente ${formatearMoneda(g.pendiente)}` : ""}
    </li>)}</ul>}
    {!error && !errorSaldos && !data?.length && <p className="texto-tenue">Sin pagos registrados.</p>}
    {(count ?? 0) > LIMITE &&<p className="mt-3 text-sm texto-tenue">Se muestran los últimos {LIMITE}.</p>}
  </Seccion>;
}
