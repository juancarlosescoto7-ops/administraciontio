import type { Metadata } from "next";
import { Suspense } from "react";
import { destinoSeguro } from "@/lib/auth/rutas";
import { leerConfigSupabase } from "@/lib/supabase/config";
import { MarcaIcono } from "@/components/marca";
import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = { title: "Iniciar sesión · ERP interno" };

export default function PaginaLogin({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="tarjeta w-full max-w-sm p-6 sm:p-8">
        <MarcaIcono className="mb-4 size-11" />
        <h1 className="text-2xl font-semibold tracking-tight">ERP interno</h1>
        <p className="mt-1 mb-6 text-sm texto-tenue">
          Ingrese con el usuario asignado por el administrador.
        </p>
        <Suspense fallback={<p className="texto-tenue">Cargando…</p>}>
          <ContenidoLogin searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function ContenidoLogin({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const parametros = await searchParams;
  if (leerConfigSupabase().estado !== "ok") {
    return (
      <p role="alert" className="aviso aviso-error">
        Supabase no está configurado. Copie .env.example a .env.local con la URL y la
        clave publicable del proyecto.
      </p>
    );
  }
  return <FormularioLogin siguiente={destinoSeguro(parametros.siguiente)} />;
}
