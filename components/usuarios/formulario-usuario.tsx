"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ETIQUETAS_ROL, ROLES } from "@/lib/auth/roles";
import type { EstadoUsuario } from "@/lib/usuarios/estado";
import { useHidratado } from "@/components/use-hidratado";

type Accion = (anterior: EstadoUsuario, formData: FormData) => Promise<EstadoUsuario>;

export function FormularioUsuario({
  accion,
  estadoInicial,
  esPropio,
}: {
  accion: Accion;
  estadoInicial: EstadoUsuario;
  esPropio: boolean;
}) {
  const [estado, despachar, pendiente] = useActionState(accion, estadoInicial);
  const hidratado = useHidratado();
  const { valores, errores } = estado;

  return (
    <form action={despachar} className="flex flex-col gap-5" noValidate>
      <div key={estado.revision} className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <div className="campo">
          <label htmlFor="nombre" className="campo-etiqueta">
            Nombre <span aria-hidden="true">*</span>
          </label>
          <input
            id="nombre"
            name="nombre"
            className="entrada"
            maxLength={120}
            required
            defaultValue={valores.nombre}
            aria-invalid={errores.nombre ? true : undefined}
          />
          {errores.nombre && <p className="campo-error">{errores.nombre}</p>}
        </div>

        <div className="campo">
          <label htmlFor="rol" className="campo-etiqueta">
            Rol
          </label>
          <select
            id="rol"
            name="rol"
            className="entrada"
            defaultValue={valores.rol}
            disabled={esPropio}
            aria-invalid={errores.rol ? true : undefined}
          >
            {ROLES.map((rol) => (
              <option key={rol} value={rol}>
                {ETIQUETAS_ROL[rol]}
              </option>
            ))}
          </select>
          {errores.rol && <p className="campo-error">{errores.rol}</p>}
        </div>

        <label className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            name="activo"
            className="h-5 w-5"
            defaultChecked={valores.activo === "on"}
            disabled={esPropio}
          />
          <span className="campo-etiqueta">Acceso activo</span>
        </label>

        {esPropio && (
          <p className="campo-ayuda sm:col-span-2">
            Por seguridad, nadie puede cambiar su propio rol ni desactivarse. Otro administrador
            debe hacerlo.
          </p>
        )}

        <div className="campo sm:col-span-2">
          <label htmlFor="motivo" className="campo-etiqueta">
            Motivo del cambio
          </label>
          <textarea
            id="motivo"
            name="motivo"
            className="entrada"
            rows={2}
            maxLength={300}
            defaultValue={valores.motivo}
            aria-invalid={errores.motivo ? true : undefined}
          />
          {errores.motivo ? (
            <p className="campo-error">{errores.motivo}</p>
          ) : (
            <p className="campo-ayuda">Obligatorio al cambiar el rol o el estado. Queda en la bitácora.</p>
          )}
        </div>
      </div>

      {estado.error && (
        <p role="alert" className="aviso aviso-error">
          {estado.error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href="/configuracion/usuarios" className="boton boton-secundario">
          Cancelar
        </Link>
        <button type="submit" className="boton boton-primario" disabled={pendiente || !hidratado}>
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
