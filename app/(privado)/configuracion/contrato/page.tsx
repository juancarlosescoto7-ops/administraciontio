import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { guardarPlantillaContrato } from "@/lib/contratos/acciones";
import {
  camposPlantillaContrato,
  esTipoContrato,
  TIPOS_CONTRATO,
  VARIABLES_CONTRATO,
  type TipoContrato,
} from "@/lib/contratos/definiciones";
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
        titulo="Contratos"
        descripcion="Textos de los contratos de membresías y servicios. Los contratos ya generados no cambian."
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
  const parametros = await searchParams;
  const tipo: TipoContrato = esTipoContrato(parametros.tipo) ? parametros.tipo : "membresia";
  const supabase = await createClient();
  const [{ data: vigente }, { count: versiones }, { count: contratos }] = await Promise.all([
    supabase.from("plantillas_contrato").select("version, contenido, created_at").eq("tipo", tipo)
      .order("version", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("plantillas_contrato").select("id", { count: "exact", head: true }).eq("tipo", tipo),
    tipo === "membresia"
      ? supabase.from("contratos_membresia").select("id", { count: "exact", head: true })
      : supabase.from("contratos_servicio").select("id", { count: "exact", head: true }).eq("tipo", tipo),
  ]);
  const { data: vistaPrevia, error: errorVista } = vigente
    ? await supabase.rpc("vista_previa_contrato", { p_contenido: vigente.contenido, p_tipo: tipo })
    : { data: null, error: null };
  const generacion = tipo === "membresia" ? "al registrar cada membresía" : "desde cada servicio, con el botón «Contrato»";

  return (
    <>
      <Pestanas tipo={tipo} />
      <AvisoOperacion parametros={parametros} mensajes={{ guardado: "Plantilla guardada como versión nueva." }} />
      <p className="mb-4 text-sm texto-tenue">
        {vigente ? `Texto vigente guardado el ${formatearFechaHora(vigente.created_at)}. ` : "Todavía no hay plantilla. "}
        El contrato se genera {generacion}. Versiones guardadas: {versiones ?? 0}. Contratos generados: {contratos ?? 0}.
        Cada vez que guarda se crea una versión nueva; las anteriores se conservan.
      </p>

      <Seccion titulo="Editar el texto" fija>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
          <div className="tarjeta p-4 sm:p-6">
            <FormularioOperacion
              key={tipo}
              campos={camposPlantillaContrato()}
              registro={{ contenido: vigente?.contenido ?? "" }}
              accion={guardarPlantillaContrato.bind(null, tipo)}
              textoEnviar="Guardar nueva versión"
            />
          </div>
          <aside className="tarjeta p-4 sm:p-6">
            <h3 className="mb-2 font-semibold">Variables disponibles</h3>
            <p className="mb-3 text-sm texto-tenue">Se reemplazan con los datos registrados al generar el contrato.</p>
            <dl className="flex flex-col gap-2 text-sm">
              {VARIABLES_CONTRATO[tipo].map((variable) => (
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

function Pestanas({ tipo }: { tipo: TipoContrato }) {
  return (
    <nav aria-label="Tipos de contrato" className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {TIPOS_CONTRATO.map((t) => (
        <Link
          key={t.valor}
          href={`/configuracion/contrato?tipo=${t.valor}`}
          aria-current={t.valor === tipo ? "page" : undefined}
          className={`boton shrink-0 ${t.valor === tipo ? "boton-primario" : "boton-secundario"}`}
        >
          {t.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
