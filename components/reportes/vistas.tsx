import Link from "next/link";
import type { ReactNode } from "react";
import type { Opcion } from "@/lib/catalogos/definiciones";
import { esUuid } from "@/lib/catalogos/presentacion";
import { ETIQUETAS_ACTIVIDAD } from "@/lib/finanzas/definiciones";
import { aCentavos, centavosATexto, sumarMontos } from "@/lib/finanzas/montos";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import {
  ETIQUETAS_ESTADO_PAGO,
  estadoPago,
  estaVencido,
  LIMITE_REPORTE,
  rutaReporte,
  type EstadoPago,
} from "@/lib/reportes/definiciones";
import { describirPeriodo, diaAnterior, type Periodo } from "@/lib/reportes/periodo";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/tipos-bd";
import { EstadoVacio } from "@/components/encabezado";
import { ResumenImportes } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";

// Vistas de /reportes. Todas las cifras salen de las funciones public.reporte_*
// y de las vistas de saldos de E2; aquí solo se presentan. Los totales de cada
// tabla vienen de la base salvo donde se indica que suman las filas mostradas
// (y entonces solo si la lista está completa).

type Actividad = Database["public"]["Enums"]["actividad"];
type TipoMovimiento = Database["public"]["Enums"]["tipo_movimiento"];

export type Parametros = { actividad?: string; filtro?: string; cuenta?: string };
type Props = { periodo: Periodo; hoy: string; parametros: Parametros };

const OPCIONES_ACTIVIDAD: readonly Opcion[] = [
  { valor: "", etiqueta: "Todas las actividades" },
  ...Object.entries(ETIQUETAS_ACTIVIDAD).map(([valor, etiqueta]) => ({ valor, etiqueta })),
];

const ETIQUETAS_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ingreso: "Entrada (cobro)",
  egreso: "Salida (pago)",
  transferencia: "Transferencia",
  apertura: "Saldo inicial",
};

const CLASE_ESTADO_PAGO: Record<EstadoPago, string> = {
  pendiente: "insignia-advertencia",
  parcial: "insignia-info",
  pagado: "insignia-activo",
  anulado: "insignia-inactivo",
};

function leerActividad(valor: string | undefined): Actividad | null {
  return valor && valor in ETIQUETAS_ACTIVIDAD ? (valor as Actividad) : null;
}

function ErrorCarga() {
  return (
    <p role="alert" className="aviso aviso-error">
      No se pudo cargar el reporte.
    </p>
  );
}

function Nota({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-sm texto-tenue">{children}</p>;
}

function Titulo({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-lg font-semibold tracking-tight">{children}</h2>;
}

function Truncado({ total }: { total: number }) {
  if (total <= LIMITE_REPORTE) return null;
  return (
    <p className="mt-3 text-sm texto-tenue">
      Se muestran las primeras {LIMITE_REPORTE} filas; acote el período. Los totales corresponden a todo el período.
    </p>
  );
}

function InsigniaPago({ estado, vencido = false }: { estado: EstadoPago; vencido?: boolean }) {
  return (
    <span className="inline-flex flex-wrap justify-end gap-1">
      <span className={`insignia ${CLASE_ESTADO_PAGO[estado]}`}>{ETIQUETAS_ESTADO_PAGO[estado]}</span>
      {vencido && <span className="insignia insignia-advertencia">Vencido</span>}
    </span>
  );
}

/** Formulario de actividad que conserva vista y período. */
function FiltroActividad({ vista, periodo, actividad }: { vista: string; periodo: Periodo; actividad: Actividad | null }) {
  return (
    <form method="get" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="vista" value={vista} />
      <input type="hidden" name="periodo" value={periodo.clave} />
      <input type="hidden" name="desde" value={periodo.desde} />
      <input type="hidden" name="hasta" value={periodo.hasta} />
      <label className="campo sm:w-72">
        <span className="campo-etiqueta">Actividad</span>
        <select className="entrada" name="actividad" defaultValue={actividad ?? ""}>
          {OPCIONES_ACTIVIDAD.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="boton boton-secundario">
        Filtrar
      </button>
    </form>
  );
}

function rango(periodo: Periodo) {
  return { p_desde: periodo.desde, p_hasta: periodo.hasta };
}

// ---------------------------------------------------------------------------
// 6.1 Resumen
// ---------------------------------------------------------------------------

export async function ReporteResumen({ periodo }: Props) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reporte_resumen", rango(periodo)).single();
  if (error || !data) return <ErrorCarga />;
  const texto = describirPeriodo(periodo);

  return (
    <div data-reporte="resumen">
      <Titulo>Resultado de {texto}</Titulo>
      <ResumenImportes
        importes={[
          { etiqueta: "Ingresos reconocidos", valor: data.ingresos, ayuda: "Cargos devengados; las anulaciones restan." },
          { etiqueta: "Gastos reconocidos", valor: data.gastos, ayuda: "Gastos registrados; los pagos no cuentan." },
          {
            etiqueta: "Resultado operativo básico",
            valor: data.resultado,
            ayuda: "Ingresos − gastos. Informe gerencial; no es utilidad fiscal.",
            destacado: true,
          },
        ]}
      />
      <Titulo>Dinero recibido y pagado en {texto}</Titulo>
      <Nota>
        Los cobros incluyen anticipos y abonos a deudas anteriores: no son ingresos del período. Las transferencias entre cuentas no
        aparecen aquí.
      </Nota>
      <ResumenImportes
        importes={[
          { etiqueta: "Cobros recibidos", valor: data.cobros_periodo, ayuda: "Entradas de caja y bancos por cobros." },
          { etiqueta: "Pagos a proveedores", valor: data.pagos_periodo, ayuda: "Abonos a gastos; no son gasto nuevo." },
        ]}
      />
      <Titulo>Saldos actuales al {formatearFecha(data.fecha_corte)}</Titulo>
      <Nota>No dependen del período elegido: son los saldos de hoy.</Nota>
      <ResumenImportes
        importes={[
          { etiqueta: "Por cobrar", valor: data.por_cobrar, ayuda: `Vencido: ${formatearMoneda(data.por_cobrar_vencido)}` },
          { etiqueta: "Por pagar", valor: data.por_pagar, ayuda: `Vencido: ${formatearMoneda(data.por_pagar_vencido)}` },
          { etiqueta: "Anticipos sin aplicar", valor: data.anticipos, ayuda: "Saldo a favor de clientes." },
          { etiqueta: "Caja y bancos", valor: data.dinero_disponible, ayuda: "Suma de todas las cuentas." },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6.2 Resultados por actividad
// ---------------------------------------------------------------------------

export async function ReporteActividades({ periodo }: Props) {
  const supabase = await createClient();
  const [actividades, resumen] = await Promise.all([
    supabase.rpc("reporte_resultados_actividad", rango(periodo)),
    supabase.rpc("reporte_resumen", rango(periodo)).single(),
  ]);
  if (actividades.error || resumen.error || !resumen.data) return <ErrorCarga />;
  const filas = (actividades.data ?? []).map((fila) => ({ ...fila, id: fila.actividad }));
  const consolidado = resumen.data;
  // Control: la suma de las cuatro filas debe igualar el consolidado del libro.
  const cuadra = (["ingresos", "gastos", "resultado"] as const).every(
    (clave) => sumarMontos(filas.map((f) => f[clave])) === centavosATexto(aCentavos(consolidado[clave]) ?? 0),
  );

  return (
    <div data-reporte="actividades">
      <Titulo>Resultados por actividad · {describirPeriodo(periodo)}</Titulo>
      <Nota>
        Los gastos generales no se reparten entre actividades: tienen su propia fila y entran en el consolidado. Ambulancias incluye
        las membresías.
      </Nota>
      {!cuadra && (
        <p role="alert" className="aviso aviso-error mb-4">
          La suma por actividad no coincide con el consolidado. Revise el libro contable.
        </p>
      )}
      <Tabla
        filas={filas}
        vacio="Sin datos."
        columnas={[
          { clave: "actividad", etiqueta: "Actividad", celda: (f) => ETIQUETAS_ACTIVIDAD[f.actividad] },
          { clave: "ingresos", etiqueta: "Ingresos", numerica: true, celda: (f) => formatearMoneda(f.ingresos) },
          { clave: "gastos", etiqueta: "Gastos", numerica: true, celda: (f) => formatearMoneda(f.gastos) },
          { clave: "resultado", etiqueta: "Resultado", numerica: true, celda: (f) => formatearMoneda(f.resultado) },
        ]}
        totales={{
          ingresos: formatearMoneda(consolidado.ingresos),
          gastos: formatearMoneda(consolidado.gastos),
          resultado: formatearMoneda(consolidado.resultado),
        }}
      />
      <p className="mt-3 text-sm texto-tenue">Totales: consolidado de la empresa (resultado operativo básico, no utilidad fiscal).</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6.3 Ingresos del período
// ---------------------------------------------------------------------------

async function totalesPeriodo(periodo: Periodo, actividad: Actividad | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reporte_resultados_actividad", rango(periodo));
  if (error || !data) return null;
  const filas = actividad ? data.filter((f) => f.actividad === actividad) : data;
  // Las cuatro filas suman el consolidado (lo comprueba la vista por actividad).
  return { ingresos: sumarMontos(filas.map((f) => f.ingresos)), gastos: sumarMontos(filas.map((f) => f.gastos)) };
}

export async function ReporteIngresos({ periodo, parametros }: Props) {
  const actividad = leerActividad(parametros.actividad);
  const supabase = await createClient();
  const [detalle, totales] = await Promise.all([
    supabase.rpc("reporte_ingresos", { ...rango(periodo), ...(actividad ? { p_actividad: actividad } : {}) }).limit(LIMITE_REPORTE + 1),
    totalesPeriodo(periodo, actividad),
  ]);
  if (detalle.error || !totales) return <ErrorCarga />;
  const filas = (detalle.data ?? []).slice(0, LIMITE_REPORTE).map((f) => ({ ...f, id: `${f.asiento_id}-${f.cuenta_codigo}` }));

  return (
    <div data-reporte="ingresos">
      <Titulo>Ingresos de {describirPeriodo(periodo)}</Titulo>
      <Nota>
        Ingresos reconocidos por cargos (servicios, mensualidades y cargos manuales). Una anulación resta en la fecha en que se anuló.
        No incluye cobros, anticipos ni transferencias.
      </Nota>
      <FiltroActividad vista="ingresos" periodo={periodo} actividad={actividad} />
      <Tabla
        filas={filas}
        enlace={(f) => (f.cargo_id ? `/finanzas/cargos/${f.cargo_id}` : null)}
        vacio="No hay ingresos en el período."
        columnas={[
          { clave: "concepto", etiqueta: "Concepto", celda: (f) => (f.evento === "reverso" ? `${f.concepto} (anulación)` : f.concepto) },
          { clave: "fecha", etiqueta: "Fecha", celda: (f) => formatearFecha(f.fecha) },
          { clave: "actividad", etiqueta: "Actividad", celda: (f) => ETIQUETAS_ACTIVIDAD[f.actividad] },
          { clave: "cliente", etiqueta: "Cliente", celda: (f) => f.cliente_nombre ?? "—" },
          { clave: "importe", etiqueta: "Importe", numerica: true, celda: (f) => formatearMoneda(f.importe) },
        ]}
        totales={{ importe: <span data-total="ingresos">{formatearMoneda(totales.ingresos)}</span> }}
      />
      <Truncado total={detalle.data?.length ?? 0} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6.4 Gastos del período
// ---------------------------------------------------------------------------

export async function ReporteGastos({ periodo, parametros }: Props) {
  const actividad = leerActividad(parametros.actividad);
  const supabase = await createClient();
  const [detalle, agrupados, totales] = await Promise.all([
    supabase.rpc("reporte_gastos", { ...rango(periodo), ...(actividad ? { p_actividad: actividad } : {}) }).limit(LIMITE_REPORTE + 1),
    supabase.rpc("reporte_gastos_agrupados", rango(periodo)),
    totalesPeriodo(periodo, actividad),
  ]);
  if (detalle.error || agrupados.error || !totales) return <ErrorCarga />;
  const filas = (detalle.data ?? []).slice(0, LIMITE_REPORTE).map((f) => ({ ...f, id: `${f.asiento_id}-${f.cuenta_codigo}` }));
  const grupos = agrupados.data ?? [];
  const porCategoria = grupos
    .filter((g) => g.agrupacion === "categoria")
    .map((g) => ({ ...g, id: g.clave }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const porActividad = grupos
    .filter((g) => g.agrupacion === "actividad")
    .map((g) => ({ ...g, id: g.clave, nombre: ETIQUETAS_ACTIVIDAD[g.clave as Actividad] ?? g.nombre }));
  const totalGrupo = sumarMontos(porActividad.map((g) => g.importe));

  return (
    <div data-reporte="gastos">
      <Titulo>Gastos de {describirPeriodo(periodo)}</Titulo>
      <Nota>
        Cada gasto cuenta una sola vez, en su fecha. Los pagos (abonos) no son gastos; el estado de pago es el actual. Una anulación
        resta en la fecha en que se anuló.
      </Nota>
      <FiltroActividad vista="gastos" periodo={periodo} actividad={actividad} />
      <Tabla
        filas={filas}
        enlace={(f) => (f.gasto_id ? `/finanzas/gastos/${f.gasto_id}` : null)}
        vacio="No hay gastos en el período."
        columnas={[
          { clave: "concepto", etiqueta: "Concepto", celda: (f) => (f.evento === "reverso" ? `${f.concepto} (anulación)` : f.concepto) },
          { clave: "fecha", etiqueta: "Fecha", celda: (f) => formatearFecha(f.fecha) },
          { clave: "categoria", etiqueta: "Categoría", celda: (f) => f.categoria ?? "—" },
          { clave: "proveedor", etiqueta: "Proveedor", celda: (f) => f.proveedor ?? "—" },
          { clave: "actividad", etiqueta: "Actividad", celda: (f) => ETIQUETAS_ACTIVIDAD[f.actividad] },
          { clave: "importe", etiqueta: "Importe", numerica: true, celda: (f) => formatearMoneda(f.importe) },
          {
            clave: "estado",
            etiqueta: "Estado de pago",
            celda: (f) => <InsigniaPago estado={estadoPago({ anulado: f.estado === "anulado", pagado: f.pagado, pendiente: f.pendiente })} />,
          },
          { clave: "pendiente", etiqueta: "Pendiente hoy", numerica: true, celda: (f) => (f.estado === "anulado" ? "—" : formatearMoneda(f.pendiente)) },
        ]}
        totales={{ importe: <span data-total="gastos">{formatearMoneda(totales.gastos)}</span> }}
      />
      <Truncado total={detalle.data?.length ?? 0} />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <Titulo>Totales por categoría</Titulo>
          {actividad && <Nota>De todas las actividades del período.</Nota>}
          <Tabla
            filas={porCategoria}
            vacio="Sin gastos en el período."
            columnas={[
              { clave: "nombre", etiqueta: "Categoría", celda: (g) => g.nombre },
              { clave: "importe", etiqueta: "Importe", numerica: true, celda: (g) => formatearMoneda(g.importe) },
            ]}
            totales={{ importe: formatearMoneda(totalGrupo) }}
          />
        </section>
        <section>
          <Titulo>Totales por actividad</Titulo>
          {actividad && <Nota>De todas las actividades del período.</Nota>}
          <Tabla
            filas={porActividad}
            vacio="Sin gastos en el período."
            columnas={[
              { clave: "nombre", etiqueta: "Actividad", celda: (g) => g.nombre },
              { clave: "importe", etiqueta: "Importe", numerica: true, celda: (g) => formatearMoneda(g.importe) },
            ]}
            totales={{ importe: formatearMoneda(totalGrupo) }}
          />
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6.5 Cuentas por cobrar (saldos actuales)
// ---------------------------------------------------------------------------

const FILTROS_COBRAR = [
  { valor: "pendientes", etiqueta: "Con saldo" },
  { valor: "vencidos", etiqueta: "Vencidos" },
  { valor: "todos", etiqueta: "Todos (incluye pagados)" },
] as const;

function FiltrosEnlace({
  opciones,
  actual,
  ruta,
}: {
  opciones: readonly { valor: string; etiqueta: string }[];
  actual: string;
  ruta: (valor: string) => string;
}) {
  return (
    <nav aria-label="Filtro" className="mb-4 flex flex-wrap gap-2">
      {opciones.map((o) => (
        <Link
          key={o.valor}
          href={ruta(o.valor)}
          aria-current={o.valor === actual ? "true" : undefined}
          className={`boton min-h-9 px-3 text-sm ${o.valor === actual ? "boton-primario" : "boton-secundario"}`}
        >
          {o.etiqueta}
        </Link>
      ))}
    </nav>
  );
}

export async function ReportePorCobrar({ periodo, hoy, parametros }: Props) {
  const filtro = FILTROS_COBRAR.find((f) => f.valor === parametros.filtro)?.valor ?? "pendientes";
  const supabase = await createClient();
  let consulta = supabase
    .from("saldos_cargos")
    .select("id, cliente_nombre, concepto, actividad, monto, aplicado, pendiente, vencimiento, estado")
    .eq("estado", "vigente")
    .order("vencimiento", { ascending: true, nullsFirst: false })
    .order("fecha", { ascending: true })
    .limit(LIMITE_REPORTE + 1);
  if (filtro !== "todos") consulta = consulta.gt("pendiente", 0);
  if (filtro === "vencidos") consulta = consulta.lt("vencimiento", hoy);
  const [cargos, aFavor, resumen] = await Promise.all([
    consulta,
    supabase.from("saldos_clientes").select("cliente_id, cliente_nombre, saldo_a_favor").gt("saldo_a_favor", 0).order("cliente_nombre"),
    supabase.rpc("reporte_resumen", { p_desde: hoy, p_hasta: hoy }).single(),
  ]);
  if (cargos.error || aFavor.error || resumen.error || !resumen.data) return <ErrorCarga />;
  const completo = (cargos.data?.length ?? 0) <= LIMITE_REPORTE;
  const filas = (cargos.data ?? []).slice(0, LIMITE_REPORTE).map((f) => ({ ...f, id: f.id! }));
  const clientes = (aFavor.data ?? []).map((f) => ({ ...f, id: f.cliente_id! }));

  return (
    <div data-reporte="cobrar">
      <Titulo>Cuentas por cobrar al {formatearFecha(hoy)}</Titulo>
      <Nota>Saldos actuales de cargos vigentes; no dependen de un período.</Nota>
      <ResumenImportes
        importes={[
          { etiqueta: "Por cobrar", valor: resumen.data.por_cobrar },
          { etiqueta: "Vencido", valor: resumen.data.por_cobrar_vencido, ayuda: "Con vencimiento anterior a hoy." },
          { etiqueta: "Saldo a favor de clientes", valor: resumen.data.anticipos, ayuda: "Anticipos sin aplicar; se muestran aparte." },
        ]}
      />
      <FiltrosEnlace opciones={FILTROS_COBRAR} actual={filtro} ruta={(valor) => rutaReporte("cobrar", periodo, { filtro: valor })} />
      <Tabla
        filas={filas}
        enlace={(f) => `/finanzas/cargos/${f.id}`}
        vacio={filtro === "vencidos" ? "No hay cargos vencidos." : "No hay cargos que coincidan."}
        columnas={[
          { clave: "cliente", etiqueta: "Cliente", celda: (f) => f.cliente_nombre ?? "—" },
          { clave: "concepto", etiqueta: "Concepto", celda: (f) => f.concepto },
          { clave: "monto", etiqueta: "Original", numerica: true, celda: (f) => formatearMoneda(f.monto) },
          { clave: "aplicado", etiqueta: "Pagado", numerica: true, celda: (f) => formatearMoneda(f.aplicado) },
          { clave: "pendiente", etiqueta: "Pendiente", numerica: true, celda: (f) => formatearMoneda(f.pendiente) },
          { clave: "vencimiento", etiqueta: "Vencimiento", celda: (f) => formatearFecha(f.vencimiento) },
          {
            clave: "estado",
            etiqueta: "Estado",
            celda: (f) => (
              <InsigniaPago
                estado={estadoPago({ anulado: false, pagado: f.aplicado, pendiente: f.pendiente })}
                vencido={estaVencido(f.vencimiento, f.pendiente, hoy)}
              />
            ),
          },
        ]}
        totales={
          completo
            ? {
                monto: formatearMoneda(sumarMontos(filas.map((f) => f.monto))),
                aplicado: formatearMoneda(sumarMontos(filas.map((f) => f.aplicado))),
                pendiente: <span data-total="pendiente">{formatearMoneda(sumarMontos(filas.map((f) => f.pendiente)))}</span>,
              }
            : undefined
        }
      />
      <Truncado total={cargos.data?.length ?? 0} />

      <section className="mt-8" data-reporte="saldo-a-favor">
        <Titulo>Saldo a favor de clientes</Titulo>
        <Nota>Cobros recibidos aún no aplicados a cargos. No reduce lo pendiente hasta que se aplica.</Nota>
        <Tabla
          filas={clientes}
          enlace={(f) => `/clientes/${f.id}`}
          vacio="Ningún cliente tiene saldo a favor."
          columnas={[
            { clave: "nombre", etiqueta: "Cliente", celda: (f) => f.cliente_nombre ?? "—" },
            { clave: "saldo", etiqueta: "Saldo a favor", numerica: true, celda: (f) => formatearMoneda(f.saldo_a_favor) },
          ]}
          totales={{ saldo: formatearMoneda(resumen.data.anticipos) }}
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6.6 Cuentas por pagar (saldos actuales)
// ---------------------------------------------------------------------------

export async function ReportePorPagar({ hoy }: Props) {
  const supabase = await createClient();
  const [gastos, resumen] = await Promise.all([
    supabase
      .from("saldos_gastos")
      .select("id, proveedor_nombre, concepto, categoria_nombre, actividad, monto, pagado, pendiente, vencimiento")
      .eq("estado", "registrado")
      .gt("pendiente", 0)
      .order("vencimiento", { ascending: true, nullsFirst: false })
      .order("fecha", { ascending: true })
      .limit(LIMITE_REPORTE + 1),
    supabase.rpc("reporte_resumen", { p_desde: hoy, p_hasta: hoy }).single(),
  ]);
  if (gastos.error || resumen.error || !resumen.data) return <ErrorCarga />;
  const completo = (gastos.data?.length ?? 0) <= LIMITE_REPORTE;
  const filas = (gastos.data ?? []).slice(0, LIMITE_REPORTE).map((f) => ({ ...f, id: f.id! }));
  const vencidas = filas.filter((f) => estaVencido(f.vencimiento, f.pendiente, hoy));
  const noVencidas = filas.filter((f) => !estaVencido(f.vencimiento, f.pendiente, hoy));
  const total = resumen.data.por_pagar;
  const vencido = resumen.data.por_pagar_vencido;
  const noVencido = centavosATexto((aCentavos(total) ?? 0) - (aCentavos(vencido) ?? 0));

  const tabla = (lista: typeof filas, vacio: string, clave: string) => (
    <Tabla
      filas={lista}
      enlace={(f) => `/finanzas/gastos/${f.id}`}
      vacio={vacio}
      columnas={[
        { clave: "proveedor", etiqueta: "Proveedor", celda: (f) => f.proveedor_nombre ?? "Sin proveedor" },
        { clave: "concepto", etiqueta: "Concepto", celda: (f) => f.concepto },
        { clave: "categoria", etiqueta: "Categoría", celda: (f) => f.categoria_nombre ?? "—" },
        { clave: "actividad", etiqueta: "Actividad", celda: (f) => (f.actividad ? ETIQUETAS_ACTIVIDAD[f.actividad] : "—") },
        { clave: "monto", etiqueta: "Original", numerica: true, celda: (f) => formatearMoneda(f.monto) },
        { clave: "pagado", etiqueta: "Pagado", numerica: true, celda: (f) => formatearMoneda(f.pagado) },
        { clave: "pendiente", etiqueta: "Pendiente", numerica: true, celda: (f) => formatearMoneda(f.pendiente) },
        { clave: "vencimiento", etiqueta: "Vencimiento", celda: (f) => formatearFecha(f.vencimiento) },
      ]}
      totales={
        completo
          ? { pendiente: <span data-total={clave}>{formatearMoneda(sumarMontos(lista.map((f) => f.pendiente)))}</span> }
          : undefined
      }
    />
  );

  return (
    <div data-reporte="pagar">
      <Titulo>Cuentas por pagar al {formatearFecha(hoy)}</Titulo>
      <Nota>Gastos registrados con saldo; no dependen de un período. Sin vencimiento cuentan como no vencidos.</Nota>
      <ResumenImportes
        importes={[
          { etiqueta: "Por pagar", valor: total },
          { etiqueta: "Vencido", valor: vencido, ayuda: "Con vencimiento anterior a hoy." },
          { etiqueta: "No vencido", valor: noVencido },
        ]}
      />
      <section className="mb-8">
        <Titulo>Vencidas</Titulo>
        {tabla(vencidas, "No hay cuentas por pagar vencidas.", "vencidas")}
      </section>
      <section>
        <Titulo>No vencidas</Titulo>
        {tabla(noVencidas, "No hay cuentas por pagar sin vencer.", "no-vencidas")}
      </section>
      <Truncado total={gastos.data?.length ?? 0} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6.7 Caja y bancos
// ---------------------------------------------------------------------------

export async function ReporteCaja({ periodo, hoy, parametros }: Props) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reporte_caja", rango(periodo));
  if (error) return <ErrorCarga />;
  // Cuentas inactivas sin saldo ni movimientos en el período no aportan nada.
  const filas = (data ?? [])
    .filter((f) =>
      f.activo || [f.saldo_inicial, f.cobros, f.pagos, f.transferencias, f.aperturas, f.saldo_actual].some((v) => aCentavos(v) !== 0),
    )
    .map((f) => ({ ...f, id: f.cuenta_dinero_id }));
  const suma = (clave: "saldo_inicial" | "cobros" | "pagos" | "transferencias" | "aperturas" | "saldo_final" | "saldo_actual") =>
    formatearMoneda(sumarMontos(filas.map((f) => f[clave])));
  const cuenta = esUuid(parametros.cuenta) ? filas.find((f) => f.id === parametros.cuenta) : undefined;
  const futuro = periodo.hasta > hoy;

  return (
    <div data-reporte="caja">
      <Titulo>Caja y bancos · {describirPeriodo(periodo)}</Titulo>
      <Nota>
        Saldos calculados solo con los movimientos registrados. Saldo inicial: al cierre del {formatearFecha(diaAnterior(periodo.desde))}
        . Saldo final: al cierre del {formatearFecha(periodo.hasta)}
        {futuro ? " (el período aún no termina: incluye hasta hoy)" : ""}. Saldo actual: hoy, {formatearFecha(hoy)}. Las
        transferencias mueven dinero entre cuentas: no son ingresos ni gastos y en el total suman cero.
      </Nota>
      <Tabla
        filas={filas}
        enlace={(f) => `${rutaReporte("caja", periodo, { cuenta: f.id })}#movimientos`}
        vacio="No hay cuentas de caja o banco."
        columnas={[
          { clave: "nombre", etiqueta: "Cuenta", celda: (f) => `${f.nombre}${f.activo ? "" : " (inactiva)"}` },
          { clave: "tipo", etiqueta: "Tipo", celda: (f) => (f.tipo === "caja" ? "Caja" : "Banco") },
          { clave: "saldo_inicial", etiqueta: "Saldo inicial", numerica: true, celda: (f) => formatearMoneda(f.saldo_inicial) },
          { clave: "cobros", etiqueta: "Entradas (cobros)", numerica: true, celda: (f) => formatearMoneda(f.cobros) },
          { clave: "pagos", etiqueta: "Salidas (pagos)", numerica: true, celda: (f) => formatearMoneda(f.pagos) },
          { clave: "transferencias", etiqueta: "Transferencias", numerica: true, celda: (f) => formatearMoneda(f.transferencias) },
          { clave: "aperturas", etiqueta: "Saldos iniciales", numerica: true, celda: (f) => formatearMoneda(f.aperturas) },
          { clave: "saldo_final", etiqueta: "Saldo final", numerica: true, celda: (f) => <SaldoConSigno valor={f.saldo_final} /> },
          { clave: "saldo_actual", etiqueta: "Saldo actual", numerica: true, celda: (f) => <SaldoConSigno valor={f.saldo_actual} /> },
        ]}
        totales={{
          saldo_inicial: suma("saldo_inicial"),
          cobros: suma("cobros"),
          pagos: suma("pagos"),
          transferencias: suma("transferencias"),
          aperturas: suma("aperturas"),
          saldo_final: suma("saldo_final"),
          saldo_actual: <span data-total="dinero">{suma("saldo_actual")}</span>,
        }}
      />
      <section id="movimientos" className="mt-8">
        {cuenta ? (
          <Movimientos cuenta={cuenta} periodo={periodo} />
        ) : (
          <EstadoVacio mensaje="Elija una cuenta para ver sus movimientos del período." />
        )}
      </section>
    </div>
  );
}

function SaldoConSigno({ valor }: { valor: number | string | null }) {
  const negativo = (aCentavos(valor) ?? 0) < 0;
  return (
    <span className={negativo ? "font-semibold text-[var(--error-texto)]" : undefined}>
      {formatearMoneda(valor)}
      {negativo && <span className="sr-only"> (saldo negativo)</span>}
    </span>
  );
}

async function Movimientos({ cuenta, periodo }: { cuenta: { id: string; nombre: string; saldo_inicial: number; saldo_final: number }; periodo: Periodo }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("reporte_movimientos", { p_cuenta_dinero_id: cuenta.id, ...rango(periodo) })
    .limit(LIMITE_REPORTE + 1);
  if (error) return <ErrorCarga />;
  const filas = (data ?? []).slice(0, LIMITE_REPORTE).map((f) => ({ ...f, id: f.movimiento_id }));

  return (
    <div data-reporte="movimientos">
      <Titulo>Movimientos de {cuenta.nombre}</Titulo>
      <Nota>
        Saldo inicial {formatearMoneda(cuenta.saldo_inicial)} · saldo final {formatearMoneda(cuenta.saldo_final)}. Los reversos aparecen
        como movimientos de signo contrario en su fecha.
      </Nota>
      <Tabla
        filas={filas}
        vacio="La cuenta no tuvo movimientos en el período."
        columnas={[
          { clave: "concepto", etiqueta: "Concepto", celda: (f) => (f.evento === "reverso" ? `${f.concepto} (reverso)` : f.concepto) },
          { clave: "fecha", etiqueta: "Fecha", celda: (f) => formatearFecha(f.fecha) },
          { clave: "tipo", etiqueta: "Tipo", celda: (f) => ETIQUETAS_MOVIMIENTO[f.tipo] },
          { clave: "importe", etiqueta: "Importe", numerica: true, celda: (f) => formatearMoneda(f.importe) },
          { clave: "saldo", etiqueta: "Saldo", numerica: true, celda: (f) => <SaldoConSigno valor={f.saldo} /> },
        ]}
      />
      <Truncado total={data?.length ?? 0} />
    </div>
  );
}
