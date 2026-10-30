"use client";

import { useMemo } from "react";
import { CABEZA, TERMINAL, type Archivo } from "./guion";
import { lenguajeDe, resaltar, type Token } from "./resaltado";

const NOMBRE_LENGUAJE = { sql: "SQL", ts: "TypeScript JSX", css: "CSS" };

/** Ráfagas de escritura: avanza a ritmo irregular, siempre hacia adelante. */
function rafagas(p: number) {
  return Math.min(1, Math.max(0, p + Math.sin(p * Math.PI * 6) * 0.025));
}

function cortar(tokens: Token[], caracteres: number): Token[] {
  const salida: Token[] = [];
  let resto = caracteres;
  for (const token of tokens) {
    if (resto <= 0) break;
    salida.push(token.texto.length <= resto ? token : { ...token, texto: token.texto.slice(0, resto) });
    resto -= token.texto.length;
  }
  return salida;
}

/**
 * Archivo real tecleado: primero su cabeza, carácter a carácter; al final, un
 * salto hasta sus últimas líneas con la numeración real, como al desplazarse.
 */
export function Editor({ archivo, escritura, pestanas, ventana }: { archivo: Archivo; escritura: number; pestanas: string[]; ventana: number }) {
  const lenguaje = lenguajeDe(archivo.ruta);
  const cabeza = useMemo(() => resaltar(archivo.cabeza, lenguaje), [archivo, lenguaje]);
  const cola = useMemo(() => resaltar(archivo.cola, lenguaje), [archivo, lenguaje]);
  const enCola = escritura >= CABEZA && archivo.cola.length > 0;

  let lineas: { numero: number; tokens: Token[] }[];
  let cursor: { linea: number; columna: number };
  if (enCola) {
    const primera = archivo.total - archivo.cola.length + 1;
    lineas = cola.map((tokens, i) => ({ numero: primera + i, tokens }));
    cursor = { linea: archivo.total, columna: (archivo.cola.at(-1)?.length ?? 0) + 1 };
  } else {
    const total = archivo.cabeza.reduce((suma, linea) => suma + linea.length + 1, 0);
    let restantes = Math.floor(total * rafagas(Math.min(1, escritura / CABEZA)));
    lineas = [];
    for (let i = 0; i < archivo.cabeza.length && restantes >= 0; i++) {
      lineas.push({ numero: i + 1, tokens: cortar(cabeza[i], restantes) });
      restantes -= archivo.cabeza[i].length + 1;
    }
    const ultima = lineas.at(-1)!;
    cursor = { linea: ultima.numero, columna: ultima.tokens.reduce((suma, token) => suma + token.texto.length, 0) + 1 };
  }
  const visibles = lineas.slice(-ventana);

  return (
    <section className="ide-editor" aria-label="Editor">
      <div className="ide-pestanas">
        {pestanas.map((ruta) => (
          <span key={ruta} className="ide-pestana" data-activa={ruta === archivo.ruta} data-lenguaje={lenguajeDe(ruta)}>
            {ruta.split("/").at(-1)}
          </span>
        ))}
      </div>
      <div className="ide-ruta">{archivo.ruta.split("/").join(" › ")}</div>
      <div className="ide-codigo" data-cola={enCola} key={`${archivo.ruta}-${enCola}`}>
        {visibles.map(({ numero, tokens }, i) => (
          <div key={numero} className="ide-linea">
            <span className="ide-numero">{numero}</span>
            <code>
              {tokens.map((token, j) => (
                <span key={j} className={`t-${token.clase}`}>
                  {token.texto}
                </span>
              ))}
              {i === visibles.length - 1 && <span className="ide-cursor" aria-hidden="true" />}
            </code>
          </div>
        ))}
      </div>
      <footer className="ide-estado">
        <span>⎇ main</span>
        <span className="ide-estado-derecha">
          Ln {cursor.linea}, Col {cursor.columna}
          <span>UTF-8</span>
          <span>{NOMBRE_LENGUAJE[lenguaje]}</span>
        </span>
      </footer>
    </section>
  );
}

/** Terminal: órdenes y salidas reales (migraciones, verificación y commits) hasta el momento. */
export function Terminal({ tiempo }: { tiempo: number }) {
  const lineas = TERMINAL.filter((linea) => tiempo >= linea.en).slice(-9);
  return (
    <section className="ide-terminal" aria-label="Terminal">
      <div className="ide-terminal-titulo">TERMINAL</div>
      <div className="ide-terminal-lineas">
        {lineas.map((linea, i) => (
          <div key={`${linea.en}-${i}-${linea.texto}`} className={`ide-terminal-${linea.tipo}`}>
            {linea.tipo === "orden" && <span className="ide-prompt">empresa-tio $ </span>}
            {linea.texto}
          </div>
        ))}
      </div>
    </section>
  );
}
