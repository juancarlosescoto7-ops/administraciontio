import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { accesosRapidos } from "@/lib/accesos";
import { puede, type ClaveCatalogo } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { ejemplosPara, opcionesFijas } from "@/lib/busqueda/intencion";
import { gruposNavegacion } from "@/lib/navegacion";
import { ESTADOS_ACTIVOS, type EstadoTraslado } from "@/lib/ambulancias/definiciones";
import { ESTADOS_ACTIVOS_TRANSPORTE } from "@/lib/transportes/definiciones";
import { CATALOGOS, OPCIONES_ESTADO_VEHICULO, OPCIONES_TIPO_VEHICULO } from "@/lib/catalogos/definiciones";
import { tablaCatalogo } from "@/lib/catalogos/tabla";
import { ETIQUETAS_METODO } from "@/lib/finanzas/definiciones";
import { sumarMontos } from "@/lib/finanzas/montos";
import {
  aFechaHoraLocal,
  formatearFecha,
  formatearMoneda,
  hoyEnTegucigalpa,
  momentoDesdeLocal,
} from "@/lib/formato";
import { inicioUltimosDias, ordenarProximos, recorrido, serieUltimosDias, type ServicioProximo } from "@/lib/panel";
import { describirPeriodo, resolverPeriodo } from "@/lib/reportes/periodo";
import { createClient } from "@/lib/supabase/server";
import { BuscadorInicio } from "@/components/buscador";
import { InsigniaFinanciera } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";
import { ActualizarAlAbrir } from "@/components/membresias/actualizar";
import {
  BandaAccesos,
  EsqueletoPanel,
  GraficoColumnas,
  GrupoCajas,
  IconoTono,
  LineaTiempo,
  ListaAtencion,
  NO_DISPONIBLE,
  Seccion,
  TarjetaIndicador,
  TarjetaModulo,
} from "@/components/panel";

const ORDEN_PANEL: ClaveCatalogo[] = [
  "clientes",
  "beneficiarios",
  "vehiculos",
  "conductores",
  "proveedores",
  "planes",
  "tarifas",
  "cuentas_dinero",
];

const LIMITE_PROXIMOS = 6;
const LIMITE_VEHICULOS = 5;

const CLASE_ESTADO_VEHICULO: Record<string, string> = {
  operativo: "insignia-activo",
  mantenimiento: "insignia-advertencia",
  fuera_servicio: "insignia-inactivo",
};
const ETIQUETA_ESTADO_VEHICULO = Object.fromEntries(OPCIONES_ESTADO_VEHICULO.map((o) => [o.valor, o.etiqueta]));
const ETIQUETA_TIPO_VEHICULO = Object.fromEntries(OPCIONES_TIPO_VEHICULO.map((o) => [o.valor, o.etiqueta]));

/** Filas de una consulta, o null si falló (para no mostrar 0 en lugar de un error). */
function filas<T>(resultado: { data: T[] | null; error: unknown } | null): T[] | null {
  return resultado && !resultado.error ? (resultado.data ?? []) : null;
}

function contar<T>(lista: T[] | null, filtro: (fila: T) => boolean): number | null {
  return lista ? lista.filter(filtro).length : null;
}

function texto(valor: number | null): string {
  return valor === null ? NO_DISPONIBLE : String(valor);
}

function plural(cantidad: number, singular: string, varios: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`;
}

function monto(lista: (number | string | null)[] | null): string {
  return lista ? formatearMoneda(sumarMontos(lista)) : NO_DISPONIBLE;
}

// Orden de uso: accesos rápidos, indicadores y después las cajas agrupadas
// (operación, finanzas y, al final, configuración, que se consulta menos).

export default function Panel() {
  return (
    <Suspense fallback={<EsqueletoPanel />}>
      <ContenidoPanel />
    </Suspense>
  );
}

async function ContenidoPanel() {
  const usuario = await requerirUsuario();
  const supabase = await createClient();
  const rol = usuario.rol;

  const tesoreria = puede("verTesoreria", rol);
  const hoy = hoyEnTegucigalpa();
  const mesActual = resolverPeriodo({}, hoy);
  const ahora = new Date();
  const enUnaSemana = new Date(ahora.getTime() + 7 * 86_400_000);
  const inicioHoy = momentoDesdeLocal(`${hoy}T00:00`);
  const finHoy = momentoDesdeLocal(`${hoy}T23:59`);
  const [
    conteos,
    clientes,
    gastos,
    cuentas,
    membresias,
    traslados,
    alquileres,
    transportes,
    transportesSolicitados,
    vehiculos,
    proximosTraslados,
    proximosTransportes,
    proximasEntregas,
    proximasDevoluciones,
    cobros,
    cobrosSemana,
    resultadoMes,
  ] = await Promise.all([
    Promise.all(
      ORDEN_PANEL.map(async (clave) => {
        const { count, error } = await tablaCatalogo(supabase, CATALOGOS[clave].tabla)
          .select("id", { count: "exact", head: true })
          .eq("activo", true);
        return { clave, total: error ? null : (count ?? 0) };
      }),
    ),
    supabase.from("saldos_clientes").select("pendiente, saldo_a_favor"),
    tesoreria ? supabase.from("saldos_gastos").select("pendiente").eq("estado", "registrado").gt("pendiente", 0) : null,
    tesoreria ? supabase.from("saldos_cuentas_dinero").select("saldo") : null,
    supabase.from("saldos_membresias").select("estado, vencido, cuotas_vencidas").neq("estado", "cancelada"),
    // Activos más los programados para hoy (aunque ya terminaran).
    supabase
      .from("traslados_ambulancia")
      .select("estado, inicio_previsto, vehiculo_id, conductor_id, condicion_cobertura")
      .or(`estado.in.(solicitado,programado,en_curso),and(inicio_previsto.gte.${inicioHoy},inicio_previsto.lte.${finHoy})`),
    supabase.from("alquileres").select("estado, entrega_prevista, devolucion_prevista").in("estado", ["reservado", "entregado"]),
    supabase
      .from("transportes")
      .select("estado, inicio_previsto")
      .or(`estado.eq.en_curso,and(inicio_previsto.gte.${inicioHoy},inicio_previsto.lte.${finHoy})`),
    supabase.from("transportes").select("id", { count: "exact", head: true }).eq("estado", "solicitado"),
    supabase.from("vehiculos").select("id, codigo, marca, modelo, tipo, estado").eq("activo", true).order("codigo"),
    // Servicios sin terminar más cercanos de cada módulo (los atrasados quedan primero).
    supabase
      .from("saldos_traslados")
      .select("id, inicio_previsto, cliente_nombre, origen, destino, vehiculo_codigo, estado")
      .in("estado", ESTADOS_ACTIVOS as EstadoTraslado[])
      .order("inicio_previsto", { ascending: true })
      .limit(LIMITE_PROXIMOS),
    supabase
      .from("saldos_transportes")
      .select("id, inicio_previsto, cliente_nombre, origen, destino, vehiculo_codigo, estado")
      .in("estado", [...ESTADOS_ACTIVOS_TRANSPORTE])
      .order("inicio_previsto", { ascending: true })
      .limit(LIMITE_PROXIMOS),
    supabase
      .from("saldos_alquileres")
      .select("id, entrega_prevista, cliente_nombre, vehiculo_codigo, estado")
      .eq("estado", "reservado")
      .order("entrega_prevista", { ascending: true })
      .limit(LIMITE_PROXIMOS),
    supabase
      .from("saldos_alquileres")
      .select("id, devolucion_prevista, cliente_nombre, vehiculo_codigo, estado")
      .eq("estado", "entregado")
      .order("devolucion_prevista", { ascending: true })
      .limit(LIMITE_PROXIMOS),
    supabase
      .from("saldos_cobros")
      .select("id, fecha, cliente_nombre, metodo, monto, estado")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    // Cobros confirmados (sin reversados) por fecha del cobro, últimos 7 días.
    supabase
      .from("saldos_cobros")
      .select("fecha, monto")
      .eq("estado", "confirmado")
      .gte("fecha", inicioUltimosDias(hoy))
      .lte("fecha", hoy),
    // Resultado del mes en curso (mismo cálculo que /reportes).
    tesoreria ? supabase.rpc("reporte_resumen", { p_desde: mesActual.desde, p_hasta: mesActual.hasta }).single() : null,
  ]);

  // --- Operación -------------------------------------------------------
  const filasTraslados = filas(traslados);
  const sinIniciar = (estado: string | null) => estado === "solicitado" || estado === "programado";
  const trasladosHoy = contar(filasTraslados, (t) => t.estado !== "cancelado" && aFechaHoraLocal(t.inicio_previsto).startsWith(hoy));
  const trasladosEnCurso = contar(filasTraslados, (t) => t.estado === "en_curso");
  const trasladosSolicitados = contar(filasTraslados, (t) => t.estado === "solicitado");

  const filasAlquileres = filas(alquileres);
  const alquilados = contar(filasAlquileres, (a) => a.estado === "entregado");
  const entregasSemana = contar(filasAlquileres, (a) => a.estado === "reservado" && new Date(a.entrega_prevista) <= enUnaSemana);
  const devolucionesVencidas = contar(filasAlquileres, (a) => a.estado === "entregado" && new Date(a.devolucion_prevista) < ahora);

  const filasTransportes = filas(transportes);
  const transportesHoy = contar(filasTransportes, (t) => t.estado !== "cancelado" && aFechaHoraLocal(t.inicio_previsto).startsWith(hoy));
  const transportesEnCurso = contar(filasTransportes, (t) => t.estado === "en_curso");
  const solicitudesTransporte = transportesSolicitados.error ? null : (transportesSolicitados.count ?? 0);

  const filasMembresias = filas(membresias);
  const membresiasActivas = contar(filasMembresias, (m) => m.estado === "activa");
  const membresiasSuspendidas = contar(filasMembresias, (m) => m.estado === "suspendida");
  const cuotasVencidas = filasMembresias ? filasMembresias.reduce((suma, m) => suma + (m.cuotas_vencidas ?? 0), 0) : null;
  const importeVencido = filasMembresias ? sumarMontos(filasMembresias.map((m) => m.vencido)) : null;

  const sinRecursos = contar(filasTraslados, (t) => sinIniciar(t.estado) && (!t.vehiculo_id || !t.conductor_id));
  const sinCobertura = contar(
    filasTraslados,
    (t) => sinIniciar(t.estado) && t.condicion_cobertura !== null && t.condicion_cobertura !== "valida",
  );

  const atencion = [
    { etiqueta: "Solicitudes de traslado sin programar", cantidad: trasladosSolicitados, href: "/ambulancias?estado=solicitado" },
    { etiqueta: "Pendientes sin ambulancia o conductor", cantidad: sinRecursos, href: "/ambulancias?estado=activos" },
    { etiqueta: "Cubiertos sin cobertura válida", cantidad: sinCobertura, href: "/ambulancias?estado=activos&tipo=cubierto" },
    { etiqueta: "Solicitudes de transporte sin programar", cantidad: solicitudesTransporte, href: "/transportes?estado=solicitado" },
    { etiqueta: "Devoluciones vencidas", cantidad: devolucionesVencidas, href: "/alquileres?estado=entregado" },
    { etiqueta: "Suspendidas por morosidad", cantidad: membresiasSuspendidas, href: "/membresias?estado=suspendida" },
    { etiqueta: "Cuotas vencidas", cantidad: cuotasVencidas, href: "/membresias?estado=todas" },
  ].map((elemento) => ({ ...elemento, valor: texto(elemento.cantidad) }));
  atencion.push({
    etiqueta: "Importe vencido de cuotas",
    cantidad: importeVencido === null ? null : Number(importeVencido),
    valor: importeVencido === null ? NO_DISPONIBLE : formatearMoneda(importeVencido),
    href: "/membresias?estado=todas",
  });

  const errorProximos = [proximosTraslados, proximosTransportes, proximasEntregas, proximasDevoluciones].some((r) => r.error);
  const proximos = ordenarProximos(
    [
      (proximosTraslados.data ?? []).flatMap((t): ServicioProximo[] =>
        t.id && t.inicio_previsto
          ? [{ tipo: "traslado", id: t.id, momento: t.inicio_previsto, cliente: t.cliente_nombre, detalle: recorrido(t.origen, t.destino), codigo: t.vehiculo_codigo, estado: t.estado, href: `/ambulancias/${t.id}` }]
          : [],
      ),
      (proximosTransportes.data ?? []).flatMap((t): ServicioProximo[] =>
        t.id && t.inicio_previsto
          ? [{ tipo: "transporte", id: t.id, momento: t.inicio_previsto, cliente: t.cliente_nombre, detalle: recorrido(t.origen, t.destino), codigo: t.vehiculo_codigo, estado: t.estado, href: `/transportes/${t.id}` }]
          : [],
      ),
      (proximasEntregas.data ?? []).flatMap((a): ServicioProximo[] =>
        a.id && a.entrega_prevista
          ? [{ tipo: "entrega", id: a.id, momento: a.entrega_prevista, cliente: a.cliente_nombre, detalle: null, codigo: a.vehiculo_codigo, estado: a.estado, href: `/alquileres/${a.id}` }]
          : [],
      ),
      (proximasDevoluciones.data ?? []).flatMap((a): ServicioProximo[] =>
        a.id && a.devolucion_prevista
          ? [{ tipo: "devolucion", id: a.id, momento: a.devolucion_prevista, cliente: a.cliente_nombre, detalle: null, codigo: a.vehiculo_codigo, estado: a.estado, href: `/alquileres/${a.id}` }]
          : [],
      ),
    ],
    LIMITE_PROXIMOS,
  );

  // --- Finanzas y flota -----------------------------------------------
  const filasCobrosSemana = filas(cobrosSemana);
  const serieCobros = filasCobrosSemana ? serieUltimosDias(filasCobrosSemana, hoy) : null;
  const cobradoHoy = serieCobros ? formatearMoneda(serieCobros[serieCobros.length - 1].total) : NO_DISPONIBLE;

  const filasClientes = filas(clientes);
  const indicadoresFinanzas = [
    { etiqueta: "Por cobrar (CxC)", valor: monto(filasClientes && filasClientes.map((c) => c.pendiente)), href: "/finanzas/pendientes" },
    { etiqueta: "Saldos a favor de clientes", valor: monto(filasClientes && filasClientes.map((c) => c.saldo_a_favor)), href: "/finanzas/pendientes" },
    ...(tesoreria
      ? [
          { etiqueta: "Por pagar (CxP)", valor: monto(filas(gastos)?.map((g) => g.pendiente) ?? null), href: "/finanzas/pendientes" },
          { etiqueta: "Dinero disponible", valor: monto(filas(cuentas)?.map((c) => c.saldo) ?? null), href: "/finanzas/cuentas" },
        ]
      : []),
  ];

  const filasVehiculos = filas(vehiculos);
  const operativos = contar(filasVehiculos, (v) => v.estado === "operativo");

  // --- Acciones disponibles para el rol ----------------------------------
  const accesos = accesosRapidos(rol);

  return (
    <>
      <ActualizarAlAbrir />

      {/* Sin cabecera visible: el buscador abre la página. */}
      <h1 className="sr-only">Inicio</h1>

      {/* Bloques a todo el ancho: buscador, accesos rápidos y después lo demás. */}
      <BuscadorInicio fijas={opcionesFijas(gruposNavegacion(rol), accesos)} ejemplos={ejemplosPara(rol)} />

      {accesos.length > 0 && <BandaAccesos accesos={accesos} />}

      <section aria-labelledby="titulo-indicadores" className="mt-4">
        <h2 id="titulo-indicadores" className="sr-only">
          Indicadores de operación
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li className="aparecer" style={{ "--orden": 2 } as CSSProperties}>
            <TarjetaIndicador
              etiqueta="Cobrado hoy"
              valor={cobradoHoy}
              periodo="Cobros confirmados con fecha de hoy"
              href="/finanzas/cobros"
              icono="dinero"
              tono="verde"
            />
          </li>
          <li className="aparecer" style={{ "--orden": 3 } as CSSProperties}>
            <TarjetaIndicador
              etiqueta="Traslados de hoy"
              valor={texto(trasladosHoy)}
              periodo="Programados para hoy, sin cancelados"
              detalle={trasladosEnCurso === null ? undefined : `${trasladosEnCurso} en curso ahora`}
              href={`/ambulancias?estado=todos&desde=${hoy}&hasta=${hoy}`}
              icono="servicios"
              tono="azul"
            />
          </li>
          <li className="aparecer" style={{ "--orden": 4 } as CSSProperties}>
            <TarjetaIndicador
              etiqueta="Vehículos alquilados ahora"
              valor={texto(alquilados)}
              periodo="Alquileres entregados sin devolver"
              detalle={entregasSemana === null ? undefined : `${plural(entregasSemana, "entrega", "entregas")} en 7 días`}
              href="/alquileres?estado=entregado"
              icono="llave"
              tono="morado"
            />
          </li>
          <li className="aparecer" style={{ "--orden": 5 } as CSSProperties}>
            <TarjetaIndicador
              etiqueta="Membresías activas"
              valor={texto(membresiasActivas)}
              periodo="Estado actual de las membresías"
              detalle={membresiasSuspendidas === null ? undefined : `${plural(membresiasSuspendidas, "suspendida", "suspendidas")} por morosidad`}
              href="/membresias?estado=activa"
              icono="membresia"
              tono="naranja"
            />
          </li>
        </ul>
      </section>

      <GrupoCajas id="operacion" titulo="Operación del día" orden={6}>
        <Seccion id="atencion" titulo="Requiere atención" descripcion="Casos que esperan una acción">
          <ListaAtencion elementos={atencion} />
        </Seccion>
        <Seccion
          id="proximos"
          titulo="Próximos servicios"
          descripcion="Sin terminar, por hora prevista"
          enlace={{ href: "/ambulancias", etiqueta: "Ver traslados" }}
        >
          <LineaTiempo servicios={proximos} hoy={hoy} ahora={ahora} error={errorProximos} />
        </Seccion>
        <Seccion id="modulos" titulo="Resumen por servicio" descripcion="Ambulancias, alquileres y transporte" sinTarjeta>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <TarjetaModulo
              titulo="Ambulancias"
              descripcion="Traslados médicos"
              icono="servicios"
              tono="azul"
              cifras={[
                { etiqueta: "En curso ahora", valor: texto(trasladosEnCurso), href: "/ambulancias?estado=en_curso" },
                { etiqueta: "Sin programar", valor: texto(trasladosSolicitados), href: "/ambulancias?estado=solicitado" },
              ]}
              href="/ambulancias"
              etiquetaEnlace="Ver traslados"
            />
            <TarjetaModulo
              titulo="Alquiler de vehículos"
              descripcion="Reservas y contratos"
              icono="llave"
              tono="verde"
              cifras={[
                { etiqueta: "Entregas en 7 días", valor: texto(entregasSemana), href: "/alquileres?estado=reservado" },
                { etiqueta: "Devoluciones vencidas", valor: texto(devolucionesVencidas), href: "/alquileres?estado=entregado" },
              ]}
              href="/alquileres"
              etiquetaEnlace="Ver alquileres"
            />
            <TarjetaModulo
              titulo="Transporte con conductor"
              descripcion="Servicios con chofer"
              icono="flota"
              tono="morado"
              cifras={[
                { etiqueta: "Transportes de hoy", valor: texto(transportesHoy), href: `/transportes?estado=todos&desde=${hoy}&hasta=${hoy}` },
                { etiqueta: "En curso ahora", valor: texto(transportesEnCurso), href: "/transportes?estado=en_curso" },
              ]}
              href="/transportes"
              etiquetaEnlace="Ver transportes"
            />
          </div>
        </Seccion>
        <Seccion
          id="flota"
          titulo="Estado de vehículos"
          descripcion={operativos === null || !filasVehiculos ? undefined : `${operativos} operativos de ${filasVehiculos.length} activos`}
          enlace={{ href: "/vehiculos", etiqueta: "Ver todos" }}
        >
          {filasVehiculos === null ? (
            <p role="alert" className="aviso aviso-error mx-5 mb-5">No se pudo consultar la flota.</p>
          ) : filasVehiculos.length === 0 ? (
            <p className="px-5 pb-6 texto-tenue">No hay vehículos activos registrados.</p>
          ) : (
            <ul className="flex flex-col px-3 pb-3">
              {filasVehiculos.slice(0, LIMITE_VEHICULOS).map((vehiculo) => (
                <li key={vehiculo.id}>
                  <Link href={`/vehiculos/${vehiculo.id}`} className="fila-enlace flex items-center gap-3 rounded-lg px-2 py-2">
                    <IconoTono icono={vehiculo.tipo === "ambulancia" ? "servicios" : "flota"} tono="azul" className="size-10" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold">{vehiculo.codigo}</span>
                      <span className="truncate text-xs texto-tenue">
                        {[ETIQUETA_TIPO_VEHICULO[vehiculo.tipo], [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className={`insignia ${CLASE_ESTADO_VEHICULO[vehiculo.estado]}`}>{ETIQUETA_ESTADO_VEHICULO[vehiculo.estado]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      </GrupoCajas>

      <GrupoCajas id="finanzas" titulo="Finanzas" orden={7}>
        <Seccion id="saldos" titulo="Saldos" descripcion="Saldos a la fecha">
          <ul className="grid grid-cols-1 gap-1 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-4">
            {indicadoresFinanzas.map((indicador, indice) => (
              <li key={indicador.etiqueta} className={indice > 0 ? "lg:border-l lg:border-borde lg:pl-1" : ""}>
                <Link href={indicador.href} className="fila-enlace flex h-full flex-col justify-center gap-1 rounded-lg px-3 py-2.5">
                  <span className="text-sm texto-tenue">{indicador.etiqueta}</span>
                  <span className="text-lg font-bold tracking-tight">{indicador.valor}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Seccion>
        <Seccion
          id="cobros-semana"
          titulo="Cobros de los últimos 7 días"
          descripcion="Cobros confirmados por fecha, en lempiras"
          enlace={{ href: "/finanzas/cobros", etiqueta: "Ver cobros" }}
        >
          {serieCobros ? (
            <GraficoColumnas serie={serieCobros} descripcion="Cobros confirmados por día" />
          ) : (
            <p role="alert" className="aviso aviso-error mx-5 mb-5">No se pudieron cargar los cobros.</p>
          )}
        </Seccion>
        {resultadoMes && (
          <Seccion
            id="resultado-mes"
            titulo="Resultado del mes"
            descripcion={describirPeriodo(mesActual)}
            enlace={{ href: "/reportes", etiqueta: "Ver reportes" }}
          >
            {resultadoMes.error || !resultadoMes.data ? (
              <p role="alert" className="aviso aviso-error mx-5 mb-5">No se pudo calcular el resultado del mes.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-1 px-3 pb-1 sm:grid-cols-3">
                {[
                  { etiqueta: "Ingresos reconocidos", valor: resultadoMes.data.ingresos },
                  { etiqueta: "Gastos reconocidos", valor: resultadoMes.data.gastos },
                  { etiqueta: "Resultado operativo básico", valor: resultadoMes.data.resultado },
                ].map((cifra, indice) => (
                  <li key={cifra.etiqueta} className={`flex flex-col gap-1 px-3 py-2.5 ${indice > 0 ? "sm:border-l sm:border-borde" : ""}`}>
                    <span className="text-sm texto-tenue">{cifra.etiqueta}</span>
                    <span className="text-lg font-bold tracking-tight">{formatearMoneda(cifra.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mx-5 mb-2 text-xs texto-tenue">Informe gerencial; no es utilidad fiscal. Los cobros del mes no son ingresos.</p>
          </Seccion>
        )}
        <Seccion
          id="cobros"
          titulo="Cobros recientes"
          descripcion="Últimos cinco registrados"
          enlace={{ href: "/finanzas/cobros", etiqueta: "Ver todos" }}
        >
          {cobros.error ? (
            <p role="alert" className="aviso aviso-error mx-5 mb-5">No se pudieron cargar los cobros.</p>
          ) : (
            <div className="tabla-incrustada">
              <Tabla
                filas={(cobros.data ?? []).flatMap((cobro) => (cobro.id ? [{ ...cobro, id: cobro.id }] : []))}
                vacio="Aún no hay cobros registrados."
                enlace={(cobro) => `/finanzas/cobros/${cobro.id}`}
                columnas={[
                  { clave: "cliente", etiqueta: "Cliente", celda: (c) => c.cliente_nombre ?? "—" },
                  { clave: "fecha", etiqueta: "Fecha", celda: (c) => formatearFecha(c.fecha) },
                  { clave: "metodo", etiqueta: "Método", celda: (c) => (c.metodo ? ETIQUETAS_METODO[c.metodo] : "—") },
                  { clave: "monto", etiqueta: "Importe", celda: (c) => formatearMoneda(c.monto), numerica: true },
                  { clave: "estado", etiqueta: "Estado", celda: (c) => <InsigniaFinanciera estado={c.estado} /> },
                ]}
              />
            </div>
          )}
        </Seccion>
      </GrupoCajas>

      <GrupoCajas id="configuracion" titulo="Configuración" orden={8}>
        <Seccion id="catalogos" titulo="Catálogos" descripcion="Registros activos por catálogo">
          <ul className="grid grid-cols-2 gap-1 px-3 py-3">
            {conteos.map(({ clave, total }) => {
              const def = CATALOGOS[clave];
              return (
                <li key={clave}>
                  <Link href={def.ruta} className="fila-enlace flex flex-col gap-0.5 rounded-lg px-3 py-2.5">
                    <span className="text-sm font-medium">{def.titulo}</span>
                    <span className="text-xs texto-tenue tabular-nums">
                      {total === null ? NO_DISPONIBLE : `${total} ${total === 1 ? "activo" : "activos"}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Seccion>
      </GrupoCajas>
    </>
  );
}
