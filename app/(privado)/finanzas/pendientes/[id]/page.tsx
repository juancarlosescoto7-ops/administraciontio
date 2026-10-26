import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { LIMITE_LISTADO } from "@/lib/finanzas/consultas";
import { ETIQUETAS_METODO } from "@/lib/finanzas/definiciones";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import { InsigniaFinanciera, ResumenImportes, Seccion } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";

/** Estado de cuenta de un cliente: cargos, cobros y saldos. */
export default function PaginaEstadoCuenta({ params }: PageProps<"/finanzas/pendientes/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: cliente }, { data: saldo }, { data: cargos }, { data: cobros }] = await Promise.all([
    supabase.from("clientes").select("id, nombre, identificacion, activo").eq("id", id).maybeSingle(),
    supabase.from("saldos_clientes").select("*").eq("cliente_id", id).maybeSingle(),
    supabase
      .from("saldos_cargos")
      .select("id, concepto, fecha, vencimiento, monto, aplicado, pendiente, estado")
      .eq("cliente_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(LIMITE_LISTADO),
    supabase
      .from("saldos_cobros")
      .select("id, fecha, cuenta_nombre, metodo, monto, aplicado, disponible, estado")
      .eq("cliente_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(LIMITE_LISTADO),
  ]);
  if (!cliente) notFound();

  return (
    <>
      <Encabezado
        titulo={cliente.nombre}
        descripcion={`Estado de cuenta${cliente.identificacion ? ` · ${cliente.identificacion}` : ""}`}
        volver={{ href: "/finanzas/pendientes", etiqueta: "Pendientes" }}
        acciones={
          <>
            {puede("registrarCargo", usuario.rol) && cliente.activo && (
              <Link href={`/finanzas/cargos/nuevo?cliente=${id}`} className="boton boton-secundario">Registrar cargo</Link>
            )}
            {puede("registrarCobro", usuario.rol) && (
              <Link href={`/finanzas/cobros/nuevo?cliente=${id}`} className="boton boton-primario">Registrar cobro</Link>
            )}
          </>
        }
      />

      <ResumenImportes
        importes={[
          { etiqueta: "Total de cargos", valor: saldo?.total_cargos ?? 0 },
          { etiqueta: "Pagado", valor: saldo?.total_aplicado ?? 0 },
          { etiqueta: "Pendiente", valor: saldo?.pendiente ?? 0, destacado: true },
          { etiqueta: "Saldo a favor", valor: saldo?.saldo_a_favor ?? 0, ayuda: "Cobros aún no aplicados" },
        ]}
      />

      <Seccion titulo="Cargos">
        <Tabla
          filas={(cargos ?? []).map((c) => ({ ...c, id: c.id! }))}
          enlace={(c) => `/finanzas/cargos/${c.id}`}
          vacio="El cliente no tiene cargos."
          columnas={[
            { clave: "concepto", etiqueta: "Concepto", celda: (c) => c.concepto },
            { clave: "fecha", etiqueta: "Fecha", celda: (c) => formatearFecha(c.fecha) },
            { clave: "vence", etiqueta: "Vence", celda: (c) => formatearFecha(c.vencimiento) },
            { clave: "monto", etiqueta: "Total", numerica: true, celda: (c) => formatearMoneda(c.monto) },
            { clave: "pagado", etiqueta: "Pagado", numerica: true, celda: (c) => formatearMoneda(c.aplicado) },
            { clave: "pendiente", etiqueta: "Pendiente", numerica: true, celda: (c) => formatearMoneda(c.pendiente) },
            { clave: "estado", etiqueta: "Estado", celda: (c) => <InsigniaFinanciera estado={c.estado} /> },
          ]}
        />
      </Seccion>

      <Seccion titulo="Cobros">
        <Tabla
          filas={(cobros ?? []).map((c) => ({ ...c, id: c.id! }))}
          enlace={(c) => `/finanzas/cobros/${c.id}`}
          vacio="El cliente no tiene cobros."
          columnas={[
            { clave: "fecha", etiqueta: "Fecha", celda: (c) => formatearFecha(c.fecha) },
            { clave: "cuenta", etiqueta: "Caja/banco", celda: (c) => c.cuenta_nombre },
            { clave: "metodo", etiqueta: "Método", celda: (c) => (c.metodo ? ETIQUETAS_METODO[c.metodo] : "—") },
            { clave: "monto", etiqueta: "Recibido", numerica: true, celda: (c) => formatearMoneda(c.monto) },
            { clave: "aplicado", etiqueta: "Aplicado", numerica: true, celda: (c) => formatearMoneda(c.aplicado) },
            { clave: "disponible", etiqueta: "Saldo a favor", numerica: true, celda: (c) => formatearMoneda(c.disponible) },
            { clave: "estado", etiqueta: "Estado", celda: (c) => <InsigniaFinanciera estado={c.estado} /> },
          ]}
        />
      </Seccion>
    </>
  );
}
