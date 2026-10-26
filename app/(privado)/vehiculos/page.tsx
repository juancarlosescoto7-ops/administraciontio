import { PaginaListado } from "@/components/catalogos/paginas";

export default function Page({ searchParams }: PageProps<"/vehiculos">) {
  return <PaginaListado clave="vehiculos" searchParams={searchParams} />;
}
