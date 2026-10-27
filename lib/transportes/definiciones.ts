import type { Campo, Opcion } from "@/lib/catalogos/definiciones";
import { puede, type Rol } from "@/lib/auth/roles";
import type { Database } from "@/lib/supabase/tipos-bd";

export type EstadoTransporte = Database["public"]["Enums"]["estado_transporte"];

export const DURACION_TRANSPORTE = 90;

export const ETIQUETAS_ESTADO_TRANSPORTE: Record<EstadoTransporte, string> = {
  solicitado: "Solicitado",
  programado: "Programado",
  en_curso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const ESTADOS_LISTADO_TRANSPORTE: readonly Opcion[] = [
  { valor: "activos", etiqueta: "Activos (sin terminar)" },
  { valor: "solicitado", etiqueta: "Solicitados" },
  { valor: "programado", etiqueta: "Programados" },
  { valor: "en_curso", etiqueta: "En curso" },
  { valor: "completado", etiqueta: "Completados" },
  { valor: "cancelado", etiqueta: "Cancelados" },
  { valor: "todos", etiqueta: "Todos" },
];

export const ESTADOS_ACTIVOS_TRANSPORTE: readonly EstadoTransporte[] = ["solicitado", "programado", "en_curso"];

export type AccionesTransporte = {
  programar: boolean;
  asignar: boolean;
  reprogramar: boolean;
  ajustarDuracion: boolean;
  editar: boolean;
  iniciar: boolean;
  finalizar: boolean;
  cancelar: boolean;
};

/** Espejo de las transiciones que valida la base. */
export function accionesTransporte(estado: EstadoTransporte, rol: Rol): AccionesTransporte {
  const gestiona = puede("gestionarTransportes", rol);
  const sinIniciar = estado === "solicitado" || estado === "programado";
  return {
    programar: gestiona && estado === "solicitado",
    asignar: gestiona && sinIniciar,
    reprogramar: gestiona && sinIniciar,
    ajustarDuracion: gestiona && estado === "en_curso",
    editar: gestiona && (sinIniciar || estado === "en_curso"),
    iniciar: gestiona && sinIniciar,
    finalizar: gestiona && estado === "en_curso",
    cancelar: gestiona && sinIniciar,
  };
}

const CAMPO_MINUTOS: Campo = {
  nombre: "minutos",
  etiqueta: "Duración estimada (minutos)",
  tipo: "entero",
  requerido: true,
  min: 1,
  max: 1440,
  predeterminado: String(DURACION_TRANSPORTE),
};

function campoRecurso(nombre: string, etiqueta: string, opciones: readonly Opcion[], seccion?: string): Campo {
  return { nombre, etiqueta, tipo: "seleccion", opciones, opcionesDinamicas: true, seccion, ayuda: "Opcional hasta iniciar." };
}

export function camposSolicitudTransporte({
  vehiculos,
  conductores,
  ahora,
  precioPropuesto,
}: {
  vehiculos: readonly Opcion[];
  conductores: readonly Opcion[];
  ahora: string;
  precioPropuesto?: string | null;
}): Campo[] {
  return [
    { nombre: "inicio", etiqueta: "Fecha y hora", tipo: "fecha_hora", requerido: true, predeterminado: ahora },
    CAMPO_MINUTOS,
    { nombre: "origen", etiqueta: "Origen", tipo: "texto", requerido: true, max: 300 },
    { nombre: "destino", etiqueta: "Destino", tipo: "texto", requerido: true, max: 300 },
    {
      nombre: "precio",
      etiqueta: "Precio pactado",
      tipo: "monto",
      predeterminado: precioPropuesto ?? undefined,
      ayuda: "Puede ajustarse; se exige antes de finalizar.",
    },
    campoRecurso("vehiculo_id", "Vehículo", vehiculos, "Recursos (opcionales en la solicitud)"),
    campoRecurso("conductor_id", "Conductor", conductores),
    { nombre: "notas", etiqueta: "Observaciones", tipo: "texto_largo", max: 1000 },
    { nombre: "programar", etiqueta: "Confirmar como programado", tipo: "booleano", ayuda: "Si no, queda como solicitud." },
  ];
}

export function camposRecursosTransporte(vehiculos: readonly Opcion[], conductores: readonly Opcion[]): Campo[] {
  return [
    campoRecurso("vehiculo_id", "Vehículo", vehiculos),
    campoRecurso("conductor_id", "Conductor", conductores),
    { nombre: "motivo", etiqueta: "Motivo del cambio", tipo: "texto", max: 300, ayuda: "Opcional; se registra en el historial." },
  ];
}

export function camposReprogramarTransporte(): Campo[] {
  return [
    { nombre: "inicio", etiqueta: "Fecha y hora", tipo: "fecha_hora", requerido: true },
    CAMPO_MINUTOS,
    { nombre: "motivo", etiqueta: "Motivo", tipo: "texto_largo", requerido: true, max: 300 },
  ];
}

export function camposDuracionTransporte(): Campo[] {
  return [
    { ...CAMPO_MINUTOS, predeterminado: undefined },
    { nombre: "motivo", etiqueta: "Motivo", tipo: "texto", max: 300 },
  ];
}

export function camposEditarTransporte(): Campo[] {
  return [
    { nombre: "origen", etiqueta: "Origen", tipo: "texto", requerido: true, max: 300 },
    { nombre: "destino", etiqueta: "Destino", tipo: "texto", requerido: true, max: 300 },
    { nombre: "precio_pactado", etiqueta: "Precio pactado", tipo: "monto" },
    { nombre: "notas", etiqueta: "Observaciones", tipo: "texto_largo", max: 1000 },
  ];
}

export function camposFinalizarTransporte(aplicaAnticipo: boolean): Campo[] {
  return [
    { nombre: "notas_finales", etiqueta: "Observaciones finales", tipo: "texto_largo", max: 1000 },
    ...(aplicaAnticipo
      ? ([
          {
            nombre: "aplicar_anticipo",
            etiqueta: "Aplicar saldo a favor del cliente",
            tipo: "monto",
            ayuda: "Se aplica al cargo del servicio sin nueva entrada de dinero.",
          },
        ] satisfies Campo[])
      : []),
  ];
}

export function camposCancelarTransporte(): Campo[] {
  return [
    { nombre: "motivo", etiqueta: "Motivo", tipo: "texto_largo", requerido: true, max: 300 },
    { nombre: "confirmar", etiqueta: "Confirmo la cancelación del servicio", tipo: "booleano", ayuda: "Queda registrado con su usuario." },
  ];
}
