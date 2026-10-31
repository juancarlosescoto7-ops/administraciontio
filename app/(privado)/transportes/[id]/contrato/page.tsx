import { Suspense } from "react";
import { PaginaContratoServicio } from "@/components/contratos/pagina-contrato-servicio";
import { Cargando } from "@/components/encabezado";

export default function PaginaContrato({ params, searchParams }: PageProps<"/transportes/[id]/contrato">) {
  return (
    <Suspense fallback={<Cargando />}>
      <PaginaContratoServicio tipo="transporte" params={params} searchParams={searchParams} />
    </Suspense>
  );
}
