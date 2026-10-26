import Link from "next/link";
import type { ReactNode } from "react";

export function Encabezado({
  titulo,
  descripcion,
  volver,
  acciones,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  volver?: { href: string; etiqueta: string };
  acciones?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        {volver && (
          <Link href={volver.href} className="text-sm texto-tenue hover:underline">
            ← {volver.etiqueta}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight break-words">{titulo}</h1>
        {descripcion && <p className="texto-tenue">{descripcion}</p>}
      </div>
      {acciones && <div className="flex shrink-0 gap-2">{acciones}</div>}
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

export function Cargando() {
  return (
    <p className="texto-tenue" role="status">
      Cargando…
    </p>
  );
}

export function SinPermiso({ mensaje }: { mensaje: string }) {
  return (
    <p role="alert" className="aviso aviso-advertencia">
      {mensaje}
    </p>
  );
}
