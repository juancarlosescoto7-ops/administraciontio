"use client";

import { useHidratado } from "@/components/use-hidratado";

/** Abre el diálogo de impresión del navegador (también permite guardar como PDF). */
export function BotonImprimir() {
  const hidratado = useHidratado();
  return (
    <button type="button" className="boton boton-primario" onClick={() => window.print()} disabled={!hidratado}>
      Imprimir o guardar PDF
    </button>
  );
}
