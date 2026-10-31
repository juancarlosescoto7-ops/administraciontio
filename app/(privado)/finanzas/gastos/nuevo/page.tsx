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
  const [{ data: categorias }, { data: proveedores }, cuentas] = await Promise.all([
    supabase.from("categorias_gasto").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre"),
    opcionesCuentas(supabase),
  ]);
  const opciones = (filas: { id: string; nombre: string }[] | null) =>
    (filas ?? []).map((fila) => ({ valor: fila.id, etiqueta: fila.nombre }));

  return (
    <div className="tarjeta p-4 sm:p-6">
      {relacionado ? <p className="mb-4">Gasto relacionado con <Link className="text-enlace underline" href={`${relacionado.ruta}/${servicio}`}>{relacionado.etiqueta}</Link>. Actividad: {relacionado.actividad}.</p>
        : <p className="mb-4 texto-tenue">Gasto general por actividad. Para vincularlo a una membresía, renta o viaje, abra ese servicio y elija «Registrar gasto relacionado».</p>}
      <FormularioOperacion
        campos={camposGasto(hoyEnTegucigalpa(), opciones(categorias), opciones(proveedores), cuentas).filter((c) => !relacionado || c.nombre !== "actividad")}
        accion={registrarGastoRelacionado.bind(null, tipo, servicio)}
        textoEnviar="Registrar gasto"
        rutaCancelar="/finanzas/gastos"
      />
    </div>
  );
}
