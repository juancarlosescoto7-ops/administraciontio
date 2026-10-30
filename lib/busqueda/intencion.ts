import { normalizar, type AccesoRapido } from "@/lib/accesos";
import { puede, type Permiso, type Rol } from "@/lib/auth/roles";
import type { NombreIcono } from "@/components/iconos";
import type { GrupoNavegacion } from "@/components/navegacion";

/** Opción del buscador universal; `seccion` ordena y titula la lista. */
export type OpcionBusqueda = {
  clave: string;
  href: string;
  etiqueta: string;
  contexto: string;
  icono: NombreIcono;
  seccion: "Asistente" | "Registros" | "Acciones" | "Páginas";
};

/** Páginas y acciones que el rol ya tiene en el menú, como opciones. */
export function opcionesFijas(grupos: readonly GrupoNavegacion[], acciones: readonly AccesoRapido[]): OpcionBusqueda[] {
  return [
    ...acciones.map((a) => ({ clave: `accion-${a.href}`, href: a.href, etiqueta: a.etiqueta, contexto: "Acción", icono: a.icono, seccion: "Acciones" as const })),
    ...grupos.flatMap((g) =>
      g.enlaces.map((e) => ({
        clave: `pagina-${e.href}`,
        href: e.href,
        etiqueta: e.etiqueta,
        contexto: g.titulo ?? "General",
        icono: g.icono,
        seccion: "Páginas" as const,
      })),
    ),
  ];
}

export type Intencion = {
  clave: string;
  /** Palabras ya normalizadas (minúsculas y sin tildes). */
  palabras: readonly string[];
  etiqueta: string;
  /** Palabra que el buscador sugiere para empezar («cobro …»). */
  ejemplo: string;
  /** null: cualquier rol con sesión. */
  permiso: Permiso | null;
  icono: NombreIcono;
  /** Página general de la acción, sin cliente elegido. */
  general: string;
  paraCliente: (clienteId: string) => string;
};

/**
 * Lo que el asistente reconoce. Solo palabras inequívocas: «conductor» o
 * «plan» se dejan para buscar en sus catálogos.
 */
export const INTENCIONES: readonly Intencion[] = [
  {
    clave: "cobro",
    ejemplo: "cobro",
    palabras: ["cobro", "cobros", "cobrar", "pago", "pagos", "pagar", "abono", "abonar"],
    etiqueta: "Registrar cobro",
    permiso: "registrarCobro",
    icono: "dinero",
    general: "/finanzas/cobros/nuevo",
    paraCliente: (id) => `/finanzas/cobros/nuevo?cliente=${id}`,
  },
  {
    clave: "cuenta",
    ejemplo: "saldo",
    palabras: ["saldo", "saldos", "debe", "deuda", "deudas", "pendiente", "pendientes"],
    etiqueta: "Ver estado de cuenta",
    permiso: null,
    icono: "finanzas",
    general: "/finanzas/pendientes",
    paraCliente: (id) => `/finanzas/pendientes/${id}`,
  },
  {
    clave: "membresia",
    ejemplo: "membresía",
    palabras: ["membresia", "membresias", "afiliar", "afiliacion"],
    etiqueta: "Nueva membresía",
    permiso: "registrarMembresia",
    icono: "membresia",
    general: "/membresias/nueva",
    paraCliente: (id) => `/membresias/nueva?cliente=${id}`,
  },
  {
    clave: "traslado",
    ejemplo: "traslado",
    palabras: ["traslado", "traslados", "ambulancia", "ambulancias"],
    etiqueta: "Nueva solicitud de traslado",
    permiso: "gestionarTraslados",
    icono: "servicios",
    general: "/ambulancias/nuevo",
    paraCliente: (id) => `/ambulancias/nuevo?cliente=${id}`,
  },
  {
    clave: "alquiler",
    ejemplo: "alquiler",
    palabras: ["alquiler", "alquileres", "alquilar", "renta", "rentar", "reserva", "reservar"],
    etiqueta: "Nueva reserva de alquiler",
    permiso: "gestionarAlquileres",
    icono: "llave",
    general: "/alquileres/nuevo",
    paraCliente: (id) => `/alquileres/nuevo?cliente=${id}`,
  },
  {
    clave: "transporte",
    ejemplo: "transporte",
    palabras: ["transporte", "transportes", "chofer"],
    etiqueta: "Nueva solicitud de transporte",
    permiso: "gestionarTransportes",
    icono: "flota",
    general: "/transportes/nuevo",
    paraCliente: (id) => `/transportes/nuevo?cliente=${id}`,
  },
];

export function permitida(intencion: Intencion, rol: Rol): boolean {
  return intencion.permiso === null || puede(intencion.permiso, rol);
}

/** Palabras que el buscador sugiere para empezar, según el rol. */
export function ejemplosPara(rol: Rol): string[] {
  return INTENCIONES.filter((intencion) => permitida(intencion, rol)).map((intencion) => intencion.ejemplo);
}

/** Palabras de enlace que se quitan al principio de lo que queda («de», «para»…). */
const DE_ENLACE = new Set([
  "de", "del", "a", "al", "para", "el", "la", "los", "las", "un", "una", "con", "por",
  "nuevo", "nueva", "registrar", "crear", "hacer", "ver", "quiero", "necesito",
]);

/**
 * Separa la acción pedida del nombre buscado: «cobro de Juan Pérez» →
 * cobro + «Juan Pérez». Sin acción reconocida, el texto queda intacto (así
 * «Juan de la Cruz» se busca completo).
 */
export function interpretar(consulta: string): { intencion: Intencion | null; texto: string } {
  const palabras = consulta.trim().split(/\s+/).filter(Boolean);
  for (const intencion of INTENCIONES) {
    const posicion = palabras.findIndex((palabra) => intencion.palabras.includes(normalizar(palabra)));
    if (posicion === -1) continue;
    const resto = palabras.filter((_, indice) => indice !== posicion);
    while (resto.length > 0 && DE_ENLACE.has(normalizar(resto[0]))) resto.shift();
    return { intencion, texto: resto.join(" ") };
  }
  return { intencion: null, texto: palabras.join(" ") };
}
