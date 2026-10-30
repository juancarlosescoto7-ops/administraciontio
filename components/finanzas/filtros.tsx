import Link from "next/link";
import { puedeEditar } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { registrarClienteDesde } from "@/lib/catalogos/acciones";
import { camposClienteNuevo, type Opcion } from "@/lib/catalogos/definiciones";
import { estadoInicial } from "@/lib/catalogos/estado";
import { primerValor } from "@/lib/catalogos/presentacion";
import { esFechaValida, limpiarBusqueda, valoresDesdeRegistro } from "@/lib/catalogos/validacion";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { FormularioCatalogo } from "@/components/catalogos/formulario-catalogo";
import { Dialogo } from "@/components/dialogo";
import { EstadoVacio } from "@/components/encabezado";
import { Plegable } from "@/components/plegable";

export type ParametrosBusqueda = Promise<Record<string, string | string[] | undefined>>;

export type Filtros = { busqueda: string; estado: string; desde: string | null; hasta: string | null };

/** Lee y sanea los filtros de un listado (búsqueda, estado y rango de fechas). */
export function leerFiltros(
  parametros: Record<string, string | string[] | undefined>,
  estados: readonly Opcion[],
): Filtros {
  const estado = primerValor(parametros.estado);
  const fecha = (valor: string | undefined) => (valor && esFechaValida(valor) ? valor : null);
  return {
    busqueda: limpiarBusqueda(primerValor(parametros.q)),
    estado: estados.some((opcion) => opcion.valor === estado) ? estado! : estados[0].valor,
    desde: fecha(primerValor(parametros.desde)),
    hasta: fecha(primerValor(parametros.hasta)),
  };
}

export function FormularioFiltros({
  filtros,
  estados,
  placeholder,
  fechas = true,
  extras = [],
}: {
  filtros: Filtros;
  estados: readonly Opcion[];
  placeholder: string;
  /** Rango de fechas desde/hasta. */
  fechas?: boolean;
  /** Selectores adicionales (p. ej., tipo de servicio). */
  extras?: readonly { nombre: string; etiqueta: string; opciones: readonly Opcion[]; valor: string }[];
}) {
  // Filtros secundarios (tipo y fechas): plegados, salvo que alguno esté aplicado.
  const activos =
    extras.filter((extra) => extra.valor !== extra.opciones[0]?.valor).length +
    (fechas && filtros.desde ? 1 : 0) +
    (fechas && filtros.hasta ? 1 : 0);
  // Todo el buscador queda en una barra; se abre solo si hay algo aplicado.
  const aplicados = activos + (filtros.busqueda ? 1 : 0) + (filtros.estado !== estados[0].valor ? 1 : 0);
  return (
    <Plegable
      titulo="Buscar y filtrar"
      resumen={aplicados === 0 ? "Sin filtros aplicados" : aplicados === 1 ? "1 filtro aplicado" : `${aplicados} filtros aplicados`}
      abierta={aplicados > 0}
    >
      <form method="get" className="tarjeta p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_auto] sm:items-end">
          <label className="campo">
            <span className="campo-etiqueta">Buscar</span>
            <input className="entrada" type="search" name="q" defaultValue={filtros.busqueda} placeholder={placeholder} />
          </label>
          <label className="campo">
            <span className="campo-etiqueta">Estado</span>
            <select className="entrada" name="estado" defaultValue={filtros.estado}>
              {estados.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="boton boton-secundario">
            Filtrar
          </button>
        </div>
        {(fechas || extras.length > 0) && (
          <details className="desplegable mt-2" open={activos > 0}>
            <summary className="w-fit justify-start text-sm font-medium text-enlace">
              Más filtros{activos > 0 ? ` · ${activos === 1 ? "1 aplicado" : `${activos} aplicados`}` : ""}
            </summary>
            <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {extras.map((extra) => (
                <label key={extra.nombre} className="campo">
                  <span className="campo-etiqueta">{extra.etiqueta}</span>
                  <select className="entrada" name={extra.nombre} defaultValue={extra.valor}>
                    {extra.opciones.map((opcion) => (
                      <option key={opcion.valor} value={opcion.valor}>
                        {opcion.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {fechas && (
                <>
                  <label className="campo">
                    <span className="campo-etiqueta">Desde</span>
                    <input className="entrada" type="date" name="desde" defaultValue={filtros.desde ?? ""} />
                  </label>
                  <label className="campo">
                    <span className="campo-etiqueta">Hasta</span>
                    <input className="entrada" type="date" name="hasta" defaultValue={filtros.hasta ?? ""} />
                  </label>
                </>
              )}
            </div>
          </details>
        )}
      </form>
    </Plegable>
  );
}

/**
 * Primer paso de servicios, membresías, cobros y cargos: elegir el cliente o,
 * si no existe, registrarlo en una ventana flotante sin salir de la pantalla.
 */
export async function BuscarCliente({ ruta, busqueda }: { ruta: string; busqueda: string }) {
  const [usuario, supabase] = await Promise.all([requerirUsuario(), createClient()]);
  let consulta = supabase.from("clientes").select("id, nombre, identificacion").eq("activo", true).order("nombre").limit(30);
  if (busqueda) consulta = consulta.or(`nombre.ilike."%${busqueda}%",identificacion.ilike."%${busqueda}%"`);
  const { data: clientes } = await consulta;
  const campos = camposClienteNuevo();

  return (
    <div className="flex flex-col gap-4">
      <div className="tarjeta flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <form method="get" className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <label className="campo flex-1">
            <span className="campo-etiqueta">Cliente</span>
            <input className="entrada" type="search" name="q" defaultValue={busqueda} placeholder="Nombre o identificación…" autoFocus />
          </label>
          <button type="submit" className="boton boton-secundario">
            Buscar
          </button>
        </form>
        {/* Fuera del formulario de búsqueda: un formulario no puede contener otro. */}
        {puedeEditar("clientes", usuario.rol) && (
          <Dialogo
            titulo="Registrar cliente nuevo"
            textoBoton="Cliente nuevo"
            descripcion="Al guardarlo se elige para continuar con esta operación."
            icono="mas"
          >
            <FormularioCatalogo
              campos={campos}
              accion={registrarClienteDesde.bind(null, ruta)}
              estadoInicial={estadoInicial(valoresDesdeRegistro({ campos }, null))}
              textoEnviar="Registrar y continuar"
              rutaCancelar={null}
              rutaBase="/clientes"
              hoy={hoyEnTegucigalpa()}
              prefijo="nuevo-cliente-"
            />
          </Dialogo>
        )}
      </div>
      {clientes?.length ? (
        <ul className="tarjeta divide-y divide-[var(--borde)] overflow-hidden">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link href={`${ruta}?cliente=${cliente.id}`} className="fila-enlace flex flex-col px-4 py-3">
                <span className="font-medium">{cliente.nombre}</span>
                {cliente.identificacion && <span className="text-sm texto-tenue">{cliente.identificacion}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVacio mensaje="No hay clientes activos que coincidan." />
      )}
    </div>
  );
}
