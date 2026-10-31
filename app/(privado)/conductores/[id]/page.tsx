import { Suspense } from "react";
import { PaginaDetalle } from "@/components/catalogos/paginas";
import { Remuneraciones } from "@/components/finanzas/remuneraciones";
import { requerirUsuario } from "@/lib/auth/sesion";

export default function Page({ params, searchParams }: PageProps<"/conductores/[id]">) {
  return <>
    <PaginaDetalle clave="conductores" params={params} searchParams={searchParams} />
    <Suspense fallback={null}><PagosConductor params={params} /></Suspense>
  </>;
}

// Visible solo para administrador y finanzas; el operador ve la ficha sin pagos.
async function PagosConductor({ params }: Pick<PageProps<"/conductores/[id]">, "params">) {
  const [usuario, { id }] = await Promise.all([requerirUsuario(), params]);
  return <Remuneraciones persona="conductor" id={id} rol={usuario.rol} />;
}
