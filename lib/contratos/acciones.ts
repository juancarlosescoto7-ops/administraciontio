"use server";

import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { esUuid } from "@/lib/catalogos/presentacion";
import { fallo, procesar, traducir } from "@/lib/operaciones";
import {
  camposPlantillaContrato,
  CONTRATO_SERVICIO,
  esTipoContrato,
  esTipoContratoServicio,
  variablesDesconocidas,
} from "./definiciones";

const INVALIDA = fallo("Operación no válida.");

/** Guarda una versión nueva de la plantilla de un tipo de contrato (solo administrador). */
export async function guardarPlantillaContrato(
  tipo: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposPlantillaContrato(), "gestionarContrato", async (datos, supabase) => {
    if (!esTipoContrato(tipo)) return INVALIDA;
    // Los navegadores envían los saltos de línea de un textarea como \r\n.
    const contenido = String(datos.contenido).replace(/\r\n?/g, "\n");
    const desconocidas = variablesDesconocidas(contenido, tipo);
    if (desconocidas.length > 0) {
      return fallo("Revise los campos marcados.", {
        contenido: `Variable desconocida: ${desconocidas.map((v) => `{{${v}}}`).join(", ")}. Use solo las de la lista.`,
      });
    }
    const { error } = await supabase.rpc("guardar_plantilla_contrato", { p_contenido: contenido, p_tipo: tipo });
    if (error) return traducir(error);
    return { destino: `/configuracion/contrato?tipo=${tipo}&guardado=1` };
  });
}

/** Genera (o vuelve a generar con los datos actuales) el contrato de un alquiler, viaje o traslado. */
export async function generarContratoServicio(
  tipo: string,
  servicioId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if (!esTipoContratoServicio(tipo)) return { ...anterior, revision: anterior.revision + 1, error: "Operación no válida." };
  const { ruta, permiso } = CONTRATO_SERVICIO[tipo];
  return procesar(anterior, formData, [], permiso, async (_datos, supabase) => {
    if (!esUuid(servicioId)) return INVALIDA;
    const { error } = await supabase.rpc("generar_contrato_servicio", { p_tipo: tipo, p_servicio_id: servicioId });
    if (error) return traducir(error);
    return { destino: `${ruta}/${servicioId}/contrato?generado=1` };
  });
}
