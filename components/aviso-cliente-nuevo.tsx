"use client";

import { useSearchParams } from "next/navigation";
import { Notificacion } from "@/components/notificacion";

/** Tras «Cliente nuevo» en un servicio (?cliente_nuevo=1), en cualquier pantalla. */
export function AvisoClienteNuevo() {
  const parametros = useSearchParams();
  if (parametros.get("cliente_nuevo") !== "1") return null;
  return <Notificacion mensaje="Cliente registrado y elegido. Continúe con la operación." />;
}
