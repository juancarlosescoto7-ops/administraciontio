import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { estadoInicial } from "@/lib/catalogos/estado";
import { esUuid, primerValor } from "@/lib/catalogos/presentacion";
import { esFechaValida, limpiarBusqueda, valoresDesdeRegistro } from "@/lib/catalogos/validacion";
import { registrarMembresiaCompleta } from "@/lib/membresias/acciones";
import {
  camposAltaMembresia,
  camposBeneficiarioNuevo,
  camposCondiciones,
  CAMPO_TITULAR_BENEFICIARIO,
  ETIQUETAS_MODALIDAD,
  PREFIJO_BENEFICIARIO,
} from "@/lib/membresias/definiciones";
import { periodosDesde } from "@/lib/membresias/fechas";
import { formatearFecha, formatearMoneda, hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { BuscarCliente, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { Datos, Seccion } from "@/components/finanzas/resumen";
import { FormularioAltaMembresia } from "@/components/membresias/formulario-alta";

export default function PaginaNuevaMembresia({ searchParams }: PageProps<"/membresias/nueva">) {
  return (
    <>
      <Encabezado titulo="Nueva membresía" volver={{ href: "/membresias", etiqueta: "Membresías" }} />
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("registrarMembresia", usuario.rol)) {
    return <SinPermiso mensaje="Su rol no permite registrar membresías." />;
  }
  const parametros = await searchParams;
  const clienteId = primerValor(parametros.cliente);
  if (!esUuid(clienteId)) {
    return (
      <>
        <p className="mb-4 texto-tenue">1. Busque y elija el cliente titular. Si no está registrado, use «Cliente nuevo».</p>
        <BuscarCliente ruta="/membresias/nueva" busqueda={limpiarBusqueda(primerValor(parametros.q))} />
      </>
    );
  }

  const hoy = hoyEnTegucigalpa();
  const planId = primerValor(parametros.plan);
  const inicioParametro = primerValor(parametros.inicio);
  const inicio = inicioParametro && esFechaValida(inicioParametro) ? inicioParametro : null;

  const supabase = await createClient();
  const [{ data: cliente }, { data: planes }, { data: beneficiarios }] = await Promise.all([
    supabase.from("clientes").select("id, nombre").eq("id", clienteId).eq("activo", true).maybeSingle(),
    supabase.from("planes").select("id, nombre, precio_mensual, cupo_mensual, modalidad_cupo, dias_gracia").eq("activo", true).order("nombre"),
    supabase.from("beneficiarios").select("id, nombre, identificacion, fecha_nacimiento").eq("activo", true).order("nombre").limit(300),
  ]);
  if (!cliente) {
    return <BuscarCliente ruta="/membresias/nueva" busqueda="" />;
  }
  const plan = (planes ?? []).find((p) => p.id === planId) ?? null;

  return (
    <>
      <p className="mb-4">
        Cliente titular: <span className="font-medium">{cliente.nombre}</span> ·{" "}
        <Link href="/membresias/nueva" className="text-sm texto-tenue hover:underline">
          cambiar
        </Link>
      </p>

      {(planes ?? []).length === 0 ? (
        <p className="aviso aviso-advertencia">No hay planes activos. El administrador debe registrarlos en Planes de membresía.</p>
      ) : (
        <form method="get" className="tarjeta mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <input type="hidden" name="cliente" value={cliente.id} />
          <label className="campo">
            <span className="campo-etiqueta">2. Plan</span>
            <select className="entrada" name="plan" defaultValue={plan?.id ?? ""} required>
              <option value="">Seleccione…</option>
              {(planes ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {formatearMoneda(p.precio_mensual)}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span className="campo-etiqueta">Fecha de inicio</span>
            <input className="entrada" type="date" name="inicio" defaultValue={inicio ?? hoy} required />
          </label>
          <button type="submit" className="boton boton-secundario">
            Revisar condiciones
          </button>
        </form>
      )}

      {plan && inicio && (
        <Revision
          clienteId={cliente.id}
          plan={plan}
          inicio={inicio}
          hoy={hoy}
          beneficiarios={(beneficiarios ?? []).map((b) => ({
            id: b.id,
            nombre: b.nombre,
            detalle: [b.identificacion, b.fecha_nacimiento ? `nac. ${formatearFecha(b.fecha_nacimiento)}` : null].filter(Boolean).join(" · ") || null,
          }))}
          administrador={puede("gestionarMembresia", usuario.rol)}
        />
      )}
    </>
  );
}

function Revision({
  clienteId,
  plan,
  inicio,
  hoy,
  beneficiarios,
  administrador,
}: {
  clienteId: string;
  plan: { id: string; nombre: string; precio_mensual: number; cupo_mensual: number; modalidad_cupo: "compartido" | "individual"; dias_gracia: number };
  inicio: string;
  hoy: string;
  beneficiarios: { id: string; nombre: string; detalle: string | null }[];
  administrador: boolean;
}) {
  const periodos = periodosDesde(inicio, 3);
  // Mensualidades que se generarían hoy si la fecha de inicio es pasada.
  const hastaHoy = inicio <= hoy ? periodosDesde(inicio, 400).filter((p) => p.inicio <= hoy).length : 0;
  const campos = camposAltaMembresia(beneficiarios, administrador).map((campo) => ({ ...campo, seccion: undefined }));
  const condiciones = administrador ? camposCondiciones(false) : [];

  return (
    <>
      <Seccion titulo="3. Condiciones del plan" fija>
        <Datos
          filas={[
            ["Plan", plan.nombre],
            ["Precio mensual", formatearMoneda(plan.precio_mensual)],
            ["Traslados por mes", String(plan.cupo_mensual)],
            ["Modalidad del cupo", ETIQUETAS_MODALIDAD[plan.modalidad_cupo]],
            ["Días de gracia", `${plan.dias_gracia} (la cuota vence el primer día de cada período)`],
            ["Fecha de inicio", formatearFecha(inicio)],
            ["Primeros períodos", periodos.map((p) => `${formatearFecha(p.inicio)} – ${formatearFecha(p.fin)}`).join(" · ")],
          ]}
        />
        <p className="mb-6 text-sm texto-tenue">
          {inicio > hoy
            ? `La primera mensualidad se generará el ${formatearFecha(inicio)}.`
            : hastaHoy > 1
              ? `La fecha de inicio es pasada: al confirmar se generarán hasta ${hastaHoy} mensualidades (una por período transcurrido), salvo que alguna quede vencida fuera del plazo de gracia.`
              : "Al confirmar se genera la primera mensualidad como cargo pendiente del cliente."}{" "}
          Los traslados no utilizados no se acumulan de un mes a otro. Al confirmar se genera también el contrato de la membresía.
        </p>
      </Seccion>

      <Seccion titulo="4. Beneficiarios" fija>
        <div className="tarjeta p-4 sm:p-6">
          <FormularioAltaMembresia
            accion={registrarMembresiaCompleta.bind(null, clienteId, plan.id, inicio)}
            estadoInicial={estadoInicial(valoresDesdeRegistro({ campos: condiciones }, null))}
            idempotencia={randomUUID()}
            hoy={hoy}
            campoTitularBeneficiario={CAMPO_TITULAR_BENEFICIARIO}
            camposExistentes={campos.filter((campo) => campo.nombre.startsWith(PREFIJO_BENEFICIARIO))}
            camposNuevo={camposBeneficiarioNuevo()}
            camposCondiciones={condiciones}
            campoConfirmar={campos.find((campo) => campo.nombre === "confirmar")!}
          />
        </div>
      </Seccion>
    </>
  );
}
