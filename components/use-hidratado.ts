"use client";

import { useSyncExternalStore } from "react";

const suscribir = () => () => {};

/**
 * Falso en el servidor y durante la hidratación; verdadero después.
 * Los formularios con useActionState deshabilitan su envío hasta hidratar:
 * con Cache Components, la respuesta a un envío nativo (sin JS) que devuelve
 * un estado de error llega sin el HTML de la página y se ve en blanco.
 */
export function useHidratado(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => true,
    () => false,
  );
}
