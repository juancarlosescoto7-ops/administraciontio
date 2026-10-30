// Pantallas del lapso armadas con los componentes reales del ERP y datos ficticios.
// Sin consultas, sesión ni acciones: solo presentación.
import type { CSSProperties, ReactNode } from "react";
import { accesosRapidos } from "@/lib/accesos";
import { CATALOGOS } from "@/lib/catalogos/definiciones";
import { ejemplosPara, opcionesFijas } from "@/lib/busqueda/intencion";
import { ETIQUETAS_METODO } from "@/lib/finanzas/definiciones";
import { ESTADOS_MEMBRESIA } from "@/lib/membresias/definiciones";
import { ESTADOS_LISTADO, ETIQUETAS_TIPO_TRASLADO, TIPOS_LISTADO } from "@/lib/ambulancias/definiciones";
import { ESTADOS_LISTADO_ALQUILER, ETIQUETAS_ESTADO_ALQUILER } from "@/lib/alquileres/definiciones";
import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { gruposNavegacion } from "@/lib/navegacion";
import { serieUltimosDias, type ServicioProximo } from "@/lib/panel";
import { describirPeriodo, resolverPeriodo } from "@/lib/reportes/periodo";
import { InsigniaCobertura, InsigniaTraslado } from "@/components/ambulancias/insignias";
import { BuscadorInicio } from "@/components/buscador";
import { Encabezado, InsigniaEstado as InsigniaActivo } from "@/components/encabezado";
import { InsigniaEstado } from "@/components/operaciones";
import { FormularioFiltros } from "@/components/finanzas/filtros";
import { InsigniaFinanciera, ResumenImportes } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";
import { InsigniaMembresia } from "@/components/membresias/insignia";
import {
  BandaAccesos,
  GraficoColumnas,
  GrupoCajas,
  IconoTono,
  LineaTiempo,
  ListaAtencion,
  Seccion,
  TarjetaIndicador,
  TarjetaModulo,
} from "@/components/panel";
import { Plegable } from "@/components/plegable";

const ROL = "administrador";
const HOY = "2026-10-29";
const AHORA = new Date("2026-10-29T14:00:00Z");

export function menuDemo() {
  return gruposNavegacion(ROL);
}

const boton = (texto: string) => <span className="boton boton-primario">{texto}</span>;

/** Listado real de cada módulo, en el orden en que se construyeron. */
export function listadosDemo(): Record<"clientes" | "cobros" | "membresias" | "ambulancias" | "alquileres", ReactNode> {
  return {
    clientes: (
      <>
        <Encabezado titulo="Clientes" descripcion="Personas naturales y jurídicas que contratan servicios." acciones={boton("Nuevo cliente")} />
        <Plegable titulo="Buscar y filtrar" resumen="Sin filtros aplicados">
          <form className="tarjeta p-4">
            <label className="campo">
              <span className="campo-etiqueta">Buscar</span>
              <input className="entrada" type="search" placeholder="Buscar en clientes…" readOnly />
            </label>
          </form>
        </Plegable>
        <Tabla
          vacio=""
          enlace={() => "#"}
          filas={[
            { id: "1", nombre: "Ana Demo", tipo: "Persona natural", identificacion: "0801-1990-00001", telefono: "9988-7766" },
            { id: "2", nombre: "Clínica Modelo", tipo: "Persona jurídica", identificacion: "08019000000011", telefono: "2233-4455" },
            { id: "3", nombre: "Comercial Ejemplo S. de R.L.", tipo: "Persona jurídica", identificacion: "08019000000022", telefono: "2244-5566" },
            { id: "4", nombre: "Luis Muestra", tipo: "Persona natural", identificacion: "0801-1985-00002", telefono: "9877-6655" },
          ]}
          columnas={[
            { clave: "nombre", etiqueta: "Nombre", celda: (f) => f.nombre },
            { clave: "tipo", etiqueta: "Tipo", celda: (f) => f.tipo },
            { clave: "identificacion", etiqueta: "Identidad / RTN", celda: (f) => f.identificacion },
            { clave: "telefono", etiqueta: "Teléfono", celda: (f) => f.telefono },
            { clave: "activo", etiqueta: "Estado", celda: () => <InsigniaActivo activo /> },
          ]}
        />
      </>
    ),
    cobros: (
      <>
        <Encabezado titulo="Cobros" descripcion="Dinero recibido de clientes. Lo no aplicado a cargos queda como saldo a favor." acciones={boton("Registrar cobro")} />
        <FormularioFiltros filtros={{ busqueda: "", estado: "confirmado", desde: null, hasta: null }} estados={[{ valor: "confirmado", etiqueta: "Confirmados" }]} placeholder="Cliente o referencia…" />
        <Tabla
          vacio=""
          enlace={() => "#"}
          filas={[
            { id: "1", cliente: "Ana Demo", fecha: "2026-10-27", cuenta: "Caja general", metodo: "efectivo" as const, monto: 500, aplicado: 500 },
            { id: "2", cliente: "Luis Muestra", fecha: "2026-10-24", cuenta: "Banco de ejemplo", metodo: "transferencia" as const, monto: 800, aplicado: 650 },
          ]}
          columnas={[
            { clave: "cliente", etiqueta: "Cliente", celda: (f) => f.cliente },
            { clave: "fecha", etiqueta: "Fecha", celda: (f) => formatearFecha(f.fecha) },
            { clave: "cuenta", etiqueta: "Caja/banco", celda: (f) => f.cuenta },
            { clave: "metodo", etiqueta: "Método", celda: (f) => ETIQUETAS_METODO[f.metodo] },
            { clave: "monto", etiqueta: "Recibido", numerica: true, celda: (f) => formatearMoneda(f.monto) },
            { clave: "aplicado", etiqueta: "Aplicado", numerica: true, celda: (f) => formatearMoneda(f.aplicado) },
            { clave: "estado", etiqueta: "Estado", celda: () => <InsigniaFinanciera estado="confirmado" /> },
          ]}
        />
      </>
    ),
    membresias: listadoMembresias(),
    ambulancias: (
      <>
        <Encabezado titulo="Traslados de ambulancia" descripcion="Solicitudes, programación, ejecución y cobro de servicios cubiertos y particulares." acciones={boton("Nueva solicitud")} />
        <FormularioFiltros
          filtros={{ busqueda: "", estado: ESTADOS_LISTADO[0].valor, desde: null, hasta: null }}
          estados={ESTADOS_LISTADO}
          placeholder="Cliente, paciente, lugar, ambulancia…"
          extras={[{ nombre: "tipo", etiqueta: "Tipo", opciones: TIPOS_LISTADO, valor: TIPOS_LISTADO[0].valor }]}
        />
        <Tabla
          vacio=""
          enlace={() => "#"}
          filas={[
            { id: "1", inicio: "2026-10-29T16:30:00Z", cliente: "Ana Demo", paciente: "Ana Demo", tipo: "cubierto" as const, estado: "programado" as const, cobertura: "valida" as const, ambulancia: "AMB-01" },
            { id: "2", inicio: "2026-10-29T19:00:00Z", cliente: "Clínica Modelo", paciente: "Paciente de ejemplo", tipo: "particular" as const, estado: "solicitado" as const, cobertura: null, ambulancia: null },
          ]}
          columnas={[
            { clave: "fecha", etiqueta: "Fecha y hora", celda: (f) => formatearFechaHora(f.inicio) },
            { clave: "cliente", etiqueta: "Cliente", celda: (f) => f.cliente },
            { clave: "paciente", etiqueta: "Beneficiario o pasajero", celda: (f) => f.paciente },
            { clave: "tipo", etiqueta: "Tipo", celda: (f) => ETIQUETAS_TIPO_TRASLADO[f.tipo] },
            { clave: "estado", etiqueta: "Estado", celda: (f) => <InsigniaTraslado estado={f.estado} /> },
            { clave: "cobertura", etiqueta: "Cobertura", celda: (f) => <InsigniaCobertura condicion={f.cobertura} /> },
            { clave: "ambulancia", etiqueta: "Ambulancia", celda: (f) => f.ambulancia ?? "Sin asignar" },
          ]}
        />
      </>
    ),
    alquileres: (
      <>
        <Encabezado titulo="Alquileres de vehículos" descripcion="Reservas, entregas y devoluciones. El cargo se genera al devolver el vehículo." acciones={boton("Nueva reserva")} />
        <FormularioFiltros filtros={{ busqueda: "", estado: ESTADOS_LISTADO_ALQUILER[0].valor, desde: null, hasta: null }} estados={ESTADOS_LISTADO_ALQUILER} placeholder="Cliente o vehículo…" />
        <Tabla
          vacio=""
          enlace={() => "#"}
          filas={[
            { id: "1", cliente: "Comercial Ejemplo S. de R.L.", vehiculo: "VEH-02", entrega: "2026-10-28T15:00:00Z", estado: "entregado" as const, precio: 1500 },
            { id: "2", cliente: "Luis Muestra", vehiculo: "VEH-03", entrega: "2026-11-02T14:00:00Z", estado: "reservado" as const, precio: 2000 },
          ]}
          columnas={[
            { clave: "cliente", etiqueta: "Cliente", celda: (f) => f.cliente },
            { clave: "vehiculo", etiqueta: "Vehículo", celda: (f) => f.vehiculo },
            { clave: "entrega", etiqueta: "Entrega", celda: (f) => formatearFechaHora(f.entrega) },
            { clave: "estado", etiqueta: "Estado", celda: (f) => <InsigniaEstado estado={f.estado} etiquetas={ETIQUETAS_ESTADO_ALQUILER} finales={["devuelto", "cancelado"]} /> },
            { clave: "precio", etiqueta: "Precio", numerica: true, celda: (f) => formatearMoneda(f.precio) },
          ]}
        />
      </>
    ),
  };
}

function listadoMembresias() {
  return (
    <>
      <Encabezado
        titulo="Membresías"
        descripcion="Mensualidades de asistencia en ambulancia. Las cuotas se cobran desde Finanzas."
        acciones={<span className="boton boton-primario">Nueva membresía</span>}
      />
      <FormularioFiltros filtros={{ busqueda: "", estado: "activa", desde: null, hasta: null }} estados={ESTADOS_MEMBRESIA} placeholder="Cliente o plan…" fechas={false} />
      <Tabla
        vacio=""
        enlace={() => "#"}
        filas={[
          { id: "1", cliente: "Ana Demo", plan: "Plan familiar", renovacion: "2026-11-27", beneficiarios: 3, pendiente: 500, vencido: 0 },
          { id: "2", cliente: "Clínica Modelo", plan: "Plan empresarial", renovacion: "2026-11-05", beneficiarios: 12, pendiente: 2400, vencido: 0 },
          { id: "3", cliente: "Luis Muestra", plan: "Plan individual", renovacion: "2026-11-15", beneficiarios: 1, pendiente: 0, vencido: 0 },
        ]}
        columnas={[
          { clave: "cliente", etiqueta: "Cliente", celda: (f) => f.cliente },
          { clave: "plan", etiqueta: "Plan", celda: (f) => f.plan },
          { clave: "estado", etiqueta: "Estado", celda: () => <InsigniaMembresia estado="activa" /> },
          { clave: "renovacion", etiqueta: "Próxima renovación", celda: (f) => formatearFecha(f.renovacion) },
          { clave: "beneficiarios", etiqueta: "Beneficiarios", numerica: true, celda: (f) => f.beneficiarios },
          { clave: "pendiente", etiqueta: "Saldo pendiente", numerica: true, celda: (f) => formatearMoneda(f.pendiente) },
          { clave: "vencido", etiqueta: "Vencido", numerica: true, celda: (f) => formatearMoneda(f.vencido) },
        ]}
        totales={{ pendiente: formatearMoneda(2900), vencido: formatearMoneda(0) }}
      />
    </>
  );
}

const PROXIMOS = [
  { tipo: "transporte", id: "2", momento: "2026-10-29T15:00:00Z", cliente: "Luis Muestra", detalle: "Colonia Ejemplo → Aeropuerto", codigo: "VEH-01", estado: "en_curso", href: "#" },
  { tipo: "traslado", id: "1", momento: "2026-10-29T16:30:00Z", cliente: "Ana Demo", detalle: "Domicilio → Clínica Modelo", codigo: "AMB-01", estado: "programado", href: "#" },
  { tipo: "devolucion", id: "3", momento: "2026-10-31T15:00:00Z", cliente: "Comercial Ejemplo S. de R.L.", detalle: null, codigo: "VEH-02", estado: "entregado", href: "#" },
] as ServicioProximo[];

/** Igual que `Seccion` del panel, con la caja abierta a voluntad. */
function SeccionAbierta({ id, titulo, descripcion, abierta, children }: { id: string; titulo: string; descripcion: string; abierta: boolean; children: ReactNode }) {
  return (
    <Plegable titulo={titulo} resumen={descripcion} idTitulo={`titulo-${id}`} abierta={abierta}>
      <div className="tarjeta flex flex-col overflow-hidden pt-4">{children}</div>
    </Plegable>
  );
}

/** Cobro que se registra en la escena final de prueba (datos ficticios). */
const COBRO_PRUEBA = { cliente: "Clínica Modelo", pendiente: 2400, monto: 1200 };

/** Encabezado del formulario real «Registrar cobro» con el cliente ya elegido. */
export function resumenCobro() {
  return (
    <>
      <p className="mb-4">
        Cliente: <span className="font-medium text-enlace">{COBRO_PRUEBA.cliente}</span> · <span className="text-sm texto-tenue">cambiar</span>
      </p>
      <ResumenImportes
        importes={[
          { etiqueta: "Pendiente del cliente", valor: COBRO_PRUEBA.pendiente },
          { etiqueta: "Saldo a favor actual", valor: 0 },
        ]}
      />
    </>
  );
}

/**
 * Panel de inicio real. `grafico` despliega «Cobros de los últimos 7 días» y
 * `cobro` suma el cobro registrado en la escena de prueba.
 */
export function panelDemo({ grafico = false, cobro = false }: { grafico?: boolean; cobro?: boolean } = {}) {
  const grupos = gruposNavegacion(ROL);
  const accesos = accesosRapidos(ROL);
  const nuevo = cobro ? [{ id: "0", cliente_nombre: COBRO_PRUEBA.cliente, fecha: HOY, metodo: "transferencia" as const, monto: COBRO_PRUEBA.monto, estado: "confirmado" }] : [];
  const cobros = [
    ...nuevo,
    { id: "1", cliente_nombre: "Clínica Modelo", fecha: HOY, metodo: "transferencia" as const, monto: 1200, estado: "confirmado" },
    { id: "2", cliente_nombre: "Comercial Ejemplo S. de R.L.", fecha: HOY, metodo: "transferencia" as const, monto: 1500, estado: "confirmado" },
    { id: "3", cliente_nombre: "Luis Muestra", fecha: HOY, metodo: "efectivo" as const, monto: 800, estado: "confirmado" },
    { id: "4", cliente_nombre: "Ana Demo", fecha: "2026-10-27", metodo: "efectivo" as const, monto: 500, estado: "confirmado" },
    { id: "5", cliente_nombre: "Luis Muestra", fecha: "2026-10-24", metodo: "transferencia" as const, monto: 800, estado: "confirmado" },
  ];
  const cobradoHoy = cobros.filter((c) => c.fecha === HOY).reduce((suma, c) => suma + c.monto, 0);
  const catalogos: [keyof typeof CATALOGOS, number][] = [["clientes", 4], ["beneficiarios", 6], ["vehiculos", 3], ["conductores", 2], ["proveedores", 2], ["planes", 2], ["tarifas", 5], ["cuentas_dinero", 2]];
  const saldos = [
    { etiqueta: "Por cobrar (CxC)", valor: 1700 + COBRO_PRUEBA.pendiente - (cobro ? COBRO_PRUEBA.monto : 0) },
    { etiqueta: "Saldos a favor de clientes", valor: 150 },
    { etiqueta: "Por pagar (CxP)", valor: 950 },
    { etiqueta: "Dinero disponible", valor: 12300 + (cobro ? COBRO_PRUEBA.monto : 0) },
  ];
  return (
    <>
      <h1 className="sr-only">Inicio</h1>
      <BuscadorInicio fijas={opcionesFijas(grupos, accesos)} ejemplos={ejemplosPara(ROL)} />
      <BandaAccesos accesos={accesos} />
      <section className="mt-4">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <li className="aparecer" style={{ "--orden": 2 } as CSSProperties}>
            <TarjetaIndicador etiqueta="Cobrado hoy" valor={formatearMoneda(cobradoHoy)} periodo="Cobros confirmados con fecha de hoy" detalle={`${cobros.filter((c) => c.fecha === HOY).length} cobros confirmados`} href="#" icono="dinero" tono="verde" />
          </li>
          <li className="aparecer" style={{ "--orden": 3 } as CSSProperties}>
            <TarjetaIndicador etiqueta="Traslados de hoy" valor="2" periodo="Programados para hoy, sin cancelados" detalle="1 en curso ahora" href="#" icono="servicios" tono="azul" />
          </li>
          <li className="aparecer" style={{ "--orden": 4 } as CSSProperties}>
            <TarjetaIndicador etiqueta="Vehículos alquilados ahora" valor="1" periodo="Alquileres entregados sin devolver" detalle="1 entrega en 7 días" href="#" icono="llave" tono="morado" />
          </li>
          <li className="aparecer" style={{ "--orden": 5 } as CSSProperties}>
            <TarjetaIndicador etiqueta="Membresías activas" valor="3" periodo="Estado actual de las membresías" detalle="0 suspendidas por morosidad" href="#" icono="membresia" tono="naranja" />
          </li>
        </ul>
      </section>

      <GrupoCajas id="operacion" titulo="Operación del día" orden={6}>
        <Seccion id="atencion" titulo="Requiere atención" descripcion="Casos que esperan una acción">
          <ListaAtencion
            elementos={[
              { etiqueta: "Solicitudes de traslado sin programar", valor: "1", cantidad: 1, href: "#" },
              { etiqueta: "Solicitudes de transporte sin programar", valor: "1", cantidad: 1, href: "#" },
              { etiqueta: "Devoluciones vencidas", valor: "0", cantidad: 0, href: "#" },
            ]}
          />
        </Seccion>
        <Seccion id="proximos" titulo="Próximos servicios" descripcion="Sin terminar, por hora prevista">
          <LineaTiempo servicios={PROXIMOS} hoy={HOY} ahora={AHORA} error={false} />
        </Seccion>
        <Seccion id="modulos" titulo="Resumen por servicio" descripcion="Ambulancias, alquileres y transporte" sinTarjeta>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <TarjetaModulo titulo="Ambulancias" descripcion="Traslados médicos" icono="servicios" tono="azul" cifras={[{ etiqueta: "En curso ahora", valor: "1" }, { etiqueta: "Sin programar", valor: "1" }]} href="#" etiquetaEnlace="Ver traslados" />
            <TarjetaModulo titulo="Alquiler de vehículos" descripcion="Reservas y contratos" icono="llave" tono="verde" cifras={[{ etiqueta: "Entregas en 7 días", valor: "1" }, { etiqueta: "Devoluciones vencidas", valor: "0" }]} href="#" etiquetaEnlace="Ver alquileres" />
            <TarjetaModulo titulo="Transporte con conductor" descripcion="Servicios con chofer" icono="flota" tono="morado" cifras={[{ etiqueta: "Transportes de hoy", valor: "1" }, { etiqueta: "En curso ahora", valor: "1" }]} href="#" etiquetaEnlace="Ver transportes" />
          </div>
        </Seccion>
        <Seccion id="flota" titulo="Estado de vehículos" descripcion="3 operativos de 3 activos">
          <ul className="flex flex-col px-3 pb-3">
            {[["AMB-01", "Ambulancia · Toyota Hiace", "servicios"], ["VEH-01", "Microbús · Toyota Coaster", "flota"], ["VEH-02", "Automóvil · Nissan Sentra", "flota"]].map(([codigo, detalle, icono]) => (
              <li key={codigo}>
                <span className="fila-enlace flex items-center gap-3 rounded-lg px-2 py-2">
                  <IconoTono icono={icono as "flota"} tono="azul" className="size-10" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold">{codigo}</span>
                    <span className="truncate text-xs texto-tenue">{detalle}</span>
                  </span>
                  <span className="insignia insignia-activo">Operativo</span>
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
      </GrupoCajas>

      <GrupoCajas id="finanzas" titulo="Finanzas" orden={7}>
        <Seccion id="saldos" titulo="Saldos" descripcion="Saldos a la fecha">
          <ul className="grid grid-cols-1 gap-1 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-4">
            {saldos.map((saldo, indice) => (
              <li key={saldo.etiqueta} className={indice > 0 ? "lg:border-l lg:border-borde lg:pl-1" : ""}>
                <span className="fila-enlace flex h-full flex-col justify-center gap-1 rounded-lg px-3 py-2.5">
                  <span className="text-sm texto-tenue">{saldo.etiqueta}</span>
                  <span className="text-lg font-bold tracking-tight">{formatearMoneda(saldo.valor)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
        <SeccionAbierta id="cobros-semana" titulo="Cobros de los últimos 7 días" descripcion="Cobros confirmados por fecha, en lempiras" abierta={grafico}>
          <GraficoColumnas serie={serieUltimosDias(cobros, HOY)} descripcion="Cobros confirmados por día" />
        </SeccionAbierta>
        <Seccion id="resultado-mes" titulo="Resultado del mes" descripcion={describirPeriodo(resolverPeriodo({}, HOY))}>
          <ul className="grid grid-cols-1 gap-1 px-3 pb-1 sm:grid-cols-3">
            {[
              { etiqueta: "Ingresos reconocidos", valor: 6800 },
              { etiqueta: "Gastos reconocidos", valor: 2150 },
              { etiqueta: "Resultado operativo básico", valor: 4650 },
            ].map((cifra, indice) => (
              <li key={cifra.etiqueta} className={`flex flex-col gap-1 px-3 py-2.5 ${indice > 0 ? "sm:border-l sm:border-borde" : ""}`}>
                <span className="text-sm texto-tenue">{cifra.etiqueta}</span>
                <span className="text-lg font-bold tracking-tight">{formatearMoneda(cifra.valor)}</span>
              </li>
            ))}
          </ul>
        </Seccion>
        <Seccion id="cobros" titulo="Cobros recientes" descripcion="Últimos cinco registrados">
          <div className="tabla-incrustada">
            <Tabla
              filas={cobros.slice(0, 5)}
              vacio="Aún no hay cobros registrados."
              enlace={() => "#"}
              columnas={[
                { clave: "cliente", etiqueta: "Cliente", celda: (c) => c.cliente_nombre },
                { clave: "fecha", etiqueta: "Fecha", celda: (c) => formatearFecha(c.fecha) },
                { clave: "metodo", etiqueta: "Método", celda: (c) => ETIQUETAS_METODO[c.metodo] },
                { clave: "monto", etiqueta: "Importe", celda: (c) => formatearMoneda(c.monto), numerica: true },
                { clave: "estado", etiqueta: "Estado", celda: (c) => <InsigniaFinanciera estado={c.estado} /> },
              ]}
            />
          </div>
        </Seccion>
      </GrupoCajas>

      <GrupoCajas id="configuracion" titulo="Configuración" orden={8}>
        <Seccion id="catalogos" titulo="Catálogos" descripcion="Registros activos por catálogo">
          <ul className="grid grid-cols-2 gap-1 px-3 py-3">
            {catalogos.map(([clave, total]) => (
              <li key={clave}>
                <span className="fila-enlace flex flex-col gap-0.5 rounded-lg px-3 py-2.5">
                  <span className="text-sm font-medium">{CATALOGOS[clave].titulo}</span>
                  <span className="text-xs texto-tenue tabular-nums">{total} activos</span>
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
      </GrupoCajas>
    </>
  );
}
