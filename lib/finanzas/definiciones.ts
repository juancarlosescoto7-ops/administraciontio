import type { Campo, Opcion } from "@/lib/catalogos/definiciones";
import type { Database } from "@/lib/supabase/tipos-bd";

type Enums = Database["public"]["Enums"];

export const ETIQUETAS_ACTIVIDAD: Record<Enums["actividad"], string> = {
  ambulancias: "Ambulancias y membresías",
  alquileres: "Alquileres",
  transportes: "Transporte con conductor",
  general: "General",
};

export const ETIQUETAS_METODO: Record<Enums["metodo_pago"], string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia bancaria",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

export const ETIQUETAS_TIPO_MOVIMIENTO: Record<Enums["tipo_movimiento"], string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
  apertura: "Saldo inicial",
  transferencia: "Transferencia",
};

/** Estados de documentos financieros: los finales se muestran apagados. */
export const ESTADOS_FINALES = new Set(["anulado", "reversado", "reversada"]);

export const ETIQUETAS_ESTADO: Record<string, string> = {
  vigente: "Vigente",
  anulado: "Anulado",
  confirmado: "Confirmado",
  reversado: "Reversado",
  reversada: "Reversada",
  registrado: "Registrado",
};

const OPCIONES_METODO: readonly Opcion[] = Object.entries(ETIQUETAS_METODO).map(
  ([valor, etiqueta]) => ({ valor, etiqueta }),
);

/** Líneas de ingreso del plan de cuentas (código de cuenta 4x00). */
export const OPCIONES_LINEA_INGRESO: readonly Opcion[] = [
  { valor: "4100", etiqueta: "Membresías" },
  { valor: "4200", etiqueta: "Ambulancias particulares" },
  { valor: "4300", etiqueta: "Alquileres" },
  { valor: "4400", etiqueta: "Transportes" },
];

const OPCIONES_ACTIVIDAD_GASTO: readonly Opcion[] = [
  { valor: "ambulancias", etiqueta: "Ambulancias y membresías" },
  { valor: "alquileres", etiqueta: "Alquileres" },
  { valor: "transportes", etiqueta: "Transporte con conductor" },
  { valor: "general", etiqueta: "General (no se reparte entre actividades)" },
];

// --- Campos de los formularios -----------------------------------------
// Las opciones de cuentas, categorías, proveedores y cargos se cargan de la
// base al pintar el formulario; en el servidor basta con validar su formato.

function campoCuenta(nombre: string, etiqueta: string, cuentas: readonly Opcion[], requerido = true): Campo {
  return { nombre, etiqueta, tipo: "seleccion", requerido, opciones: cuentas, opcionesDinamicas: true };
}

function campoFecha(hoy: string, etiqueta = "Fecha"): Campo {
  return { nombre: "fecha", etiqueta, tipo: "fecha", requerido: true, noFutura: true, predeterminado: hoy };
}

const CAMPO_METODO: Campo = {
  nombre: "metodo",
  etiqueta: "Método de pago",
  tipo: "seleccion",
  requerido: true,
  opciones: OPCIONES_METODO,
  predeterminado: "efectivo",
};

const CAMPO_REFERENCIA: Campo = {
  nombre: "referencia",
  etiqueta: "Referencia",
  tipo: "texto",
  max: 80,
  ayuda: "Número de transferencia, recibo o voucher (opcional).",
};

export function camposCobro(cuentas: readonly Opcion[], hoy: string): Campo[] {
  return [
    { nombre: "monto", etiqueta: "Importe recibido", tipo: "monto", requerido: true },
    campoCuenta("cuenta_dinero_id", "Caja o banco que recibe", cuentas),
    campoFecha(hoy),
    CAMPO_METODO,
    CAMPO_REFERENCIA,
  ];
}

export function camposCargo(hoy: string): Campo[] {
  return [
    { nombre: "cuenta_ingreso", etiqueta: "Línea de ingreso", tipo: "seleccion", requerido: true, opciones: OPCIONES_LINEA_INGRESO },
    { nombre: "monto", etiqueta: "Importe", tipo: "monto", requerido: true },
    { nombre: "concepto", etiqueta: "Concepto", tipo: "texto", requerido: true, max: 200 },
    campoFecha(hoy),
    { nombre: "vencimiento", etiqueta: "Vencimiento", tipo: "fecha", ayuda: "Opcional." },
  ];
}

export function camposAplicarSaldo(): Campo[] {
  return [{ nombre: "monto", etiqueta: "Importe a aplicar", tipo: "monto", requerido: true }];
}

export function camposGasto(
  hoy: string,
  categorias: readonly Opcion[],
  proveedores: readonly Opcion[],
  cuentas: readonly Opcion[],
): Campo[] {
  return [
    { nombre: "concepto", etiqueta: "Concepto", tipo: "texto", requerido: true, max: 200 },
    { nombre: "monto", etiqueta: "Importe del gasto", tipo: "monto", requerido: true },
    { nombre: "categoria_id", etiqueta: "Categoría", tipo: "seleccion", requerido: true, opciones: categorias, opcionesDinamicas: true },
    { nombre: "actividad", etiqueta: "Actividad", tipo: "seleccion", requerido: true, opciones: OPCIONES_ACTIVIDAD_GASTO },
    { nombre: "proveedor_id", etiqueta: "Proveedor", tipo: "seleccion", opciones: proveedores, opcionesDinamicas: true, ayuda: "Opcional." },
    campoFecha(hoy),
    { nombre: "vencimiento", etiqueta: "Vencimiento", tipo: "fecha", ayuda: "Opcional: fecha límite de pago." },
    { nombre: "notas", etiqueta: "Notas", tipo: "texto_largo", max: 1000 },
    {
      nombre: "pago_monto",
      etiqueta: "Importe pagado ahora",
      tipo: "monto",
      seccion: "Pago inmediato (opcional)",
      ayuda: "Déjelo vacío si el gasto queda pendiente. Puede ser un abono parcial.",
    },
    campoCuenta("pago_cuenta_dinero_id", "Caja o banco que paga", cuentas, false),
    { ...CAMPO_METODO, nombre: "pago_metodo", requerido: false },
    { ...CAMPO_REFERENCIA, nombre: "pago_referencia" },
  ];
}

export function camposPagoGasto(cuentas: readonly Opcion[], hoy: string): Campo[] {
  return [
    { nombre: "monto", etiqueta: "Importe pagado", tipo: "monto", requerido: true },
    campoCuenta("cuenta_dinero_id", "Caja o banco que paga", cuentas),
    campoFecha(hoy),
    CAMPO_METODO,
    CAMPO_REFERENCIA,
  ];
}

export function camposTransferencia(cuentas: readonly Opcion[], hoy: string): Campo[] {
  return [
    campoCuenta("cuenta_origen_id", "Desde (origen)", cuentas),
    campoCuenta("cuenta_destino_id", "Hacia (destino)", cuentas),
    { nombre: "monto", etiqueta: "Importe", tipo: "monto", requerido: true },
    campoFecha(hoy),
    { ...CAMPO_REFERENCIA, max: 120, ayuda: "Opcional." },
  ];
}

export function camposApertura(hoy: string): Campo[] {
  return [
    { nombre: "monto", etiqueta: "Saldo inicial", tipo: "monto", requerido: true },
    campoFecha(hoy, "Fecha de apertura"),
  ];
}

export function camposCorreccion(confirmacion: string): Campo[] {
  return [
    { nombre: "motivo", etiqueta: "Motivo", tipo: "texto_largo", requerido: true, max: 300 },
    { nombre: "confirmar", etiqueta: confirmacion, tipo: "booleano", ayuda: "Queda registrado con su usuario y no se puede deshacer." },
  ];
}
