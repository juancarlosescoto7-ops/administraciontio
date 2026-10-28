import Link from "next/link";
import type { ReactNode } from "react";
import { Icono } from "@/components/iconos";

/** Encabezado de página: título, descripción breve y una acción principal. */
export function Encabezado({
  titulo,
  descripcion,
  volver,
  acciones,
  className = "mb-6",
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  volver?: { href: string; etiqueta: string };
  acciones?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`${className} flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between`}>
      <div className="flex min-w-0 flex-col gap-1">
        {volver && (
          <Link
            href={volver.href}
            className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium texto-tenue hover:text-enlace"
          >
            <Icono nombre="atras" className="size-4" />
            {volver.etiqueta}
          </Link>
        )}
        <h1 className="text-xl font-semibold tracking-[-0.02em] break-words sm:text-[1.375rem] sm:leading-tight">{titulo}</h1>
        {descripcion && <p className="texto-tenue">{descripcion}</p>}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}

export function InsigniaEstado({ activo }: { activo: boolean }) {
  return (
    <span className={`insignia ${activo ? "insignia-activo" : "insignia-inactivo"}`}>
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}

/** Esqueleto de carga; el texto «Cargando…» queda para lectores de pantalla. */
export function Cargando() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Cargando…</span>
      <span className="block h-12 animate-pulse rounded-xl bg-neutro" />
      <span className="block h-40 animate-pulse rounded-xl bg-neutro" />
      <span className="block h-24 animate-pulse rounded-xl bg-neutro" />
    </div>
  );
}

/** Sin permiso para el rol: el servidor ya rechazó; aquí solo se explica. */
export function SinPermiso({ mensaje }: { mensaje: string }) {
  return (
    <div role="alert" className="aviso aviso-advertencia flex items-start gap-3">
      <Icono nombre="candado" className="mt-0.5 size-5" />
      <p>{mensaje}</p>
    </div>
  );
}

/** Lista o sección sin registros: qué pasa y, si existe, la siguiente acción. */
export function EstadoVacio({ mensaje, accion }: { mensaje: ReactNode; accion?: ReactNode }) {
  return (
    <div className="tarjeta flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-neutro texto-tenue">
        <Icono nombre="vacio" className="size-5" />
      </span>
      <p className="max-w-md texto-tenue">{mensaje}</p>
      {accion}
    </div>
  );
}
