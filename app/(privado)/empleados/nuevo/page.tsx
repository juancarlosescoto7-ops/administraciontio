import { Suspense } from "react";
import { PaginaNuevo } from "@/components/catalogos/paginas";
import { requerirUsuario } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { Cargando, SinPermiso } from "@/components/encabezado";

export default function Page() {
  return <Suspense fallback={<Cargando />}><Contenido /></Suspense>;
}
async function Contenido() {
  const usuario = await requerirUsuario();
  if (!puede("gestionarGastos", usuario.rol)) return <SinPermiso mensaje="El personal lo administran el administrador y finanzas." />;
  return <PaginaNuevo clave="empleados" />;
}
