// Piezas comunes de los detalles de operaciones (traslados, alquileres y
// transportes): formularios desplegables, acciones de un clic, avisos e
// historial de la bitácora.
import type { ReactNode } from "react";
import { formatearFechaHora } from "@/lib/formato";
import type { Json } from "@/lib/supabase/tipos-bd";
import { FormularioOperacion } from "@/components/finanzas/operaciones";

export function Desplegable({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className="tarjeta mt-4 p-4 sm:p-6">
      <summary className="cursor-pointer font-medium">{titulo}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

/** Acción de un clic (sin campos), con el mismo manejo de errores que los formularios. */
export function BotonAccion({ accion, texto }: { accion: Parameters<typeof FormularioOperacion>[0]["accion"]; texto: string }) {
  return (
    <div className="min-w-48">
      <FormularioOperacion campos={[]} accion={accion} textoEnviar={texto} />
    </div>
  );
}

export function ListaAvisos({ avisos }: { avisos: readonly string[] | null }) {
  if (!avisos?.length) return null;
  return (
    <ul role="status" className="aviso aviso-advertencia mb-4 list-disc pl-8">
      {avisos.map((aviso) => (
        <li key={aviso}>{aviso}</li>
      ))}
    </ul>
  );
}

type Evento = { fecha: string; accion: string; motivo: string | null; despues: Json; actor: string | null };

export function Historial({
  eventos,
  acciones,
  describir,
}: {
  eventos: readonly Evento[] | null;
  acciones: Record<string, string>;
  describir?: (accion: string, despues: Json) => string | null;
}) {
  if (!eventos?.length) return <p className="tarjeta p-4 texto-tenue">Sin eventos registrados.</p>;
  return (
    <ul className="tarjeta divide-y divide-[var(--borde)]">
      {eventos.map((evento, indice) => {
        const detalle = describir?.(evento.accion, evento.despues) ?? null;
        return (
          <li key={`${evento.fecha}-${indice}`} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
            <span className="font-medium">{acciones[evento.accion] ?? evento.accion}</span>
            <span className="texto-tenue">
              {formatearFechaHora(evento.fecha)} · {evento.actor ?? "Sistema"}
            </span>
            {detalle && <span>{detalle}</span>}
            {evento.motivo && <span className="texto-tenue">Motivo: {evento.motivo}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** Insignia de estado: los finales apagados; los que requieren atención, en advertencia. */
export function InsigniaEstado({
  estado,
  etiquetas,
  atencion = [],
  finales = [],
}: {
  estado: string | null;
  etiquetas: Record<string, string>;
  atencion?: readonly string[];
  finales?: readonly string[];
}) {
  if (!estado) return <span className="insignia insignia-inactivo">—</span>;
  const clase = finales.includes(estado) ? "insignia-inactivo" : atencion.includes(estado) ? "insignia-advertencia" : "insignia-activo";
  return <span className={`insignia ${clase}`}>{etiquetas[estado] ?? estado}</span>;
}
