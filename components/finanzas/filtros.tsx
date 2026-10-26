import Link from "next/link";
import type { Opcion } from "@/lib/catalogos/definiciones";
import { primerValor } from "@/lib/catalogos/presentacion";
import { esFechaValida, limpiarBusqueda } from "@/lib/catalogos/validacion";
import { createClient } from "@/lib/supabase/server";

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
}: {
  filtros: Filtros;
  estados: readonly Opcion[];
  placeholder: string;
}) {
  return (
    <form method="get" className="tarjeta mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
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
      <label className="campo">
        <span className="campo-etiqueta">Desde</span>
        <input className="entrada" type="date" name="desde" defaultValue={filtros.desde ?? ""} />
      </label>
      <label className="campo">
        <span className="campo-etiqueta">Hasta</span>
        <input className="entrada" type="date" name="hasta" defaultValue={filtros.hasta ?? ""} />
      </label>
      <button type="submit" className="boton boton-secundario">
        Filtrar
      </button>
    </form>
  );
}

/** Primer paso de cobros y cargos: elegir el cliente. */
export async function BuscarCliente({ ruta, busqueda }: { ruta: string; busqueda: string }) {
  const supabase = await createClient();
  let consulta = supabase.from("clientes").select("id, nombre, identificacion").eq("activo", true).order("nombre").limit(30);
  if (busqueda) consulta = consulta.or(`nombre.ilike."%${busqueda}%",identificacion.ilike."%${busqueda}%"`);
  const { data: clientes } = await consulta;

  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="tarjeta flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="campo flex-1">
          <span className="campo-etiqueta">Cliente</span>
          <input className="entrada" type="search" name="q" defaultValue={busqueda} placeholder="Nombre o identificación…" autoFocus />
        </label>
        <button type="submit" className="boton boton-secundario">
          Buscar
        </button>
      </form>
      {clientes?.length ? (
        <ul className="tarjeta divide-y divide-[var(--borde)]">
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link href={`${ruta}?cliente=${cliente.id}`} className="flex flex-col px-4 py-3 hover:bg-[var(--neutro-fondo)]">
                <span className="font-medium">{cliente.nombre}</span>
                {cliente.identificacion && <span className="text-sm texto-tenue">{cliente.identificacion}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tarjeta p-4 texto-tenue">No hay clientes activos que coincidan.</p>
      )}
    </div>
  );
}
