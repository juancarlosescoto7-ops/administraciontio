import { hoyEnTegucigalpa } from "@/lib/formato";
import type { Campo, DefinicionCatalogo } from "./definiciones";

/** Valores tal como se muestran en el formulario (para volver a pintarlo). */
export type Valores = Record<string, string>;

/** Datos listos para enviar a la base. Los montos viajan como texto decimal. */
export type Datos = Record<string, string | number | boolean | null>;

export type ResultadoValidacion =
  | { ok: true; datos: Datos }
  | { ok: false; errores: Record<string, string> };

const MAX_ENTERO = 2_147_483_647;
const PATRON_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PATRON_TELEFONO = /^[0-9+()\-\s]+$/;
// Hasta 12 enteros y 2 decimales: cabe en numeric(14,2).
const PATRON_MONTO = /^\d{1,12}(\.\d{1,2})?$/;
const PATRON_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function leerValores(def: DefinicionCatalogo, formData: FormData): Valores {
  const valores: Valores = {};
  for (const campo of def.campos) {
    const crudo = formData.get(campo.nombre);
    valores[campo.nombre] =
      campo.tipo === "booleano"
        ? crudo === "on"
          ? "on"
          : ""
        : typeof crudo === "string"
          ? crudo
          : "";
  }
  return valores;
}

function esFechaValida(texto: string): boolean {
  const partes = PATRON_FECHA.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = partes.slice(1).map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia &&
    anio >= 1900
  );
}

function validarCampo(
  campo: Campo,
  crudo: string,
  hoy: string,
): { valor: string | number | boolean | null } | { error: string } {
  if (campo.tipo === "booleano") return { valor: crudo === "on" };

  let texto = crudo.trim();
  if (campo.mayusculas) texto = texto.toUpperCase();

  if (texto === "") {
    return campo.requerido ? { error: "Este campo es obligatorio." } : { valor: null };
  }

  switch (campo.tipo) {
    case "texto":
    case "texto_largo":
    case "correo":
    case "telefono": {
      if (campo.max !== undefined && texto.length > campo.max) {
        return { error: `Máximo ${campo.max} caracteres.` };
      }
      if (campo.tipo === "correo" && !PATRON_CORREO.test(texto)) {
        return { error: "Correo electrónico no válido." };
      }
      if (campo.tipo === "telefono" && !PATRON_TELEFONO.test(texto)) {
        return { error: "Use solo números, espacios, +, - y paréntesis." };
      }
      return { valor: texto };
    }
    case "fecha": {
      if (!esFechaValida(texto)) return { error: "Fecha no válida." };
      if (campo.noFutura && texto > hoy) {
        return { error: "La fecha no puede ser posterior a hoy." };
      }
      return { valor: texto };
    }
    case "entero": {
      if (!/^-?\d+$/.test(texto)) return { error: "Ingrese un número entero." };
      const numero = Number(texto);
      const minimo = campo.min ?? 0;
      const maximo = campo.max ?? MAX_ENTERO;
      if (numero < minimo) return { error: `El valor mínimo es ${minimo}.` };
      if (numero > maximo) return { error: `El valor máximo es ${maximo}.` };
      return { valor: numero };
    }
    case "monto": {
      // Se aceptan separadores de miles con coma; nunca se convierte a float.
      const normalizado = texto.replace(/,/g, "");
      if (!PATRON_MONTO.test(normalizado)) {
        return { error: "Ingrese un monto válido, sin negativos y con hasta 2 decimales." };
      }
      const [enteros, decimales = ""] = normalizado.split(".");
      return { valor: `${enteros.replace(/^0+(?=\d)/, "")}.${decimales.padEnd(2, "0")}` };
    }
    case "seleccion": {
      if (!campo.opciones?.some((opcion) => opcion.valor === texto)) {
        return { error: "Seleccione una opción válida." };
      }
      return { valor: texto };
    }
  }
}

export function validarRegistro(
  def: DefinicionCatalogo,
  valores: Valores,
  hoy: string = hoyEnTegucigalpa(),
): ResultadoValidacion {
  const datos: Datos = {};
  const errores: Record<string, string> = {};

  for (const campo of def.campos) {
    const resultado = validarCampo(campo, valores[campo.nombre] ?? "", hoy);
    if ("error" in resultado) errores[campo.nombre] = resultado.error;
    else datos[campo.nombre] = resultado.valor;
  }

  return Object.keys(errores).length > 0 ? { ok: false, errores } : { ok: true, datos };
}

/** Convierte una fila de la base en valores de formulario. */
export function valoresDesdeRegistro(
  def: DefinicionCatalogo,
  registro: Record<string, unknown> | null,
): Valores {
  const valores: Valores = {};
  for (const campo of def.campos) {
    const valor = registro ? registro[campo.nombre] : undefined;
    if (valor === undefined) {
      valores[campo.nombre] = registro ? "" : (campo.predeterminado ?? "");
    } else if (campo.tipo === "booleano") {
      valores[campo.nombre] = valor === true ? "on" : "";
    } else if (valor === null) {
      valores[campo.nombre] = "";
    } else if (campo.tipo === "monto") {
      valores[campo.nombre] = Number(valor).toFixed(2);
    } else {
      valores[campo.nombre] = String(valor);
    }
  }
  return valores;
}

/**
 * Limpia el texto de búsqueda para usarlo dentro de un filtro `or` de
 * PostgREST: se quitan comas, paréntesis, comillas y comodines que alterarían
 * la sintaxis del filtro.
 */
export function limpiarBusqueda(texto: unknown): string {
  if (typeof texto !== "string") return "";
  return texto
    .replace(/[^\p{L}\p{N}\s@.\-+#/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function filtroBusqueda(campos: readonly string[], texto: string): string {
  return campos.map((campo) => `${campo}.ilike."%${texto}%"`).join(",");
}
