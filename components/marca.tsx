import Image from "next/image";
import icono from "@/public/marca/icono-tiovip.png";
import logo from "@/public/marca/logo-tiovip.jpg";

// Los archivos tienen fondo blanco: «multiply» lo funde con barras y tarjetas claras.

/** Ícono cuadrado de TioVIP (menú lateral contraído); decorativo, acompaña al logotipo. */
export function MarcaIcono({ className = "size-8" }: { className?: string }) {
  return <Image src={icono} alt="" width={80} height={80} loading="eager" className={`shrink-0 mix-blend-multiply ${className}`} />;
}

/** Logotipo completo de TioVIP (menú lateral, pantallas sin sesión e impresos). */
export function MarcaLogo({ alto = 40, className = "" }: { alto?: number; className?: string }) {
  const ancho = Math.round((alto * logo.width) / logo.height);
  return (
    <Image
      src={logo}
      alt="TioVIP"
      width={ancho}
      height={alto}
      loading="eager"
      className={`block shrink-0 mix-blend-multiply ${className}`}
      style={{ height: alto, width: "auto" }}
    />
  );
}
