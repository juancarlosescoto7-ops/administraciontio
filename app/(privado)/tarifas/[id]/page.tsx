import { PaginaDetalle } from "@/components/catalogos/paginas";

export default function Page({ params, searchParams }: PageProps<"/tarifas/[id]">) {
  return <PaginaDetalle clave="tarifas" params={params} searchParams={searchParams} />;
}
