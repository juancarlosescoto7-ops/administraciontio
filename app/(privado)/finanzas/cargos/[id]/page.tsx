import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { aplicarSaldo } from "@/lib/finanzas/acciones";
import { camposAplicarSaldo, ETIQUETAS_ACTIVIDAD } from "@/lib/finanzas/definiciones";
import { aCentavos } from "@/lib/finanzas/montos";
import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioCorreccion, FormularioOperacion } from "@/components/finanzas/operaciones";
import { AsientosDocumento, Datos, InsigniaFinanciera, ResumenImportes, Seccion } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";

export default function PaginaCargo({ params, searchParams }: PageProps<"/finanzas/cargos/[id]">) {
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
  const [{ data: cargo }, { data: aplicaciones }] = await Promise.all([
    supabase.from("saldos_cargos").select("*").eq("id", id).maybeSingle(),
    supabase.from("aplicaciones_cobro").select("id, cobro_id, monto, fecha, estado").eq("cargo_id", id).order("created_at"),
  ]);
  if (!cargo || !cargo.cliente_id) notFound();

  const { data: saldoCliente } = await supabase
    .from("saldos_clientes")
    .select("saldo_a_favor")
    .eq("cliente_id", cargo.cliente_id)
    .maybeSingle();

  const ruta = `/finanzas/cargos/${id}`;
  const vigente = cargo.estado === "vigente";
  const pendiente = aCentavos(cargo.pendiente) ?? 0;
  const aFavor = aCentavos(saldoCliente?.saldo_a_favor) ?? 0;

  return (
    <>
      <Encabezado
        titulo={cargo.concepto}
        descripcion={<InsigniaFinanciera estado={cargo.estado} />}
        volver={{ href: "/finanzas/cargos", etiqueta: "Cargos" }}
      />
      <AvisoOperacion
        parametros={parametros}
        mensajes={{ guardado: "Cargo registrado.", aplicado: "Saldo a favor aplicado.", corregido: "Cargo anulado." }}
      />

      <ResumenImportes
        importes={[
          { etiqueta: "Total del cargo", valor: cargo.monto },
          { etiqueta: "Pagado", valor: cargo.aplicado },
          { etiqueta: "Pendiente", valor: cargo.pendiente, destacado: true },
          { etiqueta: "Saldo a favor del cliente", valor: saldoCliente?.saldo_a_favor ?? 0 },
        ]}
      />
      <Datos
        filas={[
          ["Cliente", <Link key="c" href={`/finanzas/pendientes/${cargo.cliente_id}`} className="text-primario hover:underline">{cargo.cliente_nombre}</Link>],
          ["Actividad", cargo.actividad ? ETIQUETAS_ACTIVIDAD[cargo.actividad] : null],
          ["Fecha", formatearFecha(cargo.fecha)],
          ["Vencimiento", formatearFecha(cargo.vencimiento)],
          ["Origen", cargo.origen_tipo === "manual" ? "Cargo administrativo" : cargo.origen_tipo],
          ["Registrado", formatearFechaHora(cargo.created_at)],
          ...(cargo.estado === "anulado"
            ? ([["Motivo de anulación", cargo.motivo_anulacion], ["Anulado", formatearFechaHora(cargo.anulado_en)]] as [string, string | null][])
            : []),
        ]}
      />

      {vigente && pendiente > 0 && aFavor > 0 && puede("registrarCobro", usuario.rol) && (
        <Seccion titulo="Aplicar saldo a favor">
          <div className="tarjeta p-4 sm:p-6">
            <p className="mb-4 text-sm">
              El cliente tiene {formatearMoneda(saldoCliente?.saldo_a_favor)} a favor. Se toma de sus cobros más antiguos y no
              vuelve a entrar dinero a caja.
            </p>
            <FormularioOperacion campos={camposAplicarSaldo()} accion={aplicarSaldo.bind(null, id)} textoEnviar="Aplicar saldo" />
          </div>
        </Seccion>
      )}
      {vigente && pendiente > 0 && (
        <p className="mb-6">
          <Link href={`/finanzas/cobros/nuevo?cliente=${cargo.cliente_id}`} className="boton boton-secundario">
            Registrar cobro de este cliente
          </Link>
        </p>
      )}

      <Seccion titulo="Pagos aplicados">
        <Tabla
          filas={aplicaciones ?? []}
          enlace={(a) => `/finanzas/cobros/${a.cobro_id}`}
          vacio="Todavía no se ha aplicado ningún pago a este cargo."
          columnas={[
            { clave: "fecha", etiqueta: "Fecha", celda: (a) => formatearFecha(a.fecha) },
            { clave: "monto", etiqueta: "Importe", numerica: true, celda: (a) => formatearMoneda(a.monto) },
            { clave: "estado", etiqueta: "Estado", celda: (a) => <InsigniaFinanciera estado={a.estado} /> },
          ]}
        />
      </Seccion>

      {vigente && puede("corregir", usuario.rol) && (
        <Seccion titulo="Anular cargo">
          <div className="tarjeta p-4 sm:p-6">
            <p className="mb-4 text-sm">
              Reversa el ingreso reconocido. Lo ya pagado ({formatearMoneda(cargo.aplicado)}) vuelve al saldo a favor del cliente;
              no se mueve dinero.
            </p>
            <FormularioCorreccion
              tipo="cargo"
              id={id}
              volver={ruta}
              textoEnviar="Anular cargo"
              confirmacion="Confirmo la anulación de este cargo"
            />
          </div>
        </Seccion>
      )}

      {puede("verTesoreria", usuario.rol) && (
        <Seccion titulo="Asientos contables">
          <AsientosDocumento origenes={[{ tipo: "cargo", id }]} />
        </Seccion>
      )}
    </>
  );
}
