import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ETIQUETAS_ROL, esRol, puedeAdministrarUsuarios } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { formatearFechaHora } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/tipos-bd";
import { actualizarUsuario } from "@/lib/usuarios/acciones";
import { Cargando, Encabezado, InsigniaEstado, SinPermiso } from "@/components/encabezado";
import { FormularioUsuario } from "@/components/usuarios/formulario-usuario";

function resumirCambio(antes: Json | null, despues: Json | null): string {
  const leer = (valor: Json | null) =>
    valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
  const a = leer(antes);
  const d = leer(despues);
  const partes: string[] = [];
  if (a.nombre !== d.nombre && d.nombre !== undefined) partes.push(`nombre: ${String(d.nombre)}`);
  if (a.rol !== d.rol && esRol(d.rol)) partes.push(`rol: ${ETIQUETAS_ROL[d.rol]}`);
  if (a.activo !== d.activo && typeof d.activo === "boolean") {
    partes.push(d.activo ? "activado" : "desactivado");
  }
  return partes.join(", ") || "sin cambios de acceso";
}

type PropsUsuario = PageProps<"/configuracion/usuarios/[id]">;

export default function PaginaUsuario({ params, searchParams }: PropsUsuario) {
  return (
    <Suspense fallback={<Cargando />}>
      <ContenidoUsuario params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoUsuario({ params, searchParams }: Pick<PropsUsuario, "params" | "searchParams">) {
  const usuario = await requerirUsuario();
  const volver = { href: "/configuracion/usuarios", etiqueta: "Usuarios" };
  if (!puedeAdministrarUsuarios(usuario.rol)) {
    return (
      <>
        <Encabezado titulo="Usuario" volver={volver} />
        <SinPermiso mensaje="Solo el administrador gestiona los usuarios." />
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
      .select("id, nombre, correo, rol, activo, created_at, updated_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("bitacora")
      .select("id, fecha, accion, motivo, antes, despues, actor:perfiles!bitacora_actor_id_fkey(nombre)")
      .eq("entidad", "perfiles")
      .eq("registro_id", id)
      .order("fecha", { ascending: false })
      .limit(20),
  ]);
  if (!perfil) notFound();

  return (
    <>
      <Encabezado
        titulo={perfil.nombre}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-all">{perfil.correo ?? "Sin correo"}</span>
            <InsigniaEstado activo={perfil.activo} />
          </span>
        }
        volver={volver}
      />

      {guardado === "1" && (
        <p role="status" className="aviso aviso-exito mb-4">
          Usuario actualizado.
        </p>
      )}

      <div className="tarjeta p-4 sm:p-6">
        <FormularioUsuario
          accion={actualizarUsuario.bind(null, perfil.id)}
          esPropio={perfil.id === usuario.id}
          estadoInicial={{
            revision: 0,
            valores: {
              nombre: perfil.nombre,
              rol: perfil.rol,
              activo: perfil.activo ? "on" : "",
              motivo: "",
            },
            errores: {},
            error: null,
          }}
        />
      </div>

      <section aria-labelledby="titulo-bitacora" className="mt-8">
        <h2 id="titulo-bitacora" className="mb-3 text-lg font-semibold">
          Bitácora
        </h2>
        {(eventos ?? []).length === 0 ? (
          <p className="texto-tenue">Sin cambios registrados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(eventos ?? []).map((evento) => (
              <li key={evento.id} className="tarjeta p-3 text-sm">
                <p>
                  <span className="font-medium">{formatearFechaHora(evento.fecha)}</span> ·{" "}
                  {evento.actor?.nombre ?? "Procedimiento de base de datos"} ·{" "}
                  {resumirCambio(evento.antes, evento.despues)}
                </p>
                {evento.motivo && <p className="texto-tenue">Motivo: {evento.motivo}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-3 text-sm texto-tenue">
        Alta: {formatearFechaHora(perfil.created_at)} · Última modificación:{" "}
        {formatearFechaHora(perfil.updated_at)}
      </p>
    </>
  );
}
