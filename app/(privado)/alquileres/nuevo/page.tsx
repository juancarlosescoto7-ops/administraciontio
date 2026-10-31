import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid, primerValor } from "@/lib/catalogos/presentacion";
import { esFechaValida, limpiarBusqueda } from "@/lib/catalogos/validacion";
import { registrarAlquiler } from "@/lib/alquileres/acciones";
import { camposReserva, diasAlquiler, precioSugerido } from "@/lib/alquileres/definiciones";
import { aFechaHoraLocal, formatearFechaHora, formatearMoneda, momentoDesdeLocal } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { BuscarCliente, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { FormularioOperacion } from "@/components/finanzas/operaciones";
import { Datos, Seccion } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";
import { FechasAlquiler } from "@/components/fechas-alquiler";

/** "AAAA-MM-DDTHH:mm" válido (hora local de Tegucigalpa). */
function leerFechaHora(valor: string | undefined): string | null {
  const partes = valor ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(valor) : null;
  return partes && esFechaValida(partes[1]) && Number(partes[2]) < 24 && Number(partes[3]) < 60 ? valor! : null;
}

export default function PaginaNuevoAlquiler({ searchParams }: PageProps<"/alquileres/nuevo">) {
  return (
    <>
      <Encabezado titulo="Nueva reserva de alquiler" volver={{ href: "/alquileres", etiqueta: "Alquileres" }} />
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("gestionarAlquileres", usuario.rol)) {
    return <SinPermiso mensaje="Su rol permite consultar alquileres, no reservarlos." />;
  }
  const parametros = await searchParams;
  const clienteId = primerValor(parametros.cliente);
  if (!esUuid(clienteId)) {
    return (
      <>
        <p className="mb-4 texto-tenue">1. Busque y elija el cliente.</p>
        <BuscarCliente ruta="/alquileres/nuevo" busqueda={limpiarBusqueda(primerValor(parametros.q))} />
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: cliente }, { data: tarifas }, { data: saldo }] = await Promise.all([
    supabase.from("clientes").select("id, nombre").eq("id", clienteId).eq("activo", true).maybeSingle(),
    supabase.from("tarifas").select("id, nombre, precio_base, unidad").eq("actividad", "alquileres").eq("activo", true).order("nombre"),
    supabase.from("saldos_clientes").select("saldo_a_favor").eq("cliente_id", clienteId).maybeSingle(),
  ]);
  if (!cliente) return <BuscarCliente ruta="/alquileres/nuevo" busqueda="" />;

  const entrega = leerFechaHora(primerValor(parametros.entrega));
  const devolucion = leerFechaHora(primerValor(parametros.devolucion));
  const tarifa = (tarifas ?? []).find((t) => t.id === primerValor(parametros.tarifa)) ?? null;
  const ahora = aFechaHoraLocal(new Date());
  const fechasValidas = entrega !== null && devolucion !== null && devolucion > entrega;

  return (
    <>
      <p className="mb-4">
        Cliente: <span className="font-medium">{cliente.nombre}</span> ·{" "}
        <Link href="/alquileres/nuevo" className="text-sm texto-tenue hover:underline">
          cambiar
        </Link>
      </p>
      <form method="get" className="tarjeta mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <input type="hidden" name="cliente" value={cliente.id} />
        <FechasAlquiler key={`${entrega}-${devolucion}`} entrega={entrega ?? ahora} devolucion={devolucion ?? ""} />
        <label className="campo">
          <span className="campo-etiqueta">Tarifa por día</span>
          <select className="entrada" name="tarifa" defaultValue={tarifa?.id ?? ""}>
            <option value="">Sin tarifa (precio manual)</option>
            {(tarifas ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} · {formatearMoneda(t.precio_base)}
                {t.unidad === "dia" ? " por día" : " por servicio"}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="boton boton-secundario">
          Ver disponibilidad
        </button>
      </form>
      {entrega && devolucion && !fechasValidas && (
        <p role="alert" className="aviso aviso-error mb-4">La devolución debe ser posterior a la entrega.</p>
      )}
      {fechasValidas && (
        <Revision
          supabase={supabase}
          clienteId={cliente.id}
          entrega={entrega}
          devolucion={devolucion}
          tarifa={tarifa}
          saldoAFavor={Number(saldo?.saldo_a_favor ?? 0)}
        />
      )}
    </>
  );
}

async function Revision({
  supabase,
  clienteId,
  entrega,
  devolucion,
  tarifa,
  saldoAFavor,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  clienteId: string;
  entrega: string;
  devolucion: string;
  tarifa: { id: string; nombre: string; precio_base: number; unidad: string } | null;
  saldoAFavor: number;
}) {
  const inicio = momentoDesdeLocal(entrega);
  const fin = momentoDesdeLocal(devolucion);
  const { data: vehiculos, error } = await supabase.rpc("disponibilidad_recursos", { p_actividad: "alquileres", p_inicio: inicio, p_fin: fin });
  const dias = diasAlquiler(inicio, fin);
  const sugerido = tarifa ? (tarifa.unidad === "dia" ? precioSugerido(tarifa.precio_base, dias) : precioSugerido(tarifa.precio_base, 1)) : null;
  const libres = (vehiculos ?? []).filter((v) => v.disponible).map((v) => ({ valor: v.recurso_id, etiqueta: v.nombre }));

  return (
    <>
      <Seccion titulo="3. Disponibilidad y precio" fija>
        <Datos
          filas={[
            ["Entrega", formatearFechaHora(inicio)],
            ["Devolución", formatearFechaHora(fin)],
            ["Días cobrables", `${dias} (bloques de 24 horas iniciados, mínimo 1)`],
            ["Precio propuesto", sugerido ? `${formatearMoneda(sugerido)} (${tarifa!.nombre})` : "Sin tarifa: indique el precio"],
          ]}
        />
        {error ? (
          <p role="alert" className="aviso aviso-error">No se pudo consultar la disponibilidad.</p>
        ) : (
          <Tabla
            filas={(vehiculos ?? []).map((v) => ({ ...v, id: v.recurso_id }))}
            vacio="No hay vehículos de alquiler activos y operativos."
            columnas={[
              { clave: "vehiculo", etiqueta: "Vehículo", celda: (v) => v.nombre },
              {
                clave: "disponible",
                etiqueta: "Disponibilidad",
                celda: (v) =>
                  v.disponible ? <span className="insignia insignia-activo">Libre</span> : <span className="insignia insignia-advertencia">Ocupado</span>,
              },
              { clave: "detalle", etiqueta: "Detalle", celda: (v) => v.detalle ?? "—" },
            ]}
          />
        )}
      </Seccion>
      {libres.length === 0 ? (
        <p className="aviso aviso-advertencia">No hay vehículos libres en ese intervalo. Cambie las fechas.</p>
      ) : (
        <div className="tarjeta p-4 sm:p-6">
          <p className="mb-4 text-sm texto-tenue">
            4. Confirme la reserva. La base vuelve a comprobar la disponibilidad al guardar.
            {saldoAFavor > 0 && ` El cliente tiene ${formatearMoneda(saldoAFavor)} a favor, aplicable al devolver.`}{" "}
            <Link href={`/finanzas/cobros/nuevo?cliente=${clienteId}`} className="text-enlace underline">
              Registrar anticipo
            </Link>
          </p>
          <FormularioOperacion
            campos={camposReserva(libres, sugerido)}
            accion={registrarAlquiler.bind(null, clienteId, inicio, fin, tarifa?.id ?? null)}
            textoEnviar="Confirmar reserva"
            tono="exito"
            rutaCancelar="/alquileres"
          />
        </div>
      )}
    </>
  );
}
