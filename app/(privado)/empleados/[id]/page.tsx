import { Suspense } from "react";
import { PaginaDetalle } from "@/components/catalogos/paginas";
import { Remuneraciones } from "@/components/finanzas/remuneraciones";
import { requerirUsuario } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { Cargando, SinPermiso } from "@/components/encabezado";

export default function Page({ params, searchParams }: PageProps<"/empleados/[id]">) {
  return <Suspense fallback={<Cargando />}><Contenido params={params} searchParams={searchParams} /></Suspense>;
}
async function Contenido({ params, searchParams }: PageProps<"/empleados/[id]">) {
  const usuario = await requerirUsuario();
  if (!puede("gestionarGastos", usuario.rol)) return <SinPermiso mensaje="El personal lo administran el administrador y finanzas." />;
  const { id } = await params;
  return <>
    <PaginaDetalle clave="empleados" params={params} searchParams={searchParams} />
    <Remuneraciones persona="empleado" id={id} rol={usuario.rol} />
  </>;
}
