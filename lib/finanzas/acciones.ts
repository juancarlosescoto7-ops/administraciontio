"use server";

import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { esUuid } from "@/lib/catalogos/presentacion";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { clave, fallo, procesar, SIN_CLAVE, texto, traducir, type ClienteSupabase } from "@/lib/operaciones";
import type { Database } from "@/lib/supabase/tipos-bd";
import {
  camposAplicarSaldo,
  camposApertura,
  camposCargo,
  camposCobro,
  camposCorreccion,
  camposGasto,
  camposPagoGasto,
  camposTransferencia,
} from "./definiciones";
import { aCentavos, decimal, opcional } from "./montos";
import { esTipoServicio, SERVICIOS_GASTO } from "./servicios";

type Enums = Database["public"]["Enums"];

/**
 * Un cobro puede saldar cuotas de membresía vencidas: se pone al día al
 * cliente en el acto (reactivación). Si falla, el cobro ya quedó registrado y
 * la membresía se actualizará en la siguiente ejecución.
 */
async function actualizarMembresiasDe(supabase: ClienteSupabase, clienteId: string) {
  const { error } = await supabase.rpc("actualizar_mensualidades", { p_cliente_id: clienteId });
  if (error) console.error("No se pudieron actualizar las membresías del cliente", error.code, error.message);
}

// --- Cobros y cargos ---------------------------------------------------

export async function registrarCobro(
  clienteId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const campos = camposCobro([], hoyEnTegucigalpa());

  return procesar(anterior, formData, campos, "registrarCobro", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia || !esUuid(clienteId)) return SIN_CLAVE;

    const { data, error } = await supabase.rpc("registrar_cobro_automatico", {
      p_idempotencia: idempotencia,
      p_cliente_id: clienteId,
      p_cuenta_dinero_id: String(datos.cuenta_dinero_id),
      p_fecha: String(datos.fecha),
      p_metodo: datos.metodo as Enums["metodo_pago"],
      p_referencia: opcional(texto(datos.referencia)),
      p_monto: decimal(String(datos.monto)),
    });
    if (error) return traducir(error);
    await actualizarMembresiasDe(supabase, clienteId);
    return { destino: `/finanzas/cobros/${data}?guardado=1` };
  });
}

export async function registrarCargo(
  clienteId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposCargo(hoyEnTegucigalpa()), "registrarCargo", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia || !esUuid(clienteId)) return SIN_CLAVE;
    const { data, error } = await supabase.rpc("registrar_cargo", {
      p_idempotencia: idempotencia,
      p_cliente_id: clienteId,
      p_cuenta_ingreso: String(datos.cuenta_ingreso),
      p_concepto: String(datos.concepto),
      p_fecha: String(datos.fecha),
      p_vencimiento: opcional(texto(datos.vencimiento)),
      p_monto: decimal(String(datos.monto)),
    });
    if (error) return traducir(error);
    return { destino: `/finanzas/cargos/${data}?guardado=1` };
  });
}

export async function aplicarSaldo(
  cargoId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposAplicarSaldo(), "registrarCobro", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia || !esUuid(cargoId)) return SIN_CLAVE;
    const { error } = await supabase.rpc("aplicar_saldo_a_favor", {
      p_idempotencia: idempotencia,
      p_cargo_id: cargoId,
      p_monto: decimal(String(datos.monto)),
    });
    if (error) return traducir(error);
    const { data: cargo } = await supabase.from("cargos_cliente").select("cliente_id").eq("id", cargoId).maybeSingle();
    if (cargo) await actualizarMembresiasDe(supabase, cargo.cliente_id);
    return { destino: `/finanzas/cargos/${cargoId}?aplicado=1` };
  });
}

// --- Gastos --------------------------------------------------------------

export async function registrarGasto(anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return registrarGastoRelacionado("", "", anterior, formData);
}

export async function registrarGastoRelacionado(tipo: string, servicioId: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const relacionado = tipo !== "" || servicioId !== "";
  if (relacionado && (!esTipoServicio(tipo) || !esUuid(servicioId))) return { ...anterior, error: "Servicio no válido." };
  const actividad = esTipoServicio(tipo) ? SERVICIOS_GASTO[tipo].actividad : null;
  const campos = camposGasto(hoyEnTegucigalpa(), [], [], []).filter((c) => !actividad || c.nombre !== "actividad");
  return procesar(anterior, formData, campos, "gestionarGastos", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia) return SIN_CLAVE;

    const pagoMonto = texto(datos.pago_monto);
    let pago: { cuenta_dinero_id: string; metodo: string; referencia: string | null; monto: string } | null = null;
    if (pagoMonto !== null && aCentavos(pagoMonto)! > 0) {
      const cuenta = texto(datos.pago_cuenta_dinero_id);
      if (!cuenta) {
        return fallo("Revise los campos marcados.", { pago_cuenta_dinero_id: "Indique de qué caja o banco sale el pago." });
      }
      if (aCentavos(pagoMonto)! > aCentavos(texto(datos.monto))!) {
        return fallo("Revise los campos marcados.", { pago_monto: "El pago no puede superar el importe del gasto." });
      }
      pago = {
        cuenta_dinero_id: cuenta,
        metodo: texto(datos.pago_metodo) ?? "efectivo",
        referencia: texto(datos.pago_referencia),
        monto: pagoMonto,
      };
    }

    if ([datos.empleado_id, datos.conductor_id, datos.proveedor_id].filter(Boolean).length > 1) {
      return fallo("Seleccione un solo destinatario: empleado, conductor o proveedor.");
    }
    const { data, error } = await supabase.rpc("registrar_gasto_personal", {
      p_empleado_id: opcional(texto(datos.empleado_id)),
      p_conductor_id: opcional(texto(datos.conductor_id)),
      ...(relacionado ? { p_tipo: tipo, p_servicio_id: servicioId } : {}),
      p_idempotencia: idempotencia,
      p_proveedor_id: opcional(texto(datos.proveedor_id)),
      p_categoria_id: String(datos.categoria_id),
      p_actividad: actividad ?? datos.actividad as Enums["actividad"],
      p_fecha: String(datos.fecha),
      p_vencimiento: opcional(texto(datos.vencimiento)),
      p_concepto: String(datos.concepto),
      p_monto: decimal(String(datos.monto)),
      p_notas: opcional(texto(datos.notas)),
      p_pago: pago,
    });
    if (error) return traducir(error);
    return { destino: `/finanzas/gastos/${data}?guardado=1` };
  });
}

export async function registrarPagoGasto(
  gastoId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const campos = camposPagoGasto([], hoyEnTegucigalpa());
  return procesar(anterior, formData, campos, "gestionarGastos", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia || !esUuid(gastoId)) return SIN_CLAVE;
    const { error } = await supabase.rpc("registrar_pago_gasto", {
      p_idempotencia: idempotencia,
      p_gasto_id: gastoId,
      p_cuenta_dinero_id: String(datos.cuenta_dinero_id),
      p_fecha: String(datos.fecha),
      p_metodo: datos.metodo as Enums["metodo_pago"],
      p_referencia: opcional(texto(datos.referencia)),
      p_monto: decimal(String(datos.monto)),
    });
    if (error) return traducir(error);
    return { destino: `/finanzas/gastos/${gastoId}?pagado=1` };
  });
}

// --- Caja y bancos -------------------------------------------------------

export async function registrarTransferencia(anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const campos = camposTransferencia([], hoyEnTegucigalpa());
  return procesar(anterior, formData, campos, "transferir", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia) return SIN_CLAVE;
    if (datos.cuenta_origen_id === datos.cuenta_destino_id) {
      return fallo("Revise los campos marcados.", { cuenta_destino_id: "Elija una cuenta distinta del origen." });
    }
    const { data, error } = await supabase.rpc("registrar_transferencia", {
      p_idempotencia: idempotencia,
      p_cuenta_origen_id: String(datos.cuenta_origen_id),
      p_cuenta_destino_id: String(datos.cuenta_destino_id),
      p_fecha: String(datos.fecha),
      p_monto: decimal(String(datos.monto)),
      p_referencia: opcional(texto(datos.referencia)),
    });
    if (error) return traducir(error);
    return { destino: `/finanzas/cuentas/transferencias/${data}?guardado=1` };
  });
}

export async function registrarApertura(
  cuentaId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposApertura(hoyEnTegucigalpa()), "corregir", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia || !esUuid(cuentaId)) return SIN_CLAVE;
    const { error } = await supabase.rpc("registrar_apertura", {
      p_idempotencia: idempotencia,
      p_cuenta_dinero_id: cuentaId,
      p_fecha: String(datos.fecha),
      p_monto: decimal(String(datos.monto)),
    });
    if (error) return traducir(error);
    return { destino: `/finanzas/cuentas/${cuentaId}?apertura=1` };
  });
}

// --- Reversos y anulaciones (solo administrador, con motivo) ------------

const CORRECCIONES = {
  cobro: { funcion: "reversar_cobro", parametro: "p_cobro_id" },
  aplicacion: { funcion: "reversar_aplicacion", parametro: "p_aplicacion_id" },
  cargo: { funcion: "anular_cargo", parametro: "p_cargo_id" },
  gasto: { funcion: "anular_gasto", parametro: "p_gasto_id" },
  pago_gasto: { funcion: "reversar_pago_gasto", parametro: "p_pago_id" },
  transferencia: { funcion: "reversar_transferencia", parametro: "p_transferencia_id" },
  apertura: { funcion: "reversar_apertura", parametro: "p_apertura_id" },
} as const;

export type TipoCorreccion = keyof typeof CORRECCIONES;

export async function corregir(
  tipo: TipoCorreccion,
  id: string,
  volver: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposCorreccion(""), "corregir", async (datos, supabase) => {
    // Los argumentos enlazados llegan del cliente: se validan como cualquier dato.
    if (!Object.hasOwn(CORRECCIONES, tipo) || !esUuid(id) || !volver.startsWith("/finanzas/")) {
      return fallo("Operación no válida.");
    }
    const correccion = CORRECCIONES[tipo];
    if (datos.confirmar !== true) {
      return fallo("Revise los campos marcados.", { confirmar: "Marque la casilla para confirmar." });
    }
    const { error } = await supabase.rpc(correccion.funcion, {
      [correccion.parametro]: id,
      p_motivo: String(datos.motivo),
    } as never);
    if (error) return traducir(error);
    return { destino: `${volver}?corregido=1` };
  });
}
