"use client";

import { useActionState } from "react";
import { useHidratado } from "@/components/use-hidratado";
import { iniciarSesion, type EstadoLogin } from "./acciones";

const ESTADO_INICIAL: EstadoLogin = { error: null, correo: "" };

export function FormularioLogin({ siguiente }: { siguiente: string }) {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, ESTADO_INICIAL);
  const hidratado = useHidratado();

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="siguiente" value={siguiente} />
      <label className="campo">
        <span className="campo-etiqueta">Correo electrónico</span>
        <input
          className="entrada"
          type="email"
          name="correo"
          autoComplete="username"
          required
          defaultValue={estado.correo}
          key={estado.correo}
        />
      </label>
      <label className="campo">
        <span className="campo-etiqueta">Contraseña</span>
        <input
          className="entrada"
          type="password"
          name="contrasena"
          autoComplete="current-password"
          required
        />
      </label>
      {estado.error && (
        <p role="alert" className="aviso aviso-error">
          {estado.error}
        </p>
      )}
      <button type="submit" className="boton boton-primario" disabled={pendiente || !hidratado}>
        {pendiente ? "Ingresando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
