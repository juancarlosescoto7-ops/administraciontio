import { PaginaListado } from "@/components/catalogos/paginas";

export default function Page({ searchParams }: PageProps<"/proveedores">) {
  return <PaginaListado clave="proveedores" searchParams={searchParams} />;
}
