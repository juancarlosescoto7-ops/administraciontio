import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { generarContrato } from "@/lib/membresias/acciones";
import { formatearFechaHora } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion } from "@/components/finanzas/operaciones";
import { BotonImprimir } from "@/components/membresias/imprimir";
import { BotonAccion } from "@/components/operaciones";

export default function PaginaContrato({ params, searchParams }: PageProps<"/membresias/[id]/contrato">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: membresia }, { data: contrato }] = await Promise.all([
    supabase.from("saldos_membresias").select("id, cliente_nombre, plan_nombre").eq("id", id).maybeSingle(),
    supabase.from("contratos_membresia").select("contenido, plantilla_version, created_at").eq("membresia_id", id).maybeSingle(),
  ]);
  if (!membresia) notFound();
  const ruta = `/membresias/${id}`;

  return (
    <>
      <Encabezado
        titulo="Contrato de membresía"
        descripcion={`${membresia.cliente_nombre} · ${membresia.plan_nombre}`}
        volver={{ href: ruta, etiqueta: "Membresía" }}
        acciones={contrato ? <BotonImprimir /> : undefined}
        className="mb-6 print:hidden"
      />
      <div className="print:hidden">
        <AvisoOperacion parametros={await searchParams} mensajes={{ generado: "Contrato generado con la plantilla vigente." }} />
      </div>
      {contrato ? (
        <>
          <p className="mb-4 text-sm texto-tenue print:hidden">
            Texto congelado el {formatearFechaHora(contrato.created_at)} con la versión {contrato.plantilla_version} de la plantilla. Los
            cambios posteriores en la plantilla o en las condiciones no lo modifican.
          </p>
          <article className="contrato-imprimible tarjeta p-6 sm:p-10" data-contrato>
            <div className="mx-auto max-w-3xl font-serif text-[0.95rem] leading-relaxed whitespace-pre-wrap">{contrato.contenido}</div>
          </article>
        </>
      ) : (
        <div className="tarjeta flex flex-col gap-4 p-6">
          <p>
            Esta membresía se registró antes de que existiera el contrato. Puede generarlo ahora con la plantilla vigente y los datos
            actuales de la membresía; quedará congelado.
          </p>
          {puede("registrarMembresia", usuario.rol) ? (
            <BotonAccion accion={generarContrato.bind(null, id)} texto="Generar contrato" />
          ) : (
            <p className="text-sm texto-tenue">Solo el administrador o el operador pueden generarlo.</p>
          )}
        </div>
      )}
    </>
  );
}
