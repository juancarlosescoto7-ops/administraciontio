import Link from "next/link";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import type { Opcion } from "@/lib/catalogos/definiciones";
import { esUuid, primerValor } from "@/lib/catalogos/presentacion";
import { limpiarBusqueda } from "@/lib/catalogos/validacion";
import { registrarTransporte } from "@/lib/transportes/acciones";
import { camposSolicitudTransporte } from "@/lib/transportes/definiciones";
import { aFechaHoraLocal, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { BuscarCliente, type ParametrosBusqueda } from "@/components/finanzas/filtros";
import { FormularioOperacion } from "@/components/finanzas/operaciones";
import { Seccion } from "@/components/finanzas/resumen";

export default function PaginaNuevoTransporte({ searchParams }: PageProps<"/transportes/nuevo">) {
  return (
    <>
      <Encabezado titulo="Nueva solicitud de transporte" volver={{ href: "/transportes", etiqueta: "Transportes" }} />
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Contenido({ searchParams }: { searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("gestionarTransportes", usuario.rol)) {
    return <SinPermiso mensaje="Su rol permite consultar transportes, no registrarlos." />;
  }
  const parametros = await searchParams;
  const clienteId = primerValor(parametros.cliente);
  if (!esUuid(clienteId)) {
    return (
      <>
        <p className="mb-4 texto-tenue">1. Busque y elija el cliente.</p>
        <BuscarCliente ruta="/transportes/nuevo" busqueda={limpiarBusqueda(primerValor(parametros.q))} />
      </>
    );
  }

  const supabase = await createClient();
  const ahora = new Date();
  const [{ data: cliente }, { data: tarifas }, { data: saldo }, { data: recursos }] = await Promise.all([
    supabase.from("clientes").select("id, nombre").eq("id", clienteId).eq("activo", true).maybeSingle(),
    supabase.from("tarifas").select("id, nombre, precio_base").eq("actividad", "transportes").eq("activo", true).order("nombre"),
    supabase.from("saldos_clientes").select("saldo_a_favor").eq("cliente_id", clienteId).maybeSingle(),
    // Vehículos de transporte y conductores, indicando si están ocupados ahora.
    supabase.rpc("disponibilidad_recursos", {
      p_actividad: "transportes",
      p_inicio: ahora.toISOString(),
      p_fin: new Date(ahora.getTime() + 60000).toISOString(),
    }),
  ]);
  if (!cliente) return <BuscarCliente ruta="/transportes/nuevo" busqueda="" />;

  const tarifa = (tarifas ?? []).find((t) => t.id === primerValor(parametros.tarifa)) ?? null;
  const opciones = (tipo: string): Opcion[] =>
    (recursos ?? [])
      .filter((r) => r.recurso_tipo === tipo)
      .map((r) => ({ valor: r.recurso_id, etiqueta: r.disponible ? r.nombre : `${r.nombre} (ocupado ahora)` }));
  const aFavor = Number(saldo?.saldo_a_favor ?? 0);

  return (
    <>
      <p className="mb-4">
        Cliente: <span className="font-medium">{cliente.nombre}</span> ·{" "}
        <Link href="/transportes/nuevo" className="text-sm texto-tenue hover:underline">
          cambiar
        </Link>
      </p>
      <Seccion titulo="2. Precio">
        {(tarifas ?? []).length > 0 ? (
          <form method="get" className="tarjeta mb-3 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <input type="hidden" name="cliente" value={cliente.id} />
            <label className="campo flex-1">
              <span className="campo-etiqueta">Proponer precio desde una tarifa</span>
              <select className="entrada" name="tarifa" defaultValue={tarifa?.id ?? ""}>
                <option value="">Sin tarifa (precio manual)</option>
                {(tarifas ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} · {formatearMoneda(t.precio_base)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="boton boton-secundario">
              Proponer
            </button>
          </form>
        ) : (
          <p className="mb-3 text-sm texto-tenue">No hay tarifas de transporte: indique el precio manualmente.</p>
        )}
        <p className="text-sm texto-tenue">
          El precio pactado queda guardado en el servicio; el cargo se genera al completarlo.
          {aFavor > 0 && ` El cliente tiene ${formatearMoneda(aFavor)} a favor, aplicable al finalizar.`}{" "}
          <Link href={`/finanzas/cobros/nuevo?cliente=${cliente.id}`} className="text-primario underline">
            Registrar anticipo
          </Link>
        </p>
      </Seccion>
      <div className="tarjeta p-4 sm:p-6">
        <FormularioOperacion
          campos={camposSolicitudTransporte({
            vehiculos: opciones("vehiculo"),
            conductores: opciones("conductor"),
            ahora: aFechaHoraLocal(ahora),
            precioPropuesto: tarifa && Number(tarifa.precio_base) > 0 ? Number(tarifa.precio_base).toFixed(2) : null,
          })}
          accion={registrarTransporte.bind(null, cliente.id, tarifa?.id ?? null)}
          textoEnviar="Registrar solicitud"
          rutaCancelar="/transportes"
        />
      </div>
    </>
  );
}
