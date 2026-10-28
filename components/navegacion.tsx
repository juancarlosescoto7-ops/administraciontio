"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cerrarSesion } from "@/app/login/acciones";
import type { AccesoRapido } from "@/lib/accesos";
import { Icono, type NombreIcono } from "@/components/iconos";
import { MarcaIcono } from "@/components/marca";
import { PaletaComandos } from "@/components/paleta";

export type GrupoNavegacion = {
  /** Sin título: enlace suelto de primer nivel (Inicio). */
  titulo: string | null;
  icono: NombreIcono;
  enlaces: { href: string; etiqueta: string }[];
};

// Menú contraído a iconos en escritorio. El atributo lo fija antes de pintar
// un script del layout raíz (a partir de localStorage); aquí solo se lee y cambia.
const EVENTO_MENU = "erp-menu";

function suscribirMenu(alCambiar: () => void) {
  window.addEventListener(EVENTO_MENU, alCambiar);
  return () => window.removeEventListener(EVENTO_MENU, alCambiar);
}

function leerMenuCompacto() {
  return document.documentElement.dataset.menu === "compacto";
}

function fijarMenuCompacto(compacto: boolean) {
  if (compacto) document.documentElement.dataset.menu = "compacto";
  else delete document.documentElement.dataset.menu;
  try {
    localStorage.setItem("erp-menu", compacto ? "compacto" : "amplio");
  } catch {
    // Sin almacenamiento (modo privado): la preferencia dura hasta recargar.
  }
  window.dispatchEvent(new Event(EVENTO_MENU));
}

function esEscritorio() {
  return window.matchMedia("(width >= 80rem)").matches;
}

function estaActivo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Barra lateral y barra superior. En escritorio (≥1280 px) la barra lateral
 * está siempre visible; por debajo se despliega con el botón «Menú».
 */
export function Navegacion({
  grupos,
  acciones,
  nombreUsuario,
  rolUsuario,
  correoUsuario,
}: {
  grupos: GrupoNavegacion[];
  acciones: AccesoRapido[];
  nombreUsuario: string;
  rolUsuario: string;
  correoUsuario: string | null;
}) {
  const pathname = usePathname();
  // El menú se abre para la ruta actual: al navegar queda cerrado sin efectos.
  const [rutaConMenu, setRutaConMenu] = useState<string | null>(null);
  const abierto = rutaConMenu === pathname;
  const botonMenu = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  const compacto = useSyncExternalStore(suscribirMenu, leerMenuCompacto, () => false);

  useEffect(() => {
    if (!abierto) return;
    menu.current?.querySelector<HTMLElement>("a")?.focus();
    function alPulsar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      setRutaConMenu(null);
      botonMenu.current?.focus();
    }
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [abierto]);

  const cerrar = () => setRutaConMenu(null);
  const actual = grupos
    .flatMap((grupo) => grupo.enlaces.map((enlace) => ({ grupo: grupo.titulo, ...enlace })))
    .find((enlace) => estaActivo(pathname, enlace.href));

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 vidrio-barra border-b px-4 sm:px-6 lg:px-8">
        <button
          ref={botonMenu}
          type="button"
          className="boton boton-secundario xl:hidden"
          aria-expanded={abierto}
          aria-controls="menu-principal"
          onClick={() => setRutaConMenu(abierto ? null : pathname)}
        >
          <Icono nombre={abierto ? "cerrar" : "menu"} />
          Menú
        </button>
        <p className="min-w-0 flex-1 truncate text-sm">
          {actual?.grupo && <span className="texto-tenue">{actual.grupo} / </span>}
          <span className="font-semibold">{actual?.etiqueta ?? "ERP interno"}</span>
        </p>
        <PaletaComandos grupos={grupos} acciones={acciones} />
        <MenuUsuario nombre={nombreUsuario} rol={rolUsuario} correo={correoUsuario} />
      </header>

      {abierto && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-20 bg-black/30 xl:hidden" aria-hidden="true" onClick={cerrar} />
      )}

      <aside
        ref={menu}
        id="menu-principal"
        className={`${abierto ? "flex" : "hidden"} menu-lateral fixed top-16 bottom-0 left-0 z-30 w-full flex-col overflow-x-hidden overflow-y-auto vidrio-barra border-r [scrollbar-width:thin] md:w-72 xl:top-0 xl:flex xl:w-[var(--ancho-menu)]`}
      >
        <Link
          href="/"
          className="enlace-marca hidden h-[4.5rem] shrink-0 items-center gap-3 px-5 xl:flex"
          onClick={cerrar}
        >
          <MarcaIcono className="size-10" />
          <span className="solo-amplio flex flex-col leading-tight">
            <span className="text-[0.875rem] font-bold tracking-tight">ERP interno</span>
            <span className="text-xs texto-tenue">Gestión de servicios</span>
          </span>
        </Link>

        <nav aria-label="Principal" className="flex flex-col gap-3 px-3 pt-2 pb-6">
          {grupos.map((grupo) =>
            grupo.titulo === null ? (
              <div key="inicio" className="flex flex-col gap-1">
                {grupo.enlaces.map((enlace) => (
                  <EnlaceNav key={enlace.href} {...enlace} icono={grupo.icono} pathname={pathname} alPulsar={cerrar} compacto={compacto} />
                ))}
              </div>
            ) : (
              <GrupoNav key={grupo.titulo} grupo={grupo} pathname={pathname} alPulsar={cerrar} compacto={compacto} />
            ),
          )}
        </nav>

        <div className="mt-auto hidden border-t border-borde p-3 xl:block">
          <button
            type="button"
            className="encabezado-grupo font-medium texto-tenue"
            aria-label={compacto ? "Expandir menú" : "Contraer menú"}
            title={compacto ? "Expandir menú" : "Contraer menú"}
            onClick={() => fijarMenuCompacto(!compacto)}
          >
            <Icono nombre={compacto ? "expandir" : "contraer"} />
            <span className="solo-amplio">Contraer menú</span>
          </button>
        </div>
      </aside>
    </>
  );
}

/** Grupo plegable (abierto por omisión); los enlaces siguen en el DOM al plegarlo. */
function GrupoNav({
  grupo,
  pathname,
  alPulsar,
  compacto,
}: {
  grupo: GrupoNavegacion;
  pathname: string;
  alPulsar: () => void;
  compacto: boolean;
}) {
  const [abierto, setAbierto] = useState(true);
  const id = `grupo-${grupo.icono}`;
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        id={id}
        className="encabezado-grupo"
        aria-expanded={abierto}
        aria-controls={`${id}-enlaces`}
        title={compacto ? (grupo.titulo ?? undefined) : undefined}
        onClick={() => {
          // Contraído en escritorio: el icono del grupo vuelve a mostrar el menú completo.
          if (compacto && esEscritorio()) {
            fijarMenuCompacto(false);
            setAbierto(true);
          } else {
            setAbierto((valor) => !valor);
          }
        }}
      >
        <Icono nombre={grupo.icono} />
        <span className="solo-amplio flex-1 text-left">{grupo.titulo}</span>
        <Icono nombre="abajo" className={`solo-amplio size-4 texto-tenue transition-transform ${abierto ? "" : "-rotate-90"}`} />
      </button>
      <div id={`${id}-enlaces`} role="group" aria-labelledby={id} className={`enlaces-grupo ${abierto ? "flex" : "hidden"} flex-col gap-0.5`}>
        {grupo.enlaces.map((enlace) => (
          <EnlaceNav key={enlace.href} {...enlace} pathname={pathname} alPulsar={alPulsar} />
        ))}
      </div>
    </div>
  );
}

function EnlaceNav({
  href,
  etiqueta,
  icono,
  pathname,
  alPulsar,
  compacto = false,
}: {
  href: string;
  etiqueta: string;
  icono?: NombreIcono;
  pathname: string;
  alPulsar: () => void;
  compacto?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`enlace-nav ${icono ? "font-semibold" : "pl-11"}`}
      aria-current={estaActivo(pathname, href) ? "page" : undefined}
      title={compacto ? etiqueta : undefined}
      onClick={alPulsar}
    >
      {icono && <Icono nombre={icono} />}
      {icono ? <span className="solo-amplio">{etiqueta}</span> : etiqueta}
    </Link>
  );
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase() || "?";
}

function MenuUsuario({ nombre, rol, correo }: { nombre: string; rol: string; correo: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function alPulsarFuera(evento: PointerEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    }
    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      setAbierto(false);
      boton.current?.focus();
    }
    document.addEventListener("pointerdown", alPulsarFuera);
    document.addEventListener("keydown", alPulsarTecla);
    return () => {
      document.removeEventListener("pointerdown", alPulsarFuera);
      document.removeEventListener("keydown", alPulsarTecla);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative shrink-0">
      <button
        ref={boton}
        type="button"
        className="boton-usuario"
        aria-expanded={abierto}
        aria-controls="menu-usuario"
        aria-label={`Cuenta de ${nombre} (${rol})`}
        onClick={() => setAbierto((valor) => !valor)}
      >
        <span className="flex size-9 items-center justify-center rounded-full distintivo text-sm font-semibold">
          {iniciales(nombre)}
        </span>
        <span className="hidden max-w-48 flex-col items-start text-left leading-tight sm:flex">
          <span className="w-full truncate text-sm font-medium">{nombre}</span>
          <span className="text-xs texto-tenue">{rol}</span>
        </span>
        <Icono nombre="abajo" className="size-4 texto-tenue" />
      </button>

      <div
        id="menu-usuario"
        className={`${abierto ? "flex" : "hidden"} tarjeta sombra-flotante absolute right-0 mt-2 w-64 flex-col gap-3 p-4`}
      >
        <p className="text-sm">
          <span className="block font-medium break-words">{nombre}</span>
          {correo && <span className="block break-all texto-tenue">{correo}</span>}
          <span className="mt-1 block texto-tenue">Perfil: {rol}</span>
        </p>
        <form action={cerrarSesion}>
          <button type="submit" className="boton boton-secundario w-full">
            <Icono nombre="salir" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
