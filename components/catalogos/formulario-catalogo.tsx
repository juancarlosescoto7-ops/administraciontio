"use client";

import Link from "next/link";
import { Fragment, useActionState } from "react";
import type { Campo } from "@/lib/catalogos/definiciones";
import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { useHidratado } from "@/components/use-hidratado";

type Accion = (anterior: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

export function FormularioCatalogo({
  campos,
  accion,
  estadoInicial,
  textoEnviar,
  rutaCancelar,
  rutaBase = "",
  hoy,
  ocultos,
  prefijo = "",
}: {
  campos: readonly Campo[];
  accion: Accion;
  estadoInicial: EstadoFormulario;
  textoEnviar: string;
  /** null: sin botón «Cancelar» (formularios dentro de una página de detalle). */
  rutaCancelar: string | null;
  rutaBase?: string;
  hoy: string;
  /** Campos ocultos fijos, como la clave de idempotencia de la operación. */
  ocultos?: Record<string, string>;
  /** Prefijo de los id cuando hay varios formularios en la página (evita id repetidos). */
  prefijo?: string;
}) {
  const [estado, despachar, pendiente] = useActionState(accion, estadoInicial);
  const hidratado = useHidratado();
  const hayErrores = Object.keys(estado.errores).length > 0;
  const similares = estado.similares ?? [];

  return (
    <form action={despachar} className="flex flex-col gap-6" noValidate>
      {Object.entries(ocultos ?? {}).map(([nombre, valor]) => (
        <input key={nombre} type="hidden" name={nombre} value={valor} />
      ))}
      {/* La clave fuerza a reponer los valores devueltos por el servidor. */}
      <div key={estado.revision} className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        {campos.map((campo) => (
          <Fragment key={campo.nombre}>
            {campo.seccion && (
              <h3 className="border-t border-borde pt-4 font-semibold sm:col-span-2">{campo.seccion}</h3>
            )}
            <CampoFormulario
              campo={campo}
              valor={estado.valores[campo.nombre] ?? ""}
              error={estado.errores[campo.nombre]}
              hoy={hoy}
              prefijo={prefijo}
            />
          </Fragment>
        ))}
      </div>

      {estado.error && (
        <p role="alert" className={`aviso ${hayErrores ? "aviso-advertencia" : "aviso-error"}`}>
          {estado.error}
        </p>
      )}

      {similares.length > 0 && (
        <div role="alert" className="aviso aviso-advertencia flex flex-col gap-2">
          <p className="font-medium">
            Ya existen clientes con el mismo nombre o identificación. Verifique que no sea un
            duplicado:
          </p>
          <ul className="list-disc pl-5">
            {similares.map((cliente) => (
              <li key={cliente.id}>
                <Link href={`${rutaBase}/${cliente.id}`} className="underline" target="_blank">
                  {cliente.nombre}
                </Link>
                {cliente.identificacion ? ` · ${cliente.identificacion}` : ""}
              </li>
            ))}
          </ul>
          <input type="hidden" name="confirmar_similares" value="si" />
          <p className="text-sm">Si es una persona distinta, puede registrarlo de todos modos.</p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {rutaCancelar !== null && (
          <Link href={rutaCancelar} className="boton boton-secundario">
            Cancelar
          </Link>
        )}
        <button type="submit" className="boton boton-primario" disabled={pendiente || !hidratado}>
          {pendiente ? "Guardando…" : similares.length > 0 ? "Registrar de todos modos" : textoEnviar}
        </button>
      </div>
    </form>
  );
}

function CampoFormulario({
  campo,
  valor,
  error,
  hoy,
  prefijo,
}: {
  campo: Campo;
  valor: string;
  error: string | undefined;
  hoy: string;
  prefijo: string;
}) {
  const id = `campo-${prefijo}${campo.nombre}`;
  const idDescripcion = error ? `${id}-error` : campo.ayuda ? `${id}-ayuda` : undefined;
  const comunes = {
    id,
    name: campo.nombre,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": idDescripcion,
    required: campo.requerido,
  } as const;

  if (campo.tipo === "booleano") {
    return (
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="flex items-center gap-3">
          <input
            {...comunes}
            type="checkbox"
            defaultChecked={valor === "on"}
            className="h-5 w-5"
          />
          <span className="campo-etiqueta">{campo.etiqueta}</span>
        </label>
        {error ? (
          <p id={`${id}-error`} className="campo-error">
            {error}
          </p>
        ) : (
          campo.ayuda && (
            <p id={`${id}-ayuda`} className="campo-ayuda">
              {campo.ayuda}
            </p>
          )
        )}
      </div>
    );
  }

  let control;
  switch (campo.tipo) {
    case "texto_largo":
      control = <textarea {...comunes} className="entrada" rows={3} maxLength={campo.max} defaultValue={valor} />;
      break;
    case "seleccion":
      control = (
        <select {...comunes} className="entrada" defaultValue={valor}>
          {!campo.predeterminado && <option value="">Seleccione…</option>}
          {campo.opciones?.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      );
      break;
    case "fecha":
      control = (
        <input {...comunes} className="entrada" type="date" max={campo.noFutura ? hoy : undefined} defaultValue={valor} />
      );
      break;
    case "fecha_hora":
      control = <input {...comunes} className="entrada" type="datetime-local" defaultValue={valor} />;
      break;
    case "entero":
      control = (
        <input
          {...comunes}
          className="entrada"
          type="number"
          inputMode="numeric"
          step={1}
          min={campo.min ?? 0}
          max={campo.max}
          defaultValue={valor}
        />
      );
      break;
    case "monto":
      control = (
        <input {...comunes} className="entrada" type="text" inputMode="decimal" placeholder="0.00" defaultValue={valor} />
      );
      break;
    default:
      control = (
        <input
          {...comunes}
          className="entrada"
          type={campo.tipo === "correo" ? "email" : campo.tipo === "telefono" ? "tel" : "text"}
          maxLength={campo.max}
          autoCapitalize={campo.mayusculas ? "characters" : undefined}
          defaultValue={valor}
        />
      );
  }

  return (
    <div className={`campo ${campo.tipo === "texto_largo" ? "sm:col-span-2" : ""}`}>
      <label htmlFor={id} className="campo-etiqueta">
        {campo.etiqueta}
        {campo.requerido && <span aria-hidden="true"> *</span>}
      </label>
      {control}
      {error ? (
        <p id={`${id}-error`} className="campo-error">
          {error}
        </p>
      ) : (
        campo.ayuda && (
          <p id={`${id}-ayuda`} className="campo-ayuda">
            {campo.ayuda}
          </p>
        )
      )}
    </div>
  );
}
