import { PaginaListado } from "@/components/catalogos/paginas";

export default function Page({ searchParams }: PageProps<"/tarifas">) {
  return <PaginaListado clave="tarifas" searchParams={searchParams} />;
}
