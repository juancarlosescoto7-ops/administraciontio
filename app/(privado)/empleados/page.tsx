import { Suspense } from "react";
import { PaginaListado } from "@/components/catalogos/paginas";
import { requerirUsuario } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { Cargando, SinPermiso } from "@/components/encabezado";

export default function Page({ searchParams }: PageProps<"/empleados">) {
  return <Suspense fallback={<Cargando />}><Contenido searchParams={searchParams} /></Suspense>;
}
async function Contenido({ searchParams }: Pick<PageProps<"/empleados">, "searchParams">) {
  const usuario = await requerirUsuario();
  if (!puede("gestionarGastos", usuario.rol)) return <SinPermiso mensaje="El personal lo administran el administrador y finanzas." />;
  return <PaginaListado clave="empleados" searchParams={searchParams} />;
}
