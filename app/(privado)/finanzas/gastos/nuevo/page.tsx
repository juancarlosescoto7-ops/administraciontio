import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { registrarGastoRelacionado } from "@/lib/finanzas/acciones";
import { esTipoServicio, SERVICIOS_GASTO } from "@/lib/finanzas/servicios";
import { esUuid, primerValor } from "@/lib/catalogos/presentacion";
import Link from "next/link";
import { opcionesCuentas } from "@/lib/finanzas/consultas";
import { camposGasto } from "@/lib/finanzas/definiciones";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { FormularioOperacion } from "@/components/finanzas/operaciones";

export default function PaginaNuevoGasto({ searchParams }: PageProps<"/finanzas/gastos/nuevo">) {
  return (
    <>
      <Encabezado titulo="Registrar gasto" volver={{ href: "/finanzas/gastos", etiqueta: "Gastos" }} />
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: Pick<PageProps<"/finanzas/gastos/nuevo">, "searchParams">) {
  const usuario = await requerirUsuario();
  if (!puede("gestionarGastos", usuario.rol)) {
    return <SinPermiso mensaje="Su rol no permite registrar gastos." />;
  }
  const supabase = await createClient();
  const parametros = await searchParams;
  const tipo = primerValor(parametros.tipo) ?? "";
  const servicio = primerValor(parametros.servicio) ?? "";
  if ((tipo || servicio) && (!esTipoServicio(tipo) || !esUuid(servicio))) return <p role="alert">Servicio no válido.</p>;
  const relacionado = esTipoServicio(tipo) ? SERVICIOS_GASTO[tipo] : null;
  // Accesos desde la ficha del empleado o del conductor, o «Pagar al conductor» de un servicio.
  const empleado = primerValor(parametros.empleado) ?? "";
  const conductor = primerValor(parametros.conductor) ?? "";
  if ((empleado && !esUuid(empleado)) || (conductor && !esUuid(conductor)) || (empleado && conductor)) {
    return <p role="alert">Destinatario no válido.</p>;
  }
  const [categoriasResultado, proveedoresResultado, cuentas, empleadosResultado, conductoresResultado] = await Promise.all([
    supabase.from("categorias_gasto").select("id, nombre, cuentas_contables(codigo)").eq("activo", true).order("nombre"),
    supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre"),
    opcionesCuentas(supabase),
    supabase.from("empleados").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("conductores").select("id, nombre").eq("activo", true).order("nombre"),
  ]);
  if ([categoriasResultado, proveedoresResultado, empleadosResultado, conductoresResultado].some((r) => r.error)) {
    throw new Error("No se pudieron cargar los destinatarios y categorías del gasto.");
  }
  const categorias = categoriasResultado.data;
  const proveedores = proveedoresResultado.data;
  const opciones = (filas: { id: string; nombre: string }[] | null) =>
    (filas ?? []).map((fila) => ({ valor: fila.id, etiqueta: fila.nombre }));
  const campos = camposGasto(hoyEnTegucigalpa(), opciones(categorias), opciones(proveedores), cuentas, opciones(empleadosResultado.data), opciones(conductoresResultado.data))
    .filter((c) => !relacionado || c.nombre !== "actividad");
  // Con valores iniciales se pierden los predeterminados (fecha, método), así que se conservan.
  const salarios = categorias?.find((c) => c.cuentas_contables?.codigo === "5300")?.id ?? null;
  const registro = empleado || conductor ? {
    ...Object.fromEntries(campos.filter((c) => c.predeterminado !== undefined).map((c) => [c.nombre, c.predeterminado])),
    categoria_id: salarios,
    ...(empleado ? { empleado_id: empleado, concepto: "Pago de salario", actividad: "general" } : { conductor_id: conductor, concepto: "Remuneración de conductor" }),
  } : null;

  return (
    <div className="tarjeta p-4 sm:p-6">
      {relacionado ? <p className="mb-4">Gasto relacionado con <Link className="text-enlace underline" href={`${relacionado.ruta}/${servicio}`}>{relacionado.etiqueta}</Link>. Actividad: {relacionado.actividad}.</p>
        : <p className="mb-4 texto-tenue">Gasto general por actividad. Para vincularlo a una membresía, renta o viaje, abra ese servicio y elija «Registrar gasto relacionado».</p>}
      <FormularioOperacion
        campos={campos}
        registro={registro}
        accion={registrarGastoRelacionado.bind(null, tipo, servicio)}
        textoEnviar="Registrar gasto"
        rutaCancelar="/finanzas/gastos"
      />
      <p className="mt-4 text-sm"><Link href="/empleados" className="text-enlace underline">Administrar empleados</Link>. El importe pagado ahora registra la salida de caja o banco; lo restante queda pendiente.</p>
    </div>
  );
}
