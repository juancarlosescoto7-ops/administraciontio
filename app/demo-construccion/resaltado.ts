// Resaltado mínimo para el editor del lapso: SQL, TypeScript/TSX y CSS, línea a
// línea, con estado para comentarios de bloque que cruzan líneas.
export type Lenguaje = "sql" | "ts" | "css";
export type Clase = "comentario" | "cadena" | "clave" | "tipo" | "numero" | "etiqueta" | "texto";
export type Token = { texto: string; clase: Clase };

export function lenguajeDe(ruta: string): Lenguaje {
  return ruta.endsWith(".sql") ? "sql" : ruta.endsWith(".css") ? "css" : "ts";
}

const CLAVES_SQL = new Set(
  "create table if not exists references primary key foreign on delete cascade restrict alter add enable row level security policy for select insert update using with check function returns language as begin end declare return grant to default null not unique constraint index trigger execute procedure or replace and in is then else elsif raise exception when type enum view from where join left inner group by order case set values into security definer invoker stable immutable volatile revoke all schema comment generated always identity distinct limit exists coalesce perform loop new old after before each statement"
    .split(" "),
);
const TIPOS_SQL = new Set("uuid text numeric integer int boolean bool timestamptz timestamp date jsonb json bigint smallint tstzrange daterange void record trigger setof interval char varchar".split(" "));
const CLAVES_TS = new Set(
  "import from export default function async await return const let var if else for of in while switch case break continue type interface new try catch finally throw as typeof keyof extends implements satisfies void null undefined true false this class readonly".split(" "),
);

const PATRONES: Record<Lenguaje, RegExp> = {
  sql: /(--.*$)|('(?:[^']|'')*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w$]*)|([\s\S])/g,
  ts: /(\/\/.*$)|(\/\*)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(<\/?[A-Za-z][\w.:-]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([\s\S])/g,
  css: /(\/\*)|("(?:[^"\\]|\\.)*"?)|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:rem|px|ms|%|deg|s)?\b)|(@[\w-]+|[.:][\w-]+|--[\w-]+)|([A-Za-z_][\w-]*)|([\s\S])/g,
};

function palabra(texto: string, lenguaje: Lenguaje): Clase {
  if (lenguaje === "sql") {
    const minusculas = texto.toLowerCase();
    return TIPOS_SQL.has(minusculas) ? "tipo" : CLAVES_SQL.has(minusculas) ? "clave" : "texto";
  }
  if (lenguaje === "ts") return CLAVES_TS.has(texto) ? "clave" : /^[A-Z]/.test(texto) ? "tipo" : "texto";
  return "texto";
}

/** Tokeniza líneas consecutivas; `enBloque` indica si la anterior dejó abierto un comentario de bloque. */
export function resaltar(lineas: readonly string[], lenguaje: Lenguaje): Token[][] {
  let enBloque = false;
  return lineas.map((linea) => {
    const tokens: Token[] = [];
    let resto = linea;
    if (enBloque) {
      const fin = resto.indexOf("*/");
      if (fin < 0) return [{ texto: linea, clase: "comentario" }];
      tokens.push({ texto: resto.slice(0, fin + 2), clase: "comentario" });
      resto = resto.slice(fin + 2);
      enBloque = false;
    }
    const patron = new RegExp(PATRONES[lenguaje].source, "g");
    let m: RegExpExecArray | null;
    while ((m = patron.exec(resto))) {
      const [texto] = m;
      if (texto.startsWith("/*")) {
        const fin = resto.indexOf("*/", m.index + 2);
        const comentario = fin < 0 ? resto.slice(m.index) : resto.slice(m.index, fin + 2);
        tokens.push({ texto: comentario, clase: "comentario" });
        enBloque = fin < 0;
        if (fin < 0) break;
        patron.lastIndex = fin + 2;
        continue;
      }
      const clase: Clase =
        lenguaje === "sql"
          ? m[1] ? "comentario" : m[2] ? "cadena" : m[3] ? "numero" : m[4] ? palabra(texto, lenguaje) : "texto"
          : lenguaje === "ts"
            ? m[1] ? "comentario" : m[3] ? "cadena" : m[4] ? "etiqueta" : m[5] ? "numero" : m[6] ? palabra(texto, lenguaje) : "texto"
            : m[2] ? "cadena" : m[3] ? "numero" : m[4] ? "clave" : m[5] ? "etiqueta" : "texto";
      const anterior = tokens.at(-1);
      if (anterior && anterior.clase === clase && clase === "texto") anterior.texto += texto;
      else tokens.push({ texto, clase });
    }
    return tokens;
  });
}
