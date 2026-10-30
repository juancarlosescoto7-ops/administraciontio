import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid, primerValor } from "@/lib/catalogos/presentacion";
import { sumarMontos } from "@/lib/finanzas/montos";
import {
  agregarBeneficiario,
  agregarBeneficiarioNuevo,
  cancelarMembresia,
  editarCondiciones,
  inactivarBeneficiario,
} from "@/lib/membresias/acciones";
import {
  camposAgregarBeneficiario,
  camposBaja,
  camposBeneficiarioNuevo,
  camposEditarCondiciones,
  ETIQUETAS_MODALIDAD,
} from "@/lib/membresias/definiciones";
import { formatearFecha, formatearFechaHora, formatearMoneda, hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/tipos-bd";
import { Cargando, Encabezado, EstadoVacio } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioOperacion } from "@/components/finanzas/operaciones";
import { Datos, ResumenImportes, Seccion } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";
import { BotonActualizarMensualidades } from "@/components/membresias/actualizar";
import { Desplegable } from "@/components/operaciones";
import { HistorialPlegable } from "@/components/historial-plegable";
import { InsigniaCuota, InsigniaMembresia } from "@/components/membresias/insignia";

export default function PaginaMembresia({ params, searchParams }: PageProps<"/membresias/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  const parametros = await searchParams;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const { data: membresia } = await supabase.from("saldos_membresias").select("*").eq("id", id).maybeSingle();
  if (!membresia || !membresia.cliente_id) notFound();

  const hoy = hoyEnTegucigalpa();
  const [{ data: vinculos }, { data: periodos }, { data: saldoCliente }, { data: historial }, { data: activos }] = await Promise.all([
    supabase
      .from("membresia_beneficiarios")
      .select("id, beneficiario_id, activo, fecha_alta, fecha_baja, motivo_baja, beneficiarios(nombre, identificacion)")
      .eq("membresia_id", id)
      .order("activo", { ascending: false })
      .order("fecha_alta"),
    supabase.from("saldos_periodos").select("*").eq("membresia_id", id).order("inicio", { ascending: false }),
    supabase.from("saldos_clientes").select("saldo_a_favor").eq("cliente_id", membresia.cliente_id).maybeSingle(),
    supabase.rpc("historial_membresia", { p_membresia_id: id }),
    supabase.from("beneficiarios").select("id, nombre").eq("activo", true).order("nombre").limit(300),
  ]);

  const vigentes = (vinculos ?? []).filter((v) => v.activo);
  const coberturas = await Promise.all(
    vigentes.map(async (v) => {
      const { data } = await supabase.rpc("consultar_cobertura", {
        p_membresia_id: id,
        p_beneficiario_id: v.beneficiario_id,
        p_fecha: hoy,
      });
      return { ...v, cobertura: data?.[0] ?? null };
    }),
  );

  const ruta = `/membresias/${id}`;
  const cancelada = membresia.estado === "cancelada";
  const operador = puede("registrarMembresia", usuario.rol) && !cancelada;
  const administrador = puede("gestionarMembresia", usuario.rol) && !cancelada;
  const vinculoBaja = primerValor(parametros.vinculo);
  const vinculadosIds = new Set(vigentes.map((v) => v.beneficiario_id));
  const opcionesAgregar = (activos ?? []).filter((b) => !vinculadosIds.has(b.id)).map((b) => ({ valor: b.id, etiqueta: b.nombre }));
  const filasPeriodos = (periodos ?? []).map((p) => ({ ...p, id: p.id! }));

  return (
    <>
      <Encabezado
        titulo={`${membresia.cliente_nombre} · ${membresia.plan_nombre}`}
        descripcion={<InsigniaMembresia estado={membresia.estado} />}
        volver={{ href: "/membresias", etiqueta: "Membresías" }}
        acciones={
          <>
            <Link href={`${ruta}/contrato`} className="boton boton-secundario">
              Contrato
            </Link>
            {!cancelada && puede("actualizarMensualidades", usuario.rol) && <BotonActualizarMensualidades membresiaId={id} />}
          </>
        }
      />
      <AvisoOperacion
        parametros={parametros}
        mensajes={{
          guardado: "Membresía registrada.",
          condiciones: "Condiciones actualizadas para los próximos ciclos.",
          beneficiario: "Beneficiario agregado.",
          baja: "Beneficiario dado de baja.",
          cancelada: "Membresía cancelada.",
        }}
      />

      {membresia.estado === "suspendida" && (
        <p role="status" className="aviso aviso-advertencia mb-4">
          Suspendida por morosidad desde el {formatearFecha(membresia.suspendida_desde)}: no habilita traslados cubiertos ni genera
          mensualidades. Al saldar las cuotas vencidas se reactiva; si ya pasó la renovación, empieza un ciclo nuevo desde la fecha de
          reactivación y los meses suspendidos no se cobran.
        </p>
      )}

      <ResumenImportes
        importes={[
          { etiqueta: "Precio mensual pactado", valor: membresia.precio_pactado },
          { etiqueta: "Saldo pendiente", valor: membresia.pendiente, destacado: true },
          { etiqueta: "Vencido (fuera de gracia)", valor: membresia.vencido },
          { etiqueta: "Saldo a favor del cliente", valor: saldoCliente?.saldo_a_favor ?? 0 },
        ]}
      />
      <p className="mb-6 flex flex-wrap gap-2">
        {/* También sin deuda: un pago anticipado queda como saldo a favor. */}
        {puede("registrarCobro", usuario.rol) && (
          <Link href={`/finanzas/cobros/nuevo?cliente=${membresia.cliente_id}`} className="boton boton-primario">
            Registrar cobro
          </Link>
        )}
        <Link href={`/finanzas/pendientes/${membresia.cliente_id}`} className="boton boton-secundario">
          Estado de cuenta del cliente
        </Link>
      </p>
      {Number(saldoCliente?.saldo_a_favor ?? 0) > 0 && Number(membresia.pendiente) > 0 && (
        <p className="mb-6 text-sm texto-tenue">
          El cliente tiene saldo a favor: abra la cuota pendiente para aplicarlo sin registrar dinero nuevo.
        </p>
      )}

      <Seccion titulo="Información general">
        <Datos
          filas={[
            ["Cliente titular", <Link key="c" href={`/clientes/${membresia.cliente_id}`} className="text-enlace hover:underline">{membresia.cliente_nombre}</Link>],
            ["Plan", <Link key="p" href={`/planes/${membresia.plan_id}`} className="text-enlace hover:underline">{membresia.plan_nombre}</Link>],
            ["Fecha de afiliación", formatearFecha(membresia.fecha_inicio)],
            ["Día de renovación", `Día ${membresia.dia_ancla} de cada mes (o el último día si el mes es más corto)`],
            ["Próxima renovación", membresia.estado === "activa" ? formatearFecha(membresia.proxima_renovacion) : "— (no renueva mientras no esté activa)"],
            ["Registrada", formatearFechaHora(membresia.created_at)],
            ...(cancelada
              ? ([["Cancelada", formatearFechaHora(membresia.cancelada_en)], ["Motivo de cancelación", membresia.motivo_cancelacion]] as [string, string | null][])
              : []),
          ]}
        />
      </Seccion>

      <Seccion titulo="Condiciones pactadas (próximos ciclos)">
        <Datos
          filas={[
            ["Precio mensual", formatearMoneda(membresia.precio_pactado)],
            ["Traslados por mes", String(membresia.cupo_pactado)],
            ["Modalidad del cupo", membresia.modalidad_cupo ? ETIQUETAS_MODALIDAD[membresia.modalidad_cupo] : null],
            ["Días de gracia", String(membresia.dias_gracia)],
          ]}
        />
        {administrador && (
          <Desplegable titulo="Editar condiciones">
            <p className="mb-4 text-sm texto-tenue">
              Se aplican desde la próxima mensualidad; los períodos ya generados conservan sus condiciones.
            </p>
            <FormularioOperacion
              campos={camposEditarCondiciones()}
              accion={editarCondiciones.bind(null, id)}
              textoEnviar="Guardar condiciones"
              prefijo="condiciones-"
              registro={{
                precio: membresia.precio_pactado,
                cupo: membresia.cupo_pactado,
                modalidad: membresia.modalidad_cupo,
                dias_gracia: membresia.dias_gracia,
                motivo: null,
              }}
            />
          </Desplegable>
        )}
      </Seccion>

      <Seccion titulo="Beneficiarios" abierta={Boolean(vinculoBaja)}>
        <Tabla
          filas={vinculos ?? []}
          enlace={(v) => `/beneficiarios/${v.beneficiario_id}`}
          vacio="La membresía no tiene beneficiarios."
          columnas={[
            { clave: "nombre", etiqueta: "Beneficiario", celda: (v) => v.beneficiarios?.nombre ?? "—" },
            { clave: "alta", etiqueta: "Alta", celda: (v) => formatearFecha(v.fecha_alta) },
            { clave: "baja", etiqueta: "Baja", celda: (v) => (v.fecha_baja ? `${formatearFecha(v.fecha_baja)} · ${v.motivo_baja}` : "—") },
            {
              clave: "estado",
              etiqueta: "Estado",
              celda: (v) =>
                v.activo ? (
                  operador ? (
                    <Link href={`${ruta}?vinculo=${v.id}`} className="text-sm text-enlace underline">
                      Dar de baja
                    </Link>
                  ) : (
                    <span className="insignia insignia-activo">Activo</span>
                  )
                ) : (
                  <span className="insignia insignia-inactivo">Baja</span>
                ),
            },
          ]}
        />
        {operador && vigentes.some((v) => v.id === vinculoBaja) && (
          <Desplegable
            titulo={`Dar de baja a ${vigentes.find((v) => v.id === vinculoBaja)?.beneficiarios?.nombre ?? "beneficiario"}`}
            peligro
            abierto
          >
            <p className="mb-4 text-sm">
              Dar de baja a {vigentes.find((v) => v.id === vinculoBaja)?.beneficiarios?.nombre}: deja de estar cubierto desde hoy. El
              historial se conserva.
            </p>
            <FormularioOperacion
              campos={camposBaja("Confirmo la baja del beneficiario")}
              accion={inactivarBeneficiario.bind(null, id, vinculoBaja!)}
              textoEnviar="Dar de baja"
              rutaCancelar={ruta}
              prefijo="baja-"
              tono="peligro"
            />
          </Desplegable>
        )}
        {operador && opcionesAgregar.length > 0 && (
          <Desplegable titulo="Agregar beneficiario ya registrado">
            <FormularioOperacion
              campos={camposAgregarBeneficiario(opcionesAgregar)}
              accion={agregarBeneficiario.bind(null, id)}
              textoEnviar="Agregar"
            />
          </Desplegable>
        )}
        {operador && (
          <Desplegable titulo="Registrar beneficiario nuevo">
            <p className="mb-4 text-sm texto-tenue">Se crea su ficha y queda cubierto desde hoy, sin salir de esta página.</p>
            <FormularioOperacion
              campos={camposBeneficiarioNuevo()}
              accion={agregarBeneficiarioNuevo.bind(null, id)}
              textoEnviar="Registrar y agregar"
              prefijo="nuevo-"
            />
          </Desplegable>
        )}
      </Seccion>

      <Seccion titulo={`Disponibilidad de traslados hoy (${formatearFecha(hoy)})`}>
        <p className="mb-3 text-sm texto-tenue">
          {membresia.modalidad_cupo === "compartido"
            ? "Cupo compartido: todos los beneficiarios usan el mismo cupo del período."
            : "Cupo individual: cada beneficiario tiene su propio cupo en el período."}{" "}
          El cupo no se acumula entre meses. Los usados incluyen traslados programados (reservados) y completados (consumidos).
        </p>
        <Tabla
          filas={coberturas}
          vacio="Sin beneficiarios activos."
          columnas={[
            { clave: "nombre", etiqueta: "Beneficiario", celda: (c) => c.beneficiarios?.nombre ?? "—" },
            {
              clave: "cubierto",
              etiqueta: "Cobertura",
              celda: (c) =>
                c.cobertura?.cubierto ? (
                  <span className="insignia insignia-activo">Cubierto</span>
                ) : (
                  <span className="insignia insignia-advertencia">No cubierto</span>
                ),
            },
            {
              clave: "periodo",
              etiqueta: "Período",
              celda: (c) =>
                c.cobertura?.periodo_inicio
                  ? `${formatearFecha(c.cobertura.periodo_inicio)} – ${formatearFecha(c.cobertura.periodo_fin)}`
                  : "—",
            },
            {
              clave: "disponibles",
              etiqueta: "Disponibles",
              numerica: true,
              celda: (c) => (c.cobertura?.periodo_id ? `${c.cobertura.disponibles} de ${c.cobertura.cupo}` : "—"),
            },
            { clave: "detalle", etiqueta: "Detalle", celda: (c) => c.cobertura?.motivo ?? c.cobertura?.aviso ?? "—" },
          ]}
        />
      </Seccion>

      <Seccion titulo="Mensualidades">
        <Tabla
          filas={filasPeriodos}
          enlace={(p) => (p.cargo_id ? `/finanzas/cargos/${p.cargo_id}` : null)}
          vacio="Todavía no se ha generado ninguna mensualidad."
          columnas={[
            { clave: "periodo", etiqueta: "Período", celda: (p) => `${formatearFecha(p.inicio)} – ${formatearFecha(p.fin)}` },
            { clave: "precio", etiqueta: "Cuota", numerica: true, celda: (p) => formatearMoneda(p.precio) },
            { clave: "cupo", etiqueta: "Traslados", numerica: true, celda: (p) => p.cupo_asignado },
            { clave: "limite", etiqueta: "Límite de pago", celda: (p) => formatearFecha(p.limite_pago) },
            { clave: "aplicado", etiqueta: "Pagado", numerica: true, celda: (p) => formatearMoneda(p.aplicado) },
            { clave: "pendiente", etiqueta: "Pendiente", numerica: true, celda: (p) => formatearMoneda(p.pendiente) },
            {
              clave: "estado",
              etiqueta: "Estado",
              celda: (p) => <InsigniaCuota precio={p.precio} pendiente={p.pendiente} vencida={p.vencida} anulada={p.cargo_estado === "anulado"} />,
            },
          ]}
          totales={{
            precio: formatearMoneda(sumarMontos(filasPeriodos.filter((p) => p.cargo_estado !== "anulado").map((p) => p.precio))),
            aplicado: formatearMoneda(sumarMontos(filasPeriodos.map((p) => p.aplicado))),
            pendiente: formatearMoneda(sumarMontos(filasPeriodos.map((p) => p.pendiente))),
          }}
        />
      </Seccion>

      {administrador && (
        <Seccion titulo="Baja de la membresía">
          <Desplegable titulo="Cancelar la membresía" peligro>
            <p className="mb-4 text-sm">
              Deja de renovar y de cubrir traslados. Las cuotas pendientes se conservan como deuda del cliente y los pagos no se
              modifican. Una membresía cancelada no se reactiva al pagar.
            </p>
            <FormularioOperacion
              campos={camposBaja("Confirmo la cancelación de la membresía")}
              accion={cancelarMembresia.bind(null, id)}
              textoEnviar="Cancelar membresía"
              prefijo="cancelar-"
              tono="peligro"
            />
          </Desplegable>
        </Seccion>
      )}

      <Seccion titulo="Historial">
        {historial?.length ? (
          <HistorialPlegable total={historial.length}>
            <ul className="tarjeta historial py-1">
              {historial.map((evento, indice) => (
                <li key={`${evento.fecha}-${indice}`} className="flex flex-col gap-0.5 py-3 pr-4 text-sm">
                  <span className="font-medium">{ACCIONES[evento.accion] ?? evento.accion}</span>
                  <span className="texto-tenue">
                    {formatearFechaHora(evento.fecha)} · {evento.actor ?? "Sistema"}
                  </span>
                  {describirEvento(evento.accion, evento.despues, evento.antes) && <span>{describirEvento(evento.accion, evento.despues, evento.antes)}</span>}
                  {evento.motivo && <span className="texto-tenue">Motivo: {evento.motivo}</span>}
                </li>
              ))}
            </ul>
          </HistorialPlegable>
        ) : (
          <EstadoVacio mensaje="Sin eventos registrados." />
        )}
      </Seccion>
    </>
  );
}

const ACCIONES: Record<string, string> = {
  registrar_membresia: "Alta de la membresía",
  actualizar_condiciones: "Cambio de condiciones",
  suspender_por_morosidad: "Suspensión por morosidad",
  reactivar_membresia: "Reactivación",
  cancelar_membresia: "Cancelación",
  agregar_beneficiario: "Alta de beneficiario",
  inactivar_beneficiario: "Baja de beneficiario",
};

function describirEvento(accion: string, despues: Json, antes: Json): string | null {
  const d = (despues ?? {}) as Record<string, Json>;
  const a = (antes ?? {}) as Record<string, Json>;
  switch (accion) {
    case "registrar_membresia":
      return `Afiliación desde el ${formatearFecha(String(d.fecha_inicio))}${d.condiciones_particulares ? " con condiciones particulares" : ""}.`;
    case "suspender_por_morosidad":
      return `Suspendida desde el ${formatearFecha(String(d.suspendida_desde))}.`;
    case "reactivar_membresia":
      return d.ciclo_nuevo
        ? `Ciclo nuevo desde el ${formatearFecha(String(d.fecha_efectiva))}: renueva el día ${d.dia_ancla} (antes, el día ${a.dia_ancla}).`
        : `Reactivada el ${formatearFecha(String(d.fecha_efectiva))}; el ciclo continúa igual.`;
    case "actualizar_condiciones":
      return `Precio ${formatearMoneda(String(a.precio_pactado))} → ${formatearMoneda(String(d.precio_pactado))}, traslados ${a.cupo_pactado} → ${d.cupo_pactado}, gracia ${a.dias_gracia} → ${d.dias_gracia} días, desde el ${formatearFecha(String(d.desde))}.`;
    default:
      return null;
  }
}
