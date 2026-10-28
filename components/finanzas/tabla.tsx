import Link from "next/link";
import type { ReactNode } from "react";
import { EstadoVacio } from "@/components/encabezado";

export type Columna<T> = {
  clave: string;
  etiqueta: string;
  celda: (fila: T) => ReactNode;
  /** Importes: alineados a la derecha con cifras tabulares. */
  numerica?: boolean;
};

/** Móvil: tarjetas; escritorio: tabla. La primera columna enlaza al detalle. */
export function Tabla<T extends { id: string }>({
  filas,
  columnas,
  enlace,
  vacio,
  totales,
}: {
  filas: readonly T[];
  columnas: readonly Columna<T>[];
  enlace?: (fila: T) => string | null;
  vacio: string;
  /** Fila de totales, por clave de columna. */
  totales?: Partial<Record<string, ReactNode>>;
}) {
  if (filas.length === 0) {
    return <EstadoVacio mensaje={vacio} />;
  }
  const [principal, ...resto] = columnas;

  return (
    <>
      <ul className="flex flex-col gap-2 sm:hidden">
        {filas.map((fila) => {
          const href = enlace?.(fila);
          const contenido = (
            <>
              <span className="font-medium break-words">{principal.celda(fila)}</span>
              {resto.map((columna) => (
                <span key={columna.clave} className="flex justify-between gap-3 text-sm">
                  <span className="texto-tenue">{columna.etiqueta}</span>
                  <span className={columna.numerica ? "tabular-nums" : "text-right"}>{columna.celda(fila)}</span>
                </span>
              ))}
            </>
          );
          return (
            <li key={fila.id}>
              {href ? (
                <Link href={href} className="tarjeta tarjeta-enlace flex flex-col gap-1.5 p-4">
                  {contenido}
                </Link>
              ) : (
                <div className="tarjeta flex flex-col gap-1.5 p-4">{contenido}</div>
              )}
            </li>
          );
        })}
        {totales && (
          <li className="tarjeta flex flex-col gap-1 p-4 font-semibold">
            <span>Totales</span>
            {columnas
              .filter((columna) => totales[columna.clave] !== undefined)
              .map((columna) => (
                <span key={columna.clave} className="flex justify-between gap-3 text-sm">
                  <span>{columna.etiqueta}</span>
                  <span className="tabular-nums">{totales[columna.clave]}</span>
                </span>
              ))}
          </li>
        )}
      </ul>

      <div className="tarjeta hidden overflow-x-auto sm:block">
        <table className="tabla">
          <thead>
            <tr>
              {columnas.map((columna) => (
                <th key={columna.clave} scope="col" className={columna.numerica ? "text-right" : undefined}>
                  {columna.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const href = enlace?.(fila);
              return (
                <tr key={fila.id}>
                  {columnas.map((columna, indice) => (
                    <td key={columna.clave} className={columna.numerica ? "text-right tabular-nums whitespace-nowrap" : undefined}>
                      {indice === 0 && href ? (
                        <Link href={href} className="font-medium text-enlace hover:underline">
                          {columna.celda(fila)}
                        </Link>
                      ) : (
                        columna.celda(fila)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {totales && (
            <tfoot>
              <tr className="font-semibold">
                {columnas.map((columna, indice) => (
                  <td key={columna.clave} className={columna.numerica ? "text-right tabular-nums whitespace-nowrap" : undefined}>
                    {indice === 0 ? "Totales" : totales[columna.clave]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
