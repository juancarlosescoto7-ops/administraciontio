"use client";

import { useId, useState, type ReactNode } from "react";

/** Eventos visibles al abrir; coincide con `nth-child(n + 4)` de globals.css. */
const VISIBLES = 3;

/**
 * Historial (del más reciente al más antiguo): muestra los últimos eventos y
 * pliega los anteriores. Los plegados solo se ocultan a la vista: los lectores
 * de pantalla siguen leyendo el historial completo.
 */
export function HistorialPlegable({ total, children }: { total: number; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  const anteriores = total - VISIBLES;

  if (anteriores <= 0) return children;
  return (
    <div className="flex flex-col items-start gap-2">
      <div id={id} className={`w-full ${abierto ? "" : "historial-plegado"}`}>
        {children}
      </div>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto(!abierto)}
        className="rounded-md text-sm font-medium text-enlace hover:underline"
      >
        {abierto ? "Ocultar eventos anteriores" : `Ver ${anteriores === 1 ? "1 evento anterior" : `${anteriores} eventos anteriores`}`}
      </button>
    </div>
  );
}
