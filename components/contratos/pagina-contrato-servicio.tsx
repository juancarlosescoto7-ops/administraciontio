import { notFound } from "next/navigation";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { generarContratoServicio } from "@/lib/contratos/acciones";
import { CONTRATO_SERVICIO, type TipoContratoServicio } from "@/lib/contratos/definiciones";
import { formatearFechaHora } from "@/lib/formato";
import type { ClienteSupabase } from "@/lib/operaciones";
import { createClient } from "@/lib/supabase/server";
import { Encabezado } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion } from "@/components/finanzas/operaciones";
import { MarcaLogo } from "@/components/marca";
import { BotonImprimir } from "@/components/membresias/imprimir";
import { BotonAccion } from "@/components/operaciones";

/** Estado y cliente del servicio, para el encabezado y para saber si admite contrato. */
async function leerServicio(supabase: ClienteSupabase, tipo: TipoContratoServicio, id: string) {
  const { data } =
    tipo === "alquiler"
      ? await supabase.from("alquileres").select("estado, cliente_id").eq("id", id).maybeSingle()
      : tipo === "transporte"
        ? await supabase.from("transportes").select("estado, cliente_id").eq("id", id).maybeSingle()
        : await supabase.from("traslados_ambulancia").select("estado, cliente_id").eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: cliente } = await supabase.from("clientes").select("nombre").eq("id", data.cliente_id).maybeSingle();
  return { estado: data.estado as string, cliente: cliente?.nombre ?? "" };
}

/**
 * Contrato vigente (el último generado) de un alquiler, viaje o traslado. Se
 * genera a pedido con la plantilla de su tipo; volver a generarlo conserva el
 * anterior. Imprimir no genera cargos ni cobros.
 */
export async function PaginaContratoServicio({
  tipo,
  params,
  searchParams,
}: {
  tipo: TipoContratoServicio;
  params: Promise<{ id: string }>;
  searchParams: ParametrosBusqueda;
}) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const supabase = await createClient();
  const [servicio, { data: contratos }] = await Promise.all([
    leerServicio(supabase, tipo, id),
    supabase.from("contratos_servicio").select("id, contenido, created_at").eq("tipo", tipo).eq("servicio_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!servicio) notFound();

  const { titulo, ruta, permiso } = CONTRATO_SERVICIO[tipo];
  const rutaServicio = `${ruta}/${id}`;
  const contrato = contratos?.[0];
  const anteriores = (contratos?.length ?? 0) - 1;
  const cancelado = servicio.estado === "cancelado";
  const generar = puede(permiso, usuario.rol) && !cancelado ? generarContratoServicio.bind(null, tipo, id) : null;

  return (
    <>
      <Encabezado
        titulo={titulo}
        descripcion={servicio.cliente}
        volver={{ href: rutaServicio, etiqueta: "Volver al servicio" }}
        acciones={contrato ? <BotonImprimir /> : undefined}
        className="mb-6 print:hidden"
      />
      <div className="print:hidden">
        <AvisoOperacion parametros={await searchParams} mensajes={{ generado: "Contrato generado con los datos actuales del servicio." }} />
      </div>
      {contrato ? (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <p className="text-sm texto-tenue">
              Generado el {formatearFechaHora(contrato.created_at)} con los datos de ese momento.
              {anteriores > 0 && ` Se conservan ${anteriores} versión(es) anterior(es).`} Si el servicio cambió (vehículo, conductor,
              fechas o precio), genérelo de nuevo.
            </p>
            {generar && <BotonAccion accion={generar} texto="Generar de nuevo" />}
          </div>
          <article className="contrato-imprimible tarjeta p-6 sm:p-10" data-contrato>
            <MarcaLogo alto={64} className="mx-auto mb-8" />
            <div className="mx-auto max-w-3xl font-serif text-[0.95rem] leading-relaxed whitespace-pre-wrap">{contrato.contenido}</div>
          </article>
        </>
      ) : (
        <div className="tarjeta flex flex-col gap-4 p-6">
          <p>
            Este servicio aún no tiene contrato. Se genera con la plantilla vigente y los datos actuales del cliente, el vehículo, el
            conductor, las fechas y el precio pactado; después puede imprimirlo o guardarlo como PDF.
          </p>
          {cancelado ? (
            <p className="text-sm texto-tenue">El servicio está cancelado: no se genera contrato.</p>
          ) : generar ? (
            <BotonAccion accion={generar} texto="Generar contrato" />
          ) : (
            <p className="text-sm texto-tenue">Solo el administrador o el operador pueden generarlo.</p>
          )}
        </div>
      )}
    </>
  );
}
