import { PaginaListado } from "@/components/catalogos/paginas";

export default function Page({ searchParams }: PageProps<"/conductores">) {
  return <PaginaListado clave="conductores" searchParams={searchParams} />;
}
