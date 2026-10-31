import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/tipos-bd";
import { formatearFecha, formatearMoneda, hoyEnTegucigalpa } from "@/lib/formato";
import { proyectarCuotas } from "@/lib/membresias/plan-pagos";
import { BotonImprimir } from "@/components/membresias/imprimir";
import { Cargando, Encabezado } from "@/components/encabezado";

export default function Pagina({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Cargando />}><Contenido params={params} /></Suspense>;
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await requerirUsuario();
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: m, error: em }, { data: saldo, error: es }] = await Promise.all([
    supabase.from("membresias").select("*, clientes(nombre), planes(nombre)").eq("id", id).maybeSingle(),
    supabase.from("saldos_membresias").select("pendiente").eq("id", id).maybeSingle(),
  ]);
  if (em || es) throw new Error("No se pudo consultar la membresía.");
  if (!m) notFound();
  // Paginación: un contrato largo no debe perder cuotas silenciosamente.
  const emitidas: Database["public"]["Views"]["saldos_periodos"]["Row"][] = [];
  for (let desde = 0; ; desde += 500) {
    const { data, error } = await supabase.from("saldos_periodos").select("*").eq("membresia_id", id).order("inicio").range(desde, desde + 499);
    if (error) throw new Error("No se pudieron consultar las cuotas.");
    emitidas.push(...data);
    if (data.length < 500) break;
  }
  const hoy = hoyEnTegucigalpa();
  const futuras = m.fecha_fin && m.estado !== "cancelada" && m.fecha_fin >= hoy
    ? proyectarCuotas(m.proxima_renovacion, m.dia_ancla, m.fecha_fin).filter((p) => p.inicio >= hoy && !emitidas.some((e) => e.inicio === p.inicio)) : [];
  const filas = [
    ...emitidas.map((p) => ({ inicio: p.inicio!, fin: p.fin!, precio: p.precio, pagado: p.aplicado,
      pendiente: p.pendiente, estado: p.cargo_estado === "anulado" ? "Anulada" : Number(p.pendiente) === 0 ? "Pagada / sin saldo" : p.vencida ? "Vencida" : "Pendiente" })),
    ...futuras.map((p) => ({ ...p, precio: m.precio_pactado, pagado: null, pendiente: null, estado: "Proyectada (no emitida)" })),
  ].sort((a, b) => a.inicio.localeCompare(b.inicio));
  return <>
    <Encabezado titulo="Plan de pagos" volver={{ href: `/membresias/${id}`, etiqueta: "Membresía" }} acciones={<BotonImprimir />} className="mb-6 print:hidden" />
    <article className="contrato-imprimible tarjeta p-6">
      <h1 className="text-xl font-semibold">Estado y plan de cuotas de membresía</h1>
      <p>{m.clientes?.nombre} · {m.planes?.nombre}</p>
      <p>Contrato: {id}</p>
      <p>Inicio: {formatearFecha(m.fecha_inicio)} · Vencimiento: {m.fecha_fin ? formatearFecha(m.fecha_fin) : "Por definir por el dueño"}</p>
      <p>Emitido el {formatearFecha(hoy)} · Saldo pendiente de cuotas emitidas: {formatearMoneda(saldo?.pendiente)}</p>
      <p className="my-4 text-sm">Cada cuota vence al inicio de su período. Las cuotas proyectadas son informativas, dependen de las condiciones vigentes y de mantener la membresía activa; no son cargos ni deuda emitida. La suspensión puede omitir períodos. El saldo a favor del cliente solo se refleja al aplicarlo a las cuotas.</p>
      {!m.fecha_fin && <p className="my-4">El dueño debe establecer el vencimiento para mostrar todas las cuotas futuras del contrato.</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr>{["Cuota", "Fecha de pago", "Hasta", "Importe HNL", "Aplicado HNL", "Pendiente HNL", "Estado"].map((t) => <th className="border-b p-2" key={t}>{t}</th>)}</tr></thead>
        <tbody>{filas.map((p, i) => <tr key={p.inicio} className="break-inside-avoid">
          <td className="p-2">{i + 1}</td><td className="p-2">{formatearFecha(p.inicio)}</td><td className="p-2">{formatearFecha(p.fin)}</td>
          <td className="p-2">{formatearMoneda(p.precio)}</td><td className="p-2">{p.pagado === null ? "—" : formatearMoneda(p.pagado)}</td>
          <td className="p-2">{p.pendiente === null ? "—" : formatearMoneda(p.pendiente)}</td><td className="p-2">{p.estado}</td>
        </tr>)}</tbody>
      </table></div>
      {!filas.length && <p className="my-4">No hay cuotas emitidas ni proyectadas.</p>}
    </article>
  </>;
}
