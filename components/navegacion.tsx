"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cerrarSesion } from "@/app/login/acciones";

export type GrupoNavegacion = {
  titulo: string | null;
  enlaces: { href: string; etiqueta: string }[];
};

function estaActivo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navegacion({
  grupos,
  nombreUsuario,
  rolUsuario,
}: {
  grupos: GrupoNavegacion[];
  nombreUsuario: string;
  rolUsuario: string;
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  return (
    <aside className="border-b border-borde bg-superficie md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-semibold" onClick={() => setAbierto(false)}>
          ERP interno
        </Link>
        <button
          type="button"
          className="boton boton-secundario md:hidden"
          aria-expanded={abierto}
          aria-controls="menu-principal"
          onClick={() => setAbierto((valor) => !valor)}
        >
          {abierto ? "Cerrar" : "Menú"}
        </button>
      </div>

      <div
        id="menu-principal"
        className={`${abierto ? "flex" : "hidden"} flex-col gap-4 px-3 pb-4 md:flex md:flex-1 md:overflow-y-auto`}
      >
        <nav aria-label="Principal" className="flex flex-col gap-4">
          {grupos.map((grupo) => (
            <div key={grupo.titulo ?? "inicio"} className="flex flex-col gap-1">
              {grupo.titulo && (
                <p className="px-3 text-xs font-semibold uppercase tracking-wide texto-tenue">
                  {grupo.titulo}
                </p>
              )}
              {grupo.enlaces.map((enlace) => (
                <Link
                  key={enlace.href}
                  href={enlace.href}
                  className="enlace-nav"
                  aria-current={estaActivo(pathname, enlace.href) ? "page" : undefined}
                  onClick={() => setAbierto(false)}
                >
                  {enlace.etiqueta}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-borde px-3 pt-4">
          <p className="text-sm">
            <span className="block font-medium">{nombreUsuario}</span>
            <span className="texto-tenue">{rolUsuario}</span>
          </p>
          <form action={cerrarSesion}>
            <button type="submit" className="boton boton-secundario w-full">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
