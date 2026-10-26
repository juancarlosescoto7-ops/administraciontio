import { connection } from "next/server";
import { Suspense } from "react";
import {
  verificarConexionSupabase,
  type EstadoConexion,
} from "@/lib/supabase/estado-conexion";

export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Etapa E0 · Arranque técnico
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">ERP interno</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Proyecto inicializado. Los módulos del sistema se habilitarán en las
          siguientes etapas.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Conexión con el backend</h2>
        <Suspense
          fallback={<p className="text-zinc-500">Verificando conexión…</p>}
        >
          <EstadoBackend />
        </Suspense>
      </section>

      <p className="text-sm text-zinc-500">
        Módulos de operación y finanzas: Próximamente.
      </p>
    </main>
  );
}

async function EstadoBackend() {
  // La verificación ocurre en cada solicitud, nunca durante el build.
  await connection();
  const estado = await verificarConexionSupabase();
  const { titulo, detalle, correcto } = describirEstado(estado);

  return (
    <div className="flex flex-col gap-1">
      <p
        className={
          correcto
            ? "font-medium text-emerald-700 dark:text-emerald-400"
            : "font-medium text-amber-700 dark:text-amber-400"
        }
      >
        {titulo}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{detalle}</p>
    </div>
  );
}

function describirEstado(estado: EstadoConexion) {
  switch (estado.estado) {
    case "conectado":
      return {
        correcto: true,
        titulo: "Conexión con Supabase validada",
        detalle: `El servidor obtuvo respuesta de Supabase en ${estado.latenciaMs} ms.`,
      };
    case "sin_configurar":
      return {
        correcto: false,
        titulo: "Supabase no configurado",
        detalle:
          "Copie .env.example a .env.local y complete la URL y la clave publicable del proyecto de desarrollo.",
      };
    case "configuracion_invalida":
      return {
        correcto: false,
        titulo: "Configuración de Supabase inválida",
        detalle: estado.motivo,
      };
    case "clave_rechazada":
      return {
        correcto: false,
        titulo: "Supabase rechazó la clave",
        detalle:
          "El proyecto respondió, pero no aceptó la clave publicable configurada.",
      };
    case "error":
      return {
        correcto: false,
        titulo: "No se pudo validar la conexión",
        detalle: estado.detalle,
      };
  }
}
