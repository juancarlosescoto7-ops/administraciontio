// Línea de tiempo del time lapse, derivada de lapso-datos.json (código, historial y
// esquema reales). Todo el estado visible se calcula a partir del reloj.
import datos from "./lapso-datos.json";

export type Archivo = { ruta: string; total: number; cabeza: string[]; cola: string[] };
export type Vista = "vacio" | "clientes" | "cobros" | "membresias" | "ambulancias" | "alquileres" | "inicio" | "cobro";
export type LineaTerminal = { en: number; texto: string; tipo: "orden" | "ok" | "info" };
/** Relación entre dos tablas; aparece en `en`. */
export type Conexion = { desde: string; columna: string; hacia: string; en: number };
/** Trabajo en la base durante una migración: tablas nuevas (cada una en `en`), existentes a las que apuntan, relaciones y registro. */
export type Flash = {
  desde: number;
  hasta: number;
  migracion: string;
  nuevas: { tabla: string; en: number }[];
  existentes: string[];
  conexiones: Conexion[];
  registro: { en: number; texto: string }[];
};
/** Aspecto del diseño que se prueba al construir cada pantalla. */
export type Aspecto = "tipografia" | "color" | "esquinas" | "densidad" | "sombras";

const ESCRIBIR_SQL = 850;
const ESCRIBIR_SQL_SEGUNDA = 550;
const ESCRIBIR_CODIGO = 1900;
const COMMIT = 400;
const SIN_TABLAS = 450;
const ABRIR = 250;
const POR_TABLA = 150;
/** Columnas que se añaden una a una al crear cada tabla. */
export const POR_COLUMNA = 28;
export const COLUMNAS_VISIBLES = 6;
const POR_RELACION = 70;
const CERRAR = 450;
/** Escena final en la que se prueba el sistema terminado (prueba.tsx). */
export const DURACION_PRUEBA = 11000;
/** Fracción de la escritura dedicada a la cabeza del archivo; el resto, al salto hasta el final. */
export const CABEZA = 0.82;

/** Qué se prueba en cada pantalla nueva; la última prueba es siempre el valor real de globals.css. */
const PRUEBAS: Record<string, Aspecto> = {
  e1: "tipografia",
  e2: "color",
  e3: "esquinas",
  e4: "densidad",
  e5: "sombras",
  rediseno: "color",
  contrato: "tipografia",
  cobros: "esquinas",
};

type Escritura = { desde: number; hasta: number; etapa: number; archivo: Archivo };

const escrituras: Escritura[] = [];
/** Escritura del archivo de cada etapa: mientras se teclea, su pantalla se construye en el sistema. */
const construcciones: { desde: number; hasta: number }[] = [];
const flashes: Flash[] = [];
const terminal: LineaTerminal[] = [
  { en: 0, texto: "npm run dev", tipo: "orden" },
  { en: 250, texto: "✓ Ready · http://localhost:3000", tipo: "ok" },
];
const inicioEtapa: number[] = [];
const creadas = new Set<string>();
const columnasDe = (tabla: string) => datos.esquema.tablas[tabla as keyof typeof datos.esquema.tablas].length;

let t = 400;
datos.etapas.forEach((etapa, indice) => {
  inicioEtapa.push(t);
  etapa.migraciones.forEach((migracion, i) => {
    const escribir = i === 0 ? ESCRIBIR_SQL : ESCRIBIR_SQL_SEGUNDA;
    escrituras.push({ desde: t, hasta: t + escribir, etapa: indice, archivo: migracion });
    t += escribir;
    terminal.push({ en: t, texto: `apply_migration ${migracion.nombre}`, tipo: "orden" });
    const resumen = [
      migracion.tablas.length && `${migracion.tablas.length} ${migracion.tablas.length === 1 ? "tabla" : "tablas"}`,
      migracion.politicas && `${migracion.politicas} ${migracion.politicas === 1 ? "política RLS" : "políticas RLS"}`,
      migracion.funciones && `${migracion.funciones} ${migracion.funciones === 1 ? "función" : "funciones"}`,
    ].filter(Boolean);
    if (!migracion.tablas.length) {
      terminal.push({ en: t + 260, texto: `✓ Migración aplicada · ${resumen.join(" · ")}`, tipo: "ok" });
      t += SIN_TABLAS;
      return;
    }
    const desde = t;
    // Cada tabla nace vacía y recibe sus columnas una a una, como al ejecutar su CREATE TABLE.
    const nuevas = migracion.tablas.map((tabla, k) => ({ tabla, en: t + ABRIR + k * POR_TABLA }));
    nuevas.forEach(({ tabla }) => creadas.add(tabla));
    const registro = nuevas.map(({ tabla, en }) => ({ en, texto: `create table public.${tabla} (${columnasDe(tabla)} columnas)` }));
    const ultimaLista = Math.max(...nuevas.map(({ en }) => en + (COLUMNAS_VISIBLES + 2) * POR_COLUMNA));
    registro.push({ en: ultimaLista, texto: `alter table … enable row level security (${nuevas.length} ${nuevas.length === 1 ? "tabla" : "tablas"})` });
    // Cada relación se conecta cuando existen sus dos tablas, es decir, en la migración que crea la última.
    const relaciones = datos.esquema.relaciones.filter(
      ([a, , b]) => creadas.has(a) && creadas.has(b) && (migracion.tablas.includes(a) || migracion.tablas.includes(b)),
    );
    const primera = ultimaLista + 120;
    const conexiones = relaciones.map(([a, columna, b], k) => ({ desde: a, columna, hacia: b, en: primera + k * POR_RELACION }));
    conexiones.forEach((c) => registro.push({ en: c.en, texto: `add foreign key ${c.desde}.${c.columna} → ${c.hacia}` }));
    const nombres = new Set(migracion.tablas);
    const existentes = [...new Set(relaciones.flatMap(([a, , b]) => [a, b]))].filter((tabla) => !nombres.has(tabla));
    const hasta = primera + relaciones.length * POR_RELACION + CERRAR;
    flashes.push({ desde, hasta, migracion: migracion.nombre, nuevas, existentes, conexiones, registro });
    terminal.push({ en: hasta - 300, texto: `✓ Migración aplicada · ${resumen.join(" · ")}`, tipo: "ok" });
    t = hasta;
  });
  escrituras.push({ desde: t, hasta: t + ESCRIBIR_CODIGO, etapa: indice, archivo: etapa.archivo });
  construcciones.push({ desde: t, hasta: t + ESCRIBIR_CODIGO });
  t += ESCRIBIR_CODIGO;
  terminal.push({ en: t, texto: "npm run typecheck && npm run lint", tipo: "orden" });
  terminal.push({ en: t + 180, texto: "✓ Sin errores", tipo: "ok" });
  if (etapa.commit) {
    terminal.push({ en: t + 260, texto: `git commit -m "${etapa.commit.mensaje}"`, tipo: "orden" });
    terminal.push({ en: t + 400, texto: `[main ${etapa.commit.hash}] ${etapa.commit.mensaje}`, tipo: "info" });
    terminal.push({ en: t + 440, texto: ` ${etapa.commit.resumen}`, tipo: "info" });
  }
  t += COMMIT;
});
terminal.push({ en: t, texto: "npm run build", tipo: "orden" });
terminal.push({ en: t + 300, texto: "✓ Compiled successfully", tipo: "ok" });

/** Momento en que el proyecto pasa a ocupar toda la pantalla. */
export const FINAL = t + 500;
export const DURACION = FINAL + DURACION_PRUEBA;
export const ETAPAS = datos.etapas;
export const ESQUEMA = datos.esquema;
export const TERMINAL = terminal;
export const FLASHES = flashes;

export function progreso(tiempo: number, inicio: number, duracion: number) {
  return Math.max(0, Math.min(1, (tiempo - inicio) / duracion));
}

/**
 * Construcción de la pantalla mientras se teclea su archivo (p de 0 a 1):
 * aparecen los bloques, se escriben los títulos y se prueba un aspecto del
 * diseño (dos intentos y el valor real) antes de dejarlo fijo.
 */
function obra(p: number, aspecto: Aspecto | null) {
  return {
    progreso: Math.min(1, p / 0.5),
    escrito: progreso(p, 0.12, 0.38),
    prueba: aspecto ? { aspecto, paso: p < 0.55 ? 0 : p < 0.72 ? 1 : p < 0.92 ? 2 : 3 } : null,
  };
}

export function estadoVisual(tiempo: number) {
  const abiertas = escrituras.filter((e) => tiempo >= e.desde);
  const actual = abiertas.at(-1) ?? escrituras[0];
  const etapa = Math.max(0, inicioEtapa.findLastIndex((inicio) => tiempo >= inicio));
  // El sistema cambia de pantalla al empezar a teclear el archivo de la etapa y se arma mientras se escribe.
  const construida = construcciones.findLastIndex((c) => tiempo >= c.desde);
  const enObra = construida >= 0 ? construcciones[construida] : null;
  const etapaSistema = Math.max(0, construida);
  /** Si la pantalla es la misma de la etapa anterior, solo se añade lo nuevo (enlaces del menú). */
  const reconstruir = construida <= 0 || ETAPAS[construida].vista !== ETAPAS[construida - 1].vista;
  const p = enObra ? progreso(tiempo, enObra.desde, enObra.hasta - enObra.desde) : 0;
  return {
    etapa,
    sistema: {
      etapa: etapaSistema,
      vista: ETAPAS[etapaSistema].vista as Vista,
      reconstruir,
      ...obra(p, reconstruir ? (PRUEBAS[ETAPAS[etapaSistema].id] ?? null) : null),
    },
    archivo: actual.archivo,
    escritura: progreso(tiempo, actual.desde, actual.hasta - actual.desde),
    /** Pestañas abiertas: las últimas cuatro rutas tecleadas. */
    pestanas: [...new Set(abiertas.map((e) => e.archivo.ruta).reverse())].slice(0, 4).reverse(),
    flash: flashes.find((f) => tiempo >= f.desde && tiempo < f.hasta) ?? null,
    /** El panel de base de datos muestra la migración en curso o, entre migraciones, la última aplicada. */
    bd: flashes.findLast((f) => tiempo >= f.desde) ?? null,
    final: tiempo >= FINAL,
  };
}
