import Link from "next/link";
import { ETIQUETAS_ROL, puedeAdministrarUsuarios } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { formatearFechaHora } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Encabezado, InsigniaEstado, SinPermiso } from "@/components/encabezado";

export default async function PaginaUsuarios() {
  const usuario = await requerirUsuario();
  if (!puedeAdministrarUsuarios(usuario.rol)) {
    return (
      <>
        <Encabezado titulo="Usuarios" />
        <SinPermiso mensaje="Solo el administrador gestiona los usuarios." />
      </>
    );
  }

  const supabase = await createClient();
  const { data: perfiles, error } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, rol, activo, created_at")
    .order("activo", { ascending: false })
    .order("nombre");

  return (
    <>
      <Encabezado
        titulo="Usuarios"
        descripcion="Perfiles internos y roles. Sin registro público: las cuentas se crean en Supabase."
      />

      <div className="aviso aviso-advertencia mb-4 text-sm">
        <p className="font-medium">Para agregar un usuario</p>
        <ol className="mt-1 list-decimal pl-5">
          <li>En Supabase Dashboard › Authentication › Users, use «Add user» con su correo y una contraseña.</li>
          <li>El usuario aparecerá aquí como inactivo, con rol Operador.</li>
          <li>Ábralo, asigne el rol, márquelo como activo e indique el motivo.</li>
        </ol>
      </div>

      {error ? (
        <p role="alert" className="aviso aviso-error">
          No se pudo cargar el listado de usuarios.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(perfiles ?? []).map((perfil) => (
            <li key={perfil.id}>
              <Link
                href={`/configuracion/usuarios/${perfil.id}`}
                className="tarjeta flex flex-col gap-1 p-4 hover:border-primario sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium break-words">
                    {perfil.nombre}
                    {perfil.id === usuario.id && <span className="texto-tenue"> (usted)</span>}
                  </span>
                  <span className="text-sm texto-tenue break-all">{perfil.correo ?? "Sin correo"}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span>{ETIQUETAS_ROL[perfil.rol]}</span>
                  <InsigniaEstado activo={perfil.activo} />
                  <span className="texto-tenue">Alta: {formatearFechaHora(perfil.created_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
