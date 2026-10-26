import { OPCIONES_MODALIDAD_CUPO, type Campo } from "@/lib/catalogos/definiciones";
import type { Database } from "@/lib/supabase/tipos-bd";

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
