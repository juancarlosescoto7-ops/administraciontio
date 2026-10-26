import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puedeEditar, type ClaveCatalogo } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { guardarRegistro } from "@/lib/catalogos/acciones";
import { CATALOGOS, type DefinicionCatalogo } from "@/lib/catalogos/definiciones";
import { estadoInicial } from "@/lib/catalogos/estado";
import {
  buscarCampo,
  esUuid,
  leerFiltroEstado,
  mostrarValor,
  primerValor,
} from "@/lib/catalogos/presentacion";
import { tablaCatalogo, type Fila } from "@/lib/catalogos/tabla";
import { filtroBusqueda, limpiarBusqueda, valoresDesdeRegistro } from "@/lib/catalogos/validacion";
import { formatearFechaHora, hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, InsigniaEstado, SinPermiso } from "@/components/encabezado";
import { FormularioCatalogo } from "./formulario-catalogo";

type ParametrosBusqueda = Promise<Record<string, string | string[] | undefined>>;

const LIMITE_LISTADO = 200;

// Sesión, parámetros de la URL y datos son de tiempo de solicitud: van detrás de
// <Suspense> para que la navegación entre listado, alta y detalle sea inmediata.
export function PaginaListado({
  clave,
  searchParams,
}: {
  clave: ClaveCatalogo;
  searchParams: ParametrosBusqueda;
}) {
  const def = CATALOGOS[clave];
  return (
    <>
      <Encabezado
        titulo={def.titulo}
        descripcion={def.descripcion}
        acciones={
          <Suspense fallback={null}>
            <BotonNuevo def={def} />
          </Suspense>
        }
      />
      <Suspense fallback={<Cargando />}>
        <ContenidoListado def={def} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BotonNuevo({ def }: { def: DefinicionCatalogo }) {
  const usuario = await requerirUsuario();
  if (!puedeEditar(def.clave, usuario.rol)) return null;
  return (
    <Link href={`${def.ruta}/nuevo`} className="boton boton-primario">
      {def.etiquetaNuevo}
    </Link>
  );
}

async function ContenidoListado({
  def,
  searchParams,
}: {
  def: DefinicionCatalogo;
  searchParams: ParametrosBusqueda;
}) {
  await requerirUsuario();
  const parametros = await searchParams;
  const busqueda = limpiarBusqueda(primerValor(parametros.q));
  const filtroEstado = leerFiltroEstado(primerValor(parametros.estado));

  const supabase = await createClient();
  let consulta = tablaCatalogo(supabase, def.tabla)
    .select("*")
    .order(def.orden)
    .limit(LIMITE_LISTADO + 1);
  if (filtroEstado !== "todos") consulta = consulta.eq("activo", filtroEstado === "activos");
  if (busqueda) consulta = consulta.or(filtroBusqueda(def.camposBusqueda, busqueda));
  const { data, error } = await consulta;

  const filas = ((data ?? []) as unknown as Fila[]).slice(0, LIMITE_LISTADO);
  const hayMas = (data?.length ?? 0) > LIMITE_LISTADO;

  return (
    <>
      <form method="get" className="tarjeta mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="campo flex-1">
          <span className="campo-etiqueta">Buscar</span>
          <input
            className="entrada"
            type="search"
            name="q"
            defaultValue={busqueda}
            placeholder={`Buscar en ${def.titulo.toLowerCase()}…`}
          />
        </label>
        <label className="campo sm:w-44">
          <span className="campo-etiqueta">Estado</span>
          <select className="entrada" name="estado" defaultValue={filtroEstado}>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <button type="submit" className="boton boton-secundario">
          Filtrar
        </button>
      </form>

      {error ? (
        <p role="alert" className="aviso aviso-error">
          No se pudo cargar el listado. Intente de nuevo.
        </p>
      ) : filas.length === 0 ? (
        <p className="tarjeta p-6 text-center texto-tenue">
          {busqueda || filtroEstado !== "activos"
            ? "No hay registros que coincidan con el filtro."
            : "Todavía no hay registros."}
        </p>
      ) : (
        <ListadoFilas def={def} filas={filas} />
      )}

      <p className="mt-3 text-sm texto-tenue">
        {hayMas
          ? `Se muestran los primeros ${LIMITE_LISTADO} registros; refine la búsqueda.`
          : `${filas.length} ${filas.length === 1 ? "registro" : "registros"}.`}
      </p>
    </>
  );
}

function Celda({ def, fila, campo }: { def: DefinicionCatalogo; fila: Fila; campo: string }) {
  if (campo === "activo") return <InsigniaEstado activo={fila.activo} />;
  return <>{mostrarValor(buscarCampo(def, campo), fila[campo])}</>;
}

function ListadoFilas({ def, filas }: { def: DefinicionCatalogo; filas: Fila[] }) {
  const [principal, ...resto] = def.columnas;
  return (
    <>
      {/* Móvil: tarjetas */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {filas.map((fila) => (
          <li key={fila.id}>
            <Link href={`${def.ruta}/${fila.id}`} className="tarjeta flex flex-col gap-1 p-4">
              <span className="flex items-start justify-between gap-2">
                <span className="font-medium break-words">
                  <Celda def={def} fila={fila} campo={principal.campo} />
                </span>
                <InsigniaEstado activo={fila.activo} />
              </span>
              {resto
                .filter((columna) => columna.campo !== "activo")
                .map((columna) => (
                  <span key={columna.campo} className="text-sm texto-tenue">
                    {columna.etiqueta}: <Celda def={def} fila={fila} campo={columna.campo} />
                  </span>
                ))}
            </Link>
          </li>
        ))}
      </ul>

      {/* Escritorio: tabla */}
      <div className="tarjeta hidden overflow-x-auto sm:block">
        <table className="tabla">
          <thead>
            <tr>
              {def.columnas.map((columna) => (
                <th key={columna.campo} scope="col">
                  {columna.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.id}>
                {def.columnas.map((columna, indice) => (
                  <td key={columna.campo}>
                    {indice === 0 ? (
                      <Link href={`${def.ruta}/${fila.id}`} className="font-medium text-primario hover:underline">
                        <Celda def={def} fila={fila} campo={columna.campo} />
                      </Link>
                    ) : (
                      <Celda def={def} fila={fila} campo={columna.campo} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function PaginaNuevo({ clave }: { clave: ClaveCatalogo }) {
  const def = CATALOGOS[clave];
  return (
    <>
      <Encabezado titulo={def.etiquetaNuevo} volver={{ href: def.ruta, etiqueta: def.titulo }} />
      <Suspense fallback={<Cargando />}>
        <ContenidoNuevo def={def} />
      </Suspense>
    </>
  );
}

async function ContenidoNuevo({ def }: { def: DefinicionCatalogo }) {
  const usuario = await requerirUsuario();
  if (!puedeEditar(def.clave, usuario.rol)) {
    return <SinPermiso mensaje={`Su rol no permite registrar en ${def.titulo.toLowerCase()}.`} />;
  }

  return (
    <div className="tarjeta p-4 sm:p-6">
      <FormularioCatalogo
        campos={def.campos}
        accion={guardarRegistro.bind(null, def.clave, null)}
        estadoInicial={estadoInicial(valoresDesdeRegistro(def, null))}
        textoEnviar="Registrar"
        rutaCancelar={def.ruta}
        rutaBase={def.ruta}
        hoy={hoyEnTegucigalpa()}
      />
    </div>
  );
}

// El título del detalle sale del registro, así que todo el contenido espera.
export function PaginaDetalle({
  clave,
  params,
  searchParams,
}: {
  clave: ClaveCatalogo;
  params: Promise<{ id: string }>;
  searchParams: ParametrosBusqueda;
}) {
  return (
    <Suspense fallback={<Cargando />}>
      <ContenidoDetalle def={CATALOGOS[clave]} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ContenidoDetalle({
  def,
  params,
  searchParams,
}: {
  def: DefinicionCatalogo;
  params: Promise<{ id: string }>;
  searchParams: ParametrosBusqueda;
}) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  const { guardado } = await searchParams;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const { data, error } = await tablaCatalogo(supabase, def.tabla)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el registro.");
  if (!data) notFound();
  const fila = data as unknown as Fila;
  const editable = puedeEditar(def.clave, usuario.rol);

  return (
    <>
      <Encabezado
        titulo={String(fila[def.campoTitulo] ?? def.singular)}
        descripcion={<InsigniaEstado activo={fila.activo} />}
        volver={{ href: def.ruta, etiqueta: def.titulo }}
      />

      {guardado === "1" && (
        <p role="status" className="aviso aviso-exito mb-4">
          Datos guardados correctamente.
        </p>
      )}

      <div className="tarjeta p-4 sm:p-6">
        {editable ? (
          <FormularioCatalogo
            campos={def.campos}
            accion={guardarRegistro.bind(null, def.clave, id)}
            estadoInicial={estadoInicial(valoresDesdeRegistro(def, fila))}
            textoEnviar="Guardar cambios"
            rutaCancelar={def.ruta}
            rutaBase={def.ruta}
            hoy={hoyEnTegucigalpa()}
          />
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              {def.campos.map((campo) => (
                <div key={campo.nombre} className="flex flex-col gap-0.5">
                  <dt className="text-sm texto-tenue">{campo.etiqueta}</dt>
                  <dd className="break-words">
                    {campo.nombre === "activo" ? (
                      <InsigniaEstado activo={fila.activo} />
                    ) : (
                      mostrarValor(campo, fila[campo.nombre])
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-sm texto-tenue">Su rol permite consultar este registro, no modificarlo.</p>
          </>
        )}
      </div>

      <p className="mt-3 text-sm texto-tenue">
        Registrado: {formatearFechaHora(fila.created_at as string)} · Última modificación:{" "}
        {formatearFechaHora(fila.updated_at as string)}
      </p>
    </>
  );
}
