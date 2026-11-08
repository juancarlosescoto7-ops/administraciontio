import type { Campo, Opcion } from "@/lib/catalogos/definiciones";
import type { Datos } from "@/lib/catalogos/validacion";
import { camposPagoGasto, ETIQUETAS_ACTIVIDAD } from "@/lib/finanzas/definiciones";
import { aCentavos } from "@/lib/finanzas/montos";
import type { Database } from "@/lib/supabase/tipos-bd";

type Enums = Database["public"]["Enums"];
export type ClaseBien = Enums["clase_bien"];

export const ETIQUETAS_CLASE: Record<ClaseBien, string> = {
  terreno: "Terreno",
  edificio: "Edificio",
  vehiculo: "Vehículo",
  mobiliario: "Mobiliario y enseres",
  equipo: "Maquinaria y equipo",
  otro: "Otro bien",
};

/** Cómo entra el bien; contado y crédito son compras (origen 'compra'). */
export const FORMAS_INGRESO = {
  existente: "Ya era de la empresa",
  contado: "Compra de contado",
  credito: "Compra a crédito",
} as const;

export type FormaIngreso = keyof typeof FORMAS_INGRESO;

export const OPCIONES_CLASE: readonly Opcion[] = Object.entries(ETIQUETAS_CLASE).map(([valor, etiqueta]) => ({ valor, etiqueta }));

const OPCIONES_FORMA: readonly Opcion[] = Object.entries(FORMAS_INGRESO).map(([valor, etiqueta]) => ({ valor, etiqueta }));

const OPCIONES_ACTIVIDAD: readonly Opcion[] = Object.entries(ETIQUETAS_ACTIVIDAD).map(([valor, etiqueta]) => ({
  valor,
  etiqueta: valor === "general" ? "General (no se reparte entre actividades)" : etiqueta,
}));

// Campos de pago del formulario de gastos, con prefijo y sin fecha (el pago
// inicial lleva la fecha de la compra).
function camposPagoInicial(cuentas: readonly Opcion[]): Campo[] {
  return camposPagoGasto(cuentas, "")
    .filter((c) => c.nombre !== "fecha")
    .map((c, indice) => ({
      ...c,
      nombre: `pago_${c.nombre}`,
      requerido: false,
      ...(c.nombre === "monto"
        ? { etiqueta: "Importe pagado ahora", ayuda: "Contado: déjelo vacío y se paga el costo completo. Crédito: abono inicial opcional." }
        : {}),
      ...(indice === 0 ? { seccion: "Pago (contado o abono inicial)" } : {}),
    }));
}

export function camposBien(
  hoy: string,
  proveedores: readonly Opcion[],
  vehiculos: readonly Opcion[],
  cuentas: readonly Opcion[],
): Campo[] {
  return [
    { nombre: "nombre", etiqueta: "Nombre del bien", tipo: "texto", requerido: true, max: 120, ayuda: "Por ejemplo: «Terreno de la bodega» o «Escritorios de oficina»." },
    { nombre: "clase", etiqueta: "Clase", tipo: "seleccion", requerido: true, opciones: OPCIONES_CLASE },
    { nombre: "descripcion", etiqueta: "Descripción", tipo: "texto_largo", max: 1000, ayuda: "Opcional: ubicación, serie, escritura o cualquier dato que lo identifique." },
    { nombre: "actividad", etiqueta: "Actividad", tipo: "seleccion", requerido: true, opciones: OPCIONES_ACTIVIDAD, predeterminado: "general", ayuda: "Actividad a la que se carga la depreciación mensual." },
    { nombre: "vehiculo_id", etiqueta: "Vehículo del catálogo", tipo: "seleccion", opciones: vehiculos, opcionesDinamicas: true, ayuda: "Solo para la clase Vehículo (opcional)." },
    { nombre: "forma", etiqueta: "¿Cómo entra el bien?", tipo: "seleccion", requerido: true, opciones: OPCIONES_FORMA, seccion: "Adquisición" },
    { nombre: "costo", etiqueta: "Costo de adquisición", tipo: "monto", requerido: true },
    { nombre: "fecha_adquisicion", etiqueta: "Fecha de adquisición", tipo: "fecha", requerido: true, noFutura: true, predeterminado: hoy, ayuda: "En una compra, también es la fecha del asiento y del pago." },
    { nombre: "proveedor_id", etiqueta: "Proveedor", tipo: "seleccion", opciones: proveedores, opcionesDinamicas: true, ayuda: "Solo compras (opcional)." },
    { nombre: "vencimiento", etiqueta: "Vencimiento del saldo", tipo: "fecha", ayuda: "Solo compras a crédito (opcional)." },
    {
      nombre: "vida_util_meses",
      etiqueta: "Vida útil (meses)",
      tipo: "entero",
      min: 1,
      max: 1200,
      seccion: "Depreciación lineal mensual",
      ayuda: "Por ejemplo: 60 para un vehículo de 5 años. Déjela vacía en terrenos: no se deprecian.",
    },
    { nombre: "valor_residual", etiqueta: "Valor residual", tipo: "monto", ayuda: "Lo que valdrá al final de su vida útil (opcional; vacío es cero)." },
    {
      nombre: "fecha_registro",
      etiqueta: "Fecha de incorporación a los libros",
      tipo: "fecha",
      noFutura: true,
      seccion: "Solo para un bien que ya era de la empresa",
      ayuda: "Vacía: hoy. La depreciación empieza el mes siguiente a esta fecha.",
    },
    { nombre: "depreciacion_previa", etiqueta: "Depreciación acumulada hasta esa fecha", tipo: "monto", ayuda: "Lo que ya se depreció antes de registrarlo (opcional; vacío es cero)." },
    ...camposPagoInicial(cuentas),
  ];
}

export function camposEditarBien(): Campo[] {
  return [
    { nombre: "nombre", etiqueta: "Nombre del bien", tipo: "texto", requerido: true, max: 120 },
    { nombre: "descripcion", etiqueta: "Descripción", tipo: "texto_largo", max: 1000 },
  ];
}

export function camposBaja(hoy: string): Campo[] {
  return [
    { nombre: "fecha", etiqueta: "Fecha de baja", tipo: "fecha", requerido: true, noFutura: true, predeterminado: hoy },
    { nombre: "motivo", etiqueta: "Motivo", tipo: "texto_largo", requerido: true, max: 300, ayuda: "Venta, desecho, robo, pérdida total…" },
    { nombre: "confirmar", etiqueta: "Confirmo la baja de este bien", tipo: "booleano", ayuda: "Queda registrado con su usuario y no se puede deshacer." },
  ];
}

export type PagoInicial = { cuenta_dinero_id: string; metodo: string; referencia: string | null; monto: string };

export type Adquisicion =
  | { ok: false; errores: Record<string, string> }
  | {
      ok: true;
      origen: Enums["origen_bien"];
      proveedorId: string | null;
      vencimiento: string | null;
      fechaRegistro: string | null;
      depreciacionPrevia: string | null;
      pago: PagoInicial | null;
    };

const texto = (valor: Datos[string] | undefined) => (typeof valor === "string" && valor !== "" ? valor : null);

/**
 * Traduce la forma de ingreso del formulario a los parámetros de
 * public.registrar_bien. La base vuelve a validar todo; aquí se rechazan antes
 * las combinaciones que no corresponden a la forma elegida.
 */
export function prepararAdquisicion(datos: Datos): Adquisicion {
  const forma = datos.forma as FormaIngreso;
  const errores: Record<string, string> = {};
  const pagoMonto = texto(datos.pago_monto);
  const pagoCuenta = texto(datos.pago_cuenta_dinero_id);
  const costo = aCentavos(texto(datos.costo)) ?? 0;

  if (forma === "existente") {
    if (texto(datos.proveedor_id)) errores.proveedor_id = "Un bien que ya era de la empresa no lleva proveedor.";
    if (texto(datos.vencimiento)) errores.vencimiento = "Solo una compra a crédito tiene vencimiento.";
    if (pagoMonto || pagoCuenta) errores.pago_monto = "Un bien que ya era de la empresa no lleva pago.";
    if (Object.keys(errores).length > 0) return { ok: false, errores };
    return {
      ok: true,
      origen: "existente",
      proveedorId: null,
      vencimiento: null,
      fechaRegistro: texto(datos.fecha_registro),
      depreciacionPrevia: texto(datos.depreciacion_previa),
      pago: null,
    };
  }

  if (texto(datos.fecha_registro)) errores.fecha_registro = "Solo para un bien que ya era de la empresa; en una compra se usa la fecha de adquisición.";
  if (texto(datos.depreciacion_previa)) errores.depreciacion_previa = "Una compra no tiene depreciación previa.";
  if (forma === "contado" && texto(datos.vencimiento)) errores.vencimiento = "Una compra de contado no tiene saldo por vencer.";

  // Contado: el costo completo. Crédito: abono inicial opcional.
  const monto = forma === "contado" ? (pagoMonto ?? texto(datos.costo)) : pagoMonto;
  const centavos = aCentavos(monto) ?? 0;
  if (forma === "contado" && centavos !== costo) {
    errores.pago_monto = "En una compra de contado se paga el costo completo; para un abono elija compra a crédito.";
  }
  if (centavos > costo) errores.pago_monto = "El pago no puede superar el costo.";
  if (centavos > 0 && !pagoCuenta) errores.pago_cuenta_dinero_id = "Indique de qué caja o banco sale el pago.";
  if (Object.keys(errores).length > 0) return { ok: false, errores };

  return {
    ok: true,
    origen: "compra",
    proveedorId: texto(datos.proveedor_id),
    vencimiento: forma === "credito" ? texto(datos.vencimiento) : null,
    fechaRegistro: null,
    depreciacionPrevia: null,
    pago:
      centavos > 0
        ? { cuenta_dinero_id: pagoCuenta!, metodo: texto(datos.pago_metodo) ?? "efectivo", referencia: texto(datos.pago_referencia), monto: monto! }
        : null,
  };
}
