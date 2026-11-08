"use server";

import { revalidatePath } from "next/cache";
import { puede } from "@/lib/auth/roles";
import { usuarioActivoOpcional } from "@/lib/auth/sesion";
import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { esUuid } from "@/lib/catalogos/presentacion";
import { camposPagoGasto } from "@/lib/finanzas/definiciones";
import { decimal, decimalOpcional, opcional } from "@/lib/finanzas/montos";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { clave, fallo, procesar, SIN_CLAVE, texto, traducir } from "@/lib/operaciones";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/tipos-bd";
import { camposBaja, camposBien, camposEditarBien, prepararAdquisicion } from "./definiciones";

type Enums = Database["public"]["Enums"];

export async function registrarBien(anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const campos = camposBien(hoyEnTegucigalpa(), [], [], []);
  return procesar(anterior, formData, campos, "gestionarBienes", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia) return SIN_CLAVE;
    const adquisicion = prepararAdquisicion(datos);
    if (!adquisicion.ok) return fallo("Revise los campos marcados.", adquisicion.errores);

    const vida = datos.vida_util_meses;
    const { data, error } = await supabase.rpc("registrar_bien", {
      p_idempotencia: idempotencia,
      p_nombre: String(datos.nombre),
      p_clase: datos.clase as Enums["clase_bien"],
      p_descripcion: opcional(texto(datos.descripcion)),
      p_actividad: datos.actividad as Enums["actividad"],
      p_vehiculo_id: opcional(texto(datos.vehiculo_id)),
      p_origen: adquisicion.origen,
      p_proveedor_id: opcional(adquisicion.proveedorId),
      p_fecha_adquisicion: String(datos.fecha_adquisicion),
      p_fecha_registro: opcional(adquisicion.fechaRegistro),
      p_vencimiento: opcional(adquisicion.vencimiento),
      p_costo: decimal(String(datos.costo)),
      p_depreciacion_previa: decimalOpcional(adquisicion.depreciacionPrevia),
      p_valor_residual: decimalOpcional(texto(datos.valor_residual)),
      // Los tipos generados no admiten NULL; un terreno no lleva vida útil.
      p_vida_util_meses: (typeof vida === "number" ? vida : null) as number,
      p_pago: adquisicion.pago,
    });
    if (error) return traducir(error);
    return { destino: `/finanzas/bienes/${data}?guardado=1` };
  });
}

export async function registrarPagoBien(bienId: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const campos = camposPagoGasto([], hoyEnTegucigalpa());
  return procesar(anterior, formData, campos, "gestionarBienes", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia || !esUuid(bienId)) return SIN_CLAVE;
    const { error } = await supabase.rpc("registrar_pago_bien", {
      p_idempotencia: idempotencia,
      p_bien_id: bienId,
      p_cuenta_dinero_id: String(datos.cuenta_dinero_id),
      p_fecha: String(datos.fecha),
      p_metodo: datos.metodo as Enums["metodo_pago"],
      p_referencia: opcional(texto(datos.referencia)),
      p_monto: decimal(String(datos.monto)),
    });
    if (error) return traducir(error);
    return { destino: `/finanzas/bienes/${bienId}?pagado=1` };
  });
}

export async function darDeBajaBien(bienId: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposBaja(hoyEnTegucigalpa()), "gestionarBienes", async (datos, supabase) => {
    if (!esUuid(bienId)) return fallo("Operación no válida.");
    if (datos.confirmar !== true) {
      return fallo("Revise los campos marcados.", { confirmar: "Marque la casilla para confirmar." });
    }
    const { error } = await supabase.rpc("dar_de_baja_bien", {
      p_bien_id: bienId,
      p_fecha: String(datos.fecha),
      p_motivo: String(datos.motivo),
    });
    if (error) return traducir(error);
    return { destino: `/finanzas/bienes/${bienId}?baja=1` };
  });
}

export async function editarBien(bienId: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposEditarBien(), "gestionarBienes", async (datos, supabase) => {
    if (!esUuid(bienId)) return fallo("Operación no válida.");
    const { error } = await supabase.rpc("editar_bien", {
      p_bien_id: bienId,
      p_nombre: String(datos.nombre),
      p_descripcion: opcional(texto(datos.descripcion)),
    });
    if (error) return traducir(error);
    return { destino: `/finanzas/bienes/${bienId}?editado=1` };
  });
}

/**
 * Pone al día la depreciación mensual al abrir el panel, Bienes o Reportes
 * (POST desde el navegador, nunca en el GET de la página). Devuelve cuántas
 * cuotas registró; 0 si no cambió nada, no hay permiso o falló.
 */
export async function actualizarDepreciacionesAlAbrir(): Promise<number> {
  const usuario = await usuarioActivoOpcional();
  if (!usuario || !puede("gestionarBienes", usuario)) return 0;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("actualizar_depreciaciones");
  if (error) {
    console.error("No se pudo actualizar la depreciación", error.code, error.message);
    return 0;
  }
  if (!data) return 0;
  revalidatePath("/", "layout");
  return data;
}
