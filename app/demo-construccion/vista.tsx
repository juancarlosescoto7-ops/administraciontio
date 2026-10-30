"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { GrupoNavegacion } from "@/components/navegacion";
import { Icono } from "@/components/iconos";
import { MarcaIcono } from "@/components/marca";
import { CajasProvider } from "@/components/plegable";
import { ETAPAS, type Aspecto, type Vista } from "./guion";

export const RUTA_VISTA: Record<Vista, string> = {
  vacio: "/",
  clientes: "/clientes",
  cobros: "/finanzas/cobros",
  membresias: "/membresias",
  ambulancias: "/ambulancias",
  alquileres: "/alquileres",
  inicio: "/",
  cobro: "/finanzas/cobros",
};

/** Etapa en que cada enlace real del menú apareció en el sistema. */
const ETAPA_ENLACE: Record<string, string> = {
  "/": "e1",
  "/clientes": "e1",
  "/beneficiarios": "e1",
  "/vehiculos": "e1",
  "/conductores": "e1",
  "/proveedores": "e1",
  "/planes": "e1",
  "/tarifas": "e1",
  "/configuracion/usuarios": "e1",
  "/finanzas/cobros": "e2",
  "/finanzas/cargos": "e2",
  "/finanzas/pendientes": "e2",
  "/finanzas/cuentas": "e2",
  "/membresias": "e3",
  "/ambulancias": "e4",
  "/alquileres": "e5",
  "/transportes": "e5",
  "/finanzas/gastos": "e6",
  "/reportes": "e6",
  "/configuracion/contrato": "contrato",
};
const indiceEtapa = (id: string) => ETAPAS.findIndex((etapa) => etapa.id === id);

// Bloques que aparecen, en orden de documento, mientras se teclea el archivo de la etapa.
const NUEVO = ".sistema-nuevo";
const PANTALLA = `${NUEVO}, main .cajas > .cajas > *, main .grupo-titulo, main .cajas .cajas > .caja, main li, main thead, main tbody tr`;
// Títulos que se escriben letra a letra al construir la pantalla.
const TITULOS = "main h1:not(.sr-only), main .buscador-inicio h2";

/**
 * El ERP como se ve en la etapa indicada: marco de components/navegacion.tsx y
 * del layout privado, con el menú desplegado y la pantalla armada en el servidor.
 * `progreso` (0–1) muestra sus bloques en orden, como si aparecieran al guardar
 * el código; sin `reconstruir`, solo aparecen los enlaces nuevos del menú.
 * `escrito` (0–1) teclea los títulos y `prueba` aplica un intento de diseño
 * (demo.css) antes de asentarse en el estilo real.
 */
export function SistemaReal({
  grupos,
  etapa,
  vista,
  contenido,
  progreso = 1,
  reconstruir = false,
  escrito = 1,
  prueba = null,
}: {
  grupos: GrupoNavegacion[];
  etapa: number;
  vista: Vista;
  contenido: ReactNode;
  progreso?: number;
  reconstruir?: boolean;
  escrito?: number;
  prueba?: { aspecto: Aspecto; paso: number } | null;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const ruta = RUTA_VISTA[vista];
  const nuevo = (href: string) => indiceEtapa(ETAPA_ENLACE[href]) === etapa;

  // Sin dependencias: se recalcula en cada cuadro, porque los bloques cambian con la pantalla y el progreso.
  useLayoutEffect(() => {
    const elemento = raiz.current;
    if (!elemento) return;
    const bloques = [...elemento.querySelectorAll<HTMLElement>(reconstruir ? PANTALLA : NUEVO)];
    const visibles = Math.round(progreso * bloques.length);
    elemento.querySelectorAll<HTMLElement>("[data-construido]").forEach((bloque) => (bloque.dataset.construido = "si"));
    bloques.forEach((bloque, i) => (bloque.dataset.construido = i < visibles ? "si" : "no"));
    elemento.querySelectorAll<HTMLElement>(TITULOS).forEach((titulo) => {
      if (!reconstruir || escrito >= 1) {
        delete titulo.dataset.escribiendo;
        return;
      }
      // Avanza por letras enteras, como al teclear.
      const letras = titulo.textContent?.length ?? 1;
      titulo.dataset.escribiendo = "";
      titulo.style.setProperty("--escrito", String(Math.round(escrito * letras) / letras));
    });
  });
  const menu = grupos
    .map((grupo) => ({ ...grupo, enlaces: grupo.enlaces.filter((enlace) => enlace.href in ETAPA_ENLACE && indiceEtapa(ETAPA_ENLACE[enlace.href]) <= etapa) }))
    .filter((grupo) => grupo.enlaces.length > 0);
  const actual = menu.flatMap((grupo) => grupo.enlaces.map((enlace) => ({ grupo: grupo.titulo, ...enlace }))).find((enlace) => enlace.href === ruta);

  return (
    <div
      ref={raiz}
      className="sistema-real flex min-h-full flex-col bg-background xl:pl-[var(--ancho-menu)]"
      style={{ "--ancho-menu": "16.5rem" } as CSSProperties}
      data-prueba={prueba && prueba.paso < 2 ? `${prueba.aspecto}-${prueba.paso}` : undefined}
    >
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 vidrio-barra border-b px-4 sm:px-6 lg:px-8 xl:hidden">
        <span className="boton boton-secundario">
          <Icono nombre="menu" />
          Menú
        </span>
        <p className="min-w-0 flex-1 truncate text-sm">
          {actual?.grupo && <span className="texto-tenue">{actual.grupo} / </span>}
          <span className="font-semibold">{actual?.etiqueta ?? "ERP interno"}</span>
        </p>
      </header>
      <aside className="fixed top-0 bottom-0 left-0 z-40 hidden w-[var(--ancho-menu)] flex-col overflow-hidden vidrio-barra border-r xl:flex">
        <span className={`enlace-marca flex h-[4.5rem] shrink-0 items-center gap-3 px-5 ${etapa === 0 ? "sistema-nuevo" : ""}`}>
          <MarcaIcono className="size-10" />
          <span className="flex flex-col leading-tight">
            <span className="text-[0.875rem] font-bold tracking-tight">ERP interno</span>
            <span className="text-xs texto-tenue">Gestión de servicios</span>
          </span>
        </span>
        <nav aria-label="Menú simulado" className="flex flex-col gap-3 px-3 pt-2 pb-6">
          {menu.map((grupo) =>
            grupo.titulo === null ? (
              <div key="inicio" className="flex flex-col gap-1">
                {grupo.enlaces.map((enlace) => (
                  <a key={enlace.href} className={`enlace-nav font-semibold ${nuevo(enlace.href) ? "sistema-nuevo" : ""}`} aria-current={enlace.href === ruta && vista !== "vacio" ? "page" : undefined}>
                    <Icono nombre={grupo.icono} />
                    <span>{enlace.etiqueta}</span>
                  </a>
                ))}
              </div>
            ) : (
              <div key={grupo.titulo} className="flex flex-col gap-0.5">
                <span className={`encabezado-grupo ${grupo.enlaces.every((enlace) => nuevo(enlace.href)) ? "sistema-nuevo" : ""}`}>
                  <Icono nombre={grupo.icono} />
                  <span className="flex-1 text-left">{grupo.titulo}</span>
                  <Icono nombre="abajo" className="size-4 texto-tenue" />
                </span>
                <div className="enlaces-grupo flex flex-col gap-0.5">
                  {grupo.enlaces.map((enlace) => (
                    <a key={enlace.href} className={`enlace-nav pl-11 ${nuevo(enlace.href) ? "sistema-nuevo" : ""}`} aria-current={enlace.href === ruta ? "page" : undefined}>
                      {enlace.etiqueta}
                    </a>
                  ))}
                </div>
              </div>
            ),
          )}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 xl:py-8">
        <div className="cajas mx-auto w-full max-w-[1440px]">
          <CajasProvider key={vista}>
            <div className="cajas" key={vista}>
              {contenido}
            </div>
          </CajasProvider>
        </div>
      </main>
    </div>
  );
}
