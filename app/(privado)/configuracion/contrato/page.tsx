import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { guardarPlantillaContrato } from "@/lib/membresias/acciones";
import { camposPlantillaContrato, VARIABLES_CONTRATO } from "@/lib/membresias/definiciones";
import { formatearFechaHora } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioOperacion } from "@/components/finanzas/operaciones";
import { Seccion } from "@/components/finanzas/resumen";

export default function PaginaPlantillaContrato({ searchParams }: PageProps<"/configuracion/contrato">) {
  return (
    <>
      <Encabezado
        titulo="Contrato de membresía"
        descripcion="Texto del contrato que se genera al registrar cada membresía. Los contratos ya generados no cambian."
      />
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("gestionarContrato", usuario.rol)) {
    return <SinPermiso mensaje="La plantilla del contrato la edita el administrador." />;
  }
  const supabase = await createClient();
  const [{ data: vigente }, { count: contratos }] = await Promise.all([
    supabase.from("plantillas_contrato").select("version, contenido, created_at").order("version", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("contratos_membresia").select("id", { count: "exact", head: true }),
  ]);
  const { data: vistaPrevia, error: errorVista } = vigente
    ? await supabase.rpc("vista_previa_contrato", { p_contenido: vigente.contenido })
    : { data: null, error: null };

  return (
    <>
      <AvisoOperacion parametros={await searchParams} mensajes={{ guardado: "Plantilla guardada como versión nueva." }} />
      <p className="mb-4 text-sm texto-tenue">
        {vigente
          ? `Versión vigente: ${vigente.version}, guardada el ${formatearFechaHora(vigente.created_at)}. `
          : "Todavía no hay plantilla. "}
        Contratos generados: {contratos ?? 0}. Cada vez que guarda se crea una versión nueva; las anteriores se conservan.
      </p>

      <Seccion titulo="Editar el texto" fija>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
          <div className="tarjeta p-4 sm:p-6">
            <FormularioOperacion
              campos={camposPlantillaContrato()}
              registro={{ contenido: vigente?.contenido ?? "" }}
              accion={guardarPlantillaContrato}
              textoEnviar="Guardar nueva versión"
            />
          </div>
          <aside className="tarjeta p-4 sm:p-6">
            <h3 className="mb-2 font-semibold">Variables disponibles</h3>
            <p className="mb-3 text-sm texto-tenue">Se reemplazan con los datos de la membresía al registrarla.</p>
            <dl className="flex flex-col gap-2 text-sm">
              {VARIABLES_CONTRATO.map((variable) => (
                <div key={variable.nombre}>
                  <dt className="font-mono text-[0.8rem] break-all">{`{{${variable.nombre}}}`}</dt>
                  <dd className="texto-tenue">{variable.descripcion}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </Seccion>

      <Seccion titulo="Vista previa con datos de ejemplo" fija>
        {errorVista ? (
          <p role="alert" className="aviso aviso-error">No se pudo generar la vista previa.</p>
        ) : (
          <article className="tarjeta p-6 sm:p-10" data-vista-previa>
            <div className="mx-auto max-w-3xl font-serif text-[0.95rem] leading-relaxed whitespace-pre-wrap">{vistaPrevia}</div>
          </article>
        )}
      </Seccion>
    </>
  );
}
