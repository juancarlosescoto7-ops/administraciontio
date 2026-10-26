import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import type { Campo, DefinicionCatalogo } from "./definiciones";

export function buscarCampo(def: DefinicionCatalogo, nombre: string): Campo | undefined {
  return def.campos.find((campo) => campo.nombre === nombre);
}

/** Texto legible de un valor almacenado, según el tipo de su campo. */
export function mostrarValor(campo: Campo | undefined, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  switch (campo?.tipo) {
    case "monto":
      return formatearMoneda(valor as number | string);
    case "fecha":
      return formatearFecha(String(valor));
    case "fecha_hora":
      return formatearFechaHora(String(valor));
    case "seleccion":
      return campo.opciones?.find((opcion) => opcion.valor === valor)?.etiqueta ?? String(valor);
    case "booleano":
      return valor === true ? "Sí" : "No";
    default:
      return String(valor);
  }
}

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && PATRON_UUID.test(valor);
}

export type FiltroEstado = "activos" | "inactivos" | "todos";

export function leerFiltroEstado(valor: unknown): FiltroEstado {
  return valor === "inactivos" || valor === "todos" ? valor : "activos";
}

export function primerValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
