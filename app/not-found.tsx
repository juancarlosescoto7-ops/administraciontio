import Link from "next/link";
import { MarcaLogo } from "@/components/marca";

export default function NoEncontrado() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="tarjeta flex w-full max-w-md flex-col items-center p-6 text-center sm:p-8">
        <MarcaLogo alto={56} className="mb-5" />
        <h1 className="text-xl font-semibold">Página no encontrada</h1>
        <p className="mt-2 texto-tenue">
          La página o el registro solicitado no existe, o este módulo aún no está disponible.
        </p>
        <Link href="/" className="boton boton-primario mt-6">
          Ir al panel
        </Link>
      </div>
    </main>
  );
}
