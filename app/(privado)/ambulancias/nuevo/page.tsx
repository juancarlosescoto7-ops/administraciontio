import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import type { Opcion } from "@/lib/catalogos/definiciones";
import { esUuid, primerValor } from "@/lib/catalogos/presentacion";
import { limpiarBusqueda } from "@/lib/catalogos/validacion";
import { registrarTraslado } from "@/lib/ambulancias/acciones";
import { camposSolicitud } from "@/lib/ambulancias/definiciones";
import { ETIQUETAS_MODALIDAD } from "@/lib/membresias/definiciones";
import { aFechaHoraLocal, formatearFecha, formatearMoneda, hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { BuscarCliente, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { FormularioOperacion } from "@/components/finanzas/operaciones";
import { Seccion } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";
import { InsigniaMembresia } from "@/components/membresias/insignia";

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

export default function PaginaNuevoTraslado({ searchParams }: PageProps<"/ambulancias/nuevo">) {
  return (
    <>
      <Encabezado titulo="Nueva solicitud de traslado" volver={{ href: "/ambulancias", etiqueta: "Traslados" }} />
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("gestionarTraslados", usuario.rol)) {
    return <SinPermiso mensaje="Su rol permite consultar traslados, no registrarlos." />;
  }
  const parametros = await searchParams;
  const clienteId = primerValor(parametros.cliente);
  if (!esUuid(clienteId)) {
    return (
      <>
        <p className="mb-4 texto-tenue">1. Busque y elija el cliente (titular de la membresía o quien contrata el servicio).</p>
        <BuscarCliente ruta="/ambulancias/nuevo" busqueda={limpiarBusqueda(primerValor(parametros.q))} />
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: cliente }, { data: membresias }] = await Promise.all([
    supabase.from("clientes").select("id, nombre").eq("id", clienteId).eq("activo", true).maybeSingle(),
    supabase
      .from("saldos_membresias")
      .select("id, plan_nombre, estado, modalidad_cupo, cupo_pactado, suspendida_desde")
      .eq("cliente_id", clienteId)
      .neq("estado", "cancelada")
      .order("created_at"),
  ]);
  if (!cliente) return <BuscarCliente ruta="/ambulancias/nuevo" busqueda="" />;

  const base = `/ambulancias/nuevo?cliente=${cliente.id}`;
  const membresiaId = primerValor(parametros.membresia);
  const particular = primerValor(parametros.tipo) === "particular";
  const membresia = (membresias ?? []).find((m) => m.id === membresiaId) ?? null;

  return (
    <>
      <p className="mb-4">
        Cliente: <span className="font-medium">{cliente.nombre}</span> ·{" "}
        <Link href="/ambulancias/nuevo" className="text-sm texto-tenue hover:underline">
          cambiar
        </Link>
      </p>
      <Seccion titulo="2. Tipo de servicio" fija>
        <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {(membresias ?? []).map((m) => (
            <li key={m.id}>
              <Link
                href={`${base}&membresia=${m.id}`}
                className={`boton ${m.id === membresiaId ? "boton-primario" : "boton-secundario"} flex-col items-start`}
              >
                <span>Cubierto: {m.plan_nombre}</span>
                <InsigniaMembresia estado={m.estado} />
              </Link>
            </li>
          ))}
          <li>
            <Link href={`${base}&tipo=particular`} className={`boton ${particular ? "boton-primario" : "boton-secundario"}`}>
              Servicio particular
            </Link>
          </li>
        </ul>
        {(membresias ?? []).length === 0 && <p className="mt-2 text-sm texto-tenue">El cliente no tiene membresías vigentes.</p>}
      </Seccion>

      {membresia && <Cubierto supabase={supabase} clienteId={cliente.id} membresia={membresia} />}
      {particular && !membresia && (
        <Particular supabase={supabase} clienteId={cliente.id} base={base} tarifaParametro={primerValor(parametros.tarifa)} />
      )}
    </>
  );
}

/** Ambulancias operativas y conductores activos, indicando si están ocupados ahora. */
async function opcionesRecursos(supabase: ClienteSupabase) {
  const { data } = await supabase.rpc("recursos_disponibles", { p_inicio: new Date().toISOString(), p_minutos: 1 });
  const opciones = (tipo: string): Opcion[] =>
    (data ?? [])
      .filter((r) => r.recurso_tipo === tipo)
      .map((r) => ({ valor: r.recurso_id, etiqueta: r.disponible ? r.nombre : `${r.nombre} (ocupado ahora)` }));
  return { vehiculos: opciones("vehiculo"), conductores: opciones("conductor") };
}

async function Cubierto({
  supabase,
  clienteId,
  membresia,
}: {
  supabase: ClienteSupabase;
  clienteId: string;
  membresia: { id: string | null; plan_nombre: string | null; estado: "activa" | "suspendida" | "cancelada" | null; modalidad_cupo: "compartido" | "individual" | null; cupo_pactado: number | null };
}) {
  const membresiaId = membresia.id!;
  const hoy = hoyEnTegucigalpa();
  const [{ data: vinculos }, recursos] = await Promise.all([
    supabase
      .from("membresia_beneficiarios")
      .select("id, beneficiario_id, beneficiarios(nombre)")
      .eq("membresia_id", membresiaId)
      .eq("activo", true),
    opcionesRecursos(supabase),
  ]);
  const disponibilidad = await Promise.all(
    (vinculos ?? []).map(async (v) => {
      const { data } = await supabase.rpc("consultar_cobertura", { p_membresia_id: membresiaId, p_beneficiario_id: v.beneficiario_id, p_fecha: hoy });
      return { id: v.id, nombre: v.beneficiarios?.nombre ?? "—", cobertura: data?.[0] ?? null };
    }),
  );
  const beneficiarios = (vinculos ?? []).map((v) => ({ valor: v.beneficiario_id, etiqueta: v.beneficiarios?.nombre ?? "—" }));

  return (
    <>
      <Seccion titulo={`3. Cobertura hoy (${formatearFecha(hoy)})`} fija>
        <p className="mb-3 text-sm texto-tenue">
          {membresia.modalidad_cupo ? ETIQUETAS_MODALIDAD[membresia.modalidad_cupo] : ""} · {membresia.cupo_pactado} traslados por período. La
          cobertura y el cupo se validan para la fecha programada al registrar; la solicitud se guarda aunque no haya cobertura.
        </p>
        <Tabla
          filas={disponibilidad}
          vacio="La membresía no tiene beneficiarios activos."
          columnas={[
            { clave: "nombre", etiqueta: "Beneficiario", celda: (d) => d.nombre },
            {
              clave: "cubierto",
              etiqueta: "Hoy",
              celda: (d) =>
                d.cobertura?.cubierto ? <span className="insignia insignia-activo">Cubierto</span> : <span className="insignia insignia-advertencia">No cubierto</span>,
            },
            { clave: "disponibles", etiqueta: "Disponibles", numerica: true, celda: (d) => (d.cobertura?.periodo_id ? `${d.cobertura.disponibles} de ${d.cobertura.cupo}` : "—") },
            { clave: "detalle", etiqueta: "Detalle", celda: (d) => d.cobertura?.motivo ?? d.cobertura?.aviso ?? "—" },
          ]}
        />
      </Seccion>
      <div className="tarjeta p-4 sm:p-6">
        <FormularioOperacion
          campos={camposSolicitud({ tipo: "cubierto", beneficiarios, ...recursos, ahora: aFechaHoraLocal(new Date()) })}
          accion={registrarTraslado.bind(null, clienteId, membresiaId, null)}
          textoEnviar="Registrar solicitud"
          rutaCancelar="/ambulancias"
        />
      </div>
    </>
  );
}

async function Particular({
  supabase,
  clienteId,
  base,
  tarifaParametro,
}: {
  supabase: ClienteSupabase;
  clienteId: string;
  base: string;
  tarifaParametro: string | undefined;
}) {
  const [{ data: tarifas }, { data: beneficiarios }, { data: saldo }, recursos] = await Promise.all([
    supabase.from("tarifas").select("id, nombre, precio_base, unidad").eq("actividad", "ambulancias").eq("activo", true).order("nombre"),
    supabase.from("beneficiarios").select("id, nombre").eq("activo", true).order("nombre").limit(300),
    supabase.from("saldos_clientes").select("saldo_a_favor").eq("cliente_id", clienteId).maybeSingle(),
    opcionesRecursos(supabase),
  ]);
  const tarifa = (tarifas ?? []).find((t) => t.id === tarifaParametro) ?? null;

  return (
    <>
      <Seccion titulo="3. Precio" fija>
        {(tarifas ?? []).length > 0 ? (
          <form method="get" className="tarjeta mb-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <input type="hidden" name="cliente" value={clienteId} />
            <input type="hidden" name="tipo" value="particular" />
            <label className="campo flex-1">
              <span className="campo-etiqueta">Proponer precio desde una tarifa</span>
              <select className="entrada" name="tarifa" defaultValue={tarifa?.id ?? ""}>
                <option value="">Sin tarifa (precio manual)</option>
                {(tarifas ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} · {formatearMoneda(t.precio_base)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="boton boton-secundario">
              Proponer
            </button>
          </form>
        ) : (
          <p className="mb-3 text-sm texto-tenue">No hay tarifas de ambulancias: indique el precio manualmente.</p>
        )}
        <p className="text-sm texto-tenue">
          El precio pactado puede ajustarse y queda guardado en el servicio; el cargo se genera al completarlo.
          {Number(saldo?.saldo_a_favor ?? 0) > 0 && ` El cliente tiene ${formatearMoneda(saldo?.saldo_a_favor)} a favor, aplicable al finalizar.`}{" "}
          <Link href={`/finanzas/cobros/nuevo?cliente=${clienteId}`} className="text-enlace underline">
            Registrar anticipo
          </Link>
          {" · "}
          <Link href={base} className="underline">
            cambiar tipo
          </Link>
        </p>
      </Seccion>
      <div className="tarjeta p-4 sm:p-6">
        <FormularioOperacion
          campos={camposSolicitud({
            tipo: "particular",
            beneficiarios: (beneficiarios ?? []).map((b) => ({ valor: b.id, etiqueta: b.nombre })),
            ...recursos,
            ahora: aFechaHoraLocal(new Date()),
            precioPropuesto: tarifa && Number(tarifa.precio_base) > 0 ? Number(tarifa.precio_base).toFixed(2) : null,
          })}
          accion={registrarTraslado.bind(null, clienteId, null, tarifa?.id ?? null)}
          textoEnviar="Registrar solicitud"
          rutaCancelar="/ambulancias"
        />
      </div>
    </>
  );
}
