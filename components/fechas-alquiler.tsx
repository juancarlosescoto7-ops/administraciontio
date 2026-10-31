"use client";
import { useState } from "react";
import { aFechaHoraLocal, momentoDesdeLocal } from "@/lib/formato";
import { minutosDesdeDuracion, type UnidadDuracion } from "@/lib/duracion";

export function FechasAlquiler({ entrega, devolucion }: { entrega: string; devolucion: string }) {
  const [inicio, setInicio] = useState(entrega);
  const [fin, setFin] = useState(devolucion);
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState<UnidadDuracion>("dias");
  function calcular(fecha: string, valor: string, u: UnidadDuracion) {
    const minutos = minutosDesdeDuracion(valor, u);
    if (fecha && minutos) {
      const momento = new Date(momentoDesdeLocal(fecha)).getTime() + minutos * 60000;
      if (Number.isFinite(momento)) setFin(aFechaHoraLocal(new Date(momento)));
    }
  }
  return <>
    <label className="campo"><span className="campo-etiqueta">2. Entrega prevista</span>
      <input className="entrada" type="datetime-local" name="entrega" value={inicio} required onChange={(e) => { setInicio(e.target.value); calcular(e.target.value, cantidad, unidad); }} />
    </label>
    <label className="campo"><span className="campo-etiqueta">Devolución prevista</span>
      <input className="entrada" type="datetime-local" name="devolucion" value={fin} required onChange={(e) => { setFin(e.target.value); setCantidad(""); }} />
    </label>
    <div className="campo sm:col-span-2">
      <label htmlFor="duracion-alquiler" className="campo-etiqueta">Calcular devolución por duración (opcional)</label>
      <div className="flex gap-2">
        <input id="duracion-alquiler" className="entrada" type="number" min="0" step="any" value={cantidad} onChange={(e) => { setCantidad(e.target.value); calcular(inicio, e.target.value, unidad); }} />
        <select className="entrada" aria-label="Unidad de duración del alquiler" value={unidad} onChange={(e) => { const u = e.target.value as UnidadDuracion; setUnidad(u); calcular(inicio, cantidad, u); }}>
          <option value="minutos">Minutos</option><option value="horas">Horas</option><option value="dias">Días</option>
        </select>
      </div>
      <p className="campo-ayuda">Puede indicar la devolución directamente o calcularla con una duración. Un día equivale a 24 horas.</p>
    </div>
  </>;
}
