import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { filtroBusqueda } from "@/lib/catalogos/validacion";
import { ESTADOS_LISTADO_ALQUILER, ETIQUETAS_ESTADO_ALQUILER, type EstadoAlquiler } from "@/lib/alquileres/definiciones";
import { LIMITE_LISTADO } from "@/lib/finanzas/consultas";
import { sumarMontos } from "@/lib/finanzas/montos";
import { formatearFechaHora, formatearMoneda, momentoDesdeLocal } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import { InsigniaFinanciera } from "@/components/ambulancias/insignias";
import { FormularioFiltros, leerFiltros, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { Tabla } from "@/components/finanzas/tabla";
import { InsigniaEstado } from "@/components/operaciones";

export default function PaginaAlquileres({ searchParams }: PageProps<"/alquileres">) {
  return (
    <>
      <Encabezado
        titulo="Alquileres de vehículos"
        descripcion="Reservas, entregas y devoluciones. El cargo se genera al devolver el vehículo."
        acciones={
          <Suspense fallback={null}>
            <BotonNuevo />
          </Suspense>
        }
      />
      <Suspense fallback={<Cargando />}>
        <Listado searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BotonNuevo() {
  const usuario = await requerirUsuario();
  if (!puede("gestionarAlquileres", usuario.rol)) return null;
  return (
    <Link href="/alquileres/nuevo" className="boton boton-primario">
      Nueva reserva
    </Link>
  );
}

async function Listado({ searchParams }: { searchParams: ParametrosBusqueda }) {
  await requerirUsuario();
  const filtros = leerFiltros(await searchParams, ESTADOS_LISTADO_ALQUILER);
  const supabase = await createClient();

  const activos = filtros.estado === "activos";
  let consulta = supabase
    .from("saldos_alquileres")
    .select("id, cliente_nombre, vehiculo_codigo, entrega_prevista, devolucion_prevista, estado, importe_total, pendiente, estado_financiero")
    .order("entrega_prevista", { ascending: activos })
    .limit(LIMITE_LISTADO + 1);
  if (activos) consulta = consulta.in("estado", ["reservado", "entregado"]);
  else if (filtros.estado !== "todos") consulta = consulta.eq("estado", filtros.estado as EstadoAlquiler);
  if (filtros.busqueda) consulta = consulta.or(filtroBusqueda(["cliente_nombre", "vehiculo_codigo"], filtros.busqueda));
  if (filtros.desde) consulta = consulta.gte("entrega_prevista", momentoDesdeLocal(`${filtros.desde}T00:00`));
  if (filtros.hasta) consulta = consulta.lte("entrega_prevista", momentoDesdeLocal(`${filtros.hasta}T23:59`));
  const { data, error } = await consulta;

  const filas = (data ?? []).slice(0, LIMITE_LISTADO).map((fila) => ({ ...fila, id: fila.id! }));
  return (
    <>
      <FormularioFiltros filtros={filtros} estados={ESTADOS_LISTADO_ALQUILER} placeholder="Cliente o vehículo…" />
      {error ? (
        <p role="alert" className="aviso aviso-error">No se pudo cargar el listado.</p>
      ) : (
        <Tabla
          filas={filas}
          enlace={(fila) => `/alquileres/${fila.id}`}
          vacio="No hay alquileres que coincidan con el filtro."
          columnas={[
            { clave: "cliente", etiqueta: "Cliente", celda: (f) => f.cliente_nombre },
            { clave: "vehiculo", etiqueta: "Vehículo", celda: (f) => f.vehiculo_codigo },
            { clave: "entrega", etiqueta: "Entrega", celda: (f) => formatearFechaHora(f.entrega_prevista) },
            { clave: "devolucion", etiqueta: "Devolución", celda: (f) => formatearFechaHora(f.devolucion_prevista) },
            {
              clave: "estado",
              etiqueta: "Estado",
              celda: (f) => <InsigniaEstado estado={f.estado} etiquetas={ETIQUETAS_ESTADO_ALQUILER} finales={["devuelto", "cancelado"]} />,
            },
            { clave: "precio", etiqueta: "Precio", numerica: true, celda: (f) => formatearMoneda(f.importe_total) },
            { clave: "pendiente", etiqueta: "Saldo pendiente", numerica: true, celda: (f) => formatearMoneda(f.pendiente) },
            { clave: "financiero", etiqueta: "Cobro", celda: (f) => <InsigniaFinanciera estado={f.estado_financiero} /> },
          ]}
          totales={{ pendiente: formatearMoneda(sumarMontos(filas.map((f) => f.pendiente))) }}
        />
      )}
      {(data?.length ?? 0) > LIMITE_LISTADO && (
        <p className="mt-3 text-sm texto-tenue">Se muestran los primeros {LIMITE_LISTADO}; refine el filtro.</p>
      )}
    </>
  );
}
