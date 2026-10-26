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

/**
 * Espejo de las verificaciones de rol de las funciones financieras de E2
 * (public.registrar_*, reversar_*, anular_*) y de la RLS de lectura.
 */
export const PERMISOS_FINANZAS = {
  /** Cobros y aplicación de saldo a favor. */
  registrarCobro: ["administrador", "operador", "finanzas"],
  /** Cargos administrativos (los de servicios llegarán en E3–E5). */
  registrarCargo: ["administrador"],
  /** Gastos y sus pagos. */
  gestionarGastos: ["administrador", "finanzas"],
  /** Saldos y movimientos de caja/banco, gastos y asientos. */
  verTesoreria: ["administrador", "finanzas"],
  transferir: ["administrador", "finanzas"],
  /** Reversos, anulaciones y saldos iniciales. */
  corregir: ["administrador"],
} as const satisfies Record<string, readonly Rol[]>;

/** Espejo de las verificaciones de rol de las funciones de membresías de E3. */
export const PERMISOS_MEMBRESIAS = {
  /** Alta de membresías y altas/bajas de beneficiarios. */
  registrarMembresia: ["administrador", "operador"],
  /** Condiciones particulares, edición de condiciones y cancelación. */
  gestionarMembresia: ["administrador"],
  /** Actualizar mensualidades: solo materializa lo que fijan las condiciones. */
  actualizarMensualidades: ["administrador", "operador", "finanzas"],
} as const satisfies Record<string, readonly Rol[]>;

const PERMISOS = { ...PERMISOS_FINANZAS, ...PERMISOS_MEMBRESIAS };

export type Permiso = keyof typeof PERMISOS;
export type PermisoFinanzas = keyof typeof PERMISOS_FINANZAS;

export function puede(permiso: Permiso, rol: Rol): boolean {
  return (PERMISOS[permiso] as readonly Rol[]).includes(rol);
}
