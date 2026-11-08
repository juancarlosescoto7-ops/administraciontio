import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requerirUsuario } from "@/lib/auth/sesion";
import { puede } from "@/lib/auth/roles";
import { formatearVoucher, importeEnLetras } from "@/lib/bonos/lineas";
import { esUuid } from "@/lib/catalogos/presentacion";
import { ETIQUETAS_METODO } from "@/lib/finanzas/definiciones";
import { aCentavos } from "@/lib/finanzas/montos";
import { SERVICIOS_GASTO, type TipoServicioGasto } from "@/lib/finanzas/servicios";
import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import { AvisoOperacion } from "@/components/finanzas/operaciones";
import { MarcaLogo } from "@/components/marca";
import { BotonImprimir } from "@/components/membresias/imprimir";

export default function PaginaComprobante({ params, searchParams }: PageProps<"/comprobantes/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ params, searchParams }: Pick<PageProps<"/comprobantes/[id]">, "params" | "searchParams">) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  const parametros = await searchParams;
  if (!esUuid(id)) notFound();
  const supabase = await createClient();
  // La RLS decide: administración y finanzas ven todos; el operador, los de servicios.
  const { data: p, error } = await supabase
    .from("pagos_gasto")
    .select("id, gasto_id, fecha, monto, metodo, referencia, estado, motivo_reverso, reversado_en, created_at, creado_por, cuentas_dinero(nombre, tipo), comprobantes_pago(numero)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No se pudo consultar el pago.");
  if (!p) notFound();

  const [{ data: gasto }, { data: persona }, { data: relacion }, { data: autor }] = await Promise.all([
    supabase.from("saldos_gastos").select("concepto, monto, pagado, pendiente, categoria_nombre, proveedor_nombre, estado").eq("id", p.gasto_id).maybeSingle(),
    supabase.from("gastos_personal").select("nombre_destinatario, empleado_id, conductor_id").eq("gasto_id", p.gasto_id).maybeSingle(),
    supabase.from("gastos_servicio").select("membresia_id, alquiler_id, transporte_id, traslado_id").eq("gasto_id", p.gasto_id).maybeSingle(),
    p.creado_por ? supabase.from("perfiles").select("nombre").eq("id", p.creado_por).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const servicio = relacion ? await describirServicio(supabase, relacion) : null;
  const destinatario = persona?.nombre_destinatario ?? gasto?.proveedor_nombre ?? null;
  const tipoDestinatario = persona?.empleado_id ? "Empleado" : persona?.conductor_id ? "Conductor" : gasto?.proveedor_nombre ? "Proveedor / prestador" : null;
  const reversado = p.estado === "reversado";
  const volver = servicio ? { href: servicio.href, etiqueta: servicio.etiqueta } : puede("gestionarGastos", usuario) ? { href: `/finanzas/gastos/${p.gasto_id}`, etiqueta: "Gasto" } : { href: "/", etiqueta: "Inicio" };
  const numero = formatearVoucher(p.comprobantes_pago?.numero);

  return (
    <>
      <Encabezado titulo={`Voucher ${numero}`} volver={volver} acciones={<BotonImprimir />} className="mb-6 print:hidden" />
      <div className="print:hidden">
        <AvisoOperacion parametros={parametros} mensajes={{ nuevo: "Pago registrado. Imprima o guarde el voucher." }} />
      </div>
      <article className="contrato-imprimible tarjeta mx-auto flex max-w-2xl flex-col gap-5 p-6 sm:p-8" data-voucher>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <MarcaLogo alto={52} />
          <div className="text-right">
            <p className="text-lg font-semibold tracking-tight">Comprobante de pago</p>
            <p className="font-mono text-base" data-numero-voucher>N.º {numero}</p>
            <p className="text-sm">Fecha: {formatearFecha(p.fecha)}</p>
          </div>
        </header>

        {reversado && (
          <p className="rounded border-2 border-current p-3 text-center font-semibold uppercase text-[var(--peligro)]">
            Pago reversado el {formatearFechaHora(p.reversado_en)}: este voucher no es válido.
            {p.motivo_reverso && <span className="block text-sm font-normal normal-case">Motivo: {p.motivo_reverso}</span>}
          </p>
        )}

        <div className="rounded-lg border border-borde p-4 text-center">
          <p className="text-sm texto-tenue">Importe pagado</p>
          <p className="text-3xl font-semibold tabular-nums" data-importe-voucher>{formatearMoneda(p.monto)}</p>
          <p className="mt-1 text-sm">{importeEnLetras(aCentavos(p.monto) ?? 0)}</p>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Fila etiqueta="Pagado a" valor={destinatario ? `${destinatario}${tipoDestinatario ? ` (${tipoDestinatario.toLowerCase()})` : ""}` : "—"} />
          <Fila etiqueta="Concepto" valor={gasto?.concepto ?? "—"} />
          <Fila etiqueta="Tipo de gasto" valor={gasto?.categoria_nombre ?? "—"} />
          <Fila etiqueta="Servicio" valor={servicio ? <Link href={servicio.href} className="hover:underline">{servicio.descripcion}</Link> : "Gasto general"} />
          <Fila etiqueta="Forma de pago" valor={`${ETIQUETAS_METODO[p.metodo]}${p.referencia ? ` · Ref. ${p.referencia}` : ""}`} />
          <Fila etiqueta="Sale de" valor={p.cuentas_dinero ? `${p.cuentas_dinero.nombre} (${p.cuentas_dinero.tipo === "caja" ? "caja" : "banco"})` : "—"} />
          {gasto && (
            <Fila
              etiqueta="Estado del gasto"
              valor={`Total ${formatearMoneda(gasto.monto)} · pagado ${formatearMoneda(gasto.pagado)} · pendiente ${formatearMoneda(gasto.pendiente)}`}
            />
          )}
          <Fila etiqueta="Registrado" valor={`${formatearFechaHora(p.created_at)}${autor?.nombre ? ` por ${autor.nombre}` : ""}`} />
        </dl>

        <div className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-2">
          <Firma texto="Entregado por" nombre={autor?.nombre ?? null} />
          <Firma texto="Recibí conforme" nombre={destinatario} />
        </div>
        <p className="text-center text-xs texto-tenue">Comprobante interno de pago. No es factura fiscal.</p>
      </article>
    </>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm texto-tenue">{etiqueta}</dt>
      <dd className="font-medium break-words">{valor}</dd>
    </div>
  );
}

function Firma({ texto, nombre }: { texto: string; nombre: string | null }) {
  return (
    <div className="flex flex-col items-center gap-1 text-sm">
      <span className="h-12 w-full border-b border-current" aria-hidden="true" />
      <span className="font-medium">{texto}</span>
      {nombre && <span className="texto-tenue">{nombre}</span>}
    </div>
  );
}

type Relacion = { membresia_id: string | null; alquiler_id: string | null; transporte_id: string | null; traslado_id: string | null };

async function describirServicio(supabase: Awaited<ReturnType<typeof createClient>>, r: Relacion) {
  const tipo: TipoServicioGasto = r.membresia_id ? "membresia" : r.alquiler_id ? "alquiler" : r.transporte_id ? "transporte" : "traslado";
  const servicioId = (r.membresia_id ?? r.alquiler_id ?? r.transporte_id ?? r.traslado_id)!;
  const { etiqueta, ruta } = SERVICIOS_GASTO[tipo];
  let detalle: string | null = null;
  if (tipo === "membresia") {
    const { data } = await supabase.from("saldos_membresias").select("cliente_nombre, plan_nombre").eq("id", servicioId).maybeSingle();
    detalle = data ? `${data.cliente_nombre} · ${data.plan_nombre}` : null;
  } else if (tipo === "alquiler") {
    const { data } = await supabase.from("saldos_alquileres").select("cliente_nombre, vehiculo_nombre, entrega_prevista").eq("id", servicioId).maybeSingle();
    detalle = data ? `${data.cliente_nombre} · ${data.vehiculo_nombre} · ${formatearFechaHora(data.entrega_prevista)}` : null;
  } else if (tipo === "transporte") {
    const { data } = await supabase.from("saldos_transportes").select("cliente_nombre, origen, destino, inicio_previsto").eq("id", servicioId).maybeSingle();
    detalle = data ? `${data.cliente_nombre} · ${data.origen} → ${data.destino} · ${formatearFechaHora(data.inicio_previsto)}` : null;
  } else {
    const { data } = await supabase.from("saldos_traslados").select("cliente_nombre, origen, inicio_previsto").eq("id", servicioId).maybeSingle();
    detalle = data ? `${data.cliente_nombre} · desde ${data.origen} · ${formatearFechaHora(data.inicio_previsto)}` : null;
  }
  return { href: `${ruta}/${servicioId}`, etiqueta, descripcion: detalle ? `${etiqueta}: ${detalle}` : etiqueta };
}
