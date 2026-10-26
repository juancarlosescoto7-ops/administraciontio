import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid, primerValor } from "@/lib/catalogos/presentacion";
import { limpiarBusqueda } from "@/lib/catalogos/validacion";
import { registrarCargo } from "@/lib/finanzas/acciones";
import { camposCargo } from "@/lib/finanzas/definiciones";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { BuscarCliente, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { FormularioOperacion } from "@/components/finanzas/operaciones";

export default function PaginaNuevoCargo({ searchParams }: PageProps<"/finanzas/cargos/nuevo">) {
  return (
    <>
      <Encabezado titulo="Registrar cargo administrativo" volver={{ href: "/finanzas/cargos", etiqueta: "Cargos" }} />
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("registrarCargo", usuario.rol)) {
    return <SinPermiso mensaje="Solo el administrador registra cargos administrativos." />;
  }
  const parametros = await searchParams;
  const clienteId = primerValor(parametros.cliente);
  if (!esUuid(clienteId)) {
    return <BuscarCliente ruta="/finanzas/cargos/nuevo" busqueda={limpiarBusqueda(primerValor(parametros.q))} />;
  }

  const supabase = await createClient();
  const { data: cliente } = await supabase.from("clientes").select("id, nombre").eq("id", clienteId).eq("activo", true).maybeSingle();
  if (!cliente) return <BuscarCliente ruta="/finanzas/cargos/nuevo" busqueda="" />;

  return (
    <>
      <p className="mb-4">
        Cliente:{" "}
        <Link href={`/finanzas/pendientes/${cliente.id}`} className="font-medium text-primario hover:underline">
          {cliente.nombre}
        </Link>{" "}
        · <Link href="/finanzas/cargos/nuevo" className="text-sm texto-tenue hover:underline">cambiar</Link>
      </p>
      <p className="aviso aviso-advertencia mb-4">
        Los cargos de membresías, traslados, alquileres y transportes se generarán desde sus módulos. Use este registro
        solo para cargos administrativos; reconoce el ingreso de la línea elegida.
      </p>
      <div className="tarjeta p-4 sm:p-6">
        <FormularioOperacion
          campos={camposCargo(hoyEnTegucigalpa())}
          accion={registrarCargo.bind(null, cliente.id)}
          textoEnviar="Registrar cargo"
          rutaCancelar="/finanzas/cargos"
        />
      </div>
    </>
  );
}
