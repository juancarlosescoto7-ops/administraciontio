"use client";

import { useActionState, useMemo, useState } from "react";
import { GRUPOS_MODULOS, MODULOS, type Modulo } from "@/lib/auth/permisos";
import type { EstadoPermisos } from "@/lib/permisos/estado";
import { useHidratado } from "@/components/use-hidratado";

type Accion = (anterior: EstadoPermisos, formData: FormData) => Promise<EstadoPermisos>;

const ESTADO_INICIAL: EstadoPermisos = { revision: 0, error: null };

/**
 * Interruptores por módulo y por función. Apagar un módulo deja sus funciones
 * como estaban (al volver a encenderlo se recuperan), pero sin efecto mientras
 * el módulo siga apagado. Lo que el rol no permite se ve, deshabilitado.
 */
export function EditorPermisos({
  accion,
  denegadosIniciales,
  bloqueadasPorRol,
}: {
  accion: Accion;
  denegadosIniciales: string[];
  /** Funciones que el rol del usuario no permite, aunque estén encendidas. */
  bloqueadasPorRol: string[];
}) {
  const [estado, despachar, pendiente] = useActionState(accion, ESTADO_INICIAL);
  const hidratado = useHidratado();
  const [denegados, setDenegados] = useState<Set<string>>(() => new Set(denegadosIniciales));
  const bloqueadas = useMemo(() => new Set(bloqueadasPorRol), [bloqueadasPorRol]);

  const iniciales = useMemo(() => new Set(denegadosIniciales), [denegadosIniciales]);
  const cambios = useMemo(() => {
    let total = 0;
    for (const clave of denegados) if (!iniciales.has(clave)) total += 1;
    for (const clave of iniciales) if (!denegados.has(clave)) total += 1;
    return total;
  }, [denegados, iniciales]);

  const encendidos = MODULOS.filter((m) => !denegados.has(m.clave)).length;

  function alternar(clave: string, encender: boolean) {
    setDenegados((actual) => {
      const siguiente = new Set(actual);
      if (encender) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });
  }

  function encenderGrupo(modulos: readonly Modulo[], encender: boolean) {
    setDenegados((actual) => {
      const siguiente = new Set(actual);
      for (const modulo of modulos) {
        if (encender) siguiente.delete(modulo.clave);
        else siguiente.add(modulo.clave);
      }
      return siguiente;
    });
  }

  return (
    <form action={despachar} className="flex flex-col gap-6">
      {[...denegados].map((clave) => (
        <input key={clave} type="hidden" name="denegado" value={clave} />
      ))}

      <div className="tarjeta flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">
            {encendidos} de {MODULOS.length} módulos encendidos
          </p>
          <p className="text-sm texto-tenue">
            Lo que apague desaparece del menú y el sistema lo bloquea para este usuario. Nunca da más de lo que su rol
            permite.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="boton boton-secundario" onClick={() => setDenegados(new Set())}>
            Encender todo
          </button>
          <button
            type="button"
            className="boton boton-secundario"
            onClick={() => setDenegados(new Set(MODULOS.map((m) => m.clave)))}
          >
            Apagar todo
          </button>
        </div>
      </div>

      {GRUPOS_MODULOS.map((grupo) => {
        const id = `grupo-${grupo.titulo.toLowerCase().replace(/\s+/g, "-")}`;
        const todosEncendidos = grupo.modulos.every((m) => !denegados.has(m.clave));
        return (
          <section key={grupo.titulo} aria-labelledby={id}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id={id} className="text-lg font-semibold">
                {grupo.titulo}
              </h2>
              <button
                type="button"
                className="text-sm font-medium text-primario hover:underline"
                onClick={() => encenderGrupo(grupo.modulos, !todosEncendidos)}
              >
                {todosEncendidos ? "Apagar sección" : "Encender sección"}
              </button>
            </div>
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {grupo.modulos.map((modulo) => {
                const encendido = !denegados.has(modulo.clave);
                const idModulo = `modulo-${modulo.clave}`;
                return (
                  <li
                    key={modulo.clave}
                    className={`tarjeta flex flex-col p-4 transition-opacity ${encendido ? "" : "opacity-75"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <label htmlFor={idModulo} className="flex min-w-0 cursor-pointer flex-col">
                        <span className="font-semibold">{modulo.etiqueta}</span>
                        <span className="text-sm texto-tenue">{modulo.descripcion}</span>
                      </label>
                      <input
                        id={idModulo}
                        type="checkbox"
                        role="switch"
                        className="interruptor mt-0.5"
                        checked={encendido}
                        aria-checked={encendido}
                        onChange={(evento) => alternar(modulo.clave, evento.target.checked)}
                      />
                    </div>

                    {modulo.funciones.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-2 border-t border-borde pt-3">
                        {modulo.funciones.map((funcion) => {
                          const porRol = bloqueadas.has(funcion.clave);
                          const activa = encendido && !porRol && !denegados.has(funcion.clave);
                          const idFuncion = `funcion-${modulo.clave}-${funcion.clave}`;
                          return (
                            <li key={funcion.clave} className="flex items-start justify-between gap-4">
                              <label
                                htmlFor={idFuncion}
                                className={`flex min-w-0 flex-col text-sm ${encendido && !porRol ? "cursor-pointer" : "texto-tenue"}`}
                              >
                                <span>{funcion.etiqueta}</span>
                                {porRol ? (
                                  <span className="text-xs texto-tenue">Su rol no lo permite</span>
                                ) : (
                                  !encendido && <span className="text-xs texto-tenue">Apagada junto con el módulo</span>
                                )}
                              </label>
                              <input
                                id={idFuncion}
                                type="checkbox"
                                role="switch"
                                className="interruptor interruptor-chico"
                                checked={activa}
                                aria-checked={activa}
                                disabled={!encendido || porRol}
                                onChange={(evento) => alternar(funcion.clave, evento.target.checked)}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <div className="tarjeta sticky bottom-4 z-10 flex flex-col gap-3 p-4 shadow-lg sm:flex-row sm:items-end">
        <div className="campo min-w-0 flex-1">
          <label htmlFor="motivo" className="campo-etiqueta">
            Motivo (opcional)
          </label>
          <input id="motivo" name="motivo" className="entrada" maxLength={300} placeholder="Queda en la bitácora" />
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <span className="text-sm texto-tenue" aria-live="polite">
            {cambios === 0 ? "Sin cambios" : `${cambios} ${cambios === 1 ? "cambio sin guardar" : "cambios sin guardar"}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="boton boton-secundario"
              disabled={cambios === 0 || pendiente}
              onClick={() => setDenegados(new Set(denegadosIniciales))}
            >
              Descartar
            </button>
            <button
              type="submit"
              className="boton boton-primario"
              disabled={cambios === 0 || pendiente || !hidratado}
            >
              {pendiente ? "Guardando…" : "Guardar permisos"}
            </button>
          </div>
        </div>
      </div>

      {estado.error && (
        <p role="alert" className="aviso aviso-error">
          {estado.error}
        </p>
      )}
    </form>
  );
}
