import { PaginaListado } from "@/components/catalogos/paginas";

export default function Page({ searchParams }: PageProps<"/clientes">) {
  return <PaginaListado clave="clientes" searchParams={searchParams} />;
}
