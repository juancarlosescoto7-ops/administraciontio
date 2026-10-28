"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { coincide, type AccesoRapido } from "@/lib/accesos";
import { Icono, type NombreIcono } from "@/components/iconos";
import type { GrupoNavegacion } from "@/components/navegacion";

type Opcion = { href: string; etiqueta: string; contexto: string; icono: NombreIcono; seccion: "Acciones" | "Páginas" };

/**
 * Paleta de comandos (Ctrl/⌘+K): lleva a páginas y acciones que el rol ya
 * tiene en el menú. No busca registros; el menú lateral sigue siendo la vía
 * principal.
 */
export function PaletaComandos({ grupos, acciones }: { grupos: GrupoNavegacion[]; acciones: AccesoRapido[] }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [activa, setActiva] = useState(0);
  const disparador = useRef<HTMLButtonElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const id = useId();

  const opciones: Opcion[] = [
    ...acciones.map((a) => ({ href: a.href, etiqueta: a.etiqueta, contexto: "Acción", icono: a.icono, seccion: "Acciones" as const })),
    ...grupos.flatMap((g) =>
      g.enlaces.map((e) => ({ href: e.href, etiqueta: e.etiqueta, contexto: g.titulo ?? "General", icono: g.icono, seccion: "Páginas" as const })),
    ),
  ].filter((opcion) => coincide(consulta, opcion.etiqueta, opcion.contexto));
  const indice = Math.min(activa, Math.max(opciones.length - 1, 0));

  function abrir() {
    setConsulta("");
    setActiva(0);
    setAbierta(true);
  }

  function cerrar() {
    setAbierta(false);
    disparador.current?.focus();
  }

  function ir(opcion: Opcion | undefined) {
    if (!opcion) return;
    setAbierta(false);
    router.push(opcion.href);
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
  }, []);

  useEffect(() => {
    if (abierta) entrada.current?.focus();
  }, [abierta]);

  useEffect(() => {
    if (!abierta) return;
    document.getElementById(`${id}-opcion-${indice}`)?.scrollIntoView({ block: "nearest" });
  }, [abierta, indice, id]);

  function alTeclear(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setActiva((indice + 1) % Math.max(opciones.length, 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setActiva((indice - 1 + opciones.length) % Math.max(opciones.length, 1));
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      ir(opciones[indice]);
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      cerrar();
    } else if (evento.key === "Tab") {
      // El foco se queda en la búsqueda mientras el diálogo está abierto.
      evento.preventDefault();
    }
  }

  return (
    <>
      <button ref={disparador} type="button" className="disparador-paleta" onClick={abrir} aria-haspopup="dialog" aria-label="Buscar página o acción (Ctrl+K)">
        <Icono nombre="buscar" className="size-4 shrink-0" />
        <span className="hidden flex-1 truncate text-left md:inline">Buscar página o acción…</span>
        <kbd className="tecla hidden md:inline-flex">Ctrl K</kbd>
      </button>

      {abierta &&
        // Portal: la barra superior usa backdrop-filter, que recortaría un fixed hijo.
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgb(6_27_49/0.28)] px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={cerrar}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Buscar página o acción"
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
                  className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--tenue)]"
                  placeholder="Ir a una página o iniciar una acción…"
                  value={consulta}
                  onChange={(evento) => {
                    setConsulta(evento.target.value);
                    setActiva(0);
                  }}
                  onKeyDown={alTeclear}
                />
                <kbd className="tecla">Esc</kbd>
              </div>
              <ul id={`${id}-lista`} role="listbox" aria-label="Resultados" className="flex-1 overflow-y-auto p-2">
                {opciones.length === 0 && (
                  <li role="presentation" className="px-3 py-8 text-center texto-tenue">
                    Sin coincidencias. Pruebe con otra palabra.
                  </li>
                )}
                {opciones.map((opcion, posicion) => (
                  <OpcionPaleta
                    key={`${opcion.seccion}-${opcion.href}`}
                    opcion={opcion}
                    id={`${id}-opcion-${posicion}`}
                    activa={posicion === indice}
                    titulo={posicion === 0 || opciones[posicion - 1].seccion !== opcion.seccion ? opcion.seccion : null}
                    alApuntar={() => setActiva(posicion)}
                    alElegir={() => ir(opcion)}
                  />
                ))}
              </ul>
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

function OpcionPaleta({
  opcion,
  id,
  activa,
  titulo,
  alApuntar,
  alElegir,
}: {
  opcion: Opcion;
  id: string;
  activa: boolean;
  titulo: string | null;
  alApuntar: () => void;
  alElegir: () => void;
}) {
  return (
    <>
      {titulo && (
        <li role="presentation" className="px-3 pt-3 pb-1 text-xs font-semibold texto-tenue">
          {titulo}
        </li>
      )}
      <li
        id={id}
        role="option"
        aria-selected={activa}
        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${activa ? "bg-[var(--neutro-fondo)]" : ""}`}
        onMouseMove={alApuntar}
        onClick={alElegir}
      >
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-md ${activa ? "distintivo" : "bg-neutro texto-tenue"}`}>
          <Icono nombre={opcion.seccion === "Acciones" ? "mas" : opcion.icono} className="size-4" />
        </span>
        <span className="flex-1 font-medium">{opcion.etiqueta}</span>
        <span className="text-xs texto-tenue">{opcion.contexto}</span>
      </li>
    </>
  );
}
