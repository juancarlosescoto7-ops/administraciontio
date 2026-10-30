import type { ReactNode } from "react";
import { aCentavos, centavosATexto, sumarMontos } from "@/lib/finanzas/montos";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { describirPeriodo, diaAnterior, fechaCorte, type Periodo } from "@/lib/reportes/periodo";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/tipos-bd";
import { Tabla } from "@/components/finanzas/tabla";

// Estados financieros gerenciales: las cifras salen de las funciones
// public.estado_resultados, situacion_financiera, comprobaciones_financieras y
// balanza_comprobacion (todas del libro). Aquí solo se presentan; los totales
// suman las filas devueltas, que siempre son todas las cuentas del plan.

type Props = { periodo: Periodo; hoy: string };
type Tipo = Database["public"]["Enums"]["tipo_cuenta_contable"];

const AVISO_GERENCIAL = "Informe gerencial calculado del libro contable; no sustituye estados financieros certificados ni declaraciones fiscales.";

function Titulo({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-lg font-semibold tracking-tight">{children}</h2>;
}

function Nota({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-sm texto-tenue">{children}</p>;
}

function ErrorCarga() {
  return (
    <p role="alert" className="aviso aviso-error">
      No se pudo cargar el reporte.
    </p>
  );
}

const resta = (a: number | string, b: number | string) => centavosATexto((aCentavos(a) ?? 0) - (aCentavos(b) ?? 0));
const nombreCuenta = (codigo: string | null, nombre: string) => (codigo ? `${codigo} · ${nombre}` : nombre);

// ---------------------------------------------------------------------------
// Estado de resultados (rendimiento financiero)
// ---------------------------------------------------------------------------

type FilaResultados = Database["public"]["Functions"]["estado_resultados"]["Returns"][number];
const COLUMNAS_ACTIVIDAD = [
  { clave: "ambulancias", etiqueta: "Ambulancias y membresías" },
  { clave: "alquileres", etiqueta: "Alquileres" },
  { clave: "transportes", etiqueta: "Transporte" },
  { clave: "general", etiqueta: "General" },
  { clave: "total", etiqueta: "Total" },
] as const;

export async function EstadoResultados({ periodo }: Props) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("estado_resultados", { p_desde: periodo.desde, p_hasta: periodo.hasta });
  if (error || !data) return <ErrorCarga />;
  const ingresos = data.filter((f) => f.tipo === "ingreso");
  const gastos = data.filter((f) => f.tipo === "gasto");
  const total = (filas: FilaResultados[], clave: (typeof COLUMNAS_ACTIVIDAD)[number]["clave"]) => sumarMontos(filas.map((f) => f[clave]));

  const tabla = (filas: FilaResultados[], etiquetaTotal: string, dato: string) => (
    <Tabla
      filas={filas.map((f) => ({ ...f, id: f.cuenta_codigo }))}
      vacio="Sin cuentas."
      columnas={[
        { clave: "cuenta", etiqueta: "Cuenta", celda: (f) => nombreCuenta(f.cuenta_codigo, f.cuenta_nombre) },
        ...COLUMNAS_ACTIVIDAD.map((c) => ({ clave: c.clave, etiqueta: c.etiqueta, numerica: true, celda: (f: FilaResultados) => formatearMoneda(f[c.clave]) })),
      ]}
      totales={Object.fromEntries([
        ["cuenta", etiquetaTotal],
        ...COLUMNAS_ACTIVIDAD.map((c) => [c.clave, c.clave === "total" ? <span key={c.clave} data-total={dato}>{formatearMoneda(total(filas, c.clave))}</span> : formatearMoneda(total(filas, c.clave))]),
      ])}
    />
  );
  const resultado = COLUMNAS_ACTIVIDAD.map((c) => ({ ...c, valor: resta(total(ingresos, c.clave), total(gastos, c.clave)) }));

  return (
    <div data-reporte="resultados">
      <Titulo>Estado de resultados · {describirPeriodo(periodo)}</Titulo>
      <Nota>
        Ingresos y gastos reconocidos en el período, por cuenta y actividad. Los cobros y pagos no son ingresos ni gastos. {AVISO_GERENCIAL}
      </Nota>
      <section className="mb-8">
        <h3 className="mb-2 font-semibold">Ingresos</h3>
        {tabla(ingresos, "Total ingresos", "ingresos")}
      </section>
      <section className="mb-8">
        <h3 className="mb-2 font-semibold">Gastos</h3>
        {tabla(gastos, "Total gastos", "gastos")}
      </section>
      <section>
        <h3 className="mb-2 font-semibold">Resultado del período (ingresos − gastos)</h3>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {resultado.map((r) => (
            <div key={r.clave} className={`tarjeta flex flex-col gap-1 p-4 ${r.clave === "total" ? "border-[var(--borde-fuerte)] bg-[var(--neutro-fondo)]" : ""}`}>
              <dt className="text-sm texto-tenue">{r.etiqueta}</dt>
              <dd className="text-lg font-semibold tabular-nums" data-total={r.clave === "total" ? "resultado" : undefined}>
                {formatearMoneda(r.valor)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estado de situación financiera y comprobaciones
// ---------------------------------------------------------------------------

type FilaSituacion = Database["public"]["Functions"]["situacion_financiera"]["Returns"][number];

export async function SituacionFinanciera({ periodo, hoy }: Props) {
  const corte = fechaCorte(periodo, hoy);
  const supabase = await createClient();
  const [situacion, comprobaciones] = await Promise.all([
    supabase.rpc("situacion_financiera", { p_fecha: corte }),
    supabase.rpc("comprobaciones_financieras", { p_fecha: corte }),
  ]);
  if (situacion.error || comprobaciones.error || !situacion.data || !comprobaciones.data) return <ErrorCarga />;
  const filas = situacion.data.map((f, indice) => ({ ...f, id: f.cuenta_codigo ?? `resultado-${indice}` }));
  const de = (tipo: Tipo) => filas.filter((f) => f.tipo === tipo);
  const suma = (lista: FilaSituacion[]) => sumarMontos(lista.map((f) => f.saldo));
  const totalActivo = suma(de("activo"));
  const totalPasivo = suma(de("pasivo"));
  const totalPatrimonio = suma(de("patrimonio"));
  const totalPasivoPatrimonio = sumarMontos([totalPasivo, totalPatrimonio]);
  const controles = comprobaciones.data;
  const fallidos = controles.filter((c) => c.cuadra === false);

  const bloque = (titulo: string, tipo: Tipo, etiquetaTotal: string, dato: string) => (
    <section className="mb-6">
      <h3 className="mb-2 font-semibold">{titulo}</h3>
      <Tabla
        filas={de(tipo)}
        vacio="Sin cuentas."
        columnas={[
          { clave: "cuenta", etiqueta: "Cuenta", celda: (f) => nombreCuenta(f.cuenta_codigo, f.cuenta_nombre) },
          { clave: "saldo", etiqueta: "Saldo", numerica: true, celda: (f) => formatearMoneda(f.saldo) },
        ]}
        totales={{ cuenta: etiquetaTotal, saldo: <span data-total={dato}>{formatearMoneda(suma(de(tipo)))}</span> }}
      />
    </section>
  );

  return (
    <div data-reporte="situacion">
      <Titulo>Estado de situación financiera al {formatearFecha(corte)}</Titulo>
      <Nota>
        Saldos de las cuentas del libro al cierre del día de corte
        {corte !== periodo.hasta ? " (el período elegido termina después de hoy: se usa hoy)" : ""}. El resultado acumulado son todos los
        ingresos menos todos los gastos hasta esa fecha. {AVISO_GERENCIAL}
      </Nota>

      {fallidos.length === 0 ? (
        <p role="status" className="aviso aviso-exito mb-6" data-cuadra="si">
          Las finanzas cuadran al {formatearFecha(corte)}: el activo es igual al pasivo más el patrimonio y el libro coincide con los saldos
          operativos.
        </p>
      ) : (
        <p role="alert" className="aviso aviso-error mb-6" data-cuadra="no">
          Hay {fallidos.length === 1 ? "una comprobación que no cuadra" : `${fallidos.length} comprobaciones que no cuadran`}. Revise el
          detalle abajo.
        </p>
      )}

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <div>{bloque("Activo", "activo", "Total activo", "activo")}</div>
        <div>
          {bloque("Pasivo", "pasivo", "Total pasivo", "pasivo")}
          {bloque("Patrimonio", "patrimonio", "Total patrimonio", "patrimonio")}
          <p className="tarjeta flex justify-between gap-3 p-4 font-semibold">
            <span>Total pasivo + patrimonio</span>
            <span className="tabular-nums" data-total="pasivo-patrimonio">
              {formatearMoneda(totalPasivoPatrimonio)}
            </span>
          </p>
        </div>
      </div>
      <p className="mt-2 mb-8 text-sm texto-tenue">
        Total activo {formatearMoneda(totalActivo)} · diferencia {formatearMoneda(resta(totalActivo, totalPasivoPatrimonio))}.
      </p>

      <section data-reporte="comprobaciones">
        <Titulo>Comprobaciones</Titulo>
        <Nota>Cada control compara dos cálculos independientes. «Diferencia» debe ser cero.</Nota>
        <Tabla
          filas={controles.map((c) => ({ ...c, id: String(c.orden) }))}
          vacio="Sin comprobaciones."
          columnas={[
            { clave: "control", etiqueta: "Control", celda: (c) => c.control },
            { clave: "esperado", etiqueta: "Libro / esperado", numerica: true, celda: (c) => (c.orden === 3 ? String(c.esperado) : formatearMoneda(c.esperado)) },
            {
              clave: "obtenido",
              etiqueta: "Comparado con",
              numerica: true,
              celda: (c) => (c.obtenido === null ? "—" : c.orden === 3 ? String(c.obtenido) : formatearMoneda(c.obtenido)),
            },
            { clave: "diferencia", etiqueta: "Diferencia", numerica: true, celda: (c) => (c.diferencia === null ? "—" : c.orden === 3 ? String(c.diferencia) : formatearMoneda(c.diferencia)) },
            {
              clave: "estado",
              etiqueta: "Estado",
              celda: (c) =>
                c.cuadra === null ? (
                  <span className="insignia insignia-info" title={c.nota ?? undefined}>
                    Solo a hoy
                  </span>
                ) : c.cuadra ? (
                  <span className="insignia insignia-activo">Cuadra</span>
                ) : (
                  <span className="insignia insignia-advertencia">No cuadra</span>
                ),
            },
          ]}
        />
        {controles.some((c) => c.cuadra === null) && (
          <p className="mt-3 text-sm texto-tenue">
            «Solo a hoy»: por cobrar, por pagar y anticipos se comparan con los saldos actuales, así que solo se verifican si el período
            termina hoy o después.
          </p>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Balanza de comprobación
// ---------------------------------------------------------------------------

const ETIQUETAS_TIPO: Record<Tipo, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  patrimonio: "Patrimonio",
  ingreso: "Ingreso",
  gasto: "Gasto",
};

export async function BalanzaComprobacion({ periodo }: Props) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("balanza_comprobacion", { p_desde: periodo.desde, p_hasta: periodo.hasta });
  if (error || !data) return <ErrorCarga />;
  const debe = sumarMontos(data.map((f) => f.debe));
  const haber = sumarMontos(data.map((f) => f.haber));
  const cuadra = aCentavos(debe) === aCentavos(haber);

  return (
    <div data-reporte="balanza">
      <Titulo>Balanza de comprobación · {describirPeriodo(periodo)}</Titulo>
      <Nota>
        Por cuenta: saldo al cierre del {formatearFecha(diaAnterior(periodo.desde))}, movimientos del período y saldo al cierre del{" "}
        {formatearFecha(periodo.hasta)}. Activo y gasto se leen como debe − haber; pasivo, patrimonio e ingreso, como haber − debe. El total
        del debe debe ser igual al del haber. {AVISO_GERENCIAL}
      </Nota>
      {cuadra ? (
        <p role="status" className="aviso aviso-exito mb-4" data-cuadra="si">
          La balanza cuadra: debe {formatearMoneda(debe)} = haber {formatearMoneda(haber)}.
        </p>
      ) : (
        <p role="alert" className="aviso aviso-error mb-4" data-cuadra="no">
          La balanza no cuadra: debe {formatearMoneda(debe)} ≠ haber {formatearMoneda(haber)}.
        </p>
      )}
      <Tabla
        filas={data.map((f) => ({ ...f, id: f.cuenta_codigo }))}
        vacio="Sin cuentas."
        columnas={[
          { clave: "cuenta", etiqueta: "Cuenta", celda: (f) => nombreCuenta(f.cuenta_codigo, f.cuenta_nombre) },
          { clave: "tipo", etiqueta: "Tipo", celda: (f) => ETIQUETAS_TIPO[f.tipo] },
          { clave: "saldo_inicial", etiqueta: "Saldo inicial", numerica: true, celda: (f) => formatearMoneda(f.saldo_inicial) },
          { clave: "debe", etiqueta: "Debe", numerica: true, celda: (f) => formatearMoneda(f.debe) },
          { clave: "haber", etiqueta: "Haber", numerica: true, celda: (f) => formatearMoneda(f.haber) },
          { clave: "saldo_final", etiqueta: "Saldo final", numerica: true, celda: (f) => formatearMoneda(f.saldo_final) },
        ]}
        totales={{ debe: <span data-total="debe">{formatearMoneda(debe)}</span>, haber: <span data-total="haber">{formatearMoneda(haber)}</span> }}
      />
    </div>
  );
}
