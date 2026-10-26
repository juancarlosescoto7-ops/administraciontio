import type { Valores } from "./validacion";

export type ClienteSimilar = { id: string; nombre: string; identificacion: string | null };

/** Estado que devuelve la Server Action de guardado al formulario. */
export type EstadoFormulario = {
  /** Aumenta en cada respuesta para que el formulario reponga los valores. */
  revision: number;
  valores: Valores;
  errores: Record<string, string>;
  error: string | null;
  /** Clientes parecidos: se pide confirmar antes de registrar (sin bloquear). */
  similares: ClienteSimilar[] | null;
};

export function estadoInicial(valores: Valores): EstadoFormulario {
  return { revision: 0, valores, errores: {}, error: null, similares: null };
}
