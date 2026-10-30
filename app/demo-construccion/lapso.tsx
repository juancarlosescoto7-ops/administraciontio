"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { GrupoNavegacion } from "@/components/navegacion";
import { Icono } from "@/components/iconos";
import { PanelBd } from "./diagrama";
import { Editor, Terminal } from "./editor";
import { EscenaPrueba } from "./prueba";
import { DURACION, ETAPAS, FINAL, estadoVisual, type Aspecto, type Vista } from "./guion";
import { SistemaReal } from "./vista";
import "./demo.css";

function escucharMovimiento(cambio: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", cambio);
  return () => media.removeEventListener("change", cambio);
}
const movimientoReducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const movimientoServidor = () => false;
function escucharAncho(cambio: () => void) {
  window.addEventListener("resize", cambio);
  return () => window.removeEventListener("resize", cambio);
}
const anchoVentana = () => window.innerWidth;
const anchoServidor = () => 1440;

const ALTO_LINEA = 19;

/** Reglas que se prueban en el inspector: dos intentos y, al final, el valor real de globals.css. */
const REGLAS: Record<Aspecto, { selector: string; valores: [string, string, string] }> = {
  tipografia: { selector: "body", valores: ["font-family: Georgia, serif;", 'font-family: "Trebuchet MS", sans-serif;', 'font-family: "Inter Variable", sans-serif;'] },
  color: { selector: ":root", valores: ["--primario: #0f9d8a;", "--primario: #e8590c;", "--primario: #533afd;"] },
  esquinas: { selector: ".tarjeta", valores: ["border-radius: 0;", "border-radius: 1.25rem;", "border-radius: 0.5rem;"] },
  densidad: { selector: ".tabla td", valores: ["padding: 1.25rem 0.75rem;", "padding: 0.25rem 0.75rem;", "padding: 0.75rem;"] },
  sombras: { selector: ".tarjeta", valores: ["box-shadow: none;", "box-shadow: 0 18px 40px rgb(6 27 49 / 0.25);", "box-shadow: var(--sombra);"] },
};

/** Recuadro tipo inspector del navegador: la regla que se está probando, con los intentos anteriores tachados. */
function Inspector({ aspecto, paso }: { aspecto: Aspecto; paso: number }) {
  const regla = REGLAS[aspecto];
  return (
    <div className="inspector" aria-hidden="true" data-aspecto={aspecto} data-paso={paso}>
      <div className="inspector-selector">{regla.selector} {"{"}</div>
      {regla.valores.slice(0, paso + 1).map((valor, i) => (
        <div key={valor} className="inspector-valor" data-descartado={i < paso}>
          {valor}
        </div>
      ))}
      <div className="inspector-selector">{"}"}</div>
    </div>
  );
}

/** Mide un elemento: líneas visibles del editor, proporción del panel de base y escala del sistema. */
function useMedida<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 });
  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => setMedida({ ancho: entrada.contentRect.width, alto: entrada.contentRect.height }));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return [ref, medida] as const;
}

/**
 * Time lapse de la construcción en pantalla dividida. A la izquierda, el código
 * real con la base de datos debajo, armándose a la par. A la derecha, el ERP real
 * creciendo.
 */
export function LapsoConstruccion({
  grupos,
  listados,
  paneles,
  resumenCobro,
}: {
  grupos: GrupoNavegacion[];
  listados: Record<Exclude<Vista, "vacio" | "inicio" | "cobro">, ReactNode>;
  /** Un objeto y no un arreglo: el panel se actualiza en su sitio, sin volver a montarse. */
  paneles: { cerrado: ReactNode; grafico: ReactNode; registrado: ReactNode };
  resumenCobro: ReactNode;
}) {
  const [reloj, setReloj] = useState(0);
  const [vuelta, setVuelta] = useState(0);
  const reducir = useSyncExternalStore(escucharMovimiento, movimientoReducido, movimientoServidor);
  const anchoPantalla = useSyncExternalStore(escucharAncho, anchoVentana, anchoServidor);
  const tiempo = reducir ? DURACION : reloj;
  const estado = estadoVisual(tiempo);
  const terminado = tiempo >= DURACION;
  const [refCodigo, codigo] = useMedida<HTMLDivElement>();
  const [refBd, bd] = useMedida<HTMLDivElement>();
  const [refVista, marco] = useMedida<HTMLDivElement>();
  // Alto del editor menos pestañas, ruta y barra de estado.
  const ventana = Math.max(4, Math.floor((codigo.alto - 80) / ALTO_LINEA));
  // El ERP se dibuja al ancho real de la pantalla (así sus puntos de quiebre son los de verdad) y se reduce al panel.
  const escala = marco.ancho ? Math.min(1, marco.ancho / anchoPantalla) : 1;

  useEffect(() => {
    if (reducir) return;
    let cuadro = 0;
    let anterior: number | null = null;
    let acumulado = 0;
    // Con la pestaña oculta no hay cuadros; el salto se limita para no perder el recorrido.
    const paso = (ahora: number) => {
      acumulado = Math.min(DURACION, acumulado + (anterior === null ? 0 : Math.min(50, ahora - anterior)));
      anterior = ahora;
      setReloj(acumulado);
      if (acumulado < DURACION) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [vuelta, reducir]);

  const contenido = (vista: Vista) => (vista === "vacio" || vista === "cobro" ? null : vista === "inicio" ? paneles.cerrado : listados[vista]);

  return (
    <>
      <h1 className="sr-only">Time lapse de la construcción del sistema</h1>
      <div
        key={vuelta}
        className="escritorio"
        inert
        data-etapa={ETAPAS[estado.etapa].id}
        data-flash={estado.flash ? estado.flash.migracion : ""}
        data-vista={estado.sistema.vista}
        data-construccion={Math.round(estado.sistema.progreso * 100)}
        data-prueba={estado.sistema.prueba && estado.sistema.prueba.paso < 3 ? `${estado.sistema.prueba.aspecto}-${estado.sistema.prueba.paso}` : ""}
        data-final={estado.final}
        data-terminado={terminado}
        data-reduced={reducir}
      >
        <section className="ventana-codigo" aria-label="Editor de código y base de datos">
          <div className="ide-centro" ref={refCodigo}>
            <Editor archivo={estado.archivo} escritura={estado.escritura} pestanas={estado.pestanas} ventana={ventana} />
          </div>
          <div className="ide-bd" ref={refBd}>
            <PanelBd flash={estado.bd} tiempo={tiempo} aspecto={bd.alto ? bd.ancho / Math.max(1, bd.alto - 26) : 2} />
          </div>
          <Terminal tiempo={tiempo} />
        </section>

        <section className="ventana-navegador" aria-label="El sistema">
          <div className="ide-vista" ref={refVista}>
            <div className="ide-vista-escala" style={{ width: anchoPantalla, height: marco.alto / escala, transform: `scale(${escala})` }}>
              <SistemaReal
                grupos={grupos}
                etapa={estado.sistema.etapa}
                vista={estado.sistema.vista}
                contenido={contenido(estado.sistema.vista)}
                progreso={estado.sistema.progreso}
                reconstruir={estado.sistema.reconstruir}
                escrito={estado.sistema.escrito}
                prueba={estado.sistema.prueba}
              />
            </div>
          </div>
          {estado.sistema.prueba && estado.sistema.prueba.paso < 3 && <Inspector aspecto={estado.sistema.prueba.aspecto} paso={estado.sistema.prueba.paso} />}
        </section>
      </div>
      {estado.final && <EscenaPrueba m={tiempo - FINAL} reducir={reducir} grupos={grupos} paneles={paneles} resumenCobro={resumenCobro} />}
      {terminado && !reducir && (
        <button
          type="button"
          className="lapso-repetir boton boton-secundario sombra-flotante"
          aria-label="Repetir"
          onClick={() => {
            setReloj(0);
            setVuelta((v) => v + 1);
          }}
        >
          <Icono nombre="historial" />
          Repetir
        </button>
      )}
    </>
  );
}
