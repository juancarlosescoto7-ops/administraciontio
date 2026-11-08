"use server";

import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { esUuid } from "@/lib/catalogos/presentacion";
import { opcional } from "@/lib/finanzas/montos";
import { aFechaHoraLocal } from "@/lib/formato";
import { clave, fallo, procesar, SIN_CLAVE, texto, traducir } from "@/lib/operaciones";
import { camposMantenimiento } from "./definiciones";

export async function registrarMantenimiento(
  vehiculoId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposMantenimiento(null, aFechaHoraLocal(new Date())), "gestionarFlota", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia) return SIN_CLAVE;
    if (!esUuid(vehiculoId)) return fallo("Operación no válida.");
    const { error } = await supabase.rpc("registrar_mantenimiento", {
      p_idempotencia: idempotencia,
      p_vehiculo_id: vehiculoId,
      p_tipo: String(datos.tipo),
      p_descripcion: String(datos.descripcion),
      p_salida: String(datos.salida),
      p_regreso: String(datos.regreso),
      p_km_salida: Number(datos.km_salida),
      p_km_llegada: Number(datos.km_llegada),
      p_motivo_descuadre_km: opcional(texto(datos.motivo_descuadre_km)),
      p_proximo_km: typeof datos.proximo_km === "number" ? datos.proximo_km : undefined,
      p_proxima_fecha: opcional(texto(datos.proxima_fecha)),
      p_notas: opcional(texto(datos.notas)),
    });
    if (error) return traducir(error);
    return { destino: `/flota/${vehiculoId}?mantenimiento=1` };
  });
}
