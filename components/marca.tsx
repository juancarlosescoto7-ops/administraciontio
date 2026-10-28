import { Icono } from "@/components/iconos";

/** Distintivo del ERP (barra lateral y pantallas sin sesión). */
export function MarcaIcono({ className = "size-8" }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-md distintivo ${className}`}>
      <Icono nombre="servicios" className="size-5" />
    </span>
  );
}
