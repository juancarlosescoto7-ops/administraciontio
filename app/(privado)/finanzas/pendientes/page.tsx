import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { primerValor } from "@/lib/catalogos/presentacion";
import { limpiarBusqueda } from "@/lib/catalogos/validacion";
import { ETIQUETAS_ACTIVIDAD } from "@/lib/finanzas/definiciones";
import { sumarMontos } from "@/lib/finanzas/montos";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { ResumenImportes, Seccion } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";

const LIMITE = 500;

export default function PaginaPendientes({ searchParams }: PageProps<"/finanzas/pendientes">) {
  return (
    <>
      <Encabezado
        titulo="Pendientes"
        descripcion="Cuentas por cobrar a clientes, saldos a favor y cuentas por pagar a proveedores."
      />
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  const busqueda = limpiarBusqueda(primerValor((await searchParams).q));
  const verPagar = puede("verTesoreria", usuario.rol);
  const supabase = await createClient();

  let consulta = supabase
    .from("saldos_clientes")
    .select("cliente_id, cliente_nombre, total_cargos, total_aplicado, pendiente, saldo_a_favor, proximo_vencimiento")
    .or("pendiente.gt.0,saldo_a_favor.gt.0")
    .order("pendiente", { ascending: false })
    .limit(LIMITE);
  if (busqueda) consulta = consulta.ilike("cliente_nombre", `%${busqueda}%`);

  const [clientes, gastos] = await Promise.all([
    consulta,
    verPagar
      ? supabase
          .from("saldos_gastos")
          .select("id, concepto, proveedor_nombre, actividad, fecha, vencimiento, monto, pagado, pendiente")
          .eq("estado", "registrado")
          .gt("pendiente", 0)
          .order("vencimiento", { ascending: true, nullsFirst: false })
          .limit(LIMITE)
      : null,
  ]);

  const filasClientes = (clientes.data ?? []).map((c) => ({ ...c, id: c.cliente_id! }));
  const filasGastos = (gastos?.data ?? []).map((g) => ({ ...g, id: g.id! }));
  const totalCobrar = sumarMontos(filasClientes.map((c) => c.pendiente));
  const totalAFavor = sumarMontos(filasClientes.map((c) => c.saldo_a_favor));
  const totalPagar = sumarMontos(filasGastos.map((g) => g.pendiente));

  return (
    <>
      <ResumenImportes
        importes={[
          { etiqueta: "Por cobrar", valor: totalCobrar, destacado: true },
          { etiqueta: "Saldos a favor de clientes", valor: totalAFavor },
          ...(verPagar ? [{ etiqueta: "Por pagar a proveedores", valor: totalPagar }] : []),
        ]}
      />

      <Seccion titulo="Cuentas por cobrar">
        <form method="get" className="tarjeta mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <label className="campo flex-1">
            <span className="campo-etiqueta">Cliente</span>
            <input className="entrada" type="search" name="q" defaultValue={busqueda} placeholder="Buscar cliente…" />
          </label>
          <button type="submit" className="boton boton-secundario">Filtrar</button>
        </form>
        {clientes.error ? (
          <p role="alert" className="aviso aviso-error">No se pudo cargar el listado.</p>
        ) : (
          <Tabla
            filas={filasClientes}
            enlace={(c) => `/finanzas/pendientes/${c.id}`}
            vacio="Ningún cliente tiene saldo pendiente ni a favor."
            columnas={[
              { clave: "cliente", etiqueta: "Cliente", celda: (c) => c.cliente_nombre },
              { clave: "total", etiqueta: "Total cargos", numerica: true, celda: (c) => formatearMoneda(c.total_cargos) },
              { clave: "pagado", etiqueta: "Pagado", numerica: true, celda: (c) => formatearMoneda(c.total_aplicado) },
              { clave: "pendiente", etiqueta: "Pendiente", numerica: true, celda: (c) => formatearMoneda(c.pendiente) },
              { clave: "a_favor", etiqueta: "Saldo a favor", numerica: true, celda: (c) => formatearMoneda(c.saldo_a_favor) },
              { clave: "vence", etiqueta: "Próximo vencimiento", celda: (c) => formatearFecha(c.proximo_vencimiento) },
            ]}
            totales={{ pendiente: formatearMoneda(totalCobrar), a_favor: formatearMoneda(totalAFavor) }}
          />
        )}
      </Seccion>

      {verPagar && (
        <Seccion titulo="Cuentas por pagar">
          <Tabla
            filas={filasGastos}
            enlace={(g) => `/finanzas/gastos/${g.id}`}
            vacio="No hay gastos pendientes de pago."
            columnas={[
              { clave: "concepto", etiqueta: "Gasto", celda: (g) => g.concepto },
              { clave: "proveedor", etiqueta: "Proveedor", celda: (g) => g.proveedor_nombre ?? "—" },
              { clave: "actividad", etiqueta: "Actividad", celda: (g) => (g.actividad ? ETIQUETAS_ACTIVIDAD[g.actividad] : "—") },
              { clave: "vence", etiqueta: "Vence", celda: (g) => formatearFecha(g.vencimiento) },
              { clave: "monto", etiqueta: "Total", numerica: true, celda: (g) => formatearMoneda(g.monto) },
              { clave: "pagado", etiqueta: "Pagado", numerica: true, celda: (g) => formatearMoneda(g.pagado) },
              { clave: "pendiente", etiqueta: "Pendiente", numerica: true, celda: (g) => formatearMoneda(g.pendiente) },
            ]}
            totales={{ pendiente: formatearMoneda(totalPagar) }}
          />
        </Seccion>
      )}
    </>
  );
}
