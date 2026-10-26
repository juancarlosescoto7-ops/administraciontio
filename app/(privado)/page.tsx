import Link from "next/link";
import { ETIQUETAS_ROL, type ClaveCatalogo } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { CATALOGOS } from "@/lib/catalogos/definiciones";
import { tablaCatalogo } from "@/lib/catalogos/tabla";
import { createClient } from "@/lib/supabase/server";
import { Encabezado } from "@/components/encabezado";

// Módulos de las etapas siguientes: se anuncian sin aparentar funcionar.
const PROXIMAMENTE = [
  "Membresías",
  "Traslados de ambulancia",
  "Alquileres",
  "Transportes",
  "Cobros",
  "Gastos",
  "Pendientes",
  "Reportes",
];

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

  const conteos = await Promise.all(
    ORDEN_PANEL.map(async (clave) => {
      const { count, error } = await tablaCatalogo(supabase, CATALOGOS[clave].tabla)
        .select("id", { count: "exact", head: true })
        .eq("activo", true);
      return { clave, total: error ? null : (count ?? 0) };
    }),
  );

  return (
    <>
      <Encabezado
        titulo={`Hola, ${usuario.nombre}`}
        descripcion={`Perfil: ${ETIQUETAS_ROL[usuario.rol]}`}
      />

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
          indicadores de cuotas, saldos y dinero disponible aparecerán con ellos.
        </p>
      </section>
    </>
  );
}
