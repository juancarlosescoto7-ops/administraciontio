import type { Permiso } from "@/lib/auth/roles";
import type { Campo } from "@/lib/catalogos/definiciones";

// Contratos: una plantilla vigente por tipo (public.plantillas_contrato). La
// membresía congela el suyo al registrarse; los servicios lo generan a pedido
// (public.generar_contrato_servicio).

export type TipoContrato = "membresia" | "alquiler" | "transporte" | "traslado";
export type TipoContratoServicio = Exclude<TipoContrato, "membresia">;

export const TIPOS_CONTRATO: readonly { valor: TipoContrato; etiqueta: string }[] = [
  { valor: "membresia", etiqueta: "Membresía" },
  { valor: "alquiler", etiqueta: "Alquiler de vehículo" },
  { valor: "transporte", etiqueta: "Viaje con conductor" },
  { valor: "traslado", etiqueta: "Traslado en ambulancia" },
];

export function esTipoContrato(valor: unknown): valor is TipoContrato {
  return TIPOS_CONTRATO.some((tipo) => tipo.valor === valor);
}

export function esTipoContratoServicio(valor: unknown): valor is TipoContratoServicio {
  return valor !== "membresia" && esTipoContrato(valor);
}

/** Datos de cada servicio: título del contrato, ruta de la ficha y permiso para generarlo. */
export const CONTRATO_SERVICIO: Record<TipoContratoServicio, { titulo: string; ruta: string; permiso: Permiso }> = {
  alquiler: { titulo: "Contrato de alquiler", ruta: "/alquileres", permiso: "gestionarAlquileres" },
  transporte: { titulo: "Contrato de viaje", ruta: "/transportes", permiso: "gestionarTransportes" },
  traslado: { titulo: "Contrato de traslado", ruta: "/ambulancias", permiso: "gestionarTraslados" },
};

type Variable = { nombre: string; descripcion: string };

const COMUNES: readonly Variable[] = [
  { nombre: "fecha_contrato", descripcion: "Fecha en que se genera el contrato (dd/mm/aaaa)" },
  { nombre: "fecha_contrato_letras", descripcion: "La misma fecha para el cierre: «31 días del mes de octubre de 2026»" },
  { nombre: "cliente_nombre", descripcion: "Nombre o razón social del cliente" },
  { nombre: "cliente_identificacion", descripcion: "Identidad o RTN del cliente" },
  { nombre: "cliente_telefono", descripcion: "Teléfono del cliente" },
  { nombre: "cliente_correo", descripcion: "Correo del cliente" },
  { nombre: "cliente_direccion", descripcion: "Dirección del cliente" },
];

const VEHICULO: readonly Variable[] = [
  { nombre: "vehiculo_codigo", descripcion: "Código interno del vehículo («Por asignar» si aún no tiene)" },
  { nombre: "vehiculo_placa", descripcion: "Placa" },
  { nombre: "vehiculo_marca", descripcion: "Marca" },
  { nombre: "vehiculo_modelo", descripcion: "Modelo" },
  { nombre: "vehiculo_anio", descripcion: "Año" },
];

const CONDUCTOR: readonly Variable[] = [
  { nombre: "conductor_nombre", descripcion: "Nombre del conductor («Por asignar» si aún no tiene)" },
  { nombre: "conductor_identificacion", descripcion: "Identidad del conductor" },
];

const PRECIO: readonly Variable[] = [
  { nombre: "tarifa", descripcion: "Nombre de la tarifa de referencia" },
  { nombre: "precio_total", descripcion: "Precio pactado del servicio, en lempiras" },
  { nombre: "observaciones", descripcion: "Observaciones registradas en el servicio" },
];

/** Variables de cada plantilla (mismas que private.variables_contrato). */
export const VARIABLES_CONTRATO: Record<TipoContrato, readonly Variable[]> = {
  membresia: [
    ...COMUNES,
    { nombre: "plan", descripcion: "Nombre del plan" },
    { nombre: "precio_mensual", descripcion: "Precio mensual pactado, en lempiras" },
    { nombre: "traslados_por_mes", descripcion: "Traslados incluidos por mes" },
    { nombre: "modalidad_cupo", descripcion: "Cupo compartido o individual" },
    { nombre: "dias_gracia", descripcion: "Días de gracia para pagar" },
    { nombre: "fecha_inicio", descripcion: "Fecha de inicio de la membresía" },
    { nombre: "dia_de_pago", descripcion: "Día del mes en que vence cada cuota" },
    { nombre: "vigencia", descripcion: "Renovación mensual y, si se pactó, la fecha de vencimiento" },
    { nombre: "beneficiarios", descripcion: "Lista numerada de beneficiarios (con identidad si la tienen)" },
    { nombre: "numero_beneficiarios", descripcion: "Cantidad de beneficiarios" },
  ],
  alquiler: [
    ...COMUNES,
    ...VEHICULO,
    { nombre: "entrega_prevista", descripcion: "Fecha y hora de entrega del vehículo" },
    { nombre: "devolucion_prevista", descripcion: "Fecha y hora de devolución" },
    { nombre: "duracion", descripcion: "Duración del alquiler: «1 día», «2 días y 3 horas»" },
    ...PRECIO,
  ],
  transporte: [
    ...COMUNES,
    ...VEHICULO,
    ...CONDUCTOR,
    { nombre: "inicio_previsto", descripcion: "Fecha y hora de inicio" },
    { nombre: "duracion", descripcion: "Duración estimada" },
    { nombre: "origen", descripcion: "Origen" },
    { nombre: "destino", descripcion: "Destino" },
    ...PRECIO,
  ],
  traslado: [
    ...COMUNES,
    ...VEHICULO,
    ...CONDUCTOR,
    { nombre: "tipo_traslado", descripcion: "Particular o cubierto por membresía" },
    { nombre: "paciente", descripcion: "Nombre del paciente" },
    { nombre: "plan", descripcion: "Plan de la membresía, si el traslado es cubierto" },
    { nombre: "inicio_previsto", descripcion: "Fecha y hora de inicio" },
    { nombre: "duracion", descripcion: "Duración estimada" },
    { nombre: "origen", descripcion: "Origen" },
    { nombre: "destino", descripcion: "Destino" },
    { nombre: "motivo", descripcion: "Motivo del traslado" },
    ...PRECIO,
  ],
};

export function camposPlantillaContrato(): Campo[] {
  return [
    {
      nombre: "contenido",
      etiqueta: "Texto del contrato",
      tipo: "texto_largo",
      requerido: true,
      max: 50000,
      filas: 24,
      ayuda: "Escriba las variables entre dobles llaves, por ejemplo {{cliente_nombre}}. Al guardar se crea una versión nueva.",
    },
  ];
}

/** Variables escritas en un texto que no existen para ese tipo (la base las rechaza igual). */
export function variablesDesconocidas(texto: string, tipo: TipoContrato): string[] {
  const validas = new Set(VARIABLES_CONTRATO[tipo].map((v) => v.nombre));
  const encontradas = [...texto.matchAll(/\{\{([^{}]*)\}\}/g)].map((m) => m[1].trim());
  return [...new Set(encontradas.filter((nombre) => !validas.has(nombre)))];
}
