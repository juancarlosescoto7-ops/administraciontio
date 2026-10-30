"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { actualizarAlAbrir, actualizarMensualidades } from "@/lib/membresias/acciones";
import { describirActualizacion } from "@/lib/membresias/definiciones";
import { Notificacion } from "@/components/notificacion";
import { useHidratado } from "@/components/use-hidratado";

/** Botón «Actualizar mensualidades» de una membresía (id) o de todas (null). */
export function BotonActualizarMensualidades({ membresiaId }: { membresiaId: string | null }) {
  const [estado, despachar, pendiente] = useActionState(actualizarMensualidades.bind(null, membresiaId), {
    mensaje: null,
    error: null,
  });
  const hidratado = useHidratado();

  return (
    <form action={despachar} className="flex flex-col items-start gap-2 sm:items-end">
      <button type="submit" className="boton boton-secundario" disabled={pendiente || !hidratado}>
        {pendiente ? "Actualizando…" : "Actualizar mensualidades"}
      </button>
      {estado.mensaje && <Notificacion mensaje={estado.mensaje} />}
      {estado.error && (
        <p role="alert" className="aviso aviso-error text-sm">
          {estado.error}
        </p>
      )}
    </form>
  );
}

/**
 * Pone al día las mensualidades al abrir el panel. Es una Server Action
 * (POST) lanzada desde el navegador: el GET de la página nunca escribe.
 */
export function ActualizarAlAbrir() {
  const router = useRouter();
  const lanzado = useRef(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (lanzado.current) return;
    lanzado.current = true;
    const lanzar = () =>
      actualizarAlAbrir()
        .then((resumen) => {
          if (!resumen) return;
          setMensaje(describirActualizacion(resumen));
          router.refresh();
        })
        .catch(() => {});
    // Espera a que el navegador quede libre: no compite con la carga del panel.
    if ("requestIdleCallback" in window) requestIdleCallback(lanzar, { timeout: 2000 });
    else setTimeout(lanzar, 300);
  }, [router]);

  if (!mensaje) return null;
  return <Notificacion mensaje={mensaje} />;
}
