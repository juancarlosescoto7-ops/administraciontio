"use client";

import { useEffect, useState } from "react";
import { Icono } from "@/components/iconos";

/**
 * Aviso de éxito flotante (abajo a la derecha): no desplaza el contenido y se
 * cierra solo a los pocos segundos o con su botón. Los errores siguen junto a
 * los formularios, donde hay que corregirlos.
 */
export function Notificacion({ mensaje, duracion = 7000 }: { mensaje: string; duracion?: number }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const temporizador = setTimeout(() => setVisible(false), duracion);
    return () => clearTimeout(temporizador);
  }, [duracion, mensaje]);
  if (!visible) return null;

  return (
    <div role="status" aria-live="polite" className="notificacion">
      <Icono nombre="finalizar" className="mt-0.5 size-5 shrink-0" />
      <p className="flex-1">{mensaje}</p>
      <button type="button" className="notificacion-cerrar" onClick={() => setVisible(false)} aria-label="Cerrar aviso">
        <Icono nombre="cerrar" className="size-4" />
      </button>
    </div>
  );
}
