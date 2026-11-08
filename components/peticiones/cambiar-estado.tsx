"use client";

import { useActionState } from "react";
import { cambiarEstadoPeticion } from "@/lib/peticiones/acciones";
import { ESTADOS_PETICION, ETIQUETAS_ESTADO_PETICION, type EstadoPeticion } from "@/lib/peticiones/definiciones";
import { useHidratado } from "@/components/use-hidratado";

/** Selector de estado de una petición: se guarda al elegir otra opción. */
export function CambiarEstadoPeticion({ id, actual }: { id: string; actual: EstadoPeticion }) {
  const [estado, despachar, pendiente] = useActionState(cambiarEstadoPeticion.bind(null, id), {
    revision: 0,
    error: null,
    mensaje: null,
  });
  const hidratado = useHidratado();

  return (
    <form action={despachar} className="flex flex-col items-start gap-1 sm:items-end">
      <label className="sr-only" htmlFor={`estado-${id}`}>
        Estado de la petición
      </label>
      <select
        // Tras un error, vuelve a mostrar el estado guardado.
        key={estado.revision}
        id={`estado-${id}`}
        name="estado"
        className="entrada min-h-9 w-40 py-1 text-sm"
        defaultValue={actual}
        disabled={pendiente || !hidratado}
        onChange={(evento) => evento.currentTarget.form?.requestSubmit()}
      >
        {ESTADOS_PETICION.map((opcion) => (
          <option key={opcion} value={opcion}>
            {ETIQUETAS_ESTADO_PETICION[opcion]}
          </option>
        ))}
      </select>
      {estado.error && (
        <p role="alert" className="campo-error">
          {estado.error}
        </p>
      )}
    </form>
  );
}
