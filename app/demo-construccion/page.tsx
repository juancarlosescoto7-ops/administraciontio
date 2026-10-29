import type { Metadata } from "next";
import { DemoConstruccion } from "./reproductor";

export const metadata: Metadata = {
  title: "Así se construyó · ERP interno",
  description: "Una recreación animada del desarrollo del ERP, con datos ficticios.",
  robots: { index: false, follow: false },
};

export default function PaginaDemoConstruccion() {
  return <DemoConstruccion />;
}
