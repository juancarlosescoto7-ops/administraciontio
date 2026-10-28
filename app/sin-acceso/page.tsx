import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { obtenerSesion } from "@/lib/auth/sesion";
import { MarcaIcono } from "@/components/marca";
import { cerrarSesion } from "../login/acciones";

export const metadata: Metadata = { title: "Acceso no habilitado · ERP interno" };

export default function PaginaSinAcceso() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="tarjeta w-full max-w-md p-6 sm:p-8">
        <MarcaIcono className="mb-4 size-11" />
        <h1 className="text-xl font-semibold">Acceso no habilitado</h1>
        <Suspense fallback={<p className="mt-3 texto-tenue">Verificando…</p>}>
          <DetalleSinAcceso />
        </Suspense>
      </div>
    </main>
  );
}

async function DetalleSinAcceso() {
  const sesion = await obtenerSesion();
  if (sesion.estado === "sin_sesion") redirect("/login");
  if (sesion.estado === "activo") redirect("/");

  return (
    <>
      <p className="mt-3 texto-tenue">
        Su usuario{sesion.correo ? ` (${sesion.correo})` : ""} existe, pero su perfil
        interno no está activo. Solicite al administrador que lo habilite.
      </p>
      <form action={cerrarSesion} className="mt-6">
        <button type="submit" className="boton boton-secundario">
          Cerrar sesión
        </button>
      </form>
    </>
  );
}
