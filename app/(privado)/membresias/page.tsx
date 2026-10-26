import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { filtroBusqueda } from "@/lib/catalogos/validacion";
import { LIMITE_LISTADO } from "@/lib/finanzas/consultas";
import { sumarMontos } from "@/lib/finanzas/montos";
import { ESTADOS_MEMBRESIA } from "@/lib/membresias/definiciones";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import { FormularioFiltros, leerFiltros, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { Tabla } from "@/components/finanzas/tabla";
import { BotonActualizarMensualidades } from "@/components/membresias/actualizar";
import { InsigniaMembresia } from "@/components/membresias/insignia";

export default function PaginaMembresias({ searchParams }: PageProps<"/membresias">) {
  return (
    <>
      <Encabezado
        titulo="Membresías"
        descripcion="Mensualidades de asistencia en ambulancia. Las cuotas se cobran desde Finanzas."
        acciones={
          <Suspense fallback={null}>
            <Acciones />
          </Suspense>
        }
      />
      <Suspense fallback={<Cargando />}>
        <Listado searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Acciones() {
  const usuario = await requerirUsuario();
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      {puede("actualizarMensualidades", usuario.rol) && <BotonActualizarMensualidades membresiaId={null} />}
      {puede("registrarMembresia", usuario.rol) && (
        <Link href="/membresias/nueva" className="boton boton-primario">
          Nueva membresía
        </Link>
      )}
    </div>
  );
}

async function Listado({ searchParams }: { searchParams: ParametrosBusqueda }) {
  await requerirUsuario();
  const filtros = leerFiltros(await searchParams, ESTADOS_MEMBRESIA);
  const supabase = await createClient();

  let consulta = supabase
    .from("saldos_membresias")
    .select("id, cliente_nombre, plan_nombre, estado, proxima_renovacion, pendiente, vencido, beneficiarios_activos")
    .order("cliente_nombre")
    .order("created_at")
    .limit(LIMITE_LISTADO + 1);
  if (filtros.estado !== "todas") consulta = consulta.eq("estado", filtros.estado as "activa");
  if (filtros.busqueda) consulta = consulta.or(filtroBusqueda(["cliente_nombre", "plan_nombre"], filtros.busqueda));
  const { data, error } = await consulta;

  const filas = (data ?? []).slice(0, LIMITE_LISTADO).map((fila) => ({ ...fila, id: fila.id! }));
  return (
    <>
      <FormularioFiltros filtros={filtros} estados={ESTADOS_MEMBRESIA} placeholder="Cliente o plan…" fechas={false} />
      {error ? (
        <p role="alert" className="aviso aviso-error">No se pudo cargar el listado.</p>
      ) : (
        <Tabla
          filas={filas}
          enlace={(fila) => `/membresias/${fila.id}`}
          vacio="No hay membresías que coincidan con el filtro."
          columnas={[
            { clave: "cliente", etiqueta: "Cliente", celda: (f) => f.cliente_nombre },
            { clave: "plan", etiqueta: "Plan", celda: (f) => f.plan_nombre },
            { clave: "estado", etiqueta: "Estado", celda: (f) => <InsigniaMembresia estado={f.estado} /> },
            {
              clave: "renovacion",
              etiqueta: "Próxima renovación",
              celda: (f) => (f.estado === "activa" ? formatearFecha(f.proxima_renovacion) : "—"),
            },
            { clave: "beneficiarios", etiqueta: "Beneficiarios", numerica: true, celda: (f) => f.beneficiarios_activos },
            { clave: "pendiente", etiqueta: "Saldo pendiente", numerica: true, celda: (f) => formatearMoneda(f.pendiente) },
            { clave: "vencido", etiqueta: "Vencido", numerica: true, celda: (f) => formatearMoneda(f.vencido) },
          ]}
          totales={{
            pendiente: formatearMoneda(sumarMontos(filas.map((f) => f.pendiente))),
            vencido: formatearMoneda(sumarMontos(filas.map((f) => f.vencido))),
          }}
        />
      )}
      {(data?.length ?? 0) > LIMITE_LISTADO && (
        <p className="mt-3 text-sm texto-tenue">Se muestran los primeros {LIMITE_LISTADO}; refine el filtro.</p>
      )}
    </>
  );
}
