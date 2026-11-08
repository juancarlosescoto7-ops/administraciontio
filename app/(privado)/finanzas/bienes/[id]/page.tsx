import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { darDeBajaBien, editarBien, registrarPagoBien } from "@/lib/bienes/acciones";
import { camposBaja, camposEditarBien, ETIQUETAS_CLASE, FORMAS_INGRESO } from "@/lib/bienes/definiciones";
import { esUuid, primerValor } from "@/lib/catalogos/presentacion";
import { opcionesCuentas } from "@/lib/finanzas/consultas";
import { camposPagoGasto, ETIQUETAS_ACTIVIDAD, ETIQUETAS_METODO } from "@/lib/finanzas/definiciones";
import { aCentavos, sumarMontos } from "@/lib/finanzas/montos";
import { formatearFecha, formatearFechaHora, formatearMoneda, hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioCorreccion, FormularioOperacion } from "@/components/finanzas/operaciones";
import { AsientosDocumento, Datos, InsigniaFinanciera, ResumenImportes, Seccion } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";
import { Desplegable } from "@/components/operaciones";

export default function PaginaBien({ params, searchParams }: PageProps<"/finanzas/bienes/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const mesAnio = (mes: string) => formatearFecha(mes).slice(3);

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("gestionarBienes", usuario.rol)) {
    return <SinPermiso mensaje="Los bienes de la empresa los consultan el administrador y finanzas." />;
  }
  const { id } = await params;
  const parametros = await searchParams;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: bien }, { data: pagos }, { data: depreciaciones }] = await Promise.all([
    supabase.from("saldos_bienes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("pagos_bien")
      .select("id, fecha, metodo, referencia, monto, estado, motivo_reverso, cuentas_dinero(nombre)")
      .eq("bien_id", id)
      .order("created_at"),
    supabase.from("depreciaciones_bien").select("id, mes, monto, estado").eq("bien_id", id).order("mes", { ascending: false }),
  ]);
  if (!bien) notFound();

  const ruta = `/finanzas/bienes/${id}`;
  const activo = bien.estado === "activo";
  const porPagar = aCentavos(bien.por_pagar) ?? 0;
  const corrige = puede("corregir", usuario.rol);
  const pagoAReversar = pagos?.find((p) => p.id === primerValor(parametros.pago) && p.estado === "confirmado");
  const tienePagos = (pagos ?? []).some((p) => p.estado === "confirmado");
  const cuentas = bien.estado !== "anulado" && porPagar > 0 ? await opcionesCuentas(supabase) : [];
  const forma = bien.origen === "existente" ? FORMAS_INGRESO.existente : "Compra";
  const cuotasConfirmadas = (depreciaciones ?? []).filter((d) => d.estado === "confirmado");

  return (
    <>
      <Encabezado
        titulo={bien.nombre ?? "Bien"}
        descripcion={<InsigniaFinanciera estado={bien.estado} />}
        volver={{ href: "/finanzas/bienes", etiqueta: "Bienes de la empresa" }}
      />
      <AvisoOperacion
        parametros={parametros}
        mensajes={{
          guardado: "Bien registrado.",
          pagado: "Pago registrado.",
          editado: "Datos actualizados.",
          baja: "Bien dado de baja.",
          corregido: "Corrección registrada.",
        }}
      />

      <ResumenImportes
        importes={[
          { etiqueta: "Costo", valor: bien.costo },
          { etiqueta: "Depreciación acumulada", valor: bien.depreciacion_acumulada },
          { etiqueta: "Valor en libros", valor: bien.valor_en_libros, destacado: true },
          ...(bien.origen === "compra" ? [{ etiqueta: "Por pagar", valor: bien.por_pagar, ayuda: `Pagado: ${formatearMoneda(bien.pagado)}` }] : []),
        ]}
      />
      <Datos
        filas={[
          ["Clase", bien.clase ? ETIQUETAS_CLASE[bien.clase] : null],
          ["Actividad", bien.actividad ? ETIQUETAS_ACTIVIDAD[bien.actividad] : null],
          ["Ingreso", forma],
          ["Proveedor", bien.proveedor_nombre],
          ["Vehículo", bien.vehiculo_id ? <Link href={`/vehiculos/${bien.vehiculo_id}`} className="text-enlace underline">{bien.vehiculo_nombre}</Link> : null],
          ["Fecha de adquisición", formatearFecha(bien.fecha_adquisicion)],
          ["Fecha de registro en libros", formatearFecha(bien.fecha_registro)],
          ...(bien.vencimiento ? ([["Vencimiento del saldo", formatearFecha(bien.vencimiento)]] as [string, string][]) : []),
          [
            "Depreciación",
            bien.vida_util_meses
              ? `${formatearMoneda(bien.cuota_mensual)} al mes durante ${bien.vida_util_meses} meses de vida útil · residual ${formatearMoneda(bien.valor_residual)}`
              : "No se deprecia (terreno)",
          ],
          ...(Number(bien.depreciacion_previa) > 0 ? ([["Depreciación previa al registro", formatearMoneda(bien.depreciacion_previa)]] as [string, string][]) : []),
          ["Descripción", bien.descripcion],
          ["Registrado", formatearFechaHora(bien.created_at)],
          ...(bien.estado === "dado_de_baja"
            ? ([["Fecha de baja", formatearFecha(bien.fecha_baja)], ["Motivo de la baja", bien.motivo_baja]] as [string, string | null][])
            : []),
          ...(bien.estado === "anulado"
            ? ([["Motivo de anulación", bien.motivo_anulacion], ["Anulado", formatearFechaHora(bien.anulado_en)]] as [string, string | null][])
            : []),
        ]}
      />

      {cuentas.length > 0 && (
        <Seccion titulo="Registrar pago" abierta>
          <div className="tarjeta p-4 sm:p-6">
            <FormularioOperacion
              campos={camposPagoGasto(cuentas, hoyEnTegucigalpa())}
              accion={registrarPagoBien.bind(null, id)}
              textoEnviar="Registrar pago"
            />
          </div>
        </Seccion>
      )}

      {bien.origen === "compra" && (
        <Seccion titulo="Pagos de la compra">
          <Tabla
            filas={pagos ?? []}
            vacio="Todavía no hay pagos de esta compra."
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
      )}

      {corrige && pagoAReversar && (
        <Desplegable titulo="Reversar pago" peligro abierto>
          <p className="mb-4 text-sm">
            Devuelve {formatearMoneda(pagoAReversar.monto)} a {pagoAReversar.cuentas_dinero?.nombre} y la compra vuelve a quedar pendiente
            por ese importe. El pago original se conserva como reversado.
          </p>
          <FormularioCorreccion
            tipo="pago_bien"
            id={pagoAReversar.id}
            volver={ruta}
            textoEnviar="Reversar pago"
            confirmacion="Confirmo el reverso de este pago"
          />
        </Desplegable>
      )}

      {bien.vida_util_meses !== null && (
        <Seccion titulo="Depreciación mensual">
          <p className="mb-3 text-sm texto-tenue">
            Una cuota por mes cumplido, contabilizada el último día del mes (gasto por depreciación contra depreciación acumulada).
            Registradas: {cuotasConfirmadas.length} · {formatearMoneda(sumarMontos(cuotasConfirmadas.map((d) => d.monto)))}.
          </p>
          <Tabla
            filas={depreciaciones ?? []}
            vacio="Todavía no hay cuotas: la primera se registra al cierre del mes siguiente al registro."
            columnas={[
              { clave: "mes", etiqueta: "Mes", celda: (d) => mesAnio(d.mes) },
              { clave: "monto", etiqueta: "Cuota", numerica: true, celda: (d) => formatearMoneda(d.monto) },
              { clave: "estado", etiqueta: "Estado", celda: (d) => <InsigniaFinanciera estado={d.estado} /> },
            ]}
          />
        </Seccion>
      )}

      {activo && !pagoAReversar && (
        <Seccion titulo="Editar datos">
          <div className="tarjeta p-4 sm:p-6">
            <p className="mb-4 text-sm texto-tenue">Solo nombre y descripción. Los importes y fechas no se editan: si están mal, anule el bien y regístrelo de nuevo.</p>
            <FormularioOperacion
              campos={camposEditarBien()}
              registro={{ nombre: bien.nombre, descripcion: bien.descripcion }}
              accion={editarBien.bind(null, id)}
              textoEnviar="Guardar cambios"
              prefijo="editar-"
            />
          </div>
        </Seccion>
      )}

      {activo && !pagoAReversar && (
        <Seccion titulo="Dar de baja">
          <p className="mb-3 text-sm">
            Para un bien vendido, desechado o perdido. Se registra la depreciación de los meses cumplidos hasta la fecha de baja; el bien sale
            del balance y su valor en libros ({formatearMoneda(bien.valor_en_libros)} hoy) pasa como pérdida por baja de bienes.
            {porPagar > 0 ? " Lo que se deba de la compra sigue pendiente." : ""}
          </p>
          <Desplegable titulo="Dar de baja el bien" peligro>
            <FormularioOperacion
              campos={camposBaja(hoyEnTegucigalpa())}
              accion={darDeBajaBien.bind(null, id)}
              textoEnviar="Dar de baja"
              prefijo="baja-"
              tono="peligro"
            />
          </Desplegable>
        </Seccion>
      )}

      {corrige && activo && !pagoAReversar && (
        <Seccion titulo="Correcciones">
          {tienePagos ? (
            <p className="aviso aviso-info text-sm">Para anular un bien registrado por error, reverse primero sus pagos confirmados.</p>
          ) : (
            <Desplegable titulo="Anular bien" peligro>
              <p className="mb-4 text-sm">
                Solo para un registro equivocado: reversa el asiento del bien y el de cada cuota de depreciación. Para un bien que se vendió o
                desechó, use «Dar de baja».
              </p>
              <FormularioCorreccion
                tipo="bien"
                id={id}
                volver={ruta}
                textoEnviar="Anular bien"
                confirmacion="Confirmo la anulación de este bien"
              />
            </Desplegable>
          )}
        </Seccion>
      )}

      <Seccion titulo="Asientos contables">
        <AsientosDocumento
          origenes={[
            { tipo: "bien", id },
            ...(pagos ?? []).map((p) => ({ tipo: "pago_bien" as const, id: p.id })),
            // Las cuotas tienen su propia tabla arriba; aquí, la más reciente.
            ...(depreciaciones ?? []).slice(0, 1).map((d) => ({ tipo: "depreciacion" as const, id: d.id })),
            ...(bien.estado === "dado_de_baja" ? [{ tipo: "baja_bien" as const, id }] : []),
          ]}
        />
      </Seccion>
    </>
  );
}
