"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { Campo } from "@/lib/catalogos/definiciones";
import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { CampoFormulario } from "@/components/catalogos/formulario-catalogo";
import { Icono } from "@/components/iconos";
import { useHidratado } from "@/components/use-hidratado";

type Accion = (anterior: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

/**
 * Alta de membresía en un solo formulario: beneficiarios existentes,
 * beneficiarios nuevos (filas que se agregan y quitan sin salir de la página),
 * condiciones particulares en una ventana flotante y confirmación. El servidor
 * crea todo en una transacción. El titular se elige (o se registra en la
 * ventana «Cliente nuevo») en el paso anterior.
 */
export function FormularioAltaMembresia({
  accion,
  estadoInicial,
  idempotencia,
  hoy,
  campoTitularBeneficiario,
  camposExistentes,
  camposNuevo,
  camposCondiciones,
  campoConfirmar,
}: {
  accion: Accion;
  estadoInicial: EstadoFormulario;
  idempotencia: string;
  hoy: string;
  campoTitularBeneficiario: Campo;
  /** Una casilla por beneficiario ya registrado. */
  camposExistentes: readonly Campo[];
  /** Campos de una fila de beneficiario nuevo, sin prefijo. */
  camposNuevo: readonly Campo[];
  /** Condiciones particulares (solo administrador); vacío para el resto. */
  camposCondiciones: readonly Campo[];
  campoConfirmar: Campo;
}) {
  const [estado, despachar, pendiente] = useActionState(accion, estadoInicial);
  const hidratado = useHidratado();
  // Sin beneficiarios registrados, se empieza con una fila nueva abierta.
  const [filas, setFilas] = useState<number[]>(camposExistentes.length === 0 ? [0] : []);
  const siguiente = useRef(camposExistentes.length === 0 ? 1 : 0);
  const hayErrores = Object.keys(estado.errores).length > 0;
  // Condiciones particulares en una ventana flotante que está DENTRO del
  // formulario: sus campos se envían con la membresía aunque esté cerrada.
  // Vacías = las del plan. El resumen junto al botón muestra lo pactado.
  const dialogo = useRef<HTMLDialogElement>(null);
  const [resumen, setResumen] = useState<{ revision: number; textos: string[] }>({ revision: -1, textos: [] });
  const resumenCondiciones = resumen.revision === estado.revision ? resumen.textos : describir(camposCondiciones, estado.valores);
  const leerCondiciones = () => {
    const valores = Object.fromEntries(
      camposCondiciones.map((c) => [c.nombre, (dialogo.current?.querySelector<HTMLInputElement>(`[name="${c.nombre}"]`)?.value ?? "").trim()]),
    );
    setResumen({ revision: estado.revision, textos: describir(camposCondiciones, valores) });
  };
  const quitarCondiciones = () => {
    dialogo.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach((control) => {
      control.value = "";
    });
    dialogo.current?.close();
  };
  // Si el servidor marca errores en las condiciones, la ventana se abre sola.
  const erroresCondiciones = camposCondiciones.some((c) => estado.errores[c.nombre]);
  useEffect(() => {
    if (erroresCondiciones && dialogo.current && !dialogo.current.open) dialogo.current.showModal();
  }, [erroresCondiciones, estado.revision]);

  const campo = (c: Campo) => (
    <CampoFormulario key={c.nombre} campo={c} valor={estado.valores[c.nombre] ?? ""} error={estado.errores[c.nombre]} hoy={hoy} prefijo="" />
  );
  const agregarFila = () => {
    const indice = siguiente.current;
    siguiente.current += 1;
    setFilas((actuales) => [...actuales, indice]);
  };

  return (
    <form action={despachar} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="idempotencia" value={idempotencia} />
      {/* La clave fuerza a reponer los valores devueltos por el servidor. */}
      <div key={estado.revision} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 font-semibold">Beneficiarios</legend>
          {campo(campoTitularBeneficiario)}

          {camposExistentes.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Ya registrados</p>
              <div className="grid max-h-72 grid-cols-1 gap-x-5 gap-y-3 overflow-y-auto rounded-lg border border-borde p-3 sm:grid-cols-2">
                {camposExistentes.map(campo)}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3" data-beneficiarios-nuevos>
            <p className="text-sm font-medium">Nuevos (se registran al confirmar)</p>
            {filas.length === 0 && <p className="text-sm texto-tenue">Ninguno. Use el botón para agregar una persona nueva.</p>}
            {filas.map((indice, posicion) => (
              <div key={indice} className="tarjeta flex flex-col gap-3 p-4" data-fila-nueva={indice}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Beneficiario nuevo {posicion + 1}</span>
                  <button
                    type="button"
                    className="boton boton-secundario min-h-9 px-3 text-sm"
                    onClick={() => setFilas((actuales) => actuales.filter((i) => i !== indice))}
                  >
                    Quitar
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                  {camposNuevo.map((c) => campo({ ...c, nombre: `nuevo_${indice}_${c.nombre}` }))}
                </div>
              </div>
            ))}
            <button type="button" className="boton boton-secundario w-fit" onClick={agregarFila} disabled={!hidratado}>
              + Agregar beneficiario nuevo
            </button>
          </div>
        </fieldset>

        {camposCondiciones.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-borde pt-5">
            <button
              type="button"
              className="boton boton-secundario w-fit"
              aria-haspopup="dialog"
              onClick={() => dialogo.current?.showModal()}
              disabled={!hidratado}
            >
              <Icono nombre="editar" className="size-4" />
              {resumenCondiciones.length > 0 ? "Cambiar condiciones particulares" : "Pactar condiciones particulares"}
            </button>
            <p className="text-sm texto-tenue" data-resumen-condiciones>
              {resumenCondiciones.length > 0
                ? `Pactadas: ${resumenCondiciones.join(" · ")}. Lo demás, como el plan.`
                : "Opcional. Si no las pacta, se aplican el precio, el cupo y la gracia del plan."}
            </p>
            <dialog
              ref={dialogo}
              id="condiciones-particulares"
              aria-labelledby="condiciones-particulares-titulo"
              className="dialogo"
              onClose={leerCondiciones}
              onClick={(evento) => {
                if (evento.target === dialogo.current) dialogo.current.close();
              }}
            >
              <div className="dialogo-marco">
                <div className="dialogo-cabecera">
                  <div className="flex flex-col gap-0.5">
                    <h2 id="condiciones-particulares-titulo" className="text-base font-semibold tracking-tight">
                      Condiciones particulares
                    </h2>
                    <p className="text-sm texto-tenue">Escriba solo lo que cambia; lo que deje vacío se toma del plan.</p>
                  </div>
                  <button type="button" className="boton boton-secundario min-h-9 px-3" onClick={() => dialogo.current?.close()} aria-label="Cerrar condiciones particulares">
                    <Icono nombre="cerrar" className="size-4" />
                  </button>
                </div>
                <div className="dialogo-cuerpo flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">{camposCondiciones.map(campo)}</div>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button type="button" className="boton boton-secundario" onClick={quitarCondiciones}>
                      Quitar y usar las del plan
                    </button>
                    <button type="button" className="boton boton-primario" onClick={() => dialogo.current?.close()}>
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            </dialog>
          </div>
        )}

        <div className="border-t border-borde pt-5">{campo(campoConfirmar)}</div>
      </div>

      {estado.error && (
        <p role="alert" className={`aviso ${hayErrores ? "aviso-advertencia" : "aviso-error"}`}>
          {estado.error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href="/membresias" className="boton boton-secundario">
          Cancelar
        </Link>
        <button type="submit" className="boton boton-exito" disabled={pendiente || !hidratado}>
          {pendiente ? "Guardando…" : "Confirmar membresía"}
        </button>
      </div>
    </form>
  );
}

/** «Precio L 600», «2 traslados al mes»… solo de las condiciones escritas. */
function describir(campos: readonly Campo[], valores: Record<string, string>): string[] {
  return campos.flatMap((c) => {
    const valor = (valores[c.nombre] ?? "").trim();
    if (!valor) return [];
    const mostrado = c.opciones?.find((o) => o.valor === valor)?.etiqueta ?? valor;
    return [`${c.etiqueta.toLowerCase()}: ${mostrado}`];
  });
}
