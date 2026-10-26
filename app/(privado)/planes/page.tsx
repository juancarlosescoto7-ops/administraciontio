import { PaginaListado } from "@/components/catalogos/paginas";

export default function Page({ searchParams }: PageProps<"/planes">) {
  return <PaginaListado clave="planes" searchParams={searchParams} />;
}
