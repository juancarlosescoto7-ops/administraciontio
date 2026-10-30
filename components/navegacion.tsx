"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
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

// Menú lateral en escritorio: queda en íconos (data-menu-auto="oculto") en
// cuanto el puntero sale de él, o unos segundos después de cargar si no se
// toca; al pasar el puntero o el foco de teclado se despliega flotando sobre el
// contenido ("flotante"). «Mantener abierto» lo fija (data-menu="fijo"). El
// layout raíz aplica la preferencia antes de pintar.
const EVENTO_MENU = "erp-menu";
const OCULTAR_AL_CARGAR_MS = 4000;
// Margen breve para no parpadear si el puntero solo roza el borde.
const OCULTAR_AL_SALIR_MS = 200;

function suscribirMenu(alCambiar: () => void) {
  window.addEventListener(EVENTO_MENU, alCambiar);
  return () => window.removeEventListener(EVENTO_MENU, alCambiar);
}

function leerMenuFijo() {
  return document.documentElement.dataset.menu === "fijo";
}

function fijarMenu(fijo: boolean) {
  const raiz = document.documentElement;
  if (fijo) {
    raiz.dataset.menu = "fijo";
    delete raiz.dataset.menuAuto;
  } else {
    delete raiz.dataset.menu;
    raiz.dataset.menuAuto = "flotante";
  }
  try {
    localStorage.setItem("erp-menu", fijo ? "fijo" : "auto");
  } catch {
    // Sin almacenamiento (modo privado): la preferencia dura hasta recargar.
  }
  window.dispatchEvent(new Event(EVENTO_MENU));
}

function desplegarMenu(desplegado: boolean) {
  if (leerMenuFijo()) return;
  document.documentElement.dataset.menuAuto = desplegado ? "flotante" : "oculto";
}

function estaActivo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Barra lateral con marca, buscador, menú y cuenta del usuario. En escritorio
 * (≥1280 px) está siempre visible y no hay barra superior; por debajo, una
 * barra mínima con el botón «Menú» la despliega.
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
  const fijo = useSyncExternalStore(suscribirMenu, leerMenuFijo, () => false);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Oculta el menú salvo que siga en uso: puntero encima, foco de teclado
  // dentro (el foco que deja un clic no cuenta) o la cuenta del usuario
  // abierta (su panel está fuera del menú).
  const programarOcultar = useCallback((espera: number) => {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(function intentar() {
      const lateral = menu.current;
      if (lateral?.matches(":hover") || lateral?.querySelector(":focus-visible") || document.getElementById("menu-usuario")) {
        temporizador.current = setTimeout(intentar, OCULTAR_AL_SALIR_MS);
        return;
      }
      desplegarMenu(false);
    }, espera);
  }, []);

  useEffect(() => {
    if (fijo) return;
    programarOcultar(OCULTAR_AL_CARGAR_MS);
    return () => clearTimeout(temporizador.current);
  }, [fijo, programarOcultar]);

  const alEntrar = () => {
    if (fijo) return;
    clearTimeout(temporizador.current);
    desplegarMenu(true);
  };
  const alSalir = () => {
    if (!fijo) programarOcultar(OCULTAR_AL_SALIR_MS);
  };

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
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 vidrio-barra border-b px-4 sm:px-6 lg:px-8 xl:hidden">
        <button
          ref={botonMenu}
          type="button"
          className="boton boton-secundario"
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
      </header>

      {abierto && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-20 bg-black/30 xl:hidden" aria-hidden="true" onClick={cerrar} />
      )}

      <aside
        ref={menu}
        id="menu-principal"
        className={`${abierto ? "flex" : "hidden"} menu-lateral fixed top-16 bottom-0 left-0 z-30 w-full flex-col overflow-x-hidden overflow-y-auto vidrio-barra border-r [scrollbar-width:thin] md:w-72 xl:top-0 xl:z-40 xl:flex xl:w-[var(--ancho-menu)]`}
        onPointerEnter={alEntrar}
        onPointerLeave={alSalir}
        onFocus={alEntrar}
        onBlur={(evento) => {
          if (!evento.currentTarget.contains(evento.relatedTarget)) alSalir();
        }}
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

        {/* En el inicio ya está el buscador general: aquí solo queda Ctrl+K. */}
        <div className={pathname === "/" ? "contents" : "px-3 pt-3 pb-1 xl:pt-0"}>
          <PaletaComandos grupos={grupos} acciones={acciones} conDisparador={pathname !== "/"} />
        </div>

        <nav aria-label="Principal" className="flex flex-col gap-3 px-3 pt-2 pb-6">
          {grupos.map((grupo) =>
            grupo.titulo === null ? (
              <div key="inicio" className="flex flex-col gap-1">
                {grupo.enlaces.map((enlace) => (
                  <EnlaceNav key={enlace.href} {...enlace} icono={grupo.icono} pathname={pathname} alPulsar={cerrar} />
                ))}
              </div>
            ) : (
              <GrupoNav key={grupo.titulo} grupo={grupo} pathname={pathname} alPulsar={cerrar} />
            ),
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-borde p-3">
          <MenuUsuario nombre={nombreUsuario} rol={rolUsuario} correo={correoUsuario} />
          <button
            type="button"
            className="encabezado-grupo hidden font-medium texto-tenue xl:flex"
            aria-pressed={fijo}
            title={fijo ? "El menú queda siempre abierto" : "El menú se oculta solo tras unos segundos sin usarlo"}
            onClick={() => fijarMenu(!fijo)}
          >
            <Icono nombre={fijo ? "candado" : "contraer"} />
            <span className="solo-amplio">Mantener abierto</span>
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
}: {
  grupo: GrupoNavegacion;
  pathname: string;
  alPulsar: () => void;
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
        onClick={() => setAbierto((valor) => !valor)}
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
}: {
  href: string;
  etiqueta: string;
  icono?: NombreIcono;
  pathname: string;
  alPulsar: () => void;
}) {
  return (
    <Link
      href={href}
      className={`enlace-nav ${icono ? "font-semibold" : "pl-11"}`}
      aria-current={estaActivo(pathname, href) ? "page" : undefined}
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

/**
 * Cuenta del usuario al pie del menú lateral. El panel se abre hacia arriba en
 * un portal con posición fija: la barra lateral recorta su contenido (scroll y
 * backdrop-filter) y, contraída, es más angosta que el panel.
 */
function MenuUsuario({ nombre, rol, correo }: { nombre: string; rol: string; correo: string | null }) {
  const [posicion, setPosicion] = useState<{ izquierda: number; abajo: number } | null>(null);
  const abierto = posicion !== null;
  const panel = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  function alternar() {
    const caja = boton.current?.getBoundingClientRect();
    setPosicion(abierto || !caja ? null : { izquierda: caja.left, abajo: window.innerHeight - caja.top + 8 });
  }

  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setPosicion(null);
    function alPulsarFuera(evento: PointerEvent) {
      const objetivo = evento.target as Node;
      if (!panel.current?.contains(objetivo) && !boton.current?.contains(objetivo)) cerrar();
    }
    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      cerrar();
      boton.current?.focus();
    }
    document.addEventListener("pointerdown", alPulsarFuera);
    document.addEventListener("keydown", alPulsarTecla);
    window.addEventListener("resize", cerrar);
    return () => {
      document.removeEventListener("pointerdown", alPulsarFuera);
      document.removeEventListener("keydown", alPulsarTecla);
      window.removeEventListener("resize", cerrar);
    };
  }, [abierto]);

  return (
    <>
      <button
        ref={boton}
        type="button"
        className="boton-usuario"
        aria-expanded={abierto}
        aria-controls="menu-usuario"
        aria-label={`Cuenta de ${nombre} (${rol})`}
        title={nombre}
        onClick={alternar}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full distintivo text-sm font-semibold">
          {iniciales(nombre)}
        </span>
        <span className="solo-amplio flex min-w-0 flex-1 flex-col items-start text-left leading-tight">
          <span className="w-full truncate text-sm font-medium">{nombre}</span>
          <span className="text-xs texto-tenue">{rol}</span>
        </span>
        <Icono nombre="abajo" className={`solo-amplio size-4 shrink-0 texto-tenue transition-transform ${abierto ? "" : "rotate-180"}`} />
      </button>

      {posicion &&
        createPortal(
          <div
            ref={panel}
            id="menu-usuario"
            className="tarjeta sombra-flotante fixed z-50 flex w-64 flex-col gap-3 p-4"
            style={{ left: posicion.izquierda, bottom: posicion.abajo }}
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
          </div>,
          document.body,
        )}
    </>
  );
}
