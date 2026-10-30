"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { coincide } from "@/lib/accesos";
import { buscarUniversal } from "@/lib/busqueda/acciones";
import type { OpcionBusqueda } from "@/lib/busqueda/intencion";
import { Icono } from "@/components/iconos";

/**
 * Buscador universal: páginas y acciones del menú (al instante) más registros
 * y sugerencias del asistente (servidor, tras una breve espera). Lo comparten
 * el inicio y la paleta Ctrl/⌘+K.
 */

const ESPERA_MS = 220;
const MINIMO = 2;

export function useBusquedaUniversal(consulta: string, fijas: readonly OpcionBusqueda[]) {
  const limpia = consulta.trim();
  const [remotas, setRemotas] = useState<{ consulta: string; opciones: OpcionBusqueda[] }>({ consulta: "", opciones: [] });

  useEffect(() => {
    if (limpia.length < MINIMO) return;
    let vigente = true;
    const espera = setTimeout(() => {
      buscarUniversal(limpia)
        .catch(() => [])
        .then((opciones) => vigente && setRemotas({ consulta: limpia, opciones }));
    }, ESPERA_MS);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [limpia]);

  const buscaRegistros = limpia.length >= MINIMO;
  const servidor = buscaRegistros && remotas.consulta === limpia ? remotas.opciones : [];
  // Una acción que ya propone el asistente no se repite entre las fijas.
  const propuestas = new Set(servidor.map((o) => o.href));
  const locales = fijas.filter((o) => !propuestas.has(o.href) && coincide(consulta, o.etiqueta, o.contexto));
  return { opciones: [...servidor, ...locales], cargando: buscaRegistros && remotas.consulta !== limpia };
}

/** Flechas, Enter y Escape sobre una lista de opciones con una activa. */
export function useListaTeclado(opciones: readonly OpcionBusqueda[], alElegir: (o: OpcionBusqueda | undefined) => void, alEscapar: () => void) {
  const [activa, setActiva] = useState(0);
  const indice = Math.min(activa, Math.max(opciones.length - 1, 0));
  const total = Math.max(opciones.length, 1);

  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setActiva((indice + 1) % total);
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setActiva((indice - 1 + total) % total);
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      alElegir(opciones[indice]);
    } else if (evento.key === "Escape") {
      evento.preventDefault();
      alEscapar();
    }
  }

  return { indice, setActiva, alTeclear };
}

export function ListaBusqueda({
  id,
  opciones,
  indice,
  cargando,
  alApuntar,
  alElegir,
}: {
  id: string;
  opciones: readonly OpcionBusqueda[];
  indice: number;
  cargando: boolean;
  alApuntar: (posicion: number) => void;
  alElegir: (opcion: OpcionBusqueda) => void;
}) {
  useEffect(() => {
    document.getElementById(`${id}-opcion-${indice}`)?.scrollIntoView({ block: "nearest" });
  }, [id, indice]);

  return (
    <ul id={`${id}-lista`} role="listbox" aria-label="Resultados" aria-busy={cargando} className="flex-1 overflow-y-auto p-2">
      {opciones.length === 0 && (
        <li role="presentation" className="px-3 py-8 text-center texto-tenue">
          {cargando ? "Buscando…" : "Sin coincidencias. Pruebe con otra palabra, un teléfono o un código."}
        </li>
      )}
      {opciones.map((opcion, posicion) => {
        const activa = posicion === indice;
        const titulo = posicion === 0 || opciones[posicion - 1].seccion !== opcion.seccion ? opcion.seccion : null;
        return (
          <li key={opcion.clave} role="presentation">
            {titulo && <p className="flex items-center gap-2 px-3 pt-3 pb-1 text-xs font-semibold texto-tenue">{titulo}</p>}
            <div
              id={`${id}-opcion-${posicion}`}
              role="option"
              aria-selected={activa}
              className={`opcion-busqueda ${activa ? "opcion-busqueda-activa" : ""} ${opcion.seccion === "Asistente" ? "opcion-asistente" : ""}`}
              onMouseMove={() => alApuntar(posicion)}
              onClick={() => alElegir(opcion)}
            >
              <span className="opcion-busqueda-icono">
                <Icono nombre={opcion.seccion === "Acciones" ? "mas" : opcion.icono} className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{opcion.etiqueta}</span>
              <span className="shrink-0 text-xs texto-tenue">{opcion.contexto}</span>
            </div>
          </li>
        );
      })}
      {cargando && opciones.length > 0 && (
        <li role="presentation" className="px-3 py-2 text-xs texto-tenue">
          Buscando registros…
        </li>
      )}
    </ul>
  );
}

const PISTA_FIJA = "Escriba un nombre, teléfono, placa… o «cobro María»";
const NOMBRES_EJEMPLO = ["María López", "Juan Pérez", "Ana Rodríguez", "Carlos Mejía", "Rosa Martínez", "Luis Andino"];

/**
 * Pista del campo que se escribe y se borra sola con ejemplos reales de lo
 * que se puede pedir. Se detiene mientras hay texto; con «reducir
 * movimiento» queda la pista fija.
 */
function usePistaAnimada(frases: readonly string[], activa: boolean): string {
  const [pista, setPista] = useState(PISTA_FIJA);
  const clave = frases.join("|");

  useEffect(() => {
    if (!activa || frases.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frase = 0;
    let letras = 0;
    let borrando = false;
    let espera: ReturnType<typeof setTimeout>;
    const paso = () => {
      const actual = frases[frase];
      letras += borrando ? -1 : 1;
      setPista(`${actual.slice(0, letras)}▏`);
      if (!borrando && letras === actual.length) {
        borrando = true;
        espera = setTimeout(paso, 1700);
      } else if (borrando && letras === 0) {
        borrando = false;
        frase = (frase + 1) % frases.length;
        espera = setTimeout(paso, 350);
      } else {
        espera = setTimeout(paso, borrando ? 28 : 65);
      }
    };
    espera = setTimeout(paso, 900);
    return () => {
      clearTimeout(espera);
      setPista(PISTA_FIJA);
    };
    // `clave` resume `frases`: solo se reinicia si cambian los ejemplos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, activa]);

  return pista;
}

/**
 * Buscador grande del inicio. Los resultados se despliegan bajo el campo;
 * las sugerencias rellenan el inicio de una petición («cobro …»).
 */
export function BuscadorInicio({ fijas, ejemplos }: { fijas: readonly OpcionBusqueda[]; ejemplos: readonly string[] }) {
  const router = useRouter();
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [consulta, setConsulta] = useState("");
  const [abierta, setAbierta] = useState(false);
  const { opciones, cargando } = useBusquedaUniversal(consulta, fijas);
  const pista = usePistaAnimada(
    [...ejemplos.map((palabra, i) => `${palabra} ${NOMBRES_EJEMPLO[i % NOMBRES_EJEMPLO.length]}`), "HAA-1234", "9988-7766"],
    consulta === "",
  );
  const mostrar = abierta && consulta.trim() !== "";

  function ir(opcion: OpcionBusqueda | undefined) {
    if (!opcion) return;
    setAbierta(false);
    router.push(opcion.href);
  }

  const { indice, setActiva, alTeclear } = useListaTeclado(opciones, ir, () => setAbierta(false));

  function sugerir(palabra: string) {
    setConsulta(`${palabra} `);
    setActiva(0);
    setAbierta(true);
    entrada.current?.focus();
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="buscador-inicio">
      {/* Título y sugerencias en una sola línea, para que el bloque sea bajo. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={`${id}-titulo`} className="text-base font-semibold tracking-tight">
          ¿Qué necesita hacer?
          <span className="buscador-ayuda ml-2 hidden text-sm font-normal tracking-normal lg:inline">
            Busque por nombre, teléfono o placa, o pida una acción.
          </span>
        </h2>
        {ejemplos.length > 0 && (
          // En el teléfono se ocultan: el bloque es fijo y debe ocupar poco.
          <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
            <span className="buscador-ayuda text-xs">Pruebe:</span>
            {ejemplos.map((palabra) => (
              <button key={palabra} type="button" className="sugerencia" onClick={() => sugerir(palabra)}>
                {palabra} …
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        className="relative mt-3"
        onBlur={(evento) => {
          if (!evento.currentTarget.contains(evento.relatedTarget)) setAbierta(false);
        }}
      >
        <div className="buscador-campo">
          <Icono nombre="buscar" className="size-5 shrink-0 texto-tenue" />
          <input
            ref={entrada}
            role="combobox"
            aria-label="Buscar o pedir una acción"
            aria-expanded={mostrar}
            aria-controls={`${id}-lista`}
            aria-activedescendant={mostrar && opciones.length ? `${id}-opcion-${indice}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--tenue)]"
            placeholder={pista}
            value={consulta}
            onChange={(evento) => {
              setConsulta(evento.target.value);
              setActiva(0);
              setAbierta(true);
            }}
            onFocus={() => setAbierta(true)}
            onKeyDown={alTeclear}
          />
          {cargando && <span aria-hidden="true" className="buscador-girando" />}
          {consulta && (
            <button
              type="button"
              className="rounded-md p-1 texto-tenue hover:text-foreground"
              aria-label="Borrar búsqueda"
              onClick={() => {
                setConsulta("");
                entrada.current?.focus();
              }}
            >
              <Icono nombre="cerrar" className="size-4" />
            </button>
          )}
        </div>
        {mostrar && (
          // Sin robar el foco al campo: así el clic llega a la opción antes de cerrar.
          <div
            className="sombra-flotante absolute inset-x-0 top-full z-30 mt-2 flex max-h-[min(26rem,60vh)] flex-col overflow-hidden rounded-lg border border-borde"
            onMouseDown={(evento) => evento.preventDefault()}
          >
            <ListaBusqueda id={id} opciones={opciones} indice={indice} cargando={cargando} alApuntar={setActiva} alElegir={ir} />
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {mostrar && !cargando ? `${opciones.length} resultados` : ""}
      </p>
    </section>
  );
}
