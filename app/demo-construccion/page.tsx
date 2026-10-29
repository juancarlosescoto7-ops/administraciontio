import type { Metadata } from "next";
import { DemoConstruccion } from "./reproductor";

export const metadata: Metadata = {
  title: "Simulación · ERP interno",
  description: "El sistema pasa de HTML sin estilos a su interfaz final, con interacciones simuladas y datos ficticios.",
  robots: { index: false, follow: false },
};

export default function PaginaDemoConstruccion() {
  return <DemoConstruccion />;
}
