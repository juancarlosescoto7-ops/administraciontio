"use client";

import { Icono } from "@/components/iconos";

export default function ErrorPrivado({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="tarjeta flex flex-col items-start gap-3 p-6 sm:p-8">
      <span className="flex size-11 items-center justify-center rounded-full bg-[var(--error-fondo)] text-[var(--error-texto)]">
        <Icono nombre="alerta" className="size-6" />
      </span>
      <h1 className="text-xl font-semibold">No se pudo cargar esta página</h1>
      <p className="texto-tenue">
        Ocurrió un error al consultar los datos. Intente de nuevo; si el problema continúa, informe
        al administrador.
      </p>
      <button type="button" className="boton boton-secundario" onClick={reset}>
        Reintentar
      </button>
    </div>
  );
}
