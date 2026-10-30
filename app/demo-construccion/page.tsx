import type { Metadata } from "next";
import { LapsoConstruccion } from "./lapso";
import { listadosDemo, menuDemo, panelDemo, resumenCobro } from "./pantallas";

export const metadata: Metadata = {
  title: "Construcción · ERP interno",
  description: "Time lapse de la construcción del sistema con su código, migraciones y esquema reales.",
  robots: { index: false, follow: false },
};

export default function PaginaDemoConstruccion() {
  return <LapsoConstruccion grupos={menuDemo()} listados={listadosDemo()} paneles={{ cerrado: panelDemo(), grafico: panelDemo({ grafico: true }), registrado: panelDemo({ grafico: true, cobro: true }) }} resumenCobro={resumenCobro()} />;
}
