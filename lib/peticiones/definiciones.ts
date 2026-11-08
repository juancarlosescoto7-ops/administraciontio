// Peticiones de cambio al sistema. Los estados repiten el CHECK de la tabla.
export const ESTADOS_PETICION = ["pendiente", "en_proceso", "resuelta", "descartada"] as const;
export type EstadoPeticion = (typeof ESTADOS_PETICION)[number];

export const ETIQUETAS_ESTADO_PETICION: Record<EstadoPeticion, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  resuelta: "Resuelta",
  descartada: "Descartada",
};

export const INSIGNIA_ESTADO_PETICION: Record<EstadoPeticion, string> = {
  pendiente: "insignia-advertencia",
  en_proceso: "insignia-info",
  resuelta: "insignia-activo",
  descartada: "insignia-inactivo",
};

export const MAXIMO_DESCRIPCION = 2000;
const MAXIMO_PANTALLA = 200;

export function esEstadoPeticion(valor: unknown): valor is EstadoPeticion {
  return typeof valor === "string" && (ESTADOS_PETICION as readonly string[]).includes(valor);
}

export type EstadoEnvioPeticion = { revision: number; error: string | null; mensaje: string | null };

/** Descripción obligatoria; la pantalla es la ruta interna desde donde se escribió. */
export function validarPeticion(
  descripcion: unknown,
  pantalla: unknown,
): { ok: true; descripcion: string; pantalla: string | null } | { ok: false; error: string } {
  const texto = typeof descripcion === "string" ? descripcion.trim() : "";
  if (!texto) return { ok: false, error: "Describa qué necesita." };
  if (texto.length > MAXIMO_DESCRIPCION) return { ok: false, error: `Máximo ${MAXIMO_DESCRIPCION} caracteres.` };
  const ruta = typeof pantalla === "string" ? pantalla.trim() : "";
  const valida = ruta.startsWith("/") && !ruta.startsWith("//") && ruta.length <= MAXIMO_PANTALLA;
  return { ok: true, descripcion: texto, pantalla: valida ? ruta : null };
}

/** Primero lo abierto (pendiente, en proceso) y, dentro de cada grupo, lo más reciente. */
export function ordenarPeticiones<T extends { estado: string; created_at: string }>(peticiones: T[]): T[] {
  const abierta = (estado: string) => (estado === "pendiente" || estado === "en_proceso" ? 0 : 1);
  return [...peticiones].sort(
    (a, b) => abierta(a.estado) - abierta(b.estado) || b.created_at.localeCompare(a.created_at),
  );
}
