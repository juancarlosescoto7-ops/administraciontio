"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { GrupoNavegacion } from "@/components/navegacion";
import { Encabezado } from "@/components/encabezado";
import { Notificacion } from "@/components/notificacion";
import { DURACION_PRUEBA, ETAPAS, progreso } from "./guion";
import { SistemaReal } from "./vista";

// Escena final: el sistema terminado se prueba con sus piezas más vistosas
// (gráfico de cobros, accesos rápidos, formulario de cobro, aviso e indicador).
// Tiempos en ms desde que empieza la escena.
const ABRE_GRAFICO = 1700;
const PULSA_ACCESO = 3900;
const FORMULARIO = 4050;
const MONTO = [5000, 5600] as const;
const METODO = 6150;
const REFERENCIA = [6700, 7300] as const;
const REGISTRA = 7900;
const AVISO = 8050;
const VUELVE = 9100;

/** Recorrido del cursor: a qué apunta y cuándo llega; `clic` marca la pulsación. */
const RECORRIDO: { en: number; objetivo: string; clic?: boolean }[] = [
  { en: ABRE_GRAFICO, objetivo: "caja-grafico", clic: true },
  { en: PULSA_ACCESO, objetivo: "acceso-cobro", clic: true },
  { en: MONTO[0], objetivo: "campo-monto" },
  { en: METODO, objetivo: "campo-metodo", clic: true },
  { en: REFERENCIA[0], objetivo: "campo-referencia" },
  { en: REGISTRA, objetivo: "registrar", clic: true },
  { en: VUELVE + 900, objetivo: "indicador-cobrado" },
];
const VIAJE = 650;

/**
 * Desplazamientos de la página, como haría quien usa el sistema. El primero
 * espera a que termine la entrada de la escena (700 ms): mientras dura, la escena
 * está transformada y la barra lateral fija se movería con ella.
 */
const DESPLAZAMIENTOS: { en: number; objetivo: string | null }[] = [
  { en: 800, objetivo: "caja-grafico" },
  { en: ABRE_GRAFICO + 250, objetivo: "grafico" },
  { en: 3100, objetivo: null },
  { en: VUELVE, objetivo: null },
];

function buscar(raiz: HTMLElement, objetivo: string): HTMLElement | null {
  if (objetivo === "caja-grafico") return [...raiz.querySelectorAll<HTMLElement>(".caja")].find((caja) => caja.textContent?.includes("últimos 7 días")) ?? null;
  if (objetivo === "grafico") return raiz.querySelector<HTMLElement>("#titulo-cobros-semana");
  if (objetivo === "acceso-cobro") return [...raiz.querySelectorAll<HTMLElement>(".acceso")].find((acceso) => acceso.textContent?.includes("Registrar cobro")) ?? null;
  if (objetivo === "indicador-cobrado") return raiz.querySelector<HTMLElement>(".indicador");
  return raiz.querySelector<HTMLElement>(`[data-objetivo="${objetivo}"]`);
}

function centro(raiz: HTMLElement, objetivo: string) {
  const caja = buscar(raiz, objetivo)?.getBoundingClientRect();
  return caja ? { x: caja.left + Math.min(caja.width / 2, 60), y: caja.top + caja.height / 2 } : null;
}

const escribir = (texto: string, [desde, hasta]: readonly [number, number], m: number) => texto.slice(0, Math.round(progreso(m, desde, hasta - desde) * texto.length));

/** Formulario real «Registrar cobro» (FormularioOperacion con camposCobro), llenado por la escena. */
function FormularioCobro({ resumen, m }: { resumen: ReactNode; m: number }) {
  const activo = (campo: string) =>
    (campo === "monto" && m >= MONTO[0] - 150 && m < MONTO[1] + 200) ||
    (campo === "metodo" && m >= METODO - 150 && m < METODO + 300) ||
    (campo === "referencia" && m >= REFERENCIA[0] - 150 && m < REFERENCIA[1] + 200);
  const obligatorio = (
    <span aria-hidden="true" className="campo-obligatorio">
      {" "}
      *
    </span>
  );
  const nada = () => undefined;
  return (
    <>
      <Encabezado titulo="Registrar cobro" volver={{ href: "#", etiqueta: "Cobros" }} />
      {resumen}
      <div className="tarjeta p-4 sm:p-6">
        <p className="mb-4 text-sm texto-tenue">
          El cobro cubrirá automáticamente los cargos pendientes desde el más antiguo. Si no alcanza para liquidar el siguiente, se aplicará como abono
          parcial. El excedente sobre la deuda total quedará como saldo a favor.
        </p>
        <form className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            <div className="campo">
              <label className="campo-etiqueta">Importe recibido{obligatorio}</label>
              <input className="entrada" inputMode="decimal" placeholder="0.00" readOnly tabIndex={-1} value={escribir("1200.00", MONTO, m)} data-objetivo="campo-monto" data-activo={activo("monto")} />
            </div>
            <div className="campo">
              <label className="campo-etiqueta">Caja o banco que recibe{obligatorio}</label>
              <select className="entrada" tabIndex={-1} value="banco" onChange={nada}>
                <option value="banco">Banco de ejemplo</option>
              </select>
            </div>
            <div className="campo">
              <label className="campo-etiqueta">Fecha{obligatorio}</label>
              <input className="entrada" type="date" readOnly tabIndex={-1} value="2026-10-29" />
            </div>
            <div className="campo">
              <label className="campo-etiqueta">Método de pago{obligatorio}</label>
              <select className="entrada" tabIndex={-1} value={m >= METODO + 120 ? "transferencia" : "efectivo"} onChange={nada} data-objetivo="campo-metodo" data-activo={activo("metodo")}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia bancaria</option>
              </select>
            </div>
            <div className="campo">
              <label className="campo-etiqueta">Referencia</label>
              <input className="entrada" readOnly tabIndex={-1} value={escribir("TRF-0042", REFERENCIA, m)} data-objetivo="campo-referencia" data-activo={activo("referencia")} />
              <p className="campo-ayuda">Número de transferencia, recibo o voucher (opcional).</p>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <span className="boton boton-secundario">Cancelar</span>
            <button type="button" tabIndex={-1} className="boton boton-primario" data-objetivo="registrar" data-pulsado={m >= REGISTRA && m < REGISTRA + 180}>
              Registrar cobro
            </button>
          </div>
        </form>
        <p className="mt-4 text-sm texto-tenue">El dinero entra una sola vez en la caja o banco elegido.</p>
      </div>
    </>
  );
}

/**
 * Escena final a pantalla completa: un cursor prueba el sistema terminado. Abre
 * el gráfico de cobros, entra por el acceso rápido «Registrar cobro», llena el
 * formulario, recibe el aviso real y vuelve al inicio con «Cobrado hoy» al día.
 */
export function EscenaPrueba({
  m,
  reducir,
  grupos,
  paneles,
  resumenCobro,
}: {
  /** Milisegundos desde que empezó la escena. */
  m: number;
  reducir: boolean;
  grupos: GrupoNavegacion[];
  paneles: { cerrado: ReactNode; grafico: ReactNode; registrado: ReactNode };
  resumenCobro: ReactNode;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const hechos = useRef(0);
  const enFormulario = m >= FORMULARIO && m < VUELVE;
  const panel = m < ABRE_GRAFICO ? paneles.cerrado : m < VUELVE ? paneles.grafico : paneles.registrado;
  const pulsando = RECORRIDO.some((paso) => paso.clic && m >= paso.en && m < paso.en + 260);

  // Sin dependencias: cada cuadro coloca el cursor sobre su objetivo real y aplica los desplazamientos pendientes.
  useLayoutEffect(() => {
    const raiz = marco.current;
    const flecha = cursor.current;
    if (!raiz || !flecha || reducir) return;
    while (hechos.current < DESPLAZAMIENTOS.length && m >= DESPLAZAMIENTOS[hechos.current].en) {
      const { objetivo } = DESPLAZAMIENTOS[hechos.current++];
      if (objetivo === null) raiz.scrollTo({ top: 0, behavior: "smooth" });
      else buscar(raiz, objetivo)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const indice = RECORRIDO.findIndex((paso) => m < paso.en);
    const destino = RECORRIDO[indice === -1 ? RECORRIDO.length - 1 : indice];
    const origen = indice > 0 ? RECORRIDO[indice - 1] : null;
    const b = centro(raiz, destino.objetivo);
    const a = origen ? centro(raiz, origen.objetivo) : { x: innerWidth * 0.62, y: innerHeight * 0.82 };
    if (!b || !a) return;
    const q = progreso(m, destino.en - VIAJE, VIAJE);
    const suave = q * q * (3 - 2 * q);
    flecha.style.transform = `translate(${a.x + (b.x - a.x) * suave}px, ${a.y + (b.y - a.y) * suave}px)`;
  });

  return (
    <div className="lapso-final" ref={marco} inert data-escena={enFormulario ? "formulario" : "inicio"} data-panel={m < ABRE_GRAFICO ? "cerrado" : m < VUELVE ? "grafico" : "registrado"}>
      <SistemaReal
        grupos={grupos}
        etapa={ETAPAS.length - 1}
        vista={enFormulario ? "cobro" : "inicio"}
        contenido={enFormulario ? <FormularioCobro resumen={resumenCobro} m={m} /> : panel}
      />
      {enFormulario && m >= AVISO && <Notificacion mensaje="Cobro registrado." />}
      {!reducir && m >= 400 && m < DURACION_PRUEBA - 300 && (
        <div ref={cursor} className="prueba-cursor" aria-hidden="true" data-pulsando={pulsando}>
          <span />
          <svg viewBox="0 0 24 28">
            <path d="M2 2v22l6-6 5 9 4-2-5-9h9Z" />
          </svg>
        </div>
      )}
    </div>
  );
}
