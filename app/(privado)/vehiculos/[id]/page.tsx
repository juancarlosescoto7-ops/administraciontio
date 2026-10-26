import { PaginaDetalle } from "@/components/catalogos/paginas";

export default function Page({ params, searchParams }: PageProps<"/vehiculos/[id]">) {
  return <PaginaDetalle clave="vehiculos" params={params} searchParams={searchParams} />;
}
