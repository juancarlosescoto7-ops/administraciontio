import type { Database } from "@/lib/supabase/tipos-bd";

export type Rol = Database["public"]["Enums"]["rol_usuario"];

export const ROLES: readonly Rol[] = ["administrador", "operador", "finanzas"];

export const ETIQUETAS_ROL: Record<Rol, string> = {
  administrador: "Administrador",
  operador: "Operador",
  finanzas: "Finanzas",
};

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

/**
 * Espejo en la aplicación de las políticas RLS de E1. Sirve para mostrar u
 * ocultar acciones y para rechazar temprano en el servidor; la autorización
 * definitiva la aplica siempre la base de datos.
 */
export const ROLES_EDICION = {
  clientes: ["administrador", "operador"],
  beneficiarios: ["administrador", "operador"],
  vehiculos: ["administrador", "operador"],
  conductores: ["administrador", "operador"],
  proveedores: ["administrador", "operador", "finanzas"],
  planes: ["administrador"],
  tarifas: ["administrador"],
  cuentas_dinero: ["administrador"],
} as const satisfies Record<string, readonly Rol[]>;

export type ClaveCatalogo = keyof typeof ROLES_EDICION;

export function puedeEditar(clave: ClaveCatalogo, rol: Rol): boolean {
  return (ROLES_EDICION[clave] as readonly Rol[]).includes(rol);
}

export function puedeAdministrarUsuarios(rol: Rol): boolean {
  return rol === "administrador";
}
