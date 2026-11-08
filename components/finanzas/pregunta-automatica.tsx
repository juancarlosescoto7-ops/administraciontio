"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Dialogo } from "@/components/dialogo";

const suscribir = () => () => {};

function descartada(clave: string): boolean {
  try {
    return sessionStorage.getItem(clave) === "1";
  } catch {
    return false;
  }
}

/**
 * Ventana que se abre sola al llegar a la página para hacer una pregunta
 * (p. ej., aplicar saldo a favor). Si el usuario la cierra, no vuelve a
 * abrirse sola en esta sesión del navegador para la misma `clave`; el botón
 * sigue disponible para abrirla a mano.
 */
export function PreguntaAutomatica({
  clave,
  abrir,
  titulo,
  textoBoton,
  children,
}: {
  clave: string;
  /** Falso para no abrirla sola (p. ej., justo después de responderla). */
  abrir: boolean;
  titulo: string;
  textoBoton: string;
  children: ReactNode;
}) {
  // En el servidor y al hidratar se considera descartada: se abre después.
  const yaDescartada = useSyncExternalStore(suscribir, () => descartada(clave), () => true);

  return (
    <Dialogo
      titulo={titulo}
      textoBoton={textoBoton}
      icono="dinero"
      claseBoton="boton boton-primario"
      abierto={abrir && !yaDescartada}
      alCerrar={() => {
        try {
          sessionStorage.setItem(clave, "1");
        } catch {
          // Sin almacenamiento, la pregunta volverá a abrirse al regresar.
        }
      }}
    >
      {children}
      <form method="dialog" className="mt-3">
        <button type="submit" className="boton boton-secundario w-full sm:w-auto">
          Ahora no
        </button>
      </form>
    </Dialogo>
  );
}
