import { PaginaListado } from "@/components/catalogos/paginas";

export default function Page({ searchParams }: PageProps<"/beneficiarios">) {
  return <PaginaListado clave="beneficiarios" searchParams={searchParams} />;
}
