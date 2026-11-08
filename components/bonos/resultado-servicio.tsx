import { randomUUID } from "node:crypto";
import Link from "next/link";
import { puede, type Rol } from "@/lib/auth/roles";
import { pagarGastoServicio, agregarGastosServicio } from "@/lib/bonos/acciones";
import { formatearVoucher, ganancia } from "@/lib/bonos/lineas";
import { opcionesLineas } from "@/lib/bonos/servidor";
import { camposPagoGasto } from "@/lib/finanzas/definiciones";
import { centavosATexto, sumarMontos } from "@/lib/finanzas/montos";
import { SERVICIOS_GASTO, type TipoServicioGasto } from "@/lib/finanzas/servicios";
import { formatearFecha, formatearMoneda, hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/tipos-bd";
import { LineasGasto } from "@/components/bonos/lineas-gasto";
import { Dialogo } from "@/components/dialogo";
import { FormularioOperacion } from "@/components/finanzas/operaciones";
import { Seccion } from "@/components/finanzas/resumen";
import { RecomendacionResultado } from "@/components/bonos/recomendacion";

type OrigenCargo = Database["public"]["Enums"]["origen_cargo"];
const ORIGEN: Record<Exclude<TipoServicioGasto, "membresia">, OrigenCargo> = {
  alquiler: "alquiler",
  transporte: "transporte",
  traslado: "traslado_ambulancia",
};

/**
 * «Tienes este ingreso, le restas estos bonos y gastos y te queda esto.»
 * Mientras el servicio no genera su cargo, el ingreso es el precio pactado
 * (estimado). Desde aquí se agregan bonos y gastos, se pagan y se abren sus
 * vouchers. Los anulados se muestran tachados y no cuentan.
 */
export async function ResultadoServicio({
  tipo,
  id,
  rol,
  estimado,
  conductorId = null,
  abierta = false,
  recomendacion = null,
}: {
  tipo: TipoServicioGasto;
  id: string;
  rol: Rol;
  /** Ingreso previsto si aún no hay cargos; null si el servicio se canceló. */
  estimado: { monto: number | string | null; nota: string } | null;
  conductorId?: string | null;
  /** Abierta al llegar (p. ej., tras agregar un bono). */
  abierta?: boolean;
  /** Recomendación flotante tras finalizar el servicio o vender la membresía. */
  recomendacion?: { titulo: string; parametro: string } | null;
}) {
  const supabase = await createClient();
  const columna = SERVICIOS_GASTO[tipo].columna;
  const [gastosR, cargosR, opciones] = await Promise.all([
    supabase.from("gastos_de_servicio").select("*").eq(columna, id).order("created_at"),
    tipo === "membresia"
      ? supabase.from("saldos_periodos").select("monto:precio, aplicado, estado:cargo_estado").eq("membresia_id", id).not("cargo_id", "is", null)
      : supabase.from("saldos_cargos").select("monto, aplicado, estado").eq("origen_tipo", ORIGEN[tipo]).eq("origen_id", id),
    opcionesLineas(supabase),
  ]);
  if (gastosR.error || cargosR.error) {
    return <p role="alert" className="aviso aviso-error">No se pudo calcular el resultado del servicio.</p>;
  }
  const gastos = gastosR.data;
  const idsGasto = gastos.map((g) => g.gasto_id!).filter(Boolean);
  const pagosR = idsGasto.length
    ? await supabase.from("pagos_gasto").select("id, gasto_id, fecha, monto, estado, comprobantes_pago(numero)").in("gasto_id", idsGasto).order("created_at")
    : { data: [], error: null };
  const pagos = pagosR.data ?? [];

  const cargos = (cargosR.data ?? []).filter((c) => c.estado === "vigente");
  const real = cargos.length > 0;
  const ingreso = real ? sumarMontos(cargos.map((c) => c.monto)) : String(estimado?.monto ?? 0);
  const cobrado = sumarMontos(cargos.map((c) => c.aplicado));
  const vigentes = gastos.filter((g) => g.estado === "registrado");
  const totalGastos = sumarMontos(vigentes.map((g) => g.monto));
  const pagado = sumarMontos(vigentes.map((g) => g.pagado));
  const porPagar = sumarMontos(vigentes.map((g) => g.pendiente));
  const resultado = ganancia(ingreso, vigentes.map((g) => g.monto));
  const verGasto = puede("gestionarGastos", rol);
  const gestionar = puede("gestionarGastosServicio", rol);
  const hoy = hoyEnTegucigalpa();
  const cuentaUnica = opciones.cuentas.length === 1 ? opciones.cuentas[0].valor : null;
  const etiquetaIngreso = tipo === "membresia"
    ? real ? "Cuotas emitidas al cliente" : "Cuota mensual (estimado)"
    : real ? "Ingreso del servicio" : "Ingreso estimado (precio pactado)";
  const notaIngreso = real
    ? tipo === "membresia" ? "Suma de las cuotas emitidas hasta hoy; crece con cada cuota." : "Es el cargo generado al cliente."
    : estimado?.nota ?? "Servicio cancelado: no genera ingreso.";
  const formularioAgregar = (prefijo: string, titulo: string, destinatario = "") => (
    <FormularioOperacion
      campos={[]}
      accion={agregarGastosServicio.bind(null, tipo, id)}
      textoEnviar="Guardar"
      tono="exito"
      prefijo={prefijo}
      extra={<LineasGasto opciones={opciones} claveInicial={randomUUID()} destinatarioInicial={destinatario} titulo={titulo} />}
    />
  );

  return (
    <>
    <Seccion
      titulo="Resultado del servicio"
      abierta={abierta || recomendacion !== null}
      resumen={`${real ? "Ganancia" : "Ganancia estimada"}: ${formatearMoneda(centavosATexto(resultado))}`}
    >
      <div className="tarjeta p-4 sm:p-6" data-resultado-servicio>
        <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-3 tabular-nums">
          <dt>
            <span className="font-medium">{etiquetaIngreso}</span>
            <span className="block text-xs texto-tenue">{notaIngreso}</span>
          </dt>
          <dd className="text-right text-lg font-semibold" data-ingreso>{formatearMoneda(ingreso)}</dd>

          {gastos.map((g) => {
            const anulado = g.estado !== "registrado";
            const propios = pagos.filter((p) => p.gasto_id === g.gasto_id);
            const pendiente = Number(g.pendiente ?? 0) > 0;
            return (
              <div key={g.gasto_id} className="contents" data-gasto-servicio>
                <dt className={`border-t border-borde pt-3 ${anulado ? "line-through texto-tenue" : ""}`}>
                  <span className="font-medium">− {verGasto ? <Link href={`/finanzas/gastos/${g.gasto_id}`} className="hover:underline">{g.concepto}</Link> : g.concepto}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs texto-tenue">
                    <span>{g.categoria_nombre}{g.destinatario ? ` · ${g.destinatario}` : ""} · {formatearFecha(g.fecha)}</span>
                    {anulado ? (
                      <span className="insignia insignia-inactivo">Anulado</span>
                    ) : pendiente ? (
                      <span className="insignia insignia-advertencia">
                        {Number(g.pagado) > 0 ? `Abonado ${formatearMoneda(g.pagado)} · ` : ""}Pendiente {formatearMoneda(g.pendiente)}
                      </span>
                    ) : (
                      <span className="insignia insignia-activo">Pagado</span>
                    )}
                  </span>
                  {(propios.length > 0 || (pendiente && !anulado && gestionar)) && (
                    <span className="mt-2 flex flex-wrap items-center gap-2 no-underline">
                      {propios.map((p) => (
                        <Link
                          key={p.id}
                          href={`/comprobantes/${p.id}`}
                          className={`boton boton-secundario min-h-8 px-3 text-xs ${p.estado === "reversado" ? "line-through" : ""}`}
                          title={p.estado === "reversado" ? "Pago reversado" : `Pago del ${formatearFecha(p.fecha)}`}
                        >
                          Voucher {formatearVoucher(p.comprobantes_pago?.numero)} · {formatearMoneda(p.monto)}
                        </Link>
                      ))}
                      {pendiente && !anulado && gestionar && (
                        <Dialogo titulo={`Pagar: ${g.concepto}`} textoBoton="Pagar" claseBoton="boton boton-primario min-h-8 px-3 text-xs" descripcion={`Pendiente: ${formatearMoneda(g.pendiente)}. Puede abonar una parte.`}>
                          <FormularioOperacion
                            campos={camposPagoGasto(opciones.cuentas, hoy)}
                            registro={{ monto: g.pendiente, cuenta_dinero_id: cuentaUnica, fecha: hoy, metodo: "efectivo", referencia: null }}
                            accion={pagarGastoServicio.bind(null, g.gasto_id!)}
                            textoEnviar="Pagar y ver voucher"
                            tono="exito"
                            prefijo={`pago-${g.gasto_id}-`}
                          />
                        </Dialogo>
                      )}
                    </span>
                  )}
                </dt>
                <dd className={`border-t border-borde pt-3 text-right ${anulado ? "line-through texto-tenue" : ""}`}>− {formatearMoneda(g.monto)}</dd>
              </div>
            );
          })}
          {gastos.length === 0 && (
            <>
              <dt className="border-t border-borde pt-3 texto-tenue">Sin bonos ni gastos registrados.</dt>
              <dd className="border-t border-borde pt-3 text-right texto-tenue">− {formatearMoneda(0)}</dd>
            </>
          )}

          <dt className="border-t-2 border-[var(--borde-fuerte)] pt-3 text-lg font-semibold">{real ? "Le ganaste" : "Ganancia estimada"}</dt>
          <dd
            className={`border-t-2 border-[var(--borde-fuerte)] pt-3 text-right text-xl font-semibold ${resultado < 0 ? "text-[var(--peligro)]" : "text-[var(--exito)]"}`}
            data-ganancia-servicio
          >
            {formatearMoneda(centavosATexto(resultado))}
          </dd>
        </dl>
        <p className="mt-4 text-sm texto-tenue">
          Cobrado al cliente: {formatearMoneda(cobrado)} de {formatearMoneda(real ? ingreso : 0)}
          {" · "}Bonos y gastos: {formatearMoneda(totalGastos)} (pagado {formatearMoneda(pagado)}, por pagar {formatearMoneda(porPagar)})
        </p>

        {gestionar && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Dialogo titulo="Agregar bono o gasto" textoBoton="+ Agregar bono o gasto" claseBoton="boton boton-primario" icono="dinero">
              {formularioAgregar("agregar-gasto-", "Bonos y gastos")}
            </Dialogo>
            {conductorId && (
              <Dialogo titulo="Bono al conductor" textoBoton="Bono al conductor" icono="dinero">
                {formularioAgregar("bono-conductor-", "Bono al conductor", `c:${conductorId}`)}
              </Dialogo>
            )}
          </div>
        )}
      </div>
    </Seccion>
    {recomendacion && gestionar && (
      <RecomendacionResultado
        titulo={recomendacion.titulo}
        parametro={recomendacion.parametro}
        filas={[
          { etiqueta: etiquetaIngreso, valor: formatearMoneda(ingreso) },
          ...vigentes.map((g) => ({ etiqueta: `− ${g.concepto}${g.destinatario ? ` (${g.destinatario})` : ""}`, valor: formatearMoneda(g.monto) })),
          ...(vigentes.length === 0 ? [{ etiqueta: "− Bonos y gastos", valor: formatearMoneda(0) }] : []),
        ]}
        ganancia={formatearMoneda(centavosATexto(resultado))}
        negativa={resultado < 0}
        estimada={!real}
      >
        {formularioAgregar("recomendacion-", "Bonos y gastos")}
      </RecomendacionResultado>
    )}
    </>
  );
}
