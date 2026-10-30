"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AccesoRapido } from "@/lib/accesos";
import { opcionesFijas, type OpcionBusqueda } from "@/lib/busqueda/intencion";
import { ListaBusqueda, useBusquedaUniversal, useListaTeclado } from "@/components/buscador";
import { Icono } from "@/components/iconos";
import type { GrupoNavegacion } from "@/components/navegacion";

/**
 * Paleta de comandos (Ctrl/⌘+K): el buscador universal desde cualquier
 * pantalla. Lleva a páginas, acciones y registros que el rol puede ver.
 */
export function PaletaComandos({
  grupos,
  acciones,
  conDisparador = true,
}: {
  grupos: GrupoNavegacion[];
  acciones: AccesoRapido[];
  /** false: sin el campo de la barra; la paleta sigue abriéndose con Ctrl/⌘+K. */
  conDisparador?: boolean;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [consulta, setConsulta] = useState("");
  const disparador = useRef<HTMLButtonElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const id = useId();
  const { opciones, cargando } = useBusquedaUniversal(consulta, opcionesFijas(grupos, acciones));

  function cerrar() {
    setAbierta(false);
    disparador.current?.focus();
  }

  function ir(opcion: OpcionBusqueda | undefined) {
    if (!opcion) return;
    setAbierta(false);
    router.push(opcion.href);
  }

  const { indice, setActiva, alTeclear } = useListaTeclado(opciones, ir, cerrar);

  function abrir() {
    setConsulta("");
    setActiva(0);
    setAbierta(true);
  }

  useEffect(() => {
    function alPulsar(evento: KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        setConsulta("");
        setActiva(0);
        setAbierta((valor) => !valor);
      }
    }
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [setActiva]);

  useEffect(() => {
    if (abierta) entrada.current?.focus();
  }, [abierta]);

  return (
    <>
      {conDisparador && (
        <button ref={disparador} type="button" className="disparador-paleta" onClick={abrir} aria-haspopup="dialog" aria-label="Buscar (Ctrl+K)">
          <Icono nombre="buscar" className="size-4 shrink-0" />
          <span className="solo-amplio flex-1 truncate text-left">Buscar…</span>
          <kbd className="tecla solo-amplio">Ctrl K</kbd>
        </button>
      )}

      {abierta &&
        // Portal: la barra superior usa backdrop-filter, que recortaría un fixed hijo.
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgb(6_27_49/0.28)] px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={cerrar}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Buscar"
              className="tarjeta sombra-flotante flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden"
              onMouseDown={(evento) => evento.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-borde px-4">
                <Icono nombre="buscar" className="size-5 texto-tenue" />
                <input
                  ref={entrada}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={`${id}-lista`}
                  aria-activedescendant={opciones.length ? `${id}-opcion-${indice}` : undefined}
                  aria-autocomplete="list"
                  autoComplete="off"
                  className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--tenue)]"
                  placeholder="Nombre, teléfono, placa, página… o «cobro María»"
                  value={consulta}
                  onChange={(evento) => {
                    setConsulta(evento.target.value);
                    setActiva(0);
                  }}
                  onKeyDown={(evento) => {
                    // El foco se queda en la búsqueda mientras el diálogo está abierto.
                    if (evento.key === "Tab") evento.preventDefault();
                    else alTeclear(evento);
                  }}
                />
                {cargando && <span aria-hidden="true" className="buscador-girando" />}
                <kbd className="tecla">Esc</kbd>
              </div>
              <ListaBusqueda id={id} opciones={opciones} indice={indice} cargando={cargando} alApuntar={setActiva} alElegir={ir} />
              <p className="flex gap-4 border-t border-borde px-4 py-2 text-xs texto-tenue">
                <span><kbd className="tecla">↑</kbd> <kbd className="tecla">↓</kbd> moverse</span>
                <span><kbd className="tecla">Enter</kbd> abrir</span>
                <span><kbd className="tecla">Esc</kbd> cerrar</span>
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
