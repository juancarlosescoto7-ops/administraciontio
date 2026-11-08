"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icono } from "@/components/iconos";

/**
 * Recomendación flotante al finalizar un servicio (o al vender una
 * membresía): muestra el resultado y ofrece agregar bonos o gastos. Aparece
 * una sola vez: al abrirse quita de la dirección el parámetro que la activó,
 * así que recargar la página no la repite.
 */
export function RecomendacionResultado({
  titulo,
  parametro,
  filas,
  ganancia,
  negativa,
  estimada,
  children,
}: {
  titulo: string;
  /** Parámetro de la URL que la activó (devuelto, completado, guardado). */
  parametro: string;
  filas: { etiqueta: string; valor: string }[];
  ganancia: string;
  negativa: boolean;
  estimada: boolean;
  /** Formulario para agregar bonos o gastos. */
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [agregando, setAgregando] = useState(false);

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
    const url = new URL(window.location.href);
    if (url.searchParams.has(parametro)) {
      url.searchParams.delete(parametro);
      window.history.replaceState(window.history.state, "", url);
    }
  }, [parametro]);

  const cerrar = () => ref.current?.close();
  const verResultado = () => {
    cerrar();
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector("[data-resultado-servicio]")?.scrollIntoView({ block: "center", behavior: suave ? "smooth" : "auto" });
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-titulo`}
      className="dialogo"
      onClick={(evento) => {
        if (evento.target === ref.current) cerrar();
      }}
      data-recomendacion-resultado
    >
      <div className="dialogo-marco">
        <div className="dialogo-cabecera">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id={`${id}-titulo`} className="text-base font-semibold tracking-tight">{titulo}</h2>
            <p className="text-sm texto-tenue">Así queda el resultado de este servicio.</p>
          </div>
          <button type="button" className="boton boton-secundario min-h-9 px-3" onClick={cerrar} aria-label="Cerrar recomendación">
            <Icono nombre="cerrar" className="size-4" />
          </button>
        </div>
        <div className="dialogo-cuerpo flex flex-col gap-4">
          <dl className="tarjeta grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 p-4 text-sm tabular-nums">
            {filas.map((f) => (
              <div key={f.etiqueta} className="contents">
                <dt>{f.etiqueta}</dt>
                <dd className="text-right">{f.valor}</dd>
              </div>
            ))}
            <dt className="mt-1 border-t border-borde pt-2 font-semibold">{estimada ? "Ganancia estimada" : "Le ganaste"}</dt>
            <dd className={`mt-1 border-t border-borde pt-2 text-right text-base font-semibold ${negativa ? "text-[var(--peligro)]" : "text-[var(--exito)]"}`}>{ganancia}</dd>
          </dl>
          {agregando ? (
            children
          ) : (
            <>
              <p className="text-sm">¿Quiere dar un bono o registrar otro gasto de este servicio?</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="boton boton-secundario" onClick={cerrar}>Ahora no</button>
                <button type="button" className="boton boton-secundario" onClick={verResultado}>Ver resultado</button>
                <button type="button" className="boton boton-primario" onClick={() => setAgregando(true)}>
                  <Icono nombre="dinero" className="size-4" />
                  + Agregar bono o gasto
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
