import { GastosServicio } from "@/components/finanzas/gastos-servicio";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { cancelarAlquiler, devolverAlquiler, entregarAlquiler, modificarAlquiler } from "@/lib/alquileres/acciones";
import {
  accionesAlquiler,
  camposCancelarAlquiler,
  camposDevolucion,
  camposEntrega,
  camposModificar,
  diferenciaCombustible,
  ETIQUETAS_COMBUSTIBLE,
  ETIQUETAS_ESTADO_ALQUILER,
} from "@/lib/alquileres/definiciones";
import { formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/tipos-bd";
import { Cargando, Encabezado } from "@/components/encabezado";
import { InsigniaFinanciera } from "@/components/ambulancias/insignias";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioOperacion } from "@/components/finanzas/operaciones";
import { Datos, ResumenImportes, Seccion } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";
import { Desplegable, Historial, InsigniaEstado, ListaAvisos } from "@/components/operaciones";

export default function PaginaAlquiler({ params, searchParams }: PageProps<"/alquileres/[id]">) {
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
  const { data: a } = await supabase.from("saldos_alquileres").select("*").eq("id", id).maybeSingle();
  if (!a || !a.estado || !a.cliente_id || !a.entrega_prevista || !a.devolucion_prevista) notFound();

  const [{ data: adicionales }, { data: saldo }, { data: avisos }, { data: historial }, { data: tarifa }, { data: vehiculos }] = await Promise.all([
    supabase.from("cargos_adicionales_alquiler").select("id, concepto, monto, created_at").eq("alquiler_id", id).order("created_at"),
    supabase.from("saldos_clientes").select("saldo_a_favor").eq("cliente_id", a.cliente_id).maybeSingle(),
    supabase.rpc("avisos_operacion", { p_origen_tipo: "alquiler", p_origen_id: id }),
    supabase.rpc("historial_operacion", { p_entidad: "alquileres", p_registro_id: id }),
    a.tarifa_id ? supabase.from("tarifas").select("nombre").eq("id", a.tarifa_id).maybeSingle() : Promise.resolve({ data: null }),
    a.estado === "reservado"
      ? supabase.rpc("disponibilidad_recursos", {
          p_actividad: "alquileres",
          p_inicio: a.entrega_prevista,
          p_fin: a.devolucion_prevista,
          p_origen_tipo: "alquiler",
          p_origen_id: id,
        })
      : Promise.resolve({ data: null }),
  ]);

  const acciones = accionesAlquiler(a.estado, usuario.rol);
  const aFavor = Number(saldo?.saldo_a_favor ?? 0);
  const combustible = diferenciaCombustible(a.combustible_salida, a.combustible_regreso);
  const opcionesVehiculo = (vehiculos ?? []).map((v) => ({
    valor: v.recurso_id,
    etiqueta: v.disponible ? v.nombre : `${v.nombre} (ocupado: ${v.detalle})`,
  }));

  return (
    <>
      <Encabezado
        titulo={`Alquiler · ${a.vehiculo_codigo}`}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            <InsigniaEstado estado={a.estado} etiquetas={ETIQUETAS_ESTADO_ALQUILER} finales={["devuelto", "cancelado"]} />
            <InsigniaFinanciera estado={a.estado_financiero} />
          </span>
        }
        volver={{ href: "/alquileres", etiqueta: "Alquileres" }}
      />
      <AvisoOperacion
        parametros={parametros}
        mensajes={{
          guardado: "Reserva registrada.",
          modificado: "Reserva modificada.",
          entregado: "Entrega registrada.",
          devuelto: "Devolución registrada.",
          cancelado: "Reserva cancelada.",
        }}
      />
      <ListaAvisos avisos={avisos} />

      <Seccion titulo="Datos del alquiler">
        <Datos
          filas={[
            ["Cliente", <Link key="c" href={`/clientes/${a.cliente_id}`} className="text-enlace hover:underline">{a.cliente_nombre}</Link>],
            ["Vehículo", `${a.vehiculo_codigo}${a.vehiculo_placa ? ` · ${a.vehiculo_placa}` : ""}`],
            ["Entrega prevista", formatearFechaHora(a.entrega_prevista)],
            ["Devolución prevista", formatearFechaHora(a.devolucion_prevista)],
            ["Tarifa de referencia", tarifa?.nombre ?? "Sin tarifa"],
            ["Precio pactado", formatearMoneda(a.precio_pactado)],
            ["Observaciones", a.notas],
            ["Registrado", formatearFechaHora(a.created_at)],
            ...(a.estado === "cancelado"
              ? ([["Cancelado", formatearFechaHora(a.cancelado_en)], ["Motivo de cancelación", a.motivo_cancelacion]] as [string, string | null][])
              : []),
          ]}
        />
        {acciones.modificar && (
          <Desplegable titulo="Modificar la reserva">
            <p className="mb-4 text-sm texto-tenue">Se vuelve a comprobar en la base que el vehículo esté libre en las nuevas fechas.</p>
            <FormularioOperacion
              campos={camposModificar(opcionesVehiculo)}
              accion={modificarAlquiler.bind(null, id, a.tarifa_id)}
              textoEnviar="Guardar cambios"
              registro={{
                vehiculo_id: a.vehiculo_id,
                entrega: a.entrega_prevista,
                devolucion: a.devolucion_prevista,
                precio: a.precio_pactado,
                notas: a.notas,
                motivo: null,
              }}
              prefijo="modificar-"
            />
          </Desplegable>
        )}
      </Seccion>

      <Seccion titulo="Entrega">
        {a.entrega_real ? (
          <Datos
            filas={[
              ["Entregado", formatearFechaHora(a.entrega_real)],
              ["Kilometraje de salida", a.km_salida?.toLocaleString("es-HN") ?? null],
              ["Combustible de salida", a.combustible_salida ? ETIQUETAS_COMBUSTIBLE[a.combustible_salida] : null],
              ["Observaciones", a.notas_entrega],
            ]}
          />
        ) : (
          <p className="tarjeta p-4 texto-tenue">Todavía no se ha entregado.</p>
        )}
        {acciones.entregar && (
          <div className="tarjeta mt-4 p-4 sm:p-6">
            <p className="mb-4 text-sm">El vehículo queda ocupado hasta su devolución real. Puede entregarse con saldo pendiente.</p>
            <FormularioOperacion campos={camposEntrega()} accion={entregarAlquiler.bind(null, id)} textoEnviar="Registrar entrega" prefijo="entrega-" tono="exito" />
          </div>
        )}
      </Seccion>

      <Seccion titulo="Devolución">
        {a.devolucion_real ? (
          <>
            <Datos
              filas={[
                ["Devuelto", formatearFechaHora(a.devolucion_real)],
                ["Kilometraje de regreso", a.km_regreso?.toLocaleString("es-HN") ?? null],
                ["Recorrido", a.km_recorridos === null ? null : `${a.km_recorridos.toLocaleString("es-HN")} km`],
                [
                  "Combustible",
                  `${a.combustible_salida ? ETIQUETAS_COMBUSTIBLE[a.combustible_salida] : "—"} → ${a.combustible_regreso ? ETIQUETAS_COMBUSTIBLE[a.combustible_regreso] : "—"}${
                    combustible === null || combustible === 0 ? "" : ` (${combustible > 0 ? "+" : ""}${combustible} cuartos)`
                  }`,
                ],
                ["Observaciones", a.notas_devolucion],
                ...(a.motivo_correccion_km ? ([["Corrección de kilometraje", a.motivo_correccion_km]] as [string, string][]) : []),
              ]}
            />
            <Tabla
              filas={adicionales ?? []}
              vacio="Sin cargos adicionales."
              columnas={[
                { clave: "concepto", etiqueta: "Cargo adicional", celda: (x) => x.concepto },
                { clave: "monto", etiqueta: "Importe", numerica: true, celda: (x) => formatearMoneda(x.monto) },
              ]}
            />
          </>
        ) : (
          <p className="tarjeta p-4 texto-tenue">Todavía no se ha devuelto.</p>
        )}
        {acciones.devolver && (
          <div className="tarjeta mt-4 p-4 sm:p-6">
            <p className="mb-4 text-sm">
              Salida: {a.km_salida?.toLocaleString("es-HN")} km, combustible {a.combustible_salida ? ETIQUETAS_COMBUSTIBLE[a.combustible_salida] : "—"}. Genera
              un único cargo por {formatearMoneda(a.precio_pactado)} más los cargos adicionales que registre expresamente. No se calculan multas ni daños.
              {aFavor > 0 && ` El cliente tiene ${formatearMoneda(aFavor)} a favor.`}
            </p>
            <FormularioOperacion
              campos={camposDevolucion(aFavor > 0, puede("corregirKilometraje", usuario.rol))}
              accion={devolverAlquiler.bind(null, id, aFavor > 0)}
              textoEnviar="Registrar devolución"
              tono="exito"
              prefijo="devolucion-"
            />
          </div>
        )}
      </Seccion>

      <Seccion titulo="Cobros">
        <ResumenImportes
          importes={[
            { etiqueta: "Precio pactado", valor: a.precio_pactado },
            { etiqueta: "Cargos adicionales", valor: a.total_adicionales },
            { etiqueta: "Pagado", valor: a.aplicado },
            { etiqueta: "Pendiente", valor: a.pendiente, destacado: true, ayuda: a.cargo_id ? undefined : "El cargo se genera al devolver" },
          ]}
        />
        <p className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm texto-tenue">Saldo a favor del cliente: {formatearMoneda(aFavor)}</span>
          {a.cargo_id && (
            <Link href={`/finanzas/cargos/${a.cargo_id}`} className="text-sm text-enlace underline">
              Ver cargo
            </Link>
          )}
          {puede("registrarCobro", usuario.rol) && a.estado !== "cancelado" && (
            <Link href={`/finanzas/cobros/nuevo?cliente=${a.cliente_id}`} className="boton boton-secundario">
              {a.cargo_id ? "Registrar cobro" : "Registrar anticipo"}
            </Link>
          )}
        </p>
        {a.estado === "cancelado" && aFavor > 0 && (
          <p className="text-sm texto-tenue">El dinero recibido sigue como saldo a favor del cliente hasta que se aplique o se devuelva.</p>
        )}
      </Seccion>

      {acciones.cancelar && (
        <Seccion titulo="Cancelación de la reserva">
          <Desplegable titulo="Cancelar la reserva" peligro>
            <p className="mb-4 text-sm texto-tenue">Libera el vehículo. No genera cargo; los anticipos quedan como saldo a favor.</p>
            <FormularioOperacion campos={camposCancelarAlquiler()} accion={cancelarAlquiler.bind(null, id)} textoEnviar="Cancelar reserva" prefijo="cancelar-" tono="peligro" />
          </Desplegable>
        </Seccion>
      )}

      <Seccion titulo="Historial">
        <Historial eventos={historial} acciones={ACCIONES} describir={describir} />
      </Seccion>
      <GastosServicio tipo="alquiler" id={id} rol={usuario.rol} />
    </>
  );
}

const ACCIONES: Record<string, string> = {
  registrar_alquiler: "Reserva registrada",
  modificar_alquiler: "Reserva modificada",
  entregar_alquiler: "Entregado",
  devolver_alquiler: "Devuelto",
  cancelar_alquiler: "Cancelado",
};

function describir(accion: string, despues: Json): string | null {
  const d = (despues ?? {}) as Record<string, Json>;
  switch (accion) {
    case "entregar_alquiler":
      return `Kilometraje ${d.km_salida}, combustible ${ETIQUETAS_COMBUSTIBLE[d.combustible_salida as keyof typeof ETIQUETAS_COMBUSTIBLE] ?? "—"}.`;
    case "devolver_alquiler":
      return `Kilometraje ${d.km_regreso}; cargo de ${formatearMoneda(String(d.importe))}${Number(d.cargos_adicionales) > 0 ? ` (incluye ${formatearMoneda(String(d.cargos_adicionales))} adicionales)` : ""}.`;
    case "modificar_alquiler":
      return `Nuevo período: ${formatearFechaHora(String(d.entrega_prevista))} – ${formatearFechaHora(String(d.devolucion_prevista))}, ${formatearMoneda(String(d.precio_pactado))}.`;
    default:
      return null;
  }
}
