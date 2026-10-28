import Link from "next/link";
import type { ReactNode } from "react";
import { ETIQUETAS_ESTADO_TRASLADO } from "@/lib/ambulancias/definiciones";
import { ETIQUETAS_ESTADO_ALQUILER } from "@/lib/alquileres/definiciones";
import { ETIQUETAS_ESTADO_TRANSPORTE } from "@/lib/transportes/definiciones";
import type { AccesoRapido, Tono } from "@/lib/accesos";
import { formatearMoneda } from "@/lib/formato";
import {
  ETIQUETAS_SERVICIO_PROXIMO,
  etiquetaMomento,
  type PuntoSerie,
  type ServicioProximo,
  type TipoServicioProximo,
} from "@/lib/panel";
import { InsigniaEstado } from "@/components/operaciones";
import { Icono, type NombreIcono } from "@/components/iconos";
import { Plegable } from "@/components/plegable";

/** Texto para un dato cuya consulta falló: nunca se muestra 0 en su lugar. */
export const NO_DISPONIBLE = "No disponible";


/** Cuadro de icono con el acento del tono (solo decorativo). */
export function IconoTono({ icono, tono, className = "size-11" }: { icono: NombreIcono; tono: Tono; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg ${className}`}
      style={{ background: `var(--acento-${tono}-fondo)`, color: `var(--acento-${tono})` }}
    >
      <Icono nombre={icono} className="size-6" />
    </span>
  );
}

export function TarjetaIndicador({
  etiqueta,
  valor,
  periodo,
  detalle,
  href,
  icono,
  tono,
}: {
  etiqueta: string;
  valor: string;
  periodo: string;
  detalle?: string;
  href: string;
  icono: NombreIcono;
  tono: Tono;
}) {
  return (
    <Link href={href} className="tarjeta tarjeta-enlace flex h-full flex-col gap-2 p-4">
      <span className="flex items-center gap-3">
        <IconoTono icono={icono} tono={tono} className="size-10" />
        <span className="min-w-0 text-sm leading-snug font-medium texto-tenue">{etiqueta}</span>
      </span>
      <span className={`mt-1 font-semibold tracking-tight break-words ${valor === NO_DISPONIBLE ? "text-base" : "text-[1.25rem] leading-tight"}`}>{valor}</span>
      <span className="mt-auto flex flex-col gap-0.5 text-xs">
        {detalle && <span className="text-sm font-medium">{detalle}</span>}
        <span className="texto-tenue">{periodo}</span>
      </span>
    </Link>
  );
}

/**
 * Sección del panel como caja de ícono; su contenido aparece debajo de la fila
 * de cajas. `sinTarjeta` es para contenido que ya viene en tarjetas propias.
 */
export function Seccion({
  id,
  titulo,
  descripcion,
  enlace,
  children,
  sinTarjeta = false,
}: {
  id: string;
  titulo: string;
  descripcion?: string;
  enlace?: { href: string; etiqueta: string };
  children: ReactNode;
  sinTarjeta?: boolean;
}) {
  return (
    <Plegable titulo={titulo} resumen={descripcion} idTitulo={`titulo-${id}`}>
      <div className={sinTarjeta ? "flex flex-col" : "tarjeta flex flex-col overflow-hidden pt-4"}>
        {children}
        {enlace && (
          <Link href={enlace.href} className={`${sinTarjeta ? "mt-3" : "mx-5 mb-4"} w-fit text-sm font-medium text-enlace hover:underline`}>
            {enlace.etiqueta}
          </Link>
        )}
      </div>
    </Plegable>
  );
}

const formatoCompacto = new Intl.NumberFormat("es-HN", { notation: "compact", maximumFractionDigits: 1 });

/** Divide el eje en tres marcas «redondas» (0, mitad y tope). */
function topeRedondo(maximo: number): number {
  if (maximo <= 0) return 0;
  const magnitud = 10 ** Math.floor(Math.log10(maximo));
  const paso = [1, 2, 2.5, 5, 10].find((factor) => factor * magnitud >= maximo)!;
  return paso * magnitud;
}

/**
 * Columnas de una sola serie (sin leyenda: el título la nombra). Cada columna
 * es enfocable y muestra su importe al pasar el puntero o con el teclado.
 */
export function GraficoColumnas({ serie, descripcion }: { serie: readonly PuntoSerie[]; descripcion: string }) {
  const tope = topeRedondo(Math.max(...serie.map((punto) => punto.total)));
  if (tope === 0) {
    return <p className="px-5 pb-6 texto-tenue">Sin cobros confirmados en los últimos 7 días.</p>;
  }
  const marcas = [tope, tope / 2, 0];
  const ultimo = serie.length - 1;
  return (
    <div className="flex flex-1 flex-col px-5 pb-5">
      <div className="mt-5 flex min-h-56 flex-1 gap-3">
        <div aria-hidden="true" className="relative w-14 shrink-0 text-right text-xs tabular-nums texto-tenue">
          {marcas.map((marca, indice) => (
            <span key={marca} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${indice * 50}%` }}>
              L {formatoCompacto.format(marca)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
            {marcas.map((marca) => (
              <span key={marca} className="h-px w-full bg-[var(--borde)]" />
            ))}
          </div>
          <ul aria-label={descripcion} className="absolute inset-0 flex items-end justify-around">
            {serie.map((punto, indice) => (
              <li
                key={punto.fecha}
                tabIndex={0}
                aria-label={`${punto.etiqueta}: ${formatearMoneda(punto.total)}`}
                className="group relative flex h-full max-w-12 flex-1 items-end justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--foco)]"
              >
                <span
                  className="relative block w-full max-w-6 rounded-t"
                  style={{ height: `${(punto.total / tope) * 100}%`, minHeight: punto.total > 0 ? 2 : 0, background: "var(--primario-grafico)" }}
                >
                  {indice === ultimo && punto.total > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 text-xs font-semibold whitespace-nowrap sm:block sm:group-hover:hidden sm:group-focus-visible:hidden"
                    >
                      {formatearMoneda(punto.total)}
                    </span>
                  )}
                </span>
                <span
                  role="presentation"
                  className="sombra-flotante pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-lg border border-borde bg-superficie px-2.5 py-1.5 text-xs whitespace-nowrap group-hover:block group-focus-visible:block"
                >
                  <span className="block texto-tenue">{punto.etiqueta}</span>
                  <span className="block font-semibold tabular-nums">{formatearMoneda(punto.total)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div aria-hidden="true" className="mt-2 ml-[4.25rem] flex justify-around text-xs texto-tenue">
        {serie.map((punto, indice) => (
          <span key={punto.fecha} className={`max-w-12 flex-1 text-center whitespace-nowrap ${indice === ultimo ? "font-semibold text-foreground" : ""}`}>
            {indice === ultimo ? (
              "Hoy"
            ) : (
              <>
                <span className="sm:hidden">{punto.etiqueta.split(" ")[0]}</span>
                <span className="hidden sm:inline">{punto.etiqueta}</span>
              </>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

const ESTADOS_POR_TIPO: Record<TipoServicioProximo, { etiquetas: Record<string, string>; atencion: string[]; tono: Tono }> = {
  traslado: { etiquetas: ETIQUETAS_ESTADO_TRASLADO, atencion: ["solicitado"], tono: "azul" },
  transporte: { etiquetas: ETIQUETAS_ESTADO_TRANSPORTE, atencion: ["solicitado"], tono: "morado" },
  entrega: { etiquetas: ETIQUETAS_ESTADO_ALQUILER, atencion: [], tono: "verde" },
  devolucion: { etiquetas: ETIQUETAS_ESTADO_ALQUILER, atencion: [], tono: "naranja" },
};

/** Próximos servicios como línea de tiempo: hora, servicio, cliente y unidad. */
export function LineaTiempo({
  servicios,
  hoy,
  ahora,
  error,
}: {
  servicios: readonly ServicioProximo[];
  hoy: string;
  ahora: Date;
  error: boolean;
}) {
  if (error) {
    return <p role="alert" className="aviso aviso-error mx-5 mb-5">No se pudieron cargar los servicios. Recargue la página.</p>;
  }
  if (servicios.length === 0) {
    return <p className="px-5 pb-6 texto-tenue">Sin servicios programados.</p>;
  }
  return (
    <ol className="px-3 pb-3">
      {servicios.map((servicio, indice) => {
        const { etiquetas, atencion, tono } = ESTADOS_POR_TIPO[servicio.tipo];
        const devolucionVencida = servicio.tipo === "devolucion" && new Date(servicio.momento) < ahora;
        return (
          <li key={`${servicio.tipo}-${servicio.id}`} className="relative">
            {indice < servicios.length - 1 && (
              <span aria-hidden="true" className="absolute top-7 bottom-[-1rem] left-[calc(5.125rem-1px)] w-0.5 bg-[var(--borde)]" />
            )}
            <Link href={servicio.href} className="fila-enlace flex gap-3 rounded-lg px-2 py-2.5">
              <HoraLinea etiqueta={etiquetaMomento(servicio.momento, hoy)} />
              <span
                aria-hidden="true"
                className="relative z-[1] mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-[var(--superficie)]"
                style={{ background: `var(--acento-${tono})` }}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold">{ETIQUETAS_SERVICIO_PROXIMO[servicio.tipo]}</span>
                  {servicio.codigo && (
                    <span className="shrink-0 rounded-md border border-borde px-1.5 py-0.5 text-[0.625rem] font-medium texto-tenue">
                      {servicio.codigo}
                    </span>
                  )}
                </span>
                <span className="text-xs break-words texto-tenue">
                  {[servicio.cliente, servicio.detalle].filter(Boolean).join(" · ") || "—"}
                </span>
                <span className="flex flex-wrap gap-1">
                  {devolucionVencida && <span className="insignia insignia-advertencia">Devolución vencida</span>}
                  <InsigniaEstado estado={servicio.estado} etiquetas={etiquetas} atencion={atencion} />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function HoraLinea({ etiqueta }: { etiqueta: string }) {
  const corte = etiqueta.lastIndexOf(" ");
  const dia = corte > 0 ? etiqueta.slice(0, corte) : "";
  const hora = corte > 0 ? etiqueta.slice(corte + 1) : etiqueta;
  return (
    <span className="flex w-14 shrink-0 flex-col pt-0.5 text-right leading-tight">
      <span className="text-sm font-semibold tabular-nums">{hora}</span>
      {dia !== "Hoy" && <span className="text-[0.625rem] texto-tenue">{dia}</span>}
      {dia === "Hoy" && <span className="sr-only">Hoy</span>}
    </span>
  );
}

export type ElementoAtencion = { etiqueta: string; valor: string; cantidad: number | null; href: string };

/** Pendientes que piden acción; los que tienen casos se marcan con texto, no solo con color. */
export function ListaAtencion({ elementos }: { elementos: readonly ElementoAtencion[] }) {
  return (
    <ul className="divide-y divide-[var(--borde)] border-t border-borde">
      {elementos.map((elemento) => (
        <li key={elemento.etiqueta}>
          <Link href={elemento.href} className="fila-enlace flex items-center justify-between gap-3 px-5 py-2.5">
            <span className="min-w-0 text-sm">{elemento.etiqueta}</span>
            <span className="flex shrink-0 items-center gap-2">
              {elemento.cantidad !== null && elemento.cantidad > 0 && <span className="insignia insignia-advertencia">Revisar</span>}
              <span className="font-semibold tabular-nums">{elemento.valor}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Tarjeta de módulo: dos cifras reales y acceso al listado. */
export function TarjetaModulo({
  titulo,
  descripcion,
  icono,
  tono,
  cifras,
  href,
  etiquetaEnlace,
}: {
  titulo: string;
  descripcion: string;
  icono: NombreIcono;
  tono: Tono;
  /** `href`: la cifra enlaza al listado ya filtrado. */
  cifras: readonly { etiqueta: string; valor: string; href?: string }[];
  href: string;
  etiquetaEnlace: string;
}) {
  return (
    <div className="tarjeta flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight">{titulo}</h3>
          <p className="text-sm texto-tenue">{descripcion}</p>
        </div>
        <IconoTono icono={icono} tono={tono} className="size-12" />
      </div>
      <dl className="mt-auto grid grid-cols-2 gap-3">
        {cifras.map((cifra, indice) => (
          <div key={cifra.etiqueta} className={indice > 0 ? "border-l border-borde pl-3" : ""}>
            <dd className={`font-semibold tracking-tight ${cifra.valor === NO_DISPONIBLE ? "text-sm" : "text-2xl"}`}>
              {cifra.href ? (
                <Link href={cifra.href} className="rounded-md hover:underline focus-visible:outline-2 focus-visible:outline-[var(--foco)]">
                  {cifra.valor}
                </Link>
              ) : (
                cifra.valor
              )}
            </dd>
            <dt className="text-xs texto-tenue">{cifra.etiqueta}</dt>
          </div>
        ))}
      </dl>
      <Link
        href={href}
        className="inline-flex w-fit items-center gap-2 rounded-md text-sm font-semibold text-enlace hover:underline focus-visible:outline-2 focus-visible:outline-[var(--foco)]"
      >
        {etiquetaEnlace}
        <Icono nombre="flecha" className="size-4" />
      </Link>
    </div>
  );
}


export function AccesosRapidos({ accesos }: { accesos: readonly AccesoRapido[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 px-5 pb-5">
      {accesos.map((acceso) => (
        <li key={acceso.href}>
          <Link
            href={acceso.href}
            className="boton boton-secundario flex h-full flex-col gap-2 px-2 py-4 text-center whitespace-normal"
          >
            <span
              className="flex size-10 items-center justify-center rounded-full"
              style={{ background: `var(--acento-${acceso.tono}-fondo)`, color: `var(--acento-${acceso.tono})` }}
            >
              <Icono nombre={acceso.icono} />
            </span>
            {acceso.etiqueta}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Bloque({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded-xl bg-neutro ${className}`} />;
}

export function EsqueletoPanel() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-5">
      <span className="sr-only">Cargando…</span>
      <div className="flex flex-col gap-2">
        <Bloque className="h-9 w-64" />
        <Bloque className="h-5 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <Bloque key={n} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <Bloque key={n} className="h-16" />
        ))}
      </div>
    </div>
  );
}
