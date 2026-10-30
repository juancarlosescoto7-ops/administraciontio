"use client";

import { useEffect, useState } from "react";

const DURACION_MS = 900;

/** Separa «L 1,300.50» en prefijo, número y sufijo; null si no hay número. */
export function partirCifra(texto: string): { antes: string; numero: number; decimales: number; despues: string } | null {
  const partes = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(texto);
  if (!partes) return null;
  const [, antes, cifra, despues] = partes;
  return { antes, numero: Number(cifra.replaceAll(",", "")), decimales: cifra.split(".")[1]?.length ?? 0, despues };
}

const formatear = (valor: number, decimales: number) =>
  valor.toLocaleString("en-US", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/**
 * Cifra que cuenta desde cero al aparecer. El servidor envía el valor final
 * (sin JavaScript se lee igual) y con «reducir movimiento» no se anima. Los
 * lectores de pantalla leen siempre el valor final.
 */
export function CifraAnimada({ valor }: { valor: string }) {
  const [mostrado, setMostrado] = useState(valor);

  useEffect(() => {
    const cifra = partirCifra(valor);
    if (!cifra || cifra.numero === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let marco = 0;
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const avance = Math.min((ahora - inicio) / DURACION_MS, 1);
      const suave = 1 - (1 - avance) ** 3;
      setMostrado(`${cifra.antes}${formatear(cifra.numero * suave, cifra.decimales)}${cifra.despues}`);
      if (avance < 1) marco = requestAnimationFrame(paso);
    };
    marco = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(marco);
      setMostrado(valor);
    };
  }, [valor]);

  return (
    <>
      <span aria-hidden="true" className="tabular-nums">
        {mostrado}
      </span>
      <span className="sr-only">{valor}</span>
    </>
  );
}
