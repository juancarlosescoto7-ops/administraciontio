import { PaginaListado } from "@/components/catalogos/paginas";

export default function Page({ searchParams }: PageProps<"/finanzas/cuentas">) {
  return <PaginaListado clave="cuentas_dinero" searchParams={searchParams} />;
}
