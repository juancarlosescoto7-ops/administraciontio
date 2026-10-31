"use server";

import { revalidatePath } from "next/cache";
import { puede } from "@/lib/auth/roles";
import { usuarioActivoOpcional } from "@/lib/auth/sesion";
import type { EstadoFormulario } from "@/lib/catalogos/estado";
import { esUuid } from "@/lib/catalogos/presentacion";
import { esFechaValida, type Datos } from "@/lib/catalogos/validacion";
import { decimal } from "@/lib/finanzas/montos";
import { clave, fallo, procesar, SIN_CLAVE, texto, traducir } from "@/lib/operaciones";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/tipos-bd";
import { camposVencimiento } from "./vigencia";
import {
  camposAgregarBeneficiario,
  camposAltaIntegrada,
  camposBaja,
  camposBeneficiarioNuevo,
  camposEditarCondiciones,
  camposPlantillaContrato,
  describirActualizacion,
  indicesBeneficiariosNuevos,
  PREFIJO_BENEFICIARIO,
  prefijoNuevo,
  variablesDesconocidas,
  type ResumenActualizacion,
} from "./definiciones";

type Modalidad = Database["public"]["Enums"]["modalidad_cupo"];

const INVALIDA = fallo("Operación no válida.");
const SIN_CONFIRMAR = fallo("Revise los campos marcados.", { confirmar: "Marque la casilla para confirmar." });

/**
 * Alta integrada: beneficiarios existentes y nuevos, y membresía en una sola
 * operación (registrar_membresia_completa). El titular ya existe: si era nuevo,
 * se registró antes en la ventana «Cliente nuevo».
 */
export async function registrarMembresiaCompleta(
  clienteId: string,
  planId: string,
  fechaInicio: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const nombres = [...formData.keys()];
  const casillas = nombres
    .filter((nombre) => nombre.startsWith(PREFIJO_BENEFICIARIO) && esUuid(nombre.slice(PREFIJO_BENEFICIARIO.length)))
    .map((nombre) => ({ id: nombre.slice(PREFIJO_BENEFICIARIO.length), nombre: "", detalle: null }));
  const nuevos = indicesBeneficiariosNuevos(nombres);
  const usuario = await usuarioActivoOpcional();
  const administrador = usuario !== null && puede("gestionarMembresia", usuario.rol);
  // El nombre de cada fila nueva se exige abajo: una fila vacía se ignora.
  const campos = camposAltaIntegrada({ beneficiarios: casillas, nuevos, administrador }).map(
    (campo) => (/^nuevo_\d+_nombre$/.test(campo.nombre) ? { ...campo, requerido: false } : campo),
  );

  return procesar(anterior, formData, campos, "registrarMembresia", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia) return SIN_CLAVE;
    if (!esUuid(clienteId) || !esUuid(planId) || !esFechaValida(fechaInicio)) return INVALIDA;
    if (datos.confirmar !== true) return SIN_CONFIRMAR;

    const existentes = casillas.map((c) => c.id).filter((id) => datos[`${PREFIJO_BENEFICIARIO}${id}`] === true);
    const nuevosDatos: Record<string, string | null>[] = [];
    const errores: Record<string, string> = {};
    for (const indice of nuevos) {
      const prefijo = prefijoNuevo(indice);
      const fila = Object.fromEntries(
        camposBeneficiarioNuevo().map((campo) => [campo.nombre, texto(datos[`${prefijo}${campo.nombre}`])]),
      );
      if (Object.values(fila).every((valor) => valor === null)) continue;
      if (fila.nombre === null) {
        errores[`${prefijo}nombre`] = "Indique el nombre o quite la fila.";
        continue;
      }
      nuevosDatos.push(fila);
    }
    if (Object.keys(errores).length > 0) return fallo("Revise los campos marcados.", errores);
    const titular = datos.titular_beneficiario === true;
    if (existentes.length + nuevosDatos.length === 0 && !titular) {
      return fallo("Agregue al menos un beneficiario: marque uno existente, registre uno nuevo o marque al titular.");
    }

    const condiciones = administrador ? condicionesParticulares(datos) : null;
    const { data, error } = await supabase.rpc("registrar_membresia_completa", {
      p_idempotencia: idempotencia,
      p_cliente_id: clienteId,
      p_cliente: null,
      p_plan_id: planId,
      p_fecha_inicio: fechaInicio,
      p_beneficiarios: existentes,
      p_nuevos_beneficiarios: nuevosDatos as Json,
      p_titular_beneficiario: titular,
      p_condiciones: condiciones ?? undefined,
    });
    if (error) return traducir(error);
    return { destino: `/membresias/${data}?guardado=1` };
  });
}

/** Registra un beneficiario nuevo y lo vincula a la membresía en una sola operación. */
export async function agregarBeneficiarioNuevo(
  membresiaId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposBeneficiarioNuevo(), "registrarMembresia", async (datos, supabase) => {
    const idempotencia = clave(formData);
    if (!idempotencia) return SIN_CLAVE;
    if (!esUuid(membresiaId)) return INVALIDA;
    const beneficiario = Object.fromEntries(camposBeneficiarioNuevo().map((campo) => [campo.nombre, texto(datos[campo.nombre])]));
    const { error } = await supabase.rpc("agregar_beneficiario_nuevo_membresia", {
      p_idempotencia: idempotencia,
      p_membresia_id: membresiaId,
      p_beneficiario: beneficiario as Json,
    });
    if (error) return traducir(error);
    return { destino: `/membresias/${membresiaId}?beneficiario=1` };
  });
}

/** Guarda una versión nueva de la plantilla del contrato (solo administrador). */
export async function guardarPlantillaContrato(anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposPlantillaContrato(), "gestionarContrato", async (datos, supabase) => {
    // Los navegadores envían los saltos de línea de un textarea como \r\n.
    const contenido = String(datos.contenido).replace(/\r\n?/g, "\n");
    const desconocidas = variablesDesconocidas(contenido);
    if (desconocidas.length > 0) {
      return fallo("Revise los campos marcados.", {
        contenido: `Variable desconocida: ${desconocidas.map((v) => `{{${v}}}`).join(", ")}. Use solo las de la lista.`,
      });
    }
    const { error } = await supabase.rpc("guardar_plantilla_contrato", { p_contenido: contenido });
    if (error) return traducir(error);
    return { destino: "/configuracion/contrato?guardado=1" };
  });
}

/** Contrato de una membresía registrada sin él (antes del alta integrada). */
export async function generarContrato(
  membresiaId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, [], "registrarMembresia", async (_datos, supabase) => {
    if (!esUuid(membresiaId)) return INVALIDA;
    const { error } = await supabase.rpc("generar_contrato_membresia", { p_membresia_id: membresiaId });
    if (error) return traducir(error);
    return { destino: `/membresias/${membresiaId}/contrato?generado=1` };
  });
}

/** Solo los campos escritos: lo vacío conserva la condición del plan. */
function condicionesParticulares(datos: Datos): Record<string, string | number> | null {
  const condiciones: Record<string, string | number> = {};
  if (texto(datos.fecha_fin) !== null) condiciones.fecha_fin = String(datos.fecha_fin);
  if (texto(datos.precio) !== null) condiciones.precio = String(datos.precio);
  if (typeof datos.cupo === "number") condiciones.cupo = datos.cupo;
  if (texto(datos.modalidad) !== null) condiciones.modalidad = String(datos.modalidad);
  if (typeof datos.dias_gracia === "number") condiciones.dias_gracia = datos.dias_gracia;
  return Object.keys(condiciones).length > 0 ? condiciones : null;
}

export async function establecerVencimiento(id: string, anterior: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposVencimiento, "gestionarMembresia", async (datos, supabase) => {
    if (!esUuid(id)) return INVALIDA;
    const { error } = await supabase.rpc("establecer_vencimiento_membresia", {
      p_membresia_id: id, p_fecha_fin: String(datos.fecha_fin), p_motivo: String(datos.motivo),
    });
    if (error) return traducir(error);
    return { destino: `/membresias/${id}?vigencia=1` };
  });
}

export async function editarCondiciones(
  membresiaId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposEditarCondiciones(), "gestionarMembresia", async (datos, supabase) => {
    if (!esUuid(membresiaId)) return INVALIDA;
    const { error } = await supabase.rpc("actualizar_condiciones_membresia", {
      p_membresia_id: membresiaId,
      p_precio: decimal(String(datos.precio)),
      p_cupo: Number(datos.cupo),
      p_modalidad: datos.modalidad as Modalidad,
      p_dias_gracia: Number(datos.dias_gracia),
      p_motivo: String(datos.motivo),
    });
    if (error) return traducir(error);
    return { destino: `/membresias/${membresiaId}?condiciones=1` };
  });
}

export async function agregarBeneficiario(
  membresiaId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposAgregarBeneficiario([]), "registrarMembresia", async (datos, supabase) => {
    if (!esUuid(membresiaId)) return INVALIDA;
    const { error } = await supabase.rpc("agregar_beneficiario_membresia", {
      p_membresia_id: membresiaId,
      p_beneficiario_id: String(datos.beneficiario_id),
    });
    if (error) return traducir(error);
    return { destino: `/membresias/${membresiaId}?beneficiario=1` };
  });
}

export async function inactivarBeneficiario(
  membresiaId: string,
  vinculoId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposBaja(""), "registrarMembresia", async (datos, supabase) => {
    if (!esUuid(membresiaId) || !esUuid(vinculoId)) return INVALIDA;
    if (datos.confirmar !== true) return SIN_CONFIRMAR;
    const { error } = await supabase.rpc("inactivar_beneficiario_membresia", {
      p_vinculo_id: vinculoId,
      p_motivo: String(datos.motivo),
    });
    if (error) return traducir(error);
    return { destino: `/membresias/${membresiaId}?baja=1` };
  });
}

export async function cancelarMembresia(
  membresiaId: string,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return procesar(anterior, formData, camposBaja(""), "gestionarMembresia", async (datos, supabase) => {
    if (!esUuid(membresiaId)) return INVALIDA;
    if (datos.confirmar !== true) return SIN_CONFIRMAR;
    const { error } = await supabase.rpc("cancelar_membresia", {
      p_membresia_id: membresiaId,
      p_motivo: String(datos.motivo),
    });
    if (error) return traducir(error);
    return { destino: `/membresias/${membresiaId}?cancelada=1` };
  });
}

// --- Actualizar mensualidades ------------------------------------------

export type EstadoActualizacion = { mensaje: string | null; error: string | null };

async function ejecutarActualizacion(membresiaId: string | null): Promise<ResumenActualizacion | string> {
  const usuario = await usuarioActivoOpcional();
  if (!usuario || !puede("actualizarMensualidades", usuario.rol)) return "Su rol no permite realizar esta operación.";
  if (membresiaId !== null && !esUuid(membresiaId)) return "Operación no válida.";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("actualizar_mensualidades", membresiaId ? { p_membresia_id: membresiaId } : {});
  if (error) return traducir(error).error;
  const resumen = data as Record<string, number>;
  return { periodos: resumen.periodos ?? 0, suspendidas: resumen.suspendidas ?? 0, reactivadas: resumen.reactivadas ?? 0 };
}

/** Botón «Actualizar mensualidades» (de una membresía o de todas). */
export async function actualizarMensualidades(membresiaId: string | null): Promise<EstadoActualizacion> {
  const resultado = await ejecutarActualizacion(membresiaId);
  if (typeof resultado === "string") return { mensaje: null, error: resultado };
  revalidatePath("/", "layout");
  return { mensaje: describirActualizacion(resultado), error: null };
}

/**
 * Al abrir el panel (POST desde el navegador, nunca en el GET de la página).
 * Devuelve null si no cambió nada o no se pudo ejecutar.
 */
export async function actualizarAlAbrir(): Promise<ResumenActualizacion | null> {
  const resultado = await ejecutarActualizacion(null);
  if (typeof resultado === "string") return null;
  if (resultado.periodos + resultado.suspendidas + resultado.reactivadas === 0) return null;
  revalidatePath("/", "layout");
  return resultado;
}
