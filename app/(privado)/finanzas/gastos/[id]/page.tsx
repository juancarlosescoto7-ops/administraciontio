import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid, primerValor } from "@/lib/catalogos/presentacion";
import { registrarPagoGasto } from "@/lib/finanzas/acciones";
import { opcionesCuentas } from "@/lib/finanzas/consultas";
import { camposPagoGasto, ETIQUETAS_ACTIVIDAD, ETIQUETAS_METODO } from "@/lib/finanzas/definiciones";
import { aCentavos } from "@/lib/finanzas/montos";
import { formatearFecha, formatearFechaHora, formatearMoneda, hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioCorreccion, FormularioOperacion } from "@/components/finanzas/operaciones";
import { AsientosDocumento, Datos, InsigniaFinanciera, ResumenImportes, Seccion } from "@/components/finanzas/resumen";
import { Desplegable } from "@/components/operaciones";
import { Tabla } from "@/components/finanzas/tabla";

export default function PaginaGasto({ params, searchParams }: PageProps<"/finanzas/gastos/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("verTesoreria", usuario.rol)) {
    return <SinPermiso mensaje="Los gastos los consultan el administrador y finanzas." />;
  }
  const { id } = await params;
  const parametros = await searchParams;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: gasto }, { data: pagos }] = await Promise.all([
    supabase.from("saldos_gastos").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("pagos_gasto")
      .select("id, fecha, metodo, referencia, monto, estado, motivo_reverso, cuentas_dinero(nombre)")
      .eq("gasto_id", id)
      .order("created_at"),
  ]);
  if (!gasto) notFound();

  const ruta = `/finanzas/gastos/${id}`;
  const registrado = gasto.estado === "registrado";
  const pendiente = aCentavos(gasto.pendiente) ?? 0;
  const corrige = puede("corregir", usuario.rol);
  const pagoAReversar = pagos?.find((p) => p.id === primerValor(parametros.pago) && p.estado === "confirmado");
  const tienePagos = (pagos ?? []).some((p) => p.estado === "confirmado");
  const cuentas = registrado && pendiente > 0 && puede("gestionarGastos", usuario.rol) ? await opcionesCuentas(supabase) : [];

  return (
    <>
      <Encabezado
        titulo={gasto.concepto}
        descripcion={<InsigniaFinanciera estado={gasto.estado} />}
        volver={{ href: "/finanzas/gastos", etiqueta: "Gastos" }}
      />
      <AvisoOperacion
        parametros={parametros}
        mensajes={{ guardado: "Gasto registrado.", pagado: "Pago registrado.", corregido: "Corrección registrada." }}
      />

      <ResumenImportes
        importes={[
          { etiqueta: "Gasto reconocido", valor: gasto.monto },
          { etiqueta: "Pagado", valor: gasto.pagado },
          { etiqueta: "Por pagar", valor: gasto.pendiente, destacado: true },
        ]}
      />
      <Datos
        filas={[
          ["Proveedor", gasto.proveedor_nombre ?? "Sin proveedor"],
          ["Categoría", gasto.categoria_nombre],
          ["Actividad", gasto.actividad ? ETIQUETAS_ACTIVIDAD[gasto.actividad] : null],
          ["Fecha", formatearFecha(gasto.fecha)],
          ["Vencimiento", formatearFecha(gasto.vencimiento)],
          ["Notas", gasto.notas],
          ["Registrado", formatearFechaHora(gasto.created_at)],
          ...(gasto.estado === "anulado"
            ? ([["Motivo de anulación", gasto.motivo_anulacion], ["Anulado", formatearFechaHora(gasto.anulado_en)]] as [string, string | null][])
            : []),
        ]}
      />

      {cuentas.length > 0 && (
        <Seccion titulo="Registrar pago">
          <div className="tarjeta p-4 sm:p-6">
            <FormularioOperacion
              campos={camposPagoGasto(cuentas, hoyEnTegucigalpa())}
              accion={registrarPagoGasto.bind(null, id)}
              textoEnviar="Registrar pago"
            />
          </div>
        </Seccion>
      )}

      <Seccion titulo="Pagos">
        <Tabla
          filas={pagos ?? []}
          vacio="Todavía no hay pagos de este gasto."
          columnas={[
            { clave: "fecha", etiqueta: "Fecha", celda: (p) => formatearFecha(p.fecha) },
            { clave: "cuenta", etiqueta: "Caja/banco", celda: (p) => p.cuentas_dinero?.nombre ?? "—" },
            { clave: "metodo", etiqueta: "Método", celda: (p) => ETIQUETAS_METODO[p.metodo] },
            { clave: "referencia", etiqueta: "Referencia", celda: (p) => p.referencia ?? "—" },
            { clave: "monto", etiqueta: "Importe", numerica: true, celda: (p) => formatearMoneda(p.monto) },
            { clave: "estado", etiqueta: "Estado", celda: (p) => <InsigniaFinanciera estado={p.estado} /> },
            ...(corrige
              ? [{
                  clave: "accion",
                  etiqueta: "Acción",
                  celda: (p: { id: string; estado: string }) =>
                    p.estado === "confirmado" ? (
                      <Link href={`${ruta}?pago=${p.id}`} className="text-sm text-enlace hover:underline">Reversar</Link>
                    ) : null,
                }]
              : []),
          ]}
        />
      </Seccion>

      {corrige && pagoAReversar && (
        <Seccion titulo="Reversar pago" abierta>
          <div className="tarjeta desplegable-peligro p-4 sm:p-6">
            <p className="mb-4 text-sm">
              Devuelve {formatearMoneda(pagoAReversar.monto)} a {pagoAReversar.cuentas_dinero?.nombre} y el gasto vuelve a quedar
              pendiente por ese importe. El pago original se conserva como reversado.
            </p>
            <FormularioCorreccion
              tipo="pago_gasto"
              id={pagoAReversar.id}
              volver={ruta}
              textoEnviar="Reversar pago"
              confirmacion="Confirmo el reverso de este pago"
            />
          </div>
        </Seccion>
      )}

      {corrige && registrado && !pagoAReversar && (
        <Seccion titulo="Correcciones">
          {tienePagos ? (
            <p className="aviso aviso-info text-sm">
              Para anular el gasto, reverse primero sus pagos confirmados.
            </p>
          ) : (
            <Desplegable titulo="Anular gasto" peligro>
              <FormularioCorreccion
                tipo="gasto"
                id={id}
                volver={ruta}
                textoEnviar="Anular gasto"
                confirmacion="Confirmo la anulación de este gasto"
              />
            </Desplegable>
          )}
        </Seccion>
      )}

      <Seccion titulo="Asientos contables">
        <AsientosDocumento
          origenes={[{ tipo: "gasto", id }, ...(pagos ?? []).map((p) => ({ tipo: "pago_gasto" as const, id: p.id }))]}
        />
      </Seccion>
    </>
  );
}
