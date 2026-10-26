import { PaginaDetalle } from "@/components/catalogos/paginas";

export default function Page({ params, searchParams }: PageProps<"/proveedores/[id]">) {
  return <PaginaDetalle clave="proveedores" params={params} searchParams={searchParams} />;
}
