import Link from "next/link";
import { Suspense } from "react";
import { presentarAcceso } from "@/lib/auth/acceso";
import { resumirDenegados, RUTA_PERMISOS } from "@/lib/auth/permisos";
import { ETIQUETAS_ROL } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, InsigniaEstado, SinPermiso } from "@/components/encabezado";

export default function PaginaPermisos() {
  return (
    <Suspense fallback={<Cargando />}>
      <ContenidoPermisos />
    </Suspense>
  );
}

function describir(denegados: string[]): { texto: string; clase: string } {
  const { modulos, funciones } = resumirDenegados(denegados);
  if (modulos === 0 && funciones === 0) return { texto: "Acceso a todo", clase: "insignia-activo" };
  const partes = [
    modulos > 0 && `${modulos} ${modulos === 1 ? "módulo apagado" : "módulos apagados"}`,
    funciones > 0 && `${funciones} ${funciones === 1 ? "función apagada" : "funciones apagadas"}`,
  ].filter(Boolean);
  return { texto: partes.join(" · "), clase: "insignia-advertencia" };
}

async function ContenidoPermisos() {
  const usuario = await requerirUsuario();
  if (!usuario.esDesarrollador) {
    return (
      <>
        <Encabezado titulo="Permisos" />
        <SinPermiso mensaje="Solo la cuenta de desarrollador administra los permisos." />
      </>
    );
  }

  const supabase = await createClient();
  const { data: perfiles, error } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, rol, activo, es_desarrollador, permisos_denegados")
    .order("activo", { ascending: false })
    .order("nombre");

  return (
    <>
      <Encabezado
        titulo="Permisos"
        descripcion="Elija un usuario para encender o apagar sus módulos y funciones."
      />

      {error ? (
        <p role="alert" className="aviso aviso-error">
          No se pudo cargar el listado de usuarios.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(perfiles ?? []).map((perfil) => {
            const resumen = perfil.es_desarrollador
              ? { texto: "Desarrollador · todo siempre", clase: "insignia-info" }
              : describir(perfil.permisos_denegados);
            return (
              <li key={perfil.id}>
                <Link
                  href={`${RUTA_PERMISOS}/${perfil.id}`}
                  className="tarjeta tarjeta-enlace flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium break-words">
                      {perfil.nombre}
                      {perfil.id === usuario.id && <span className="texto-tenue"> (usted)</span>}
                    </span>
                    <span className="text-sm texto-tenue break-all">
                      {presentarAcceso(perfil.correo) ?? "Sin usuario"} · {ETIQUETAS_ROL[perfil.rol]}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`insignia ${resumen.clase}`}>{resumen.texto}</span>
                    <InsigniaEstado activo={perfil.activo} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
