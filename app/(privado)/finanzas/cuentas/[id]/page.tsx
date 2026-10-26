import { PaginaDetalle } from "@/components/catalogos/paginas";

export default function Page({ params, searchParams }: PageProps<"/finanzas/cuentas/[id]">) {
  return <PaginaDetalle clave="cuentas_dinero" params={params} searchParams={searchParams} />;
}
