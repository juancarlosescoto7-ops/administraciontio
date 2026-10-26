import { PaginaDetalle } from "@/components/catalogos/paginas";

export default function Page({ params, searchParams }: PageProps<"/conductores/[id]">) {
  return <PaginaDetalle clave="conductores" params={params} searchParams={searchParams} />;
}
