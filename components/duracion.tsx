"use client";

import { useState } from "react";
import { duracionDesdeMinutos, minutosDesdeDuracion, type UnidadDuracion } from "@/lib/duracion";

export function CampoDuracion({ id, nombre, minutos, error }: { id: string; nombre: string; minutos: string; error?: boolean }) {
  const inicial = duracionDesdeMinutos(Number(minutos));
  const [valor, setValor] = useState(minutos ? inicial.valor : "");
  const [unidad, setUnidad] = useState<UnidadDuracion>(inicial.unidad);
  const convertido = minutosDesdeDuracion(valor, unidad);
  return (
    <div className="flex gap-2">
      <input id={id} className="entrada min-w-0" type="number" min="0" step="any" value={valor}
        aria-invalid={error || undefined} onChange={(e) => setValor(e.target.value)} />
      <select className="entrada" aria-label="Unidad de duración" value={unidad} onChange={(e) => {
        const nueva = e.target.value as UnidadDuracion;
        setUnidad(nueva);
      }}>
        <option value="minutos">Minutos</option><option value="horas">Horas</option><option value="dias">Días</option>
      </select>
      <input type="hidden" name={nombre} value={convertido ?? ""} />
    </div>
  );
}
