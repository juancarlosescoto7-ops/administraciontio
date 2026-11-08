import Link from "next/link";
import { Suspense } from "react";
import { requerirUsuario } from "@/lib/auth/sesion";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";

/** Destino cuando el desarrollador apagó el módulo de la página pedida. */
export default function PaginaSinPermiso() {
  return (
    <Suspense fallback={<Cargando />}>
      <ContenidoSinPermiso />
    </Suspense>
  );
}

async function ContenidoSinPermiso() {
  await requerirUsuario();
  return (
    <>
      <Encabezado titulo="Módulo no habilitado" />
      <SinPermiso mensaje="Este módulo no está habilitado para su usuario. Si lo necesita, pida al desarrollador que lo encienda." />
      <div className="mt-4 flex">
        <Link href="/" className="boton boton-secundario">
          Volver al inicio
        </Link>
      </div>
    </>
  );
}
