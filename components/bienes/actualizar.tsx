"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { actualizarDepreciacionesAlAbrir } from "@/lib/bienes/acciones";
import { Notificacion } from "@/components/notificacion";

/**
 * Pone al día la depreciación mensual de los bienes al abrir la página. Es
 * una Server Action (POST) lanzada desde el navegador: el GET nunca escribe.
 * Solo se monta para administrador y finanzas.
 */
export function ActualizarDepreciacionesAlAbrir() {
  const router = useRouter();
  const lanzado = useRef(false);
  const [cuotas, setCuotas] = useState(0);

  useEffect(() => {
    if (lanzado.current) return;
    lanzado.current = true;
    const lanzar = () =>
      actualizarDepreciacionesAlAbrir()
        .then((registradas) => {
          if (registradas === 0) return;
          setCuotas(registradas);
          router.refresh();
        })
        .catch(() => {});
    if ("requestIdleCallback" in window) requestIdleCallback(lanzar, { timeout: 2000 });
    else setTimeout(lanzar, 300);
  }, [router]);

  if (cuotas === 0) return null;
  return <Notificacion mensaje={`Depreciación al día: ${cuotas === 1 ? "1 cuota mensual registrada" : `${cuotas} cuotas mensuales registradas`}.`} />;
}
