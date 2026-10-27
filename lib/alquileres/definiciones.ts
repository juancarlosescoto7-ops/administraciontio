import type { Campo, Opcion } from "@/lib/catalogos/definiciones";
import { puede, type Rol } from "@/lib/auth/roles";
import type { Database } from "@/lib/supabase/tipos-bd";

type Enums = Database["public"]["Enums"];
export type EstadoAlquiler = Enums["estado_alquiler"];
export type NivelCombustible = Enums["nivel_combustible"];

export const ETIQUETAS_ESTADO_ALQUILER: Record<EstadoAlquiler, string> = {
  reservado: "Reservado",
  entregado: "Entregado",
  devuelto: "Devuelto",
  cancelado: "Cancelado",
};

export const ETIQUETAS_COMBUSTIBLE: Record<NivelCombustible, string> = {
  vacio: "Vacío",
  cuarto: "1/4",
  medio: "1/2",
  tres_cuartos: "3/4",
  lleno: "Lleno",
};

const NIVELES: readonly NivelCombustible[] = ["vacio", "cuarto", "medio", "tres_cuartos", "lleno"];
const OPCIONES_COMBUSTIBLE: readonly Opcion[] = NIVELES.map((valor) => ({ valor, etiqueta: ETIQUETAS_COMBUSTIBLE[valor] }));

export const ESTADOS_LISTADO_ALQUILER: readonly Opcion[] = [
  { valor: "activos", etiqueta: "Reservados y entregados" },
  { valor: "reservado", etiqueta: "Reservados" },
  { valor: "entregado", etiqueta: "Entregados" },
  { valor: "devuelto", etiqueta: "Devueltos" },
  { valor: "cancelado", etiqueta: "Cancelados" },
  { valor: "todos", etiqueta: "Todos" },
];

// --- Precio sugerido -----------------------------------------------------

/** Días cobrables: bloques de 24 horas iniciados, mínimo uno. */
export function diasAlquiler(entrega: string, devolucion: string): number {
  const horas = (new Date(devolucion).getTime() - new Date(entrega).getTime()) / 3_600_000;
  if (!Number.isFinite(horas) || horas <= 0) return 1;
  return Math.max(1, Math.ceil(horas / 24));
}

/** Tarifa diaria × días, en texto decimal (centavos enteros, sin float). */
export function precioSugerido(precioDia: number | string, dias: number): string {
  const centavos = Math.round(Number(precioDia) * 100) * dias;
  return `${Math.trunc(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
}

/** Diferencia de combustible en cuartos de tanque (negativa si volvió con menos). */
export function diferenciaCombustible(salida: NivelCombustible | null, regreso: NivelCombustible | null): number | null {
  if (!salida || !regreso) return null;
  return NIVELES.indexOf(regreso) - NIVELES.indexOf(salida);
}

// --- Acciones según estado y rol (espejo de la base) -----------------------

export type AccionesAlquiler = { modificar: boolean; entregar: boolean; devolver: boolean; cancelar: boolean };

export function accionesAlquiler(estado: EstadoAlquiler, rol: Rol): AccionesAlquiler {
  const gestiona = puede("gestionarAlquileres", rol);
  return {
    modificar: gestiona && estado === "reservado",
    entregar: gestiona && estado === "reservado",
    devolver: gestiona && estado === "entregado",
    cancelar: gestiona && estado === "reservado",
  };
}

// --- Campos -------------------------------------------------------------

export function camposReserva(vehiculos: readonly Opcion[], precio: string | null): Campo[] {
  return [
    { nombre: "vehiculo_id", etiqueta: "Vehículo", tipo: "seleccion", requerido: true, opciones: vehiculos, opcionesDinamicas: true },
    { nombre: "precio", etiqueta: "Precio total pactado", tipo: "monto", requerido: true, predeterminado: precio ?? undefined, ayuda: "Propuesto por la tarifa; puede ajustarse." },
    { nombre: "notas", etiqueta: "Observaciones", tipo: "texto_largo", max: 1000 },
  ];
}

export function camposModificar(vehiculos: readonly Opcion[]): Campo[] {
  return [
    { nombre: "vehiculo_id", etiqueta: "Vehículo", tipo: "seleccion", requerido: true, opciones: vehiculos, opcionesDinamicas: true },
    { nombre: "entrega", etiqueta: "Entrega prevista", tipo: "fecha_hora", requerido: true },
    { nombre: "devolucion", etiqueta: "Devolución prevista", tipo: "fecha_hora", requerido: true },
    { nombre: "precio", etiqueta: "Precio total pactado", tipo: "monto", requerido: true },
    { nombre: "notas", etiqueta: "Observaciones", tipo: "texto_largo", max: 1000 },
    { nombre: "motivo", etiqueta: "Motivo del cambio", tipo: "texto_largo", requerido: true, max: 300 },
  ];
}

export function camposEntrega(): Campo[] {
  return [
    { nombre: "km", etiqueta: "Kilometraje de salida", tipo: "entero", requerido: true, min: 0, max: 9_999_999 },
    { nombre: "combustible", etiqueta: "Combustible de salida", tipo: "seleccion", requerido: true, opciones: OPCIONES_COMBUSTIBLE },
    { nombre: "notas", etiqueta: "Observaciones de entrega", tipo: "texto_largo", max: 1000 },
  ];
}

/** Dos líneas de cargos adicionales expresos (concepto + importe). */
export const LINEAS_ADICIONALES = [1, 2] as const;

export function camposDevolucion(aplicaAnticipo: boolean, corrigeKm: boolean): Campo[] {
  return [
    { nombre: "km", etiqueta: "Kilometraje de regreso", tipo: "entero", requerido: true, min: 0, max: 9_999_999 },
    { nombre: "combustible", etiqueta: "Combustible de regreso", tipo: "seleccion", requerido: true, opciones: OPCIONES_COMBUSTIBLE },
    { nombre: "notas", etiqueta: "Observaciones de devolución", tipo: "texto_largo", max: 1000 },
    ...LINEAS_ADICIONALES.flatMap((n): Campo[] => [
      {
        nombre: `adicional${n}_concepto`,
        etiqueta: `Cargo adicional ${n}: concepto`,
        tipo: "texto",
        max: 200,
        seccion: n === 1 ? "Cargos adicionales (solo si corresponden, con concepto e importe)" : undefined,
      },
      { nombre: `adicional${n}_monto`, etiqueta: `Cargo adicional ${n}: importe`, tipo: "monto" },
    ]),
    ...(aplicaAnticipo
      ? ([
          {
            nombre: "aplicar_anticipo",
            etiqueta: "Aplicar saldo a favor del cliente",
            tipo: "monto",
            seccion: "Cobro",
            ayuda: "Se aplica al cargo del alquiler sin nueva entrada de dinero.",
          },
        ] satisfies Campo[])
      : []),
    ...(corrigeKm
      ? ([
          {
            nombre: "motivo_km",
            etiqueta: "Motivo de corrección de kilometraje (solo administrador)",
            tipo: "texto",
            max: 300,
            ayuda: "Solo si el kilometraje de regreso es menor que el de salida.",
          },
        ] satisfies Campo[])
      : []),
  ];
}

/** Valida que cada cargo adicional tenga concepto e importe a la vez. */
export function leerAdicionales(datos: Record<string, unknown>): { adicionales: { concepto: string; monto: string }[]; errores: Record<string, string> } {
  const adicionales: { concepto: string; monto: string }[] = [];
  const errores: Record<string, string> = {};
  for (const n of LINEAS_ADICIONALES) {
    const concepto = datos[`adicional${n}_concepto`];
    const monto = datos[`adicional${n}_monto`];
    if (typeof concepto === "string" && typeof monto === "string") adicionales.push({ concepto, monto });
    else if (typeof concepto === "string") errores[`adicional${n}_monto`] = "Indique el importe del cargo adicional.";
    else if (typeof monto === "string") errores[`adicional${n}_concepto`] = "Indique el concepto del cargo adicional.";
  }
  return { adicionales, errores };
}

export function camposCancelarAlquiler(): Campo[] {
  return [
    { nombre: "motivo", etiqueta: "Motivo", tipo: "texto_largo", requerido: true, max: 300 },
    { nombre: "confirmar", etiqueta: "Confirmo la cancelación de la reserva", tipo: "booleano", ayuda: "Queda registrado con su usuario." },
  ];
}
