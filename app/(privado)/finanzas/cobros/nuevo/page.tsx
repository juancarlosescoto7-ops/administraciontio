import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid, primerValor } from "@/lib/catalogos/presentacion";
import { limpiarBusqueda } from "@/lib/catalogos/validacion";
import { registrarCobro } from "@/lib/finanzas/acciones";
import { opcionesCuentas } from "@/lib/finanzas/consultas";
import { camposCobro } from "@/lib/finanzas/definiciones";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { BuscarCliente, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { FormularioOperacion } from "@/components/finanzas/operaciones";
import { ResumenImportes } from "@/components/finanzas/resumen";

export default function PaginaNuevoCobro({ searchParams }: PageProps<"/finanzas/cobros/nuevo">) {
  return (
    <>
      <Encabezado titulo="Registrar cobro" volver={{ href: "/finanzas/cobros", etiqueta: "Cobros" }} />
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("registrarCobro", usuario.rol)) {
    return <SinPermiso mensaje="Su rol no permite registrar cobros." />;
  }
  const parametros = await searchParams;
  const clienteId = primerValor(parametros.cliente);
  if (!esUuid(clienteId)) {
    return <BuscarCliente ruta="/finanzas/cobros/nuevo" busqueda={limpiarBusqueda(primerValor(parametros.q))} />;
  }

  const supabase = await createClient();
  const [{ data: cliente }, { data: saldo }, cuentas] = await Promise.all([
    supabase.from("clientes").select("id, nombre").eq("id", clienteId).maybeSingle(),
    supabase.from("saldos_clientes").select("pendiente, saldo_a_favor").eq("cliente_id", clienteId).maybeSingle(),
    opcionesCuentas(supabase),
  ]);
  if (!cliente) {
    return <BuscarCliente ruta="/finanzas/cobros/nuevo" busqueda="" />;
  }
  if (cuentas.length === 0) {
    return <p className="aviso aviso-advertencia">No hay cajas ni bancos activos. Registre una cuenta en Cajas y bancos.</p>;
  }

  return (
    <>
      <p className="mb-4">
        Cliente:{" "}
        <Link href={`/finanzas/pendientes/${cliente.id}`} className="font-medium text-enlace hover:underline">
          {cliente.nombre}
        </Link>{" "}
        · <Link href="/finanzas/cobros/nuevo" className="text-sm texto-tenue hover:underline">cambiar</Link>
      </p>
      <ResumenImportes
        importes={[
          { etiqueta: "Pendiente del cliente", valor: saldo?.pendiente ?? 0 },
          { etiqueta: "Saldo a favor actual", valor: saldo?.saldo_a_favor ?? 0 },
        ]}
      />
      <div className="tarjeta p-4 sm:p-6">
        <p className="mb-4 text-sm texto-tenue">
          El cobro cubrirá automáticamente los cargos pendientes desde el más antiguo.
          Si no alcanza para liquidar el siguiente, se aplicará como abono parcial.
          El excedente sobre la deuda total quedará como saldo a favor.
        </p>
        <FormularioOperacion
          campos={camposCobro(cuentas, hoyEnTegucigalpa())}
          accion={registrarCobro.bind(null, cliente.id)}
          textoEnviar="Registrar cobro"
          rutaCancelar="/finanzas/cobros"
        />
        <p className="mt-4 text-sm texto-tenue">
          El dinero entra una sola vez en la caja o banco elegido.
        </p>
      </div>
    </>
  );
}
