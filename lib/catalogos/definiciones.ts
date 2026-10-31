import type { ClaveCatalogo } from "@/lib/auth/roles";

export type TipoCampo =
  | "texto"
  | "texto_largo"
  | "correo"
  | "telefono"
  | "fecha"
  /** Fecha y hora local de Tegucigalpa; se envía como timestamptz con zona. */
  | "fecha_hora"
  | "entero"
  | "monto"
  | "seleccion"
  | "booleano";

export type Opcion = { valor: string; etiqueta: string };

export type Campo = {
  duracion?: boolean;
  nombre: string;
  etiqueta: string;
  tipo: TipoCampo;
  requerido?: boolean;
  /** Longitud máxima (texto) o valor máximo (entero). */
  max?: number;
  /** Valor mínimo (entero). */
  min?: number;
  opciones?: readonly Opcion[];
  /**
   * Opciones que dependen de datos (cuentas, cargos…): en el servidor se
   * valida que el valor sea un UUID y la base comprueba que exista.
   */
  opcionesDinamicas?: boolean;
  /** Título de sección que se muestra antes del campo. */
  seccion?: string;
  /** Normaliza a mayúsculas (códigos y placas). */
  mayusculas?: boolean;
  /** Fecha que no puede ser posterior a hoy. */
  noFutura?: boolean;
  predeterminado?: string;
  ayuda?: string;
  /** Alto del área de texto (texto_largo), en líneas. */
  filas?: number;
};

export type Columna = { campo: string; etiqueta: string };

export type DefinicionCatalogo = {
  clave: ClaveCatalogo;
  tabla: ClaveCatalogo;
  ruta: string;
  titulo: string;
  descripcion: string;
  /** Nombre del registro en singular, para títulos («Editar cliente»). */
  singular: string;
  etiquetaNuevo: string;
  /** Campo que identifica el registro en títulos y tarjetas. */
  campoTitulo: string;
  campos: readonly Campo[];
  columnas: readonly Columna[];
  camposBusqueda: readonly string[];
  orden: string;
  /** Mensajes para violaciones de restricciones UNIQUE, por nombre de restricción. */
  restriccionesUnicas?: Record<string, { campo: string; mensaje: string }>;
};

const CAMPO_ACTIVO: Campo = {
  nombre: "activo",
  etiqueta: "Activo",
  tipo: "booleano",
  predeterminado: "on",
  ayuda: "Los registros no se eliminan: desmarque para inactivarlo.",
};

export const OPCIONES_TIPO_CLIENTE: readonly Opcion[] = [
  { valor: "natural", etiqueta: "Persona natural" },
  { valor: "juridica", etiqueta: "Persona jurídica" },
];

export const OPCIONES_TIPO_VEHICULO: readonly Opcion[] = [
  { valor: "ambulancia", etiqueta: "Ambulancia" },
  { valor: "alquiler", etiqueta: "Alquiler" },
  { valor: "transporte", etiqueta: "Transporte" },
  { valor: "mixto", etiqueta: "Mixto" },
];

export const OPCIONES_ESTADO_VEHICULO: readonly Opcion[] = [
  { valor: "operativo", etiqueta: "Operativo" },
  { valor: "mantenimiento", etiqueta: "En mantenimiento" },
  { valor: "fuera_servicio", etiqueta: "Fuera de servicio" },
];

export const OPCIONES_MODALIDAD_CUPO: readonly Opcion[] = [
  { valor: "compartido", etiqueta: "Compartido" },
  { valor: "individual", etiqueta: "Individual" },
];

// 'general' existe en el tipo actividad solo para gastos; no aplica a tarifas.
export const OPCIONES_ACTIVIDAD_TARIFA: readonly Opcion[] = [
  { valor: "ambulancias", etiqueta: "Ambulancias" },
  { valor: "alquileres", etiqueta: "Alquileres" },
  { valor: "transportes", etiqueta: "Transportes" },
];

export const OPCIONES_UNIDAD_TARIFA: readonly Opcion[] = [
  { valor: "dia", etiqueta: "Por día" },
  { valor: "servicio", etiqueta: "Por servicio" },
];

export const OPCIONES_TIPO_CUENTA: readonly Opcion[] = [
  { valor: "caja", etiqueta: "Caja" },
  { valor: "banco", etiqueta: "Banco" },
];

export const CATALOGOS: Record<ClaveCatalogo, DefinicionCatalogo> = {
  empleados: {
    clave: "empleados", tabla: "empleados", ruta: "/empleados", titulo: "Empleados",
    descripcion: "Personal de la empresa. Registre sus salarios desde Gastos.",
    singular: "empleado", etiquetaNuevo: "Nuevo empleado", campoTitulo: "nombre",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true, max: 200 },
      { nombre: "puesto", etiqueta: "Puesto", tipo: "texto", max: 100 },
      { nombre: "telefono", etiqueta: "Teléfono", tipo: "telefono", max: 40 },
      CAMPO_ACTIVO,
    ],
    columnas: [{ campo: "nombre", etiqueta: "Nombre" }, { campo: "puesto", etiqueta: "Puesto" }, { campo: "activo", etiqueta: "Estado" }],
    camposBusqueda: ["nombre", "puesto"], orden: "nombre",
  },
  clientes: {
    clave: "clientes",
    tabla: "clientes",
    ruta: "/clientes",
    titulo: "Clientes",
    descripcion: "Personas naturales y jurídicas que contratan servicios.",
    singular: "cliente",
    etiquetaNuevo: "Nuevo cliente",
    campoTitulo: "nombre",
    campos: [
      {
        nombre: "tipo",
        etiqueta: "Tipo",
        tipo: "seleccion",
        requerido: true,
        opciones: OPCIONES_TIPO_CLIENTE,
        predeterminado: "natural",
      },
      { nombre: "nombre", etiqueta: "Nombre o razón social", tipo: "texto", requerido: true, max: 200 },
      { nombre: "identificacion", etiqueta: "Identidad / RTN", tipo: "texto", max: 40, ayuda: "Opcional." },
      { nombre: "telefono", etiqueta: "Teléfono", tipo: "telefono", max: 40 },
      { nombre: "correo", etiqueta: "Correo electrónico", tipo: "correo", max: 254 },
      { nombre: "direccion", etiqueta: "Dirección", tipo: "texto_largo", max: 300 },
      CAMPO_ACTIVO,
    ],
    columnas: [
      { campo: "nombre", etiqueta: "Nombre" },
      { campo: "tipo", etiqueta: "Tipo" },
      { campo: "identificacion", etiqueta: "Identidad / RTN" },
      { campo: "telefono", etiqueta: "Teléfono" },
      { campo: "activo", etiqueta: "Estado" },
    ],
    camposBusqueda: ["nombre", "identificacion", "telefono", "correo"],
    orden: "nombre",
  },
  beneficiarios: {
    clave: "beneficiarios",
    tabla: "beneficiarios",
    ruta: "/beneficiarios",
    titulo: "Beneficiarios",
    descripcion: "Personas que reciben la asistencia; no todas tienen identidad.",
    singular: "beneficiario",
    etiquetaNuevo: "Nuevo beneficiario",
    campoTitulo: "nombre",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre completo", tipo: "texto", requerido: true, max: 200 },
      { nombre: "identificacion", etiqueta: "Identidad", tipo: "texto", max: 40, ayuda: "Opcional." },
      { nombre: "fecha_nacimiento", etiqueta: "Fecha de nacimiento", tipo: "fecha", noFutura: true },
      { nombre: "telefono", etiqueta: "Teléfono", tipo: "telefono", max: 40 },
      { nombre: "tutor", etiqueta: "Tutor o responsable", tipo: "texto", max: 200 },
      { nombre: "notas", etiqueta: "Notas", tipo: "texto_largo", max: 1000 },
      CAMPO_ACTIVO,
    ],
    columnas: [
      { campo: "nombre", etiqueta: "Nombre" },
      { campo: "identificacion", etiqueta: "Identidad" },
      { campo: "fecha_nacimiento", etiqueta: "Nacimiento" },
      { campo: "tutor", etiqueta: "Tutor" },
      { campo: "activo", etiqueta: "Estado" },
    ],
    camposBusqueda: ["nombre", "identificacion", "tutor", "telefono"],
    orden: "nombre",
  },
  vehiculos: {
    clave: "vehiculos",
    tabla: "vehiculos",
    ruta: "/vehiculos",
    titulo: "Vehículos",
    descripcion: "Flota propia: ambulancias, alquiler y transporte.",
    singular: "vehículo",
    etiquetaNuevo: "Nuevo vehículo",
    campoTitulo: "codigo",
    campos: [
      { nombre: "codigo", etiqueta: "Código interno", tipo: "texto", requerido: true, max: 30, mayusculas: true },
      { nombre: "placa", etiqueta: "Placa", tipo: "texto", max: 20, mayusculas: true, ayuda: "Opcional; si se indica debe ser única." },
      { nombre: "tipo", etiqueta: "Tipo", tipo: "seleccion", requerido: true, opciones: OPCIONES_TIPO_VEHICULO },
      { nombre: "marca", etiqueta: "Marca", tipo: "texto", max: 60 },
      { nombre: "modelo", etiqueta: "Modelo", tipo: "texto", max: 60 },
      { nombre: "anio", etiqueta: "Año", tipo: "entero", min: 1950, max: 2100 },
      {
        nombre: "estado",
        etiqueta: "Estado operativo",
        tipo: "seleccion",
        requerido: true,
        opciones: OPCIONES_ESTADO_VEHICULO,
        predeterminado: "operativo",
      },
      CAMPO_ACTIVO,
    ],
    columnas: [
      { campo: "codigo", etiqueta: "Código" },
      { campo: "placa", etiqueta: "Placa" },
      { campo: "tipo", etiqueta: "Tipo" },
      { campo: "marca", etiqueta: "Marca" },
      { campo: "estado", etiqueta: "Estado operativo" },
      { campo: "activo", etiqueta: "Estado" },
    ],
    camposBusqueda: ["codigo", "placa", "marca", "modelo"],
    orden: "codigo",
    restriccionesUnicas: {
      vehiculos_codigo_key: { campo: "codigo", mensaje: "Ya existe un vehículo con este código." },
      vehiculos_placa_key: { campo: "placa", mensaje: "Ya existe un vehículo con esta placa." },
    },
  },
  conductores: {
    clave: "conductores",
    tabla: "conductores",
    ruta: "/conductores",
    titulo: "Conductores",
    descripcion: "Conductores disponibles para traslados y transportes.",
    singular: "conductor",
    etiquetaNuevo: "Nuevo conductor",
    campoTitulo: "nombre",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre completo", tipo: "texto", requerido: true, max: 200 },
      { nombre: "identificacion", etiqueta: "Documento", tipo: "texto", max: 40, ayuda: "Opcional." },
      { nombre: "telefono", etiqueta: "Teléfono", tipo: "telefono", max: 40 },
      CAMPO_ACTIVO,
    ],
    columnas: [
      { campo: "nombre", etiqueta: "Nombre" },
      { campo: "identificacion", etiqueta: "Documento" },
      { campo: "telefono", etiqueta: "Teléfono" },
      { campo: "activo", etiqueta: "Estado" },
    ],
    camposBusqueda: ["nombre", "identificacion", "telefono"],
    orden: "nombre",
  },
  proveedores: {
    clave: "proveedores",
    tabla: "proveedores",
    ruta: "/proveedores",
    titulo: "Proveedores",
    descripcion: "Proveedores de bienes y servicios.",
    singular: "proveedor",
    etiquetaNuevo: "Nuevo proveedor",
    campoTitulo: "nombre",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre o razón social", tipo: "texto", requerido: true, max: 200 },
      { nombre: "identificacion", etiqueta: "Identificación / RTN", tipo: "texto", max: 40 },
      { nombre: "telefono", etiqueta: "Teléfono", tipo: "telefono", max: 40 },
      CAMPO_ACTIVO,
    ],
    columnas: [
      { campo: "nombre", etiqueta: "Nombre" },
      { campo: "identificacion", etiqueta: "Identificación / RTN" },
      { campo: "telefono", etiqueta: "Teléfono" },
      { campo: "activo", etiqueta: "Estado" },
    ],
    camposBusqueda: ["nombre", "identificacion", "telefono"],
    orden: "nombre",
  },
  planes: {
    clave: "planes",
    tabla: "planes",
    ruta: "/planes",
    titulo: "Planes de membresía",
    descripcion: "Precio mensual, cupo de traslados y días de gracia. Solo el administrador los modifica.",
    singular: "plan",
    etiquetaNuevo: "Nuevo plan",
    campoTitulo: "nombre",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre del plan", tipo: "texto", requerido: true, max: 120 },
      { nombre: "precio_mensual", etiqueta: "Precio mensual (HNL)", tipo: "monto", requerido: true },
      { nombre: "cupo_mensual", etiqueta: "Cupo de traslados al mes", tipo: "entero", requerido: true, min: 0 },
      {
        nombre: "modalidad_cupo",
        etiqueta: "Modalidad del cupo",
        tipo: "seleccion",
        requerido: true,
        opciones: OPCIONES_MODALIDAD_CUPO,
        ayuda: "Compartido: cuenta para todos los beneficiarios. Individual: por beneficiario.",
      },
      { nombre: "dias_gracia", etiqueta: "Días de gracia", tipo: "entero", requerido: true, min: 0 },
      CAMPO_ACTIVO,
    ],
    columnas: [
      { campo: "nombre", etiqueta: "Plan" },
      { campo: "precio_mensual", etiqueta: "Precio mensual" },
      { campo: "cupo_mensual", etiqueta: "Cupo" },
      { campo: "modalidad_cupo", etiqueta: "Modalidad" },
      { campo: "dias_gracia", etiqueta: "Gracia (días)" },
      { campo: "activo", etiqueta: "Estado" },
    ],
    camposBusqueda: ["nombre"],
    orden: "nombre",
  },
  tarifas: {
    clave: "tarifas",
    tabla: "tarifas",
    ruta: "/tarifas",
    titulo: "Tarifas",
    descripcion: "Precios de referencia por actividad. Solo el administrador los modifica.",
    singular: "tarifa",
    etiquetaNuevo: "Nueva tarifa",
    campoTitulo: "nombre",
    campos: [
      {
        nombre: "actividad",
        etiqueta: "Actividad",
        tipo: "seleccion",
        requerido: true,
        opciones: OPCIONES_ACTIVIDAD_TARIFA,
      },
      { nombre: "nombre", etiqueta: "Nombre de la tarifa", tipo: "texto", requerido: true, max: 120 },
      { nombre: "unidad", etiqueta: "Unidad", tipo: "seleccion", requerido: true, opciones: OPCIONES_UNIDAD_TARIFA },
      { nombre: "precio_base", etiqueta: "Precio base (HNL)", tipo: "monto", requerido: true },
      CAMPO_ACTIVO,
    ],
    columnas: [
      { campo: "nombre", etiqueta: "Tarifa" },
      { campo: "actividad", etiqueta: "Actividad" },
      { campo: "unidad", etiqueta: "Unidad" },
      { campo: "precio_base", etiqueta: "Precio base" },
      { campo: "activo", etiqueta: "Estado" },
    ],
    camposBusqueda: ["nombre"],
    orden: "nombre",
  },
  cuentas_dinero: {
    clave: "cuentas_dinero",
    tabla: "cuentas_dinero",
    ruta: "/finanzas/cuentas",
    titulo: "Cajas y bancos",
    descripcion:
      "Cuentas de dinero en HNL. El saldo se calcula con los movimientos confirmados; nunca se edita a mano.",
    singular: "cuenta",
    etiquetaNuevo: "Nueva cuenta",
    campoTitulo: "nombre",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre", tipo: "texto", requerido: true, max: 120 },
      { nombre: "tipo", etiqueta: "Tipo", tipo: "seleccion", requerido: true, opciones: OPCIONES_TIPO_CUENTA },
      { nombre: "banco", etiqueta: "Banco", tipo: "texto", max: 120, ayuda: "Solo para cuentas bancarias." },
      { nombre: "numero_cuenta", etiqueta: "Número de cuenta", tipo: "texto", max: 40 },
      CAMPO_ACTIVO,
    ],
    columnas: [
      { campo: "nombre", etiqueta: "Nombre" },
      { campo: "tipo", etiqueta: "Tipo" },
      { campo: "banco", etiqueta: "Banco" },
      { campo: "numero_cuenta", etiqueta: "Número" },
      { campo: "activo", etiqueta: "Estado" },
    ],
    camposBusqueda: ["nombre", "banco", "numero_cuenta"],
    orden: "nombre",
  },
};

export function obtenerDefinicion(clave: string): DefinicionCatalogo {
  if (!Object.hasOwn(CATALOGOS, clave)) {
    throw new Error("Catálogo desconocido.");
  }
  return CATALOGOS[clave as ClaveCatalogo];
}

/**
 * Campos de la ventana «Cliente nuevo» de los servicios: los del catálogo sin
 * «Activo» (un cliente nuevo nace activo por omisión de la base). La ventana y
 * la acción del servidor usan esta misma lista.
 */
export function camposClienteNuevo(): Campo[] {
  return CATALOGOS.clientes.campos.filter((campo) => campo.nombre !== "activo");
}
