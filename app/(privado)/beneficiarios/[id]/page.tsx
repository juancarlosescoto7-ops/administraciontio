import { PaginaDetalle } from "@/components/catalogos/paginas";

export default function Page({ params, searchParams }: PageProps<"/beneficiarios/[id]">) {
  return <PaginaDetalle clave="beneficiarios" params={params} searchParams={searchParams} />;
}
