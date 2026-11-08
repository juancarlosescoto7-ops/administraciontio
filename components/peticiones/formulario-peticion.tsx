"use client";

import { useActionState, useEffect, useRef } from "react";
import { registrarPeticion } from "@/lib/peticiones/acciones";
import { MAXIMO_DESCRIPCION } from "@/lib/peticiones/definiciones";
import { useHidratado } from "@/components/use-hidratado";

/** Registro de una petición de cambio; nace como pendiente. */
export function FormularioPeticion() {
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, despachar, pendiente] = useActionState(registrarPeticion, { revision: 0, error: null, mensaje: null });
  const hidratado = useHidratado();

  useEffect(() => {
    if (estado.mensaje) formulario.current?.reset();
  }, [estado]);

  return (
    <form ref={formulario} action={despachar} className="tarjeta mb-6 flex flex-col gap-3 p-4">
      <div className="campo">
        <label htmlFor="peticion-descripcion" className="campo-etiqueta">
          ¿Qué necesita? <span aria-hidden="true">*</span>
        </label>
        <textarea
          id="peticion-descripcion"
          name="descripcion"
          className="entrada"
          rows={3}
          maxLength={MAXIMO_DESCRIPCION}
          required
          aria-invalid={estado.error ? true : undefined}
        />
      </div>
      {estado.error && (
        <p role="alert" className="aviso aviso-error text-sm">
          {estado.error}
        </p>
      )}
      {estado.mensaje && (
        <p role="status" className="aviso aviso-exito text-sm">
          {estado.mensaje}
        </p>
      )}
      <div className="flex justify-end">
        <button type="submit" className="boton boton-primario" disabled={pendiente || !hidratado}>
          {pendiente ? "Registrando…" : "Registrar petición"}
        </button>
      </div>
    </form>
  );
}
