import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { primerValor } from "@/lib/catalogos/presentacion";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { leerVista, rutaReporte, VISTAS, type Vista } from "@/lib/reportes/definiciones";
import { describirPeriodo, PERIODOS, resolverPeriodo, type Periodo } from "@/lib/reportes/periodo";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import {
  ReporteActividades,
  ReporteCaja,
  ReporteGastos,
  ReporteIngresos,
  ReportePorCobrar,
  ReportePorPagar,
  ReporteResumen,
  type Parametros,
} from "@/components/reportes/vistas";
import { BalanzaComprobacion, EstadoResultados, SituacionFinanciera } from "@/components/reportes/estados";

export default function PaginaReportes({ searchParams }: PageProps<"/reportes">) {
  return (
    <>
      <Encabezado
        titulo="Reportes"
        descripcion="Informes gerenciales calculados del libro contable. No sustituyen estados financieros ni declaraciones fiscales."
      />
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("verReportes", usuario.rol)) {
    return <SinPermiso mensaje="Los reportes financieros los consultan el administrador y finanzas." />;
  }
  const parametros = await searchParams;
  const hoy = hoyEnTegucigalpa();
  const vista = leerVista(primerValor(parametros.vista));
  const periodo = resolverPeriodo(
    { periodo: primerValor(parametros.periodo), desde: primerValor(parametros.desde), hasta: primerValor(parametros.hasta) },
    hoy,
  );
  const otros: Parametros = {
    actividad: primerValor(parametros.actividad),
    filtro: primerValor(parametros.filtro),
    cuenta: primerValor(parametros.cuenta),
  };

  return (
    <>
      <Pestanas vista={vista} periodo={periodo} />
      {vista !== "cobrar" && vista !== "pagar" && <SelectorPeriodo vista={vista} periodo={periodo} />}
      {periodo.aviso && (
        <p role="alert" className="aviso aviso-advertencia mb-4">
          {periodo.aviso}
        </p>
      )}
      <Suspense key={JSON.stringify({ vista, periodo, otros })} fallback={<Cargando />}>
        <Vista vista={vista} periodo={periodo} hoy={hoy} parametros={otros} />
      </Suspense>
    </>
  );
}

function Vista({ vista, periodo, hoy, parametros }: { vista: Vista; periodo: Periodo; hoy: string; parametros: Parametros }) {
  const props = { periodo, hoy, parametros };
  switch (vista) {
    case "actividades":
      return <ReporteActividades {...props} />;
    case "ingresos":
      return <ReporteIngresos {...props} />;
    case "gastos":
      return <ReporteGastos {...props} />;
    case "cobrar":
      return <ReportePorCobrar {...props} />;
    case "pagar":
      return <ReportePorPagar {...props} />;
    case "caja":
      return <ReporteCaja {...props} />;
    case "resultados":
      return <EstadoResultados {...props} />;
    case "situacion":
      return <SituacionFinanciera {...props} />;
    case "balanza":
      return <BalanzaComprobacion {...props} />;
    default:
      return <ReporteResumen {...props} />;
  }
}

function Pestanas({ vista, periodo }: { vista: Vista; periodo: Periodo }) {
  return (
    <nav aria-label="Reportes" className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {VISTAS.map((v) => (
        <Link
          key={v.valor}
          href={rutaReporte(v.valor, periodo)}
          aria-current={v.valor === vista ? "page" : undefined}
          className={`boton shrink-0 ${v.valor === vista ? "boton-primario" : "boton-secundario"}`}
        >
          {v.etiqueta}
        </Link>
      ))}
    </nav>
  );
}

function SelectorPeriodo({ vista, periodo }: { vista: Vista; periodo: Periodo }) {
  return (
    <form method="get" className="tarjeta mb-4 p-4">
      <input type="hidden" name="vista" value={vista} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(12rem,16rem)_minmax(0,11rem)_minmax(0,11rem)_auto] sm:items-end">
        <label className="campo">
          <span className="campo-etiqueta">Período</span>
          <select className="entrada" name="periodo" defaultValue={periodo.clave}>
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Desde</span>
          <input className="entrada" type="date" name="desde" defaultValue={periodo.desde} />
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Hasta</span>
          <input className="entrada" type="date" name="hasta" defaultValue={periodo.hasta} />
        </label>
        <button type="submit" className="boton boton-secundario">
          Ver
        </button>
      </div>
      <p className="mt-2 text-sm texto-tenue">
        Período: <span className="font-medium" data-periodo>{describirPeriodo(periodo)}</span>, ambos días incluidos (hora de
        Tegucigalpa). Las fechas solo se usan con «Rango personalizado».
      </p>
    </form>
  );
}
