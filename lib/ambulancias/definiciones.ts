import type { Campo, Opcion } from "@/lib/catalogos/definiciones";
import { puede, type Rol } from "@/lib/auth/roles";
import type { Database } from "@/lib/supabase/tipos-bd";

type Enums = Database["public"]["Enums"];
export type EstadoTraslado = Enums["estado_traslado"];
export type TipoTraslado = Enums["tipo_traslado"];

/** Duración estimada por omisión (especificación: 90 minutos, ajustable). */
export const DURACION_PREDETERMINADA = 90;

export const ETIQUETAS_ESTADO_TRASLADO: Record<EstadoTraslado, string> = {
  solicitado: "Solicitado",
  programado: "Programado",
  en_curso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const ETIQUETAS_TIPO_TRASLADO: Record<TipoTraslado, string> = {
  cubierto: "Cubierto por membresía",
  particular: "Particular",
};

export const ETIQUETAS_COBERTURA: Record<Enums["condicion_cobertura"], string> = {
  valida: "Cobertura válida",
  pendiente_validacion: "Pendiente de validación",
  no_valida: "Sin cobertura válida",
};

export const ETIQUETAS_RESERVA: Record<Enums["estado_reserva"], string> = {
  reservada: "Beneficio reservado",
  consumida: "Beneficio consumido",
  liberada: "Reserva liberada",
};

export const ETIQUETAS_FINANCIERO: Record<string, string> = {
  no_aplica: "Cubierto (sin cargo)",
  sin_cargo: "Sin cargo todavía",
  pendiente: "Cargo pendiente",
  parcial: "Pagado parcialmente",
  pagado: "Pagado",
  anulado: "Cargo anulado",
};

export const ESTADOS_LISTADO: readonly Opcion[] = [
  { valor: "activos", etiqueta: "Activos (sin terminar)" },
  { valor: "solicitado", etiqueta: "Solicitados" },
  { valor: "programado", etiqueta: "Programados" },
  { valor: "en_curso", etiqueta: "En curso" },
  { valor: "completado", etiqueta: "Completados" },
  { valor: "cancelado", etiqueta: "Cancelados" },
  { valor: "todos", etiqueta: "Todos" },
];

export const ESTADOS_ACTIVOS: readonly EstadoTraslado[] = ["solicitado", "programado", "en_curso"];

export const TIPOS_LISTADO: readonly Opcion[] = [
  { valor: "todos", etiqueta: "Cubiertos y particulares" },
  { valor: "cubierto", etiqueta: "Cubiertos" },
  { valor: "particular", etiqueta: "Particulares" },
];

// --- Acciones según estado y rol --------------------------------------
// Espejo de las validaciones de las funciones SQL: la base decide siempre.

export type AccionesTraslado = {
  programar: boolean;
  asignar: boolean;
  reprogramar: boolean;
  ajustarDuracion: boolean;
  editar: boolean;
  revalidar: boolean;
  convertir: boolean;
  iniciar: boolean;
  finalizar: boolean;
  cancelar: boolean;
  revertirConsumo: boolean;
};

export function accionesDisponibles(
  traslado: { estado: EstadoTraslado; tipo: TipoTraslado; reservaEstado: Enums["estado_reserva"] | null },
  rol: Rol,
): AccionesTraslado {
  const gestiona = puede("gestionarTraslados", rol);
  const sinIniciar = traslado.estado === "solicitado" || traslado.estado === "programado";
  const cubierto = traslado.tipo === "cubierto";
  return {
    programar: gestiona && traslado.estado === "solicitado",
    asignar: gestiona && sinIniciar,
    reprogramar: gestiona && sinIniciar,
    ajustarDuracion: gestiona && traslado.estado === "en_curso",
    editar: gestiona && (sinIniciar || traslado.estado === "en_curso"),
    revalidar: gestiona && sinIniciar && cubierto,
    convertir: gestiona && sinIniciar && cubierto,
    iniciar: gestiona && sinIniciar,
    finalizar: gestiona && traslado.estado === "en_curso",
    cancelar: gestiona && sinIniciar,
    revertirConsumo:
      puede("corregirTraslados", rol) && traslado.estado === "completado" && cubierto && traslado.reservaEstado === "consumida",
  };
}

// --- Campos de los formularios -----------------------------------------

const CAMPO_INICIO = (ahora: string): Campo => ({
  nombre: "inicio",
  etiqueta: "Fecha y hora programadas",
  tipo: "fecha_hora",
  requerido: true,
  predeterminado: ahora,
});

const CAMPO_MINUTOS: Campo = {
  nombre: "minutos",
  etiqueta: "Duración estimada (minutos)",
  tipo: "entero",
  requerido: true,
  min: 1,
  max: 1440,
  predeterminado: String(DURACION_PREDETERMINADA),
};

function campoRecurso(nombre: string, etiqueta: string, opciones: readonly Opcion[], seccion?: string): Campo {
  return { nombre, etiqueta, tipo: "seleccion", opciones, opcionesDinamicas: true, seccion, ayuda: "Opcional hasta iniciar." };
}

const CAMPO_CONFIRMAR = (etiqueta: string): Campo => ({
  nombre: "confirmar",
  etiqueta,
  tipo: "booleano",
  ayuda: "Queda registrado con su usuario.",
});

const CAMPO_MOTIVO_OBLIGATORIO: Campo = { nombre: "motivo", etiqueta: "Motivo", tipo: "texto_largo", requerido: true, max: 300 };

export function camposSolicitud({
  tipo,
  beneficiarios,
  vehiculos,
  conductores,
  ahora,
  precioPropuesto,
}: {
  tipo: TipoTraslado;
  beneficiarios: readonly Opcion[];
  vehiculos: readonly Opcion[];
  conductores: readonly Opcion[];
  ahora: string;
  precioPropuesto?: string | null;
}): Campo[] {
  const particular = tipo === "particular";
  return [
    {
      nombre: "beneficiario_id",
      etiqueta: particular ? "Beneficiario registrado" : "Beneficiario",
      tipo: "seleccion",
      requerido: !particular,
      opciones: beneficiarios,
      opcionesDinamicas: true,
      ayuda: particular ? "Opcional: o escriba el nombre del pasajero." : "Debe estar vinculado a la membresía.",
    },
    ...(particular
      ? ([
          { nombre: "pasajero", etiqueta: "Pasajero", tipo: "texto", max: 200, ayuda: "Si no tiene ficha de beneficiario." },
          {
            nombre: "precio",
            etiqueta: "Precio pactado",
            tipo: "monto",
            predeterminado: precioPropuesto ?? undefined,
            ayuda: "Puede ajustarse; se exige antes de finalizar.",
          },
        ] satisfies Campo[])
      : []),
    CAMPO_INICIO(ahora),
    CAMPO_MINUTOS,
    { nombre: "origen", etiqueta: "Origen", tipo: "texto", requerido: true, max: 300 },
    { nombre: "destino", etiqueta: "Destino", tipo: "texto", max: 300, ayuda: "Se exige para iniciar." },
    { nombre: "motivo", etiqueta: "Motivo o descripción", tipo: "texto_largo", max: 500 },
    campoRecurso("vehiculo_id", "Ambulancia", vehiculos, "Recursos (opcionales en la solicitud)"),
    campoRecurso("conductor_id", "Conductor", conductores),
    { nombre: "notas", etiqueta: "Observaciones", tipo: "texto_largo", max: 1000 },
    { nombre: "programar", etiqueta: "Confirmar como programado", tipo: "booleano", ayuda: "Si no, queda como solicitud." },
  ];
}

export function camposRecursos(vehiculos: readonly Opcion[], conductores: readonly Opcion[]): Campo[] {
  return [
    campoRecurso("vehiculo_id", "Ambulancia", vehiculos),
    campoRecurso("conductor_id", "Conductor", conductores),
    { nombre: "motivo", etiqueta: "Motivo del cambio", tipo: "texto", max: 300, ayuda: "Opcional; se registra en el historial." },
  ];
}

export function camposReprogramar(ahora: string): Campo[] {
  return [CAMPO_INICIO(ahora), CAMPO_MINUTOS, CAMPO_MOTIVO_OBLIGATORIO];
}

export function camposDuracion(): Campo[] {
  return [
    { ...CAMPO_MINUTOS, predeterminado: undefined },
    { nombre: "motivo", etiqueta: "Motivo", tipo: "texto", max: 300 },
  ];
}

export function camposEditar(tipo: TipoTraslado): Campo[] {
  return [
    { nombre: "origen", etiqueta: "Origen", tipo: "texto", requerido: true, max: 300 },
    { nombre: "destino", etiqueta: "Destino", tipo: "texto", max: 300 },
    { nombre: "motivo", etiqueta: "Motivo o descripción", tipo: "texto_largo", max: 500 },
    ...(tipo === "particular"
      ? ([
          { nombre: "pasajero", etiqueta: "Pasajero", tipo: "texto", max: 200 },
          { nombre: "precio_pactado", etiqueta: "Precio pactado", tipo: "monto" },
        ] satisfies Campo[])
      : []),
    { nombre: "notas", etiqueta: "Observaciones", tipo: "texto_largo", max: 1000 },
  ];
}

export function camposFinalizar(aplicaAnticipo: boolean): Campo[] {
  return [
    { nombre: "notas_finales", etiqueta: "Observaciones finales", tipo: "texto_largo", max: 1000 },
    ...(aplicaAnticipo
      ? ([
          {
            nombre: "aplicar_anticipo",
            etiqueta: "Aplicar saldo a favor del cliente",
            tipo: "monto",
            ayuda: "Opcional: se aplica al cargo del servicio sin nueva entrada de dinero.",
          },
        ] satisfies Campo[])
      : []),
  ];
}

export function camposCancelar(confirmacion: string): Campo[] {
  return [CAMPO_MOTIVO_OBLIGATORIO, CAMPO_CONFIRMAR(confirmacion)];
}

export function camposConvertir(): Campo[] {
  return [
    { nombre: "precio", etiqueta: "Precio pactado como particular", tipo: "monto", requerido: true },
    CAMPO_MOTIVO_OBLIGATORIO,
    CAMPO_CONFIRMAR("El cliente acepta el servicio particular con este precio"),
  ];
}
