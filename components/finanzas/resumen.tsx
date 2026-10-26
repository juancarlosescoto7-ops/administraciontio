import type { ReactNode } from "react";
import { ESTADOS_FINALES, ETIQUETAS_ESTADO } from "@/lib/finanzas/definiciones";
import { formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/tipos-bd";

type Importe = { etiqueta: string; valor: number | string | null; ayuda?: string; destacado?: boolean };

/** Tarjetas con los importes clave (total, pagado, pendiente, saldo a favor…). */
export function ResumenImportes({ importes }: { importes: readonly Importe[] }) {
  return (
    <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {importes.map((importe) => (
        <div key={importe.etiqueta} className={`tarjeta flex flex-col gap-1 p-4 ${importe.destacado ? "border-primario" : ""}`}>
          <dt className="text-sm texto-tenue">{importe.etiqueta}</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatearMoneda(importe.valor ?? 0)}</dd>
          {importe.ayuda && <dd className="text-xs texto-tenue">{importe.ayuda}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function InsigniaFinanciera({ estado }: { estado: string | null }) {
  const final = estado !== null && ESTADOS_FINALES.has(estado);
  return (
    <span className={`insignia ${final ? "insignia-inactivo" : "insignia-activo"}`}>
      {estado ? (ETIQUETAS_ESTADO[estado] ?? estado) : "—"}
    </span>
  );
}

/** Tarjeta de detalle con pares etiqueta/valor. */
export function Datos({ filas }: { filas: readonly [string, ReactNode][] }) {
  return (
    <dl className="tarjeta mb-6 grid grid-cols-1 gap-x-5 gap-y-3 p-4 sm:grid-cols-2 sm:p-6">
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="flex flex-col gap-0.5">
          <dt className="text-sm texto-tenue">{etiqueta}</dt>
          <dd className="break-words">{valor ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

type Origen = Database["public"]["Enums"]["origen_financiero"];

/**
 * Asientos generados automáticamente por uno o varios documentos (solo
 * lectura; no hay captura manual de asientos). Solo para roles con acceso.
 */
export async function AsientosDocumento({ origenes }: { origenes: readonly { tipo: Origen; id: string }[] }) {
  if (origenes.length === 0) return null;
  const supabase = await createClient();
  const filtro = origenes.map((o) => `and(origen_tipo.eq.${o.tipo},origen_id.eq.${o.id})`).join(",");
  const { data, error } = await supabase
    .from("asientos")
    .select("id, fecha, concepto, evento, estado, created_at, lineas_asiento(id, debe, haber, cuentas_contables(codigo, nombre), cuentas_dinero(nombre))")
    .or(filtro)
    .order("created_at");

  if (error) return <p className="aviso aviso-error">No se pudieron cargar los asientos.</p>;
  if (!data?.length) return <p className="texto-tenue">Sin asientos.</p>;

  return (
    <div className="flex flex-col gap-3">
      {data.map((asiento) => (
        <div key={asiento.id} className="tarjeta overflow-x-auto p-3">
          <p className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{asiento.concepto}</span>
            <span className="texto-tenue">{asiento.evento === "reverso" ? "· reverso" : ""}</span>
            {asiento.estado === "reversado" && <span className="insignia insignia-inactivo">Reversado</span>}
          </p>
          <table className="tabla text-sm">
            <thead>
              <tr>
                <th scope="col">Cuenta</th>
                <th scope="col" className="text-right">Debe</th>
                <th scope="col" className="text-right">Haber</th>
              </tr>
            </thead>
            <tbody>
              {asiento.lineas_asiento.map((linea) => (
                <tr key={linea.id}>
                  <td>
                    {linea.cuentas_contables?.codigo} {linea.cuentas_contables?.nombre}
                    {linea.cuentas_dinero ? ` · ${linea.cuentas_dinero.nombre}` : ""}
                  </td>
                  <td className="text-right tabular-nums">{Number(linea.debe) > 0 ? formatearMoneda(linea.debe) : ""}</td>
                  <td className="text-right tabular-nums">{Number(linea.haber) > 0 ? formatearMoneda(linea.haber) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
