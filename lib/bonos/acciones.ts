"use server";

import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { esUuid } from "@/lib/catalogos/presentacion";
import { camposPagoGasto } from "@/lib/finanzas/definiciones";
import { decimal, opcional } from "@/lib/finanzas/montos";
import { esTipoServicio, SERVICIOS_GASTO } from "@/lib/finanzas/servicios";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { clave, fallo, procesar, SIN_CLAVE, texto, traducir } from "@/lib/operaciones";
import type { Database } from "@/lib/supabase/tipos-bd";
import { leerLineas, NOMBRE_CAMPO_LINEAS } from "./lineas";
import { registrarLineas } from "./servidor";

type Enums = Database["public"]["Enums"];

/** Agrega bonos y gastos a un servicio ya registrado, desde su ficha. */
export async function agregarGastosServicio(
  tipo: string,
  servicioId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, [], "gestionarGastosServicio", async (_datos, supabase) => {
    if (!esTipoServicio(tipo) || !esUuid(servicioId)) return fallo("Servicio no válido.");
    const lectura = leerLineas(formData.get(NOMBRE_CAMPO_LINEAS));
    if (lectura.error !== undefined) return fallo(lectura.error);
    if (lectura.lineas.length === 0) return fallo("Agregue al menos un bono o gasto.");
    const error = await registrarLineas(supabase, tipo, servicioId, lectura.lineas);
    if (error) return error;
    return { destino: `${SERVICIOS_GASTO[tipo].ruta}/${servicioId}?gastos=1` };
  });
}

/** Paga (total o parcialmente) un bono o gasto del servicio y abre su voucher. */
export async function pagarGastoServicio(gastoId: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposPagoGasto([], hoyEnTegucigalpa()), "gestionarGastosServicio", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia || !esUuid(gastoId)) return SIN_CLAVE;
    const { data, error } = await supabase.rpc("registrar_pago_gasto_servicio", {
      p_idempotencia: idempotencia,
      p_gasto_id: gastoId,
      p_cuenta_dinero_id: String(datos.cuenta_dinero_id),
      p_fecha: String(datos.fecha),
      p_metodo: datos.metodo as Enums["metodo_pago"],
      p_referencia: opcional(texto(datos.referencia)),
      p_monto: decimal(String(datos.monto)),
    });
    if (error) return traducir(error);
    return { destino: `/comprobantes/${data}?nuevo=1` };
  });
}
