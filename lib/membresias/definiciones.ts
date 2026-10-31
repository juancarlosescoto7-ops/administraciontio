import { CATALOGOS, OPCIONES_MODALIDAD_CUPO, type Campo } from "@/lib/catalogos/definiciones";
import type { Database } from "@/lib/supabase/tipos-bd";
import { CAMPO_FECHA_FIN } from "./vigencia";

type Enums = Database["public"]["Enums"];

export const ETIQUETAS_ESTADO_MEMBRESIA: Record<Enums["estado_membresia"], string> = {
  activa: "Activa",
  suspendida: "Suspendida por morosidad",
  cancelada: "Cancelada",
};

export const ETIQUETAS_MODALIDAD: Record<Enums["modalidad_cupo"], string> = {
  compartido: "Compartido entre beneficiarios",
  individual: "Individual por beneficiario",
};

export const ESTADOS_MEMBRESIA = [
  { valor: "activa", etiqueta: "Activas" },
  { valor: "suspendida", etiqueta: "Suspendidas" },
  { valor: "vencida", etiqueta: "Vencidas" },
  { valor: "cancelada", etiqueta: "Canceladas" },
  { valor: "todas", etiqueta: "Todas" },
] as const;

export type ResumenActualizacion = { periodos: number; suspendidas: number; reactivadas: number };

export function describirActualizacion(resumen: ResumenActualizacion): string {
  const partes = [
    `${resumen.periodos} ${resumen.periodos === 1 ? "mensualidad generada" : "mensualidades generadas"}`,
    resumen.suspendidas > 0 ? `${resumen.suspendidas} suspendida(s) por morosidad` : null,
    resumen.reactivadas > 0 ? `${resumen.reactivadas} reactivada(s)` : null,
  ].filter(Boolean);
  return `Mensualidades al día: ${partes.join(", ")}.`;
}

/** Campos de beneficiario: una casilla por beneficiario, beneficiario_<id>. */
export const PREFIJO_BENEFICIARIO = "beneficiario_";

const CAMPO_CONFIRMAR = (etiqueta: string): Campo => ({
  nombre: "confirmar",
  etiqueta,
  tipo: "booleano",
  ayuda: "Queda registrado con su usuario.",
});

/**
 * Condiciones pactadas. En el alta son opcionales (vacío = las del plan) y
 * solo las ve el administrador; al editarlas son obligatorias.
 */
export function camposCondiciones(obligatorias: boolean, seccion?: string): Campo[] {
  const vacio = obligatorias ? undefined : "Vacío: la del plan.";
  return [
    ...(!obligatorias ? [CAMPO_FECHA_FIN] : []),
    { nombre: "precio", etiqueta: "Precio mensual", tipo: "monto", requerido: obligatorias, seccion, ayuda: vacio },
    { nombre: "cupo", etiqueta: "Traslados por mes", tipo: "entero", requerido: obligatorias, min: 0, max: 1000, ayuda: vacio },
    {
      nombre: "modalidad",
      etiqueta: "Modalidad del cupo",
      tipo: "seleccion",
      requerido: obligatorias,
      opciones: OPCIONES_MODALIDAD_CUPO,
      ayuda: vacio,
    },
    { nombre: "dias_gracia", etiqueta: "Días de gracia", tipo: "entero", requerido: obligatorias, min: 0, max: 3650, ayuda: vacio },
  ];
}

export function camposEditarCondiciones(): Campo[] {
  return [
    ...camposCondiciones(true),
    { nombre: "motivo", etiqueta: "Motivo del cambio", tipo: "texto_largo", requerido: true, max: 300 },
  ];
}

export function camposAltaMembresia(beneficiarios: readonly { id: string; nombre: string; detalle: string | null }[], administrador: boolean): Campo[] {
  return [
    ...beneficiarios.map(
      (beneficiario, indice): Campo => ({
        nombre: `${PREFIJO_BENEFICIARIO}${beneficiario.id}`,
        etiqueta: beneficiario.nombre,
        tipo: "booleano",
        ayuda: beneficiario.detalle ?? undefined,
        seccion: indice === 0 ? "Beneficiarios" : undefined,
      }),
    ),
    ...(administrador ? camposCondiciones(false, "Condiciones particulares (opcional, solo administrador)") : []),
    { ...CAMPO_CONFIRMAR("Revisé cliente, plan, fecha de inicio, beneficiarios y condiciones"), seccion: "Confirmación" },
  ];
}

export function camposAgregarBeneficiario(opciones: readonly { valor: string; etiqueta: string }[]): Campo[] {
  return [
    { nombre: "beneficiario_id", etiqueta: "Beneficiario", tipo: "seleccion", requerido: true, opciones, opcionesDinamicas: true },
  ];
}

export function camposBaja(confirmacion: string): Campo[] {
  return [
    { nombre: "motivo", etiqueta: "Motivo", tipo: "texto_largo", requerido: true, max: 300 },
    CAMPO_CONFIRMAR(confirmacion),
  ];
}

// --- Alta integrada: beneficiarios nuevos en el mismo formulario ---

/** Beneficiario nuevo número n: nuevo_<n>_<campo>. */
const PATRON_NUEVO = /^nuevo_(\d{1,3})_nombre$/;

const sinActivo = (campos: readonly Campo[]) => campos.filter((campo) => campo.nombre !== "activo");

/** Datos de un beneficiario nuevo (sin notas, para que la fila sea breve). */
export function camposBeneficiarioNuevo(prefijo = ""): Campo[] {
  return sinActivo(CATALOGOS.beneficiarios.campos)
    .filter((campo) => campo.nombre !== "notas")
    .map((campo) => ({ ...campo, nombre: `${prefijo}${campo.nombre}` }));
}

/** Índices de las filas de beneficiarios nuevos enviadas en el formulario. */
export function indicesBeneficiariosNuevos(nombres: Iterable<string>): number[] {
  const indices = new Set<number>();
  for (const nombre of nombres) {
    const coincidencia = PATRON_NUEVO.exec(nombre);
    if (coincidencia) indices.add(Number(coincidencia[1]));
  }
  return [...indices].sort((a, b) => a - b).slice(0, 50);
}

export const prefijoNuevo = (indice: number) => `nuevo_${indice}_`;

export const CAMPO_TITULAR_BENEFICIARIO: Campo = {
  nombre: "titular_beneficiario",
  etiqueta: "El titular también es beneficiario",
  tipo: "booleano",
  ayuda: "Solo para personas naturales. Si ya tiene ficha de beneficiario con la misma identidad, se usa esa.",
};

/** Todos los campos del alta integrada, para validar en el servidor. */
export function camposAltaIntegrada({
  beneficiarios,
  nuevos,
  administrador,
}: {
  beneficiarios: readonly { id: string; nombre: string; detalle: string | null }[];
  nuevos: readonly number[];
  administrador: boolean;
}): Campo[] {
  return [
    CAMPO_TITULAR_BENEFICIARIO,
    ...nuevos.flatMap((indice) => camposBeneficiarioNuevo(prefijoNuevo(indice))),
    ...camposAltaMembresia(beneficiarios, administrador).map((campo) => ({ ...campo, seccion: undefined })),
  ];
}

// --- Contrato -----------------------------------------------------------------

/** Variables de la plantilla del contrato (mismas que private.variables_contrato). */
export const VARIABLES_CONTRATO: readonly { nombre: string; descripcion: string }[] = [
  { nombre: "fecha_contrato", descripcion: "Fecha en que se registró la membresía" },
  { nombre: "cliente_nombre", descripcion: "Nombre o razón social del titular" },
  { nombre: "cliente_identificacion", descripcion: "Identidad o RTN del titular" },
  { nombre: "cliente_telefono", descripcion: "Teléfono del titular" },
  { nombre: "cliente_correo", descripcion: "Correo del titular" },
  { nombre: "cliente_direccion", descripcion: "Dirección del titular" },
  { nombre: "plan", descripcion: "Nombre del plan" },
  { nombre: "precio_mensual", descripcion: "Precio mensual pactado, en lempiras" },
  { nombre: "traslados_por_mes", descripcion: "Traslados incluidos por mes" },
  { nombre: "modalidad_cupo", descripcion: "Cupo compartido o individual" },
  { nombre: "dias_gracia", descripcion: "Días de gracia para pagar" },
  { nombre: "fecha_inicio", descripcion: "Fecha de inicio de la membresía" },
  { nombre: "dia_de_pago", descripcion: "Día del mes en que vence cada cuota" },
  { nombre: "beneficiarios", descripcion: "Lista numerada de beneficiarios (con identidad si la tienen)" },
  { nombre: "numero_beneficiarios", descripcion: "Cantidad de beneficiarios" },
];

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

/** Variables escritas en un texto que no existen (la base las rechaza igual). */
export function variablesDesconocidas(texto: string): string[] {
  const validas = new Set(VARIABLES_CONTRATO.map((v) => v.nombre));
  const encontradas = [...texto.matchAll(/\{\{([^{}]*)\}\}/g)].map((m) => m[1].trim());
  return [...new Set(encontradas.filter((nombre) => !validas.has(nombre)))];
}
