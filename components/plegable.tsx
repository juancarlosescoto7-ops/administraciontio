"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Icono, type NombreIcono } from "@/components/iconos";

/**
 * Caja de ícono: un botón con ícono y nombre que muestra su contenido debajo
 * de la fila de cajas (la retícula `.cajas` lo coloca ahí). Solo una abierta a
 * la vez dentro de `CajasProvider`. El contenido cerrado queda `inert`: sin
 * foco ni lectura por lectores de pantalla.
 */

// undefined: nadie ha elegido aún (vale la apertura inicial de cada caja);
// null: el usuario las cerró todas.
type Seleccion = string | null | undefined;
const Contexto = createContext<Dispatch<SetStateAction<Seleccion>> | null>(null);
const SeleccionActual = createContext<Seleccion>(undefined);

export function CajasProvider({ children }: { children: ReactNode }) {
  const [seleccion, elegir] = useState<Seleccion>(undefined);
  return (
    <Contexto.Provider value={elegir}>
      <SeleccionActual.Provider value={seleccion}>{children}</SeleccionActual.Provider>
    </Contexto.Provider>
  );
}

// Ícono según el título, para no repetirlo en cada página. El orden importa.
const ICONOS: [RegExp, NombreIcono][] = [
  [/historial/i, "historial"],
  [/buscar|filtrar/i, "buscar"],
  [/asiento/i, "libro"],
  [/últimos 7|gráfico/i, "grafico"],
  [/cobertura/i, "escudo"],
  [/finalizar/i, "finalizar"],
  [/cancela|baja|anular|reversar|atención/i, "alerta"],
  [/cambio|correcci|editar|condiciones/i, "editar"],
  [/horario|disponibilidad|próximos/i, "calendario"],
  [/cobro|pago|saldo|financ|finanz|mensualidad|cargo|movimiento|cuenta/i, "dinero"],
  [/beneficiario|cliente/i, "clientes"],
  [/vehículo|entrega|devoluci/i, "flota"],
  [/acceso/i, "mas"],
  [/catálogo/i, "configuracion"],
  [/servicio/i, "servicios"],
  [/membres/i, "membresia"],
];

function iconoPara(titulo: string): NombreIcono {
  return ICONOS.find(([patron]) => patron.test(titulo))?.[1] ?? "documento";
}

export function Plegable({
  titulo,
  resumen,
  icono,
  children,
  abierta = false,
  peligro = false,
  idTitulo,
}: {
  titulo: string;
  /** Línea breve bajo el nombre, visible aun cerrada. */
  resumen?: ReactNode;
  icono?: NombreIcono;
  children: ReactNode;
  /** Abierta al llegar (p. ej., hay filtros aplicados). */
  abierta?: boolean;
  peligro?: boolean;
  idTitulo?: string;
}) {
  const elegir = useContext(Contexto);
  const seleccion = useContext(SeleccionActual);
  const [local, setLocal] = useState(abierta);
  const id = useId();
  const idPanel = `${id}-panel`;
  const idEncabezado = idTitulo ?? `${id}-titulo`;
  const abierto = elegir ? (seleccion === undefined ? abierta : seleccion === id) : local;

  const nombreIcono = icono ?? iconoPara(titulo);
  const panel = useRef<HTMLElement>(null);
  const abiertaPorUsuario = useRef(false);

  // Al salir de la página, la selección no pasa a la caja que ocupe su lugar.
  useEffect(() => () => elegir?.((actual) => (actual === id ? undefined : actual)), [elegir, id]);

  // Si el contenido queda fuera de la vista (p. ej., en el teléfono), se acerca.
  useEffect(() => {
    if (!abierto || !abiertaPorUsuario.current) return;
    abiertaPorUsuario.current = false;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.current?.scrollIntoView({ block: "nearest", behavior: suave ? "smooth" : "auto" });
  }, [abierto]);

  const fijar = (valor: boolean) => {
    abiertaPorUsuario.current = valor;
    return elegir ? elegir(valor ? id : null) : setLocal(valor);
  };

  return (
    <>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => fijar(!abierto)}
        className={`caja ${abierto ? "caja-abierta" : ""} ${peligro ? "caja-peligro" : ""}`}
      >
        <span className="caja-icono">
          <Icono nombre={nombreIcono} className="size-[1.375rem]" />
        </span>
        <Icono nombre="abajo" className="caja-flecha size-4" />
        <span className="caja-titulo">{titulo}</span>
        {resumen && <span className="caja-resumen">{resumen}</span>}
        {abierto && (
          <span aria-hidden="true" className="caja-marca">
            Abierta
          </span>
        )}
      </button>
      <section
        ref={panel}
        id={idPanel}
        aria-labelledby={idEncabezado}
        className={`caja-panel ${abierto ? "caja-panel-abierto" : ""}`}
        inert={!abierto}
      >
        <div>
          <div className="caja-contenido">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id={idEncabezado} className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
                <span aria-hidden="true" className="caja-panel-icono">
                  <Icono nombre={nombreIcono} className="size-4" />
                </span>
                {titulo}
              </h2>
              <button type="button" onClick={() => fijar(false)} className="boton boton-secundario min-h-9 px-3" aria-label={`Cerrar ${titulo}`}>
                <Icono nombre="cerrar" className="size-4" />
                Cerrar
              </button>
            </div>
            {children}
          </div>
        </div>
      </section>
    </>
  );
}
