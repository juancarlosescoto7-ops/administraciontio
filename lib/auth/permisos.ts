import type { ClaveCatalogo, Permiso } from "./roles";

/**
 * Permisos por usuario (solicitado el 2026-11-07).
 *
 * El rol fija el techo: lo que la base de datos permite. Encima, el
 * desarrollador puede apagar módulos y funciones para cada usuario; las claves
 * apagadas viven en perfiles.permisos_denegados. Apagar un módulo apaga
 * también todas sus funciones. La aplicación lo aplica en el menú, en cada
 * página (por ruta, ver moduloDeRuta) y en las acciones del servidor (a través
 * de puede/puedeEditar). Este archivo solo importa tipos de roles.ts para no
 * crear dependencias circulares.
 */

/** Clave de una función que se puede apagar. */
export type ClaveFuncion = Permiso | `editar.${ClaveCatalogo}` | "administrarUsuarios";

export type Funcion = { clave: ClaveFuncion; etiqueta: string };

export type Modulo = {
  clave: `modulo.${string}`;
  etiqueta: string;
  descripcion: string;
  /** Prefijos de ruta que pertenecen al módulo. Sin rutas: solo interruptor. */
  rutas: readonly string[];
  funciones: readonly Funcion[];
};

export type GrupoModulos = { titulo: string; modulos: readonly Modulo[] };

export const GRUPOS_MODULOS: readonly GrupoModulos[] = [
  {
    titulo: "Servicios",
    modulos: [
      {
        clave: "modulo.ambulancias",
        etiqueta: "Traslados de ambulancia",
        descripcion: "Ver y atender los traslados.",
        rutas: ["/ambulancias"],
        funciones: [
          { clave: "gestionarTraslados", etiqueta: "Registrar, programar, iniciar, finalizar y cancelar traslados" },
          { clave: "corregirTraslados", etiqueta: "Revertir un beneficio ya consumido" },
        ],
      },
      {
        clave: "modulo.alquileres",
        etiqueta: "Alquileres",
        descripcion: "Ver las reservas y los contratos de alquiler.",
        rutas: ["/alquileres"],
        funciones: [{ clave: "gestionarAlquileres", etiqueta: "Reservar, entregar, devolver y cancelar alquileres" }],
      },
      {
        clave: "modulo.transportes",
        etiqueta: "Transporte con conductor",
        descripcion: "Ver los viajes con chofer.",
        rutas: ["/transportes"],
        funciones: [{ clave: "gestionarTransportes", etiqueta: "Registrar, asignar, iniciar, finalizar y cancelar viajes" }],
      },
      {
        clave: "modulo.membresias",
        etiqueta: "Membresías",
        descripcion: "Ver las membresías, sus cuotas y su plan de pagos.",
        rutas: ["/membresias"],
        funciones: [
          { clave: "registrarMembresia", etiqueta: "Vender membresías y dar de alta o baja beneficiarios" },
          { clave: "gestionarMembresia", etiqueta: "Cambiar condiciones, vencimiento y cancelar" },
          { clave: "actualizarMensualidades", etiqueta: "Actualizar mensualidades" },
        ],
      },
      {
        clave: "modulo.bonos",
        etiqueta: "Bonos y gastos de los servicios",
        descripcion: "Resultado del servicio y vouchers de pago.",
        rutas: ["/comprobantes"],
        funciones: [{ clave: "gestionarGastosServicio", etiqueta: "Dar bonos y registrar o pagar gastos de un servicio" }],
      },
    ],
  },
  {
    titulo: "Clientes",
    modulos: [
      {
        clave: "modulo.clientes",
        etiqueta: "Clientes",
        descripcion: "Ver la lista y la ficha de cada cliente.",
        rutas: ["/clientes"],
        funciones: [{ clave: "editar.clientes", etiqueta: "Crear y editar clientes" }],
      },
      {
        clave: "modulo.beneficiarios",
        etiqueta: "Beneficiarios",
        descripcion: "Ver los beneficiarios de las membresías.",
        rutas: ["/beneficiarios"],
        funciones: [{ clave: "editar.beneficiarios", etiqueta: "Crear y editar beneficiarios" }],
      },
    ],
  },
  {
    titulo: "Flota y personal",
    modulos: [
      {
        clave: "modulo.vehiculos",
        etiqueta: "Vehículos",
        descripcion: "Ver los vehículos y su estado.",
        rutas: ["/vehiculos"],
        funciones: [{ clave: "editar.vehiculos", etiqueta: "Crear y editar vehículos" }],
      },
      {
        clave: "modulo.flota",
        etiqueta: "Kilometraje y mantenimiento",
        descripcion: "Ver el cuadre de kilometraje y los mantenimientos.",
        rutas: ["/flota"],
        funciones: [
          { clave: "gestionarFlota", etiqueta: "Registrar mantenimientos" },
          { clave: "corregirKilometraje", etiqueta: "Corregir un kilometraje de regreso menor que el de salida" },
        ],
      },
      {
        clave: "modulo.conductores",
        etiqueta: "Conductores",
        descripcion: "Ver los conductores.",
        rutas: ["/conductores"],
        funciones: [{ clave: "editar.conductores", etiqueta: "Crear y editar conductores" }],
      },
      {
        clave: "modulo.empleados",
        etiqueta: "Empleados",
        descripcion: "Ver los empleados y sus remuneraciones.",
        rutas: ["/empleados"],
        funciones: [{ clave: "editar.empleados", etiqueta: "Crear y editar empleados" }],
      },
    ],
  },
  {
    titulo: "Finanzas",
    modulos: [
      {
        clave: "modulo.cobros",
        etiqueta: "Cobros",
        descripcion: "Ver los cobros recibidos.",
        rutas: ["/finanzas/cobros"],
        funciones: [{ clave: "registrarCobro", etiqueta: "Registrar cobros y aplicar saldo a favor" }],
      },
      {
        clave: "modulo.cargos",
        etiqueta: "Cargos",
        descripcion: "Ver los cargos a clientes.",
        rutas: ["/finanzas/cargos"],
        funciones: [{ clave: "registrarCargo", etiqueta: "Registrar cargos administrativos" }],
      },
      {
        clave: "modulo.pendientes",
        etiqueta: "Pendientes",
        descripcion: "Cuentas por cobrar y por pagar pendientes.",
        rutas: ["/finanzas/pendientes"],
        funciones: [],
      },
      {
        clave: "modulo.gastos",
        etiqueta: "Gastos",
        descripcion: "Gastos generales y sus pagos.",
        rutas: ["/finanzas/gastos"],
        funciones: [{ clave: "gestionarGastos", etiqueta: "Registrar gastos generales y sus pagos" }],
      },
      {
        clave: "modulo.cuentas",
        etiqueta: "Cajas y bancos",
        descripcion: "Ver las cajas y cuentas bancarias.",
        rutas: ["/finanzas/cuentas"],
        funciones: [
          { clave: "verTesoreria", etiqueta: "Ver saldos, movimientos y asientos" },
          { clave: "transferir", etiqueta: "Transferir entre cuentas" },
          { clave: "editar.cuentas_dinero", etiqueta: "Crear y editar cajas y cuentas" },
        ],
      },
      {
        clave: "modulo.bienes",
        etiqueta: "Bienes de la empresa",
        descripcion: "Bienes, sus pagos y su depreciación.",
        rutas: ["/finanzas/bienes"],
        funciones: [{ clave: "gestionarBienes", etiqueta: "Registrar, pagar, dar de baja y depreciar bienes" }],
      },
      {
        clave: "modulo.proveedores",
        etiqueta: "Proveedores",
        descripcion: "Ver los proveedores y prestadores.",
        rutas: ["/proveedores"],
        funciones: [{ clave: "editar.proveedores", etiqueta: "Crear y editar proveedores" }],
      },
      {
        clave: "modulo.reportes",
        etiqueta: "Reportes",
        descripcion: "Resultados, cuentas por cobrar y pagar, caja y bancos.",
        rutas: ["/reportes"],
        funciones: [{ clave: "verReportes", etiqueta: "Ver los reportes consolidados" }],
      },
      {
        clave: "modulo.correcciones",
        etiqueta: "Correcciones financieras",
        descripcion: "Operaciones delicadas que se usan en varias pantallas.",
        rutas: [],
        funciones: [{ clave: "corregir", etiqueta: "Reversar, anular y registrar saldos iniciales" }],
      },
    ],
  },
  {
    titulo: "Configuración",
    modulos: [
      {
        clave: "modulo.planes",
        etiqueta: "Planes de membresía",
        descripcion: "Ver los planes.",
        rutas: ["/planes"],
        funciones: [{ clave: "editar.planes", etiqueta: "Crear y editar planes" }],
      },
      {
        clave: "modulo.tarifas",
        etiqueta: "Tarifas",
        descripcion: "Ver las tarifas.",
        rutas: ["/tarifas"],
        funciones: [{ clave: "editar.tarifas", etiqueta: "Crear y editar tarifas" }],
      },
      {
        clave: "modulo.contratos",
        etiqueta: "Contratos",
        descripcion: "Plantillas de los contratos.",
        rutas: ["/configuracion/contrato"],
        funciones: [{ clave: "gestionarContrato", etiqueta: "Editar las plantillas de contrato" }],
      },
      {
        clave: "modulo.usuarios",
        etiqueta: "Usuarios",
        descripcion: "Ver los usuarios del sistema.",
        rutas: ["/configuracion/usuarios"],
        funciones: [{ clave: "administrarUsuarios", etiqueta: "Cambiar nombre, rol y estado de los usuarios" }],
      },
      {
        clave: "modulo.peticiones",
        etiqueta: "Peticiones",
        descripcion: "Pedidos de cambios al sistema.",
        rutas: ["/peticiones"],
        funciones: [],
      },
    ],
  },
];

export const MODULOS: readonly Modulo[] = GRUPOS_MODULOS.flatMap((grupo) => grupo.modulos);

/** Ruta del módulo de permisos: solo para la cuenta de desarrollador. */
export const RUTA_PERMISOS = "/configuracion/permisos";

const MODULO_DE_FUNCION = new Map<string, Modulo>(
  MODULOS.flatMap((modulo) => modulo.funciones.map((funcion) => [funcion.clave, modulo] as const)),
);

const CLAVES_VALIDAS = new Set<string>([
  ...MODULOS.map((modulo) => modulo.clave),
  ...MODULO_DE_FUNCION.keys(),
]);

/** Lo mínimo que se necesita para decidir: rol (en roles.ts) y claves apagadas. */
export type Restricciones = { esDesarrollador?: boolean; denegados?: readonly string[] };

function apagadas(restricciones: Restricciones): readonly string[] {
  return restricciones.esDesarrollador ? [] : (restricciones.denegados ?? []);
}

export function moduloActivo(restricciones: Restricciones, modulo: Modulo["clave"]): boolean {
  return !apagadas(restricciones).includes(modulo);
}

/** La función no está apagada, ni ella ni su módulo. No mira el rol. */
export function funcionActiva(restricciones: Restricciones, funcion: string): boolean {
  const lista = apagadas(restricciones);
  if (lista.includes(funcion)) return false;
  const modulo = MODULO_DE_FUNCION.get(funcion);
  return !modulo || !lista.includes(modulo.clave);
}

function coincidePrefijo(pathname: string, prefijo: string): boolean {
  return pathname === prefijo || pathname.startsWith(`${prefijo}/`);
}

/** Módulo dueño de una ruta (el prefijo más largo), o null si es libre. */
export function moduloDeRuta(pathname: string): Modulo | null {
  let elegido: Modulo | null = null;
  let largo = -1;
  for (const modulo of MODULOS) {
    for (const ruta of modulo.rutas) {
      if (coincidePrefijo(pathname, ruta) && ruta.length > largo) {
        elegido = modulo;
        largo = ruta.length;
      }
    }
  }
  return elegido;
}

/** Si el usuario puede abrir la ruta según sus módulos. No mira el rol. */
export function rutaPermitida(restricciones: Restricciones, pathname: string): boolean {
  if (coincidePrefijo(pathname, RUTA_PERMISOS)) return Boolean(restricciones.esDesarrollador);
  const modulo = moduloDeRuta(pathname);
  return !modulo || moduloActivo(restricciones, modulo.clave);
}

export function esClavePermiso(valor: string): boolean {
  return CLAVES_VALIDAS.has(valor);
}

/** Quita duplicados y claves desconocidas, y ordena (igual que la base). */
export function normalizarDenegados(valores: readonly unknown[]): string[] {
  const claves = valores
    .filter((valor): valor is string => typeof valor === "string")
    .map((valor) => valor.trim())
    .filter(esClavePermiso);
  return [...new Set(claves)].sort();
}

/** Cuántos módulos y funciones (de módulos encendidos) están apagados. */
export function resumirDenegados(denegados: readonly string[]): { modulos: number; funciones: number } {
  const restricciones = { denegados };
  let modulos = 0;
  let funciones = 0;
  for (const modulo of MODULOS) {
    if (!moduloActivo(restricciones, modulo.clave)) modulos += 1;
    else funciones += modulo.funciones.filter((f) => denegados.includes(f.clave)).length;
  }
  return { modulos, funciones };
}

/** Etiqueta legible de una clave, para la bitácora. */
export function etiquetaPermiso(clave: string): string {
  const modulo = MODULOS.find((m) => m.clave === clave);
  if (modulo) return `Módulo ${modulo.etiqueta}`;
  const duenio = MODULO_DE_FUNCION.get(clave);
  const funcion = duenio?.funciones.find((f) => f.clave === clave);
  return funcion && duenio ? `${duenio.etiqueta}: ${funcion.etiqueta}` : clave;
}
