import { notFound } from "next/navigation";
import { Suspense } from "react";
import { presentarAcceso } from "@/lib/auth/acceso";
import { etiquetaPermiso, MODULOS, RUTA_PERMISOS } from "@/lib/auth/permisos";
import { ETIQUETAS_ROL, rolPermiteFuncion } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { formatearFechaHora } from "@/lib/formato";
import { guardarPermisos } from "@/lib/permisos/acciones";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/tipos-bd";
import { Cargando, Encabezado, InsigniaEstado, SinPermiso } from "@/components/encabezado";
import { Notificacion } from "@/components/notificacion";
import { EditorPermisos } from "@/components/permisos/editor-permisos";

type PropsPermisos = PageProps<"/configuracion/permisos/[id]">;

export default function PaginaPermisosUsuario({ params, searchParams }: PropsPermisos) {
  return (
    <Suspense fallback={<Cargando />}>
      <ContenidoPermisosUsuario params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function lista(valor: Json | null): string[] {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return [];
  const claves = valor.permisos_denegados;
  return Array.isArray(claves) ? claves.filter((c): c is string => typeof c === "string") : [];
}

/** «Apagó: …; encendió: …» a partir de las listas de antes y después. */
function resumirCambio(antes: Json | null, despues: Json | null): string {
  const a = new Set(lista(antes));
  const d = new Set(lista(despues));
  const apagados = [...d].filter((c) => !a.has(c)).map(etiquetaPermiso);
  const encendidos = [...a].filter((c) => !d.has(c)).map(etiquetaPermiso);
  const partes = [
    apagados.length > 0 && `Apagó: ${apagados.join("; ")}`,
    encendidos.length > 0 && `Encendió: ${encendidos.join("; ")}`,
  ].filter(Boolean);
  return partes.join(" · ") || "Sin cambios";
}

async function ContenidoPermisosUsuario({ params, searchParams }: Pick<PropsPermisos, "params" | "searchParams">) {
  const usuario = await requerirUsuario();
  const volver = { href: RUTA_PERMISOS, etiqueta: "Permisos" };
  if (!usuario.esDesarrollador) {
    return (
      <>
        <Encabezado titulo="Permisos" volver={volver} />
        <SinPermiso mensaje="Solo la cuenta de desarrollador administra los permisos." />
      </>
    );
  }

  const { id } = await params;
  const { guardado } = await searchParams;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: perfil }, { data: eventos }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, nombre, correo, rol, activo, es_desarrollador, permisos_denegados, updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("bitacora")
      .select("id, fecha, motivo, antes, despues, actor:perfiles!bitacora_actor_id_fkey(nombre)")
      .eq("entidad", "perfiles")
      .eq("registro_id", id)
      .eq("accion", "guardar_permisos_usuario")
      .order("fecha", { ascending: false })
      .limit(20),
  ]);
  if (!perfil) notFound();

  const bloqueadasPorRol = MODULOS.flatMap((m) => m.funciones)
    .filter((f) => !rolPermiteFuncion(f.clave, perfil.rol))
    .map((f) => f.clave);

  return (
    <>
      <Encabezado
        titulo={`Permisos de ${perfil.nombre}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-all">{presentarAcceso(perfil.correo) ?? "Sin usuario"}</span>
            <span>· Rol {ETIQUETAS_ROL[perfil.rol]}</span>
            <InsigniaEstado activo={perfil.activo} />
          </span>
        }
        volver={volver}
      />

      {guardado === "1" && <Notificacion mensaje="Permisos guardados. Se aplican en la próxima pantalla que abra el usuario." />}

      {perfil.es_desarrollador ? (
        <p className="aviso aviso-info">
          La cuenta de desarrollador siempre tiene todos los módulos y funciones de su rol, para que nunca se quede
          sin acceso a esta pantalla.
        </p>
      ) : (
        <>
          {!perfil.activo && (
            <p className="aviso aviso-advertencia mb-4">
              Este usuario está inactivo y no puede entrar. Sus permisos se aplicarán cuando lo activen en Usuarios.
            </p>
          )}
          <EditorPermisos
            key={`${perfil.updated_at}-${perfil.permisos_denegados.join(",")}`}
            accion={guardarPermisos.bind(null, perfil.id)}
            denegadosIniciales={perfil.permisos_denegados}
            bloqueadasPorRol={bloqueadasPorRol}
          />
        </>
      )}

      <section aria-labelledby="titulo-bitacora-permisos" className="mt-8">
        <h2 id="titulo-bitacora-permisos" className="mb-3 text-lg font-semibold">
          Cambios de permisos
        </h2>
        {(eventos ?? []).length === 0 ? (
          <p className="texto-tenue">Sin cambios registrados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(eventos ?? []).map((evento) => (
              <li key={evento.id} className="tarjeta p-3 text-sm">
                <p>
                  <span className="font-medium">{formatearFechaHora(evento.fecha)}</span> ·{" "}
                  {evento.actor?.nombre ?? "Procedimiento de base de datos"}
                </p>
                <p className="mt-1">{resumirCambio(evento.antes, evento.despues)}</p>
                {evento.motivo && <p className="texto-tenue">Motivo: {evento.motivo}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
