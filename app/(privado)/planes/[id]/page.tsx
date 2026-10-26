import { PaginaDetalle } from "@/components/catalogos/paginas";

export default function Page({ params, searchParams }: PageProps<"/planes/[id]">) {
  return <PaginaDetalle clave="planes" params={params} searchParams={searchParams} />;
}
