"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { puedeEditar } from "@/lib/auth/roles";
import { usuarioActivoOpcional } from "@/lib/auth/sesion";
import { createClient } from "@/lib/supabase/server";
import { obtenerDefinicion, type DefinicionCatalogo } from "./definiciones";
import type { ClienteSimilar, EstadoFormulario } from "./estado";
import { esUuid } from "./presentacion";
import { tablaCatalogo } from "./tabla";
import { leerValores, validarRegistro } from "./validacion";

/**
 * Registra (id = null) o edita un registro de catálogo. Vuelve a verificar
 * sesión, perfil activo y rol en el servidor; la RLS lo verifica de nuevo en
 * la base de datos.
 */
export async function guardarRegistro(
  clave: string,
  id: string | null,
  anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const def = obtenerDefinicion(clave);
  const valores = leerValores(def, formData);
  const respuesta = (cambios: Partial<EstadoFormulario>): EstadoFormulario => ({
    revision: anterior.revision + 1,
    valores,
    errores: {},
    error: null,
    similares: null,
    ...cambios,
  });

  const usuario = await usuarioActivoOpcional();
  if (!usuario) {
    return respuesta({ error: "Su sesión expiró o su usuario no está activo. Inicie sesión de nuevo." });
  }
  if (!puedeEditar(def.clave, usuario.rol)) {
    return respuesta({ error: "Su rol no permite modificar este catálogo." });
  }
  if (id !== null && !esUuid(id)) {
    return respuesta({ error: "Registro no válido." });
  }

  const validacion = validarRegistro(def, valores);
  if (!validacion.ok) {
    return respuesta({ errores: validacion.errores, error: "Revise los campos marcados." });
  }
  const datos = validacion.datos;
  const supabase = await createClient();

  // Clientes: los posibles duplicados se advierten, no se bloquean.
  if (def.clave === "clientes" && id === null && formData.get("confirmar_similares") !== "si") {
    const similares = await buscarClientesSimilares(
      supabase,
      String(datos.nombre),
      typeof datos.identificacion === "string" ? datos.identificacion : null,
    );
    if (similares.length > 0) return respuesta({ similares });
  }

  const tabla = tablaCatalogo(supabase, def.tabla);
  // Los montos viajan como texto decimal ("1500.00") para no pasar por float.
  const fila = datos as never;
  const { data, error } =
    id === null
      ? await tabla.insert(fila).select("id")
      : await tabla.update(fila).eq("id", id).select("id");

  if (error) return respuesta(traducirError(def, error));
  const guardado = data?.[0]?.id;
  if (!guardado) {
    // UPDATE filtrado por RLS: no hay error, pero tampoco filas afectadas.
    return respuesta({ error: "No se encontró el registro o no tiene permiso para modificarlo." });
  }

  revalidatePath(def.ruta);
  redirect(`${def.ruta}/${guardado}?guardado=1`);
}

async function buscarClientesSimilares(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nombre: string,
  identificacion: string | null,
): Promise<ClienteSimilar[]> {
  // Los comodines de LIKE del propio nombre se tratan como "cualquier carácter".
  const patron = nombre.replace(/[\\%_*]/g, "_");
  const consultas = [
    supabase.from("clientes").select("id, nombre, identificacion").ilike("nombre", patron).limit(5),
  ];
  if (identificacion) {
    consultas.push(
      supabase
        .from("clientes")
        .select("id, nombre, identificacion")
        .eq("identificacion", identificacion)
        .limit(5),
    );
  }
  const resultados = await Promise.all(consultas);
  const porId = new Map<string, ClienteSimilar>();
  for (const { data } of resultados) {
    for (const cliente of data ?? []) porId.set(cliente.id, cliente);
  }
  return [...porId.values()];
}

function traducirError(def: DefinicionCatalogo, error: PostgrestError): Partial<EstadoFormulario> {
  if (error.code === "23505") {
    const restriccion = Object.entries(def.restriccionesUnicas ?? {}).find(([nombre]) =>
      error.message.includes(nombre),
    );
    return restriccion
      ? { errores: { [restriccion[1].campo]: restriccion[1].mensaje }, error: "Revise los campos marcados." }
      : { error: "Ya existe un registro con esos datos." };
  }
  if (error.code === "42501") {
    return { error: "Su rol no permite realizar esta operación." };
  }
  if (error.code === "23514" || error.code === "22P02" || error.code === "22003") {
    return { error: "Algún dato no cumple las reglas del sistema. Revise los valores." };
  }
  console.error("Error al guardar en catálogo", def.clave, error.code, error.message);
  return { error: "No se pudo guardar. Intente de nuevo." };
}
