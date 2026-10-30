"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icono, type NombreIcono } from "@/components/iconos";
import { useHidratado } from "@/components/use-hidratado";

/**
 * Ventana flotante para formularios secundarios (crear un cliente, cancelar,
 * reversar…): un botón la abre sobre la página sin ocupar espacio. Usa el
 * <dialog> nativo: foco atrapado, Esc la cierra y el resto queda inerte.
 * El contenido sigue montado al cerrarla, así que lo escrito se conserva.
 */
export function Dialogo({
  titulo,
  textoBoton,
  children,
  icono,
  peligro = false,
  abierto = false,
  claseBoton = "boton boton-secundario",
  descripcion,
}: {
  titulo: string;
  /** Texto del botón que la abre (por omisión, el título). */
  textoBoton?: string;
  children: ReactNode;
  icono?: NombreIcono;
  peligro?: boolean;
  /** Abierta al llegar (p. ej., la URL apunta a esta acción o hay errores). */
  abierto?: boolean;
  claseBoton?: string;
  descripcion?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const hidratado = useHidratado();
  const id = useId();

  useEffect(() => {
    if (abierto && ref.current && !ref.current.open) ref.current.showModal();
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        className={`${claseBoton} ${peligro ? "boton-aviso-peligro" : ""}`}
        onClick={() => ref.current?.showModal()}
        disabled={!hidratado}
        aria-haspopup="dialog"
      >
        {icono && <Icono nombre={icono} className="size-4" />}
        {textoBoton ?? titulo}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={`${id}-titulo`}
        className={`dialogo ${peligro ? "dialogo-peligro" : ""}`}
        // Un clic fuera del contenido (en el fondo) la cierra.
        onClick={(evento) => {
          if (evento.target === ref.current) ref.current.close();
        }}
      >
        <div className="dialogo-marco">
          <div className="dialogo-cabecera">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 id={`${id}-titulo`} className="text-base font-semibold tracking-tight">
                {titulo}
              </h2>
              {descripcion && <p className="text-sm texto-tenue">{descripcion}</p>}
            </div>
            <button type="button" className="boton boton-secundario min-h-9 px-3" onClick={() => ref.current?.close()} aria-label={`Cerrar ${titulo}`}>
              <Icono nombre="cerrar" className="size-4" />
            </button>
          </div>
          <div className="dialogo-cuerpo">{children}</div>
        </div>
      </dialog>
    </>
  );
}
