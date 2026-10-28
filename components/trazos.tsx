"use client";

import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

// Trazos (firma visual de la cabecera): un haz de líneas curvas finas que fluye
// por la esquina superior derecha, en grises, con una línea de acento. Es
// decorativo (SVG, sin bibliotecas). Cada pantalla desplaza y ondula el haz a
// una posición propia (derivada de la ruta) y, al navegar, sus dos grupos de
// líneas se deslizan hasta ella con distinto desfase. El resto del tiempo está
// quieto; con «reducir movimiento» cambia sin transición.

const LINEAS = 16;

/** Línea `i` del haz: baja desde arriba, se ondula y sale por la derecha; sobra trazo para moverse. */
function linea(i: number): string {
  const d = i * 18;
  return [
    `M${(300 + d).toFixed(1)} -120`,
    `C${(470 + d * 0.6).toFixed(1)} ${(120 + d * 0.35).toFixed(1)}`,
    `${(760 - d * 0.25).toFixed(1)} ${(-10 + d * 0.8).toFixed(1)}`,
    `${(980 + d * 0.15).toFixed(1)} ${(150 + d * 0.55).toFixed(1)}`,
    `S${(1260).toFixed(1)} ${(250 + d * 0.9).toFixed(1)} ${(1600).toFixed(1)} ${(170 + d * 0.7).toFixed(1)}`,
  ].join(" ");
}

/** Posición del haz para una ruta: siempre la misma para la misma pantalla. */
function posicion(ruta: string) {
  let h = 2166136261;
  for (let i = 0; i < ruta.length; i++) {
    h ^= ruta.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rango = (desplazamiento: number, minimo: number, maximo: number) =>
    minimo + (((h >>> desplazamiento) & 1023) / 1023) * (maximo - minimo);
  return { x: rango(0, -12, 6), y: rango(7, -10, 8), giro: rango(14, -8, 8), escala: rango(21, 0.95, 1.2) };
}

function estiloGrupo(ruta: string | null, grupo: number): CSSProperties | undefined {
  if (ruta === null) return undefined;
  const { x, y, giro, escala } = posicion(ruta);
  // El segundo grupo se desplaza más y gira al revés: el haz se abre y se ondula.
  const f = grupo === 0 ? 1 : 1.5;
  const g = grupo === 0 ? 1 : -0.6;
  return {
    transform: `translate(${(x * f).toFixed(2)}%, ${(y * f).toFixed(2)}%) rotate(${(giro * g).toFixed(2)}deg) scale(${escala.toFixed(3)})`,
  };
}

export function Trazos() {
  const ruta = usePathname();
  return <Dibujo ruta={ruta} />;
}

/** Mientras se resuelve la ruta: el haz en reposo. */
export function TrazosFijos() {
  return <Dibujo ruta={null} />;
}

function Dibujo({ ruta }: { ruta: string | null }) {
  return (
    <div aria-hidden="true" className="trazos">
      <svg viewBox="0 0 1200 420" preserveAspectRatio="xMaxYMin slice">
        {[0, 1].map((grupo) => (
          <g key={grupo} className="trazos-grupo" style={estiloGrupo(ruta, grupo)}>
            {Array.from({ length: LINEAS / 2 }, (_, n) => {
              const i = n * 2 + grupo;
              const acento = i === 9;
              return (
                <path
                  key={i}
                  d={linea(i)}
                  fill="none"
                  stroke={acento ? "#a3afbf" : i % 3 === 0 ? "#c0cad7" : "#d3dbe5"}
                  strokeWidth={acento ? 1.5 : 1}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}
