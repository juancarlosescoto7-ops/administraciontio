"use client";

import { COLUMNAS_VISIBLES, ESQUEMA, POR_COLUMNA, type Conexion, type Flash } from "./guion";

const ANCHO = 204;
const CABECERA = 20;
const FILA = 14;
const MARGEN = 14;
const HUECO_X = 50;
const HUECO_Y = 26;
const AUDITORIA = /^(creado_por|actualizado_por|cancelado_por|cancelada_por|anulado_por|reversado_por|liberada_por|dado_baja_por|created_at|updated_at)$/;

type Tabla = keyof typeof ESQUEMA.tablas;
type Caja = { tabla: string; x: number; y: number; columnas: string[]; restantes: number; existente: boolean; inferior: number };

/** Columnas visibles: `id`, las FK que se conectan ahora y otras hasta completar la vista; el resto se cuenta. */
function columnasDe(tabla: string, conexiones: Conexion[]) {
  const todas = ESQUEMA.tablas[tabla as Tabla] as string[];
  const fk = [...new Set(conexiones.filter((c) => c.desde === tabla).map((c) => c.columna))];
  const resto = todas.filter((c) => c !== "id" && !fk.includes(c) && !AUDITORIA.test(c));
  const columnas = ["id", ...fk, ...resto.slice(0, Math.max(0, COLUMNAS_VISIBLES - 1 - fk.length))];
  return { columnas, restantes: todas.length - columnas.length };
}

const filas = (caja: Pick<Caja, "columnas" | "restantes">) => caja.columnas.length + (caja.restantes > 0 ? 1 : 0);

/** Retícula de tablas (nuevas primero, después las existentes a las que apuntan) con el número de columnas que mejor llena el panel. */
function disposicion(flash: Flash, aspecto: number) {
  const tablas = [...flash.nuevas.map((n) => ({ tabla: n.tabla, existente: false })), ...flash.existentes.map((tabla) => ({ tabla, existente: true }))];
  const contenido = Object.fromEntries(tablas.map(({ tabla }) => [tabla, columnasDe(tabla, flash.conexiones)]));
  let mejor: { cajas: Record<string, Caja>; ancho: number; alto: number; escala: number } | null = null;
  for (let porFila = 1; porFila <= Math.min(8, tablas.length); porFila++) {
    const cajas: Record<string, Caja> = {};
    let y = MARGEN;
    for (let inicio = 0; inicio < tablas.length; inicio += porFila) {
      const fila = tablas.slice(inicio, inicio + porFila);
      const alto = Math.max(...fila.map(({ tabla }) => CABECERA + filas(contenido[tabla]) * FILA));
      fila.forEach(({ tabla, existente }, i) => (cajas[tabla] = { tabla, existente, x: MARGEN + i * (ANCHO + HUECO_X), y, ...contenido[tabla], inferior: y + alto }));
      y += alto + HUECO_Y;
    }
    const ancho = MARGEN * 2 + porFila * ANCHO + (porFila - 1) * HUECO_X + 28;
    const alto = y - HUECO_Y + MARGEN;
    const escala = Math.min(aspecto / ancho, 1 / alto);
    if (!mejor || escala > mejor.escala) mejor = { cajas, ancho, alto, escala };
  }
  return mejor!;
}

const filaY = (caja: Caja, columna: string) => caja.y + CABECERA + Math.max(0, caja.columnas.indexOf(columna)) * FILA + FILA / 2;

/** Conector ortogonal: sale de la columna FK y entra por la fila `id`; si hay tablas en medio, las rodea por el hueco entre filas. */
function puntos(origen: Caja, destino: Caja, columna: string, indice: number) {
  const ys = filaY(origen, columna);
  const ye = filaY(destino, "id");
  const desvio = ((indice % 3) - 1) * 4;
  if (Math.abs(origen.x - destino.x) < 10) {
    const x = origen.x + ANCHO;
    const xm = x + 12 + (indice % 4) * 4;
    return [[x, ys], [xm, ys], [xm, ye], [x, ye]];
  }
  const derecha = destino.x > origen.x;
  const sentido = derecha ? 1 : -1;
  const xs = derecha ? origen.x + ANCHO : origen.x;
  const xe = derecha ? destino.x : destino.x + ANCHO;
  if (Math.abs(xe - xs) > HUECO_X + 30) {
    const hueco = origen.inferior + HUECO_Y / 2 + desvio;
    const x1 = xs + sentido * (10 + (indice % 3) * 4);
    const x2 = xe - sentido * (12 + (indice % 4) * 4);
    return [[xs, ys], [x1, ys], [x1, hueco], [x2, hueco], [x2, ye], [xe, ye]];
  }
  const xm = (xs + xe) / 2 + desvio;
  return [[xs, ys], [xm, ys], [xm, ye], [xe, ye]];
}

/** Polilínea con esquinas redondeadas, como los conectores de un diseñador de bases de datos. */
function redondeada(ruta: number[][], radio = 6) {
  let d = `M${ruta[0][0]} ${ruta[0][1]}`;
  for (let i = 1; i < ruta.length - 1; i++) {
    const [ax, ay] = ruta[i - 1];
    const [bx, by] = ruta[i];
    const [cx, cy] = ruta[i + 1];
    const r = Math.min(radio, Math.hypot(bx - ax, by - ay) / 2, Math.hypot(cx - bx, cy - by) / 2);
    d += ` L${bx - Math.sign(bx - ax) * r} ${by - Math.sign(by - ay) * r} Q${bx} ${by} ${bx + Math.sign(cx - bx) * r} ${by + Math.sign(cy - by) * r}`;
  }
  const ultimo = ruta.at(-1)!;
  return `${d} L${ultimo[0]} ${ultimo[1]}`;
}

const tipoDe = (tabla: string, columna: string) => {
  const tipo = ESQUEMA.tipos[tabla as Tabla][(ESQUEMA.tablas[tabla as Tabla] as string[]).indexOf(columna)];
  return tipo.length > 14 ? `${tipo.slice(0, 13)}…` : tipo;
};

/**
 * Panel de base de datos bajo el editor, como un diseñador de esquemas: cada
 * tabla de la migración nace vacía y recibe sus columnas reales (con su tipo);
 * después se añaden las llaves foráneas. Un registro muestra lo que se ejecuta.
 */
export function PanelBd({ flash, tiempo, aspecto }: { flash: Flash | null; tiempo: number; aspecto: number }) {
  if (!flash) {
    return (
      <div className="panel-bd" data-activo="false">
        <div className="panel-bd-titulo">BASE DE DATOS · public</div>
        <div className="panel-bd-vacio">Sin tablas</div>
        <div className="panel-bd-registro" />
      </div>
    );
  }
  const { cajas, ancho, alto } = disposicion(flash, aspecto);
  // Filas creadas de cada tabla: las existentes ya están completas.
  const creadas = (caja: Caja) => {
    const nueva = flash.nuevas.find((n) => n.tabla === caja.tabla);
    if (!nueva) return tiempo >= flash.desde ? filas(caja) : -1;
    if (tiempo < nueva.en) return -1;
    return Math.min(filas(caja), Math.floor((tiempo - nueva.en) / POR_COLUMNA));
  };
  const registro = flash.registro.filter((linea) => tiempo >= linea.en).slice(-2);

  return (
    <div className="panel-bd" data-activo={tiempo < flash.hasta} role="img" aria-label={`Base de datos: ${flash.migracion}`}>
      <div className="panel-bd-titulo">
        BASE DE DATOS · public
        <span>{flash.migracion}</span>
      </div>
      <svg viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="bd-origen" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
            <circle cx="5" cy="5" r="3.2" className="bd-marca" />
          </marker>
          <marker id="bd-destino" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M1 1 L11 6 L1 11" className="bd-marca-linea" />
          </marker>
        </defs>
        {flash.conexiones.map((conexion, i) =>
          tiempo < conexion.en ? null : (
            <path
              key={`${conexion.desde}.${conexion.columna}`}
              d={redondeada(puntos(cajas[conexion.desde], cajas[conexion.hacia], conexion.columna, i))}
              className="bd-conexion"
              data-relacion={`${conexion.desde}.${conexion.columna}`}
              markerStart="url(#bd-origen)"
              markerEnd="url(#bd-destino)"
            />
          ),
        )}
        {Object.values(cajas).map((caja) => {
          const hechas = creadas(caja);
          if (hechas < 0) return null;
          const columnas = caja.columnas.slice(0, hechas);
          const completa = hechas >= filas(caja);
          return (
            <g key={caja.tabla} className="bd-tabla" data-existente={caja.existente} data-completa={completa} data-tabla={caja.tabla} transform={`translate(${caja.x} ${caja.y})`}>
              <rect width={ANCHO} height={CABECERA + Math.max(hechas, 0.4) * FILA} rx={5} className="bd-caja" />
              <path d={`M0 5 a5 5 0 0 1 5 -5 h${ANCHO - 10} a5 5 0 0 1 5 5 v${CABECERA - 5} h-${ANCHO} z`} className="bd-cabecera" />
              <text x={8} y={14} className="bd-nombre">
                {caja.tabla}
              </text>
              {ESQUEMA.rls[caja.tabla as Tabla] && completa && (
                <text x={ANCHO - 8} y={14} textAnchor="end" className="bd-rls">
                  RLS
                </text>
              )}
              {columnas.map((columna, i) => {
                const fk = columna.endsWith("_id") || columna === "plantilla_version";
                return (
                  <g key={columna} className="bd-columna-fila">
                    <text x={8} y={CABECERA + i * FILA + 10.5} className="bd-columna">
                      <tspan className={i === 0 ? "bd-pk" : fk ? "bd-fk" : "bd-icono"}>{i === 0 ? "◆ " : fk ? "◇ " : "· "}</tspan>
                      {columna}
                    </text>
                    <text x={ANCHO - 8} y={CABECERA + i * FILA + 10.5} textAnchor="end" className="bd-tipo">
                      {tipoDe(caja.tabla, columna)}
                    </text>
                  </g>
                );
              })}
              {caja.restantes > 0 && hechas > caja.columnas.length && (
                <text x={8} y={CABECERA + caja.columnas.length * FILA + 10.5} className="bd-restantes">
                  + {caja.restantes} columnas
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="panel-bd-registro">
        {registro.map((linea, i) => (
          <div key={`${linea.en}-${linea.texto}`} data-ultima={i === registro.length - 1}>
            › {linea.texto}
          </div>
        ))}
      </div>
    </div>
  );
}
