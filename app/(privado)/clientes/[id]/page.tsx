import { PaginaDetalle } from "@/components/catalogos/paginas";

export default function Page({ params, searchParams }: PageProps<"/clientes/[id]">) {
  return <PaginaDetalle clave="clientes" params={params} searchParams={searchParams} />;
}
