import { Suspense } from "react";
import { requerirUsuario } from "@/lib/auth/sesion";
import { formatearFechaHora } from "@/lib/formato";
import {
  esEstadoPeticion,
  ETIQUETAS_ESTADO_PETICION,
  INSIGNIA_ESTADO_PETICION,
  ordenarPeticiones,
} from "@/lib/peticiones/definiciones";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import { CambiarEstadoPeticion } from "@/components/peticiones/cambiar-estado";
import { FormularioPeticion } from "@/components/peticiones/formulario-peticion";

export default function PaginaPeticiones() {
  return (
    <Suspense fallback={<Cargando />}>
      <ContenidoPeticiones />
    </Suspense>
  );
}

async function ContenidoPeticiones() {
  await requerirUsuario();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("peticiones")
    .select("id, descripcion, pantalla, estado, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const peticiones = ordenarPeticiones(data ?? []);
  const abiertas = peticiones.filter((p) => p.estado === "pendiente" || p.estado === "en_proceso").length;

  return (
    <>
      <Encabezado
        titulo="Peticiones"
        descripcion="Cambios solicitados al sistema y su estado."
      />

      <FormularioPeticion />

      {error ? (
        <p role="alert" className="aviso aviso-error">
          No se pudo cargar el listado de peticiones.
        </p>
      ) : peticiones.length === 0 ? (
        <p className="aviso aviso-info">Todavía no hay peticiones registradas.</p>
      ) : (
        <>
          <p className="mb-3 text-sm texto-tenue">
            {abiertas} abierta{abiertas === 1 ? "" : "s"} de {peticiones.length}
          </p>
          <ul className="flex flex-col gap-2">
            {peticiones.map((peticion) => {
              const estado = esEstadoPeticion(peticion.estado) ? peticion.estado : "pendiente";
              return (
                <li key={peticion.id} className="tarjeta flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="break-words whitespace-pre-wrap">{peticion.descripcion}</p>
                    <p className="flex flex-wrap items-center gap-2 text-sm texto-tenue">
                      <span className={`insignia ${INSIGNIA_ESTADO_PETICION[estado]}`}>{ETIQUETAS_ESTADO_PETICION[estado]}</span>
                      <span>{formatearFechaHora(peticion.created_at)}</span>
                      {peticion.pantalla && <span className="break-all">· {peticion.pantalla}</span>}
                    </p>
                  </div>
                  <CambiarEstadoPeticion id={peticion.id} actual={estado} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
