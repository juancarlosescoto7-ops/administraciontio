import Link from "next/link";
import { ETIQUETAS_ROL, puede, type ClaveCatalogo } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { CATALOGOS } from "@/lib/catalogos/definiciones";
import { tablaCatalogo } from "@/lib/catalogos/tabla";
import { sumarMontos } from "@/lib/finanzas/montos";
import { formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Encabezado } from "@/components/encabezado";
import { ActualizarAlAbrir } from "@/components/membresias/actualizar";

// Módulos de las etapas siguientes: se anuncian sin aparentar funcionar.
const PROXIMAMENTE = ["Traslados de ambulancia", "Alquileres", "Transportes", "Reportes"];

const ORDEN_PANEL: ClaveCatalogo[] = [
  "clientes",
  "beneficiarios",
  "vehiculos",
  "conductores",
  "proveedores",
  "planes",
  "tarifas",
  "cuentas_dinero",
];

export default async function Panel() {
  const usuario = await requerirUsuario();
  const supabase = await createClient();

  const tesoreria = puede("verTesoreria", usuario.rol);
  const [conteos, clientes, gastos, cuentas, membresias] = await Promise.all([
    Promise.all(
      ORDEN_PANEL.map(async (clave) => {
        const { count, error } = await tablaCatalogo(supabase, CATALOGOS[clave].tabla)
          .select("id", { count: "exact", head: true })
          .eq("activo", true);
        return { clave, total: error ? null : (count ?? 0) };
      }),
    ),
    supabase.from("saldos_clientes").select("pendiente, saldo_a_favor"),
    tesoreria ? supabase.from("saldos_gastos").select("pendiente").eq("estado", "registrado").gt("pendiente", 0) : null,
    tesoreria ? supabase.from("saldos_cuentas_dinero").select("saldo") : null,
    supabase.from("saldos_membresias").select("estado, vencido, cuotas_vencidas").neq("estado", "cancelada"),
  ]);

  const filasMembresias = membresias.data ?? [];
  const indicadoresMembresias = [
    { etiqueta: "Membresías activas", valor: String(filasMembresias.filter((m) => m.estado === "activa").length), href: "/membresias?estado=activa" },
    { etiqueta: "Suspendidas por morosidad", valor: String(filasMembresias.filter((m) => m.estado === "suspendida").length), href: "/membresias?estado=suspendida" },
    {
      etiqueta: "Cuotas vencidas",
      valor: String(filasMembresias.reduce((suma, m) => suma + (m.cuotas_vencidas ?? 0), 0)),
      href: "/membresias?estado=todas",
    },
    {
      etiqueta: "Importe vencido de cuotas",
      valor: formatearMoneda(sumarMontos(filasMembresias.map((m) => m.vencido))),
      href: "/membresias?estado=todas",
    },
  ];

  const indicadores = [
    { etiqueta: "Por cobrar (CxC)", valor: sumarMontos((clientes.data ?? []).map((c) => c.pendiente)), href: "/finanzas/pendientes" },
    { etiqueta: "Saldos a favor de clientes", valor: sumarMontos((clientes.data ?? []).map((c) => c.saldo_a_favor)), href: "/finanzas/pendientes" },
    ...(tesoreria
      ? [
          { etiqueta: "Por pagar (CxP)", valor: sumarMontos((gastos?.data ?? []).map((g) => g.pendiente)), href: "/finanzas/pendientes" },
          { etiqueta: "Dinero disponible", valor: sumarMontos((cuentas?.data ?? []).map((c) => c.saldo)), href: "/finanzas/cuentas" },
        ]
      : []),
  ];

  return (
    <>
      <Encabezado
        titulo={`Hola, ${usuario.nombre}`}
        descripcion={`Perfil: ${ETIQUETAS_ROL[usuario.rol]}`}
      />
      <ActualizarAlAbrir />

      <section aria-labelledby="titulo-membresias" className="mb-8">
        <h2 id="titulo-membresias" className="mb-3 text-lg font-semibold">
          Membresías
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {indicadoresMembresias.map((indicador) => (
            <li key={indicador.etiqueta}>
              <Link href={indicador.href} className="tarjeta flex h-full flex-col gap-1 p-4 hover:border-primario">
                <span className="text-sm texto-tenue">{indicador.etiqueta}</span>
                <span className="text-lg font-semibold tabular-nums">{indicador.valor}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-finanzas" className="mb-8">
        <h2 id="titulo-finanzas" className="mb-3 text-lg font-semibold">
          Finanzas
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {indicadores.map((indicador) => (
            <li key={indicador.etiqueta}>
              <Link href={indicador.href} className="tarjeta flex h-full flex-col gap-1 p-4 hover:border-primario">
                <span className="text-sm texto-tenue">{indicador.etiqueta}</span>
                <span className="text-lg font-semibold tabular-nums">{formatearMoneda(indicador.valor)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-catalogos" className="mb-8">
        <h2 id="titulo-catalogos" className="mb-3 text-lg font-semibold">
          Catálogos
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {conteos.map(({ clave, total }) => {
            const def = CATALOGOS[clave];
            return (
              <li key={clave}>
                <Link href={def.ruta} className="tarjeta flex h-full flex-col gap-1 p-4 hover:border-primario">
                  <span className="font-medium">{def.titulo}</span>
                  <span className="text-sm texto-tenue">
                    {total === null ? "No disponible" : `${total} ${total === 1 ? "activo" : "activos"}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="titulo-proximamente">
        <h2 id="titulo-proximamente" className="mb-3 text-lg font-semibold">
          Próximamente
        </h2>
        <p className="tarjeta p-4 texto-tenue">
          {PROXIMAMENTE.join(" · ")}. Estos módulos se habilitarán en las siguientes etapas; los
          indicadores de alquileres activos y traslados del día aparecerán con ellos.
        </p>
      </section>
    </>
  );
}
