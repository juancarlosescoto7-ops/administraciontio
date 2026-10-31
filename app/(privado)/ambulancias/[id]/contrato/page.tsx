import { Suspense } from "react";
import { PaginaContratoServicio } from "@/components/contratos/pagina-contrato-servicio";
import { Cargando } from "@/components/encabezado";

export default function PaginaContrato({ params, searchParams }: PageProps<"/ambulancias/[id]/contrato">) {
  return (
    <Suspense fallback={<Cargando />}>
      <PaginaContratoServicio tipo="traslado" params={params} searchParams={searchParams} />
    </Suspense>
  );
}
