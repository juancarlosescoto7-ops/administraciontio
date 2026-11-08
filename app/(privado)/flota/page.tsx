import { Suspense } from "react";
import { requerirUsuario } from "@/lib/auth/sesion";
import { estadoMantenimiento, formatearKm } from "@/lib/flota/definiciones";
import { formatearFecha, formatearFechaHora, hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import { Tabla } from "@/components/finanzas/tabla";
import { InsigniaMantenimiento, InsigniaVehiculo } from "@/components/flota/insignias";

export default function PaginaFlota() {
  return (
    <>
      <Encabezado
        titulo="Kilometraje y mantenimiento"
        descripcion="Kilometraje de cada vehículo según sus viajes, alquileres, traslados y mantenimientos. Cada salida debe coincidir con la llegada anterior."
      />
      <Suspense fallback={<Cargando />}>
        <Listado />
      </Suspense>
    </>
  );
}

async function Listado() {
  await requerirUsuario();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumen_flota")
    .select("*")
    .order("activo", { ascending: false })
    .order("codigo");
  const hoy = hoyEnTegucigalpa();
  const filas = (data ?? []).map((fila) => ({ ...fila, id: fila.vehiculo_id! }));
  const descuadres = filas.reduce((total, fila) => total + (fila.descuadres ?? 0), 0);
  const vencidos = filas.filter(
    (fila) => fila.activo && estadoMantenimiento({ km_para_mantenimiento: fila.km_para_mantenimiento, proxima_fecha: fila.proxima_fecha }, hoy) === "vencido",
  ).length;

  if (error) return <p role="alert" className="aviso aviso-error">No se pudo cargar la flota.</p>;
  return (
    <>
      {(descuadres > 0 || vencidos > 0) && (
        <ul role="status" className="aviso aviso-advertencia mb-4 list-disc pl-8">
          {descuadres > 0 && (
            <li>
              {descuadres === 1 ? "Hay 1 recorrido" : `Hay ${descuadres} recorridos`} cuya salida no coincide con la llegada anterior. Revise el
              detalle del vehículo.
            </li>
          )}
          {vencidos > 0 && <li>{vencidos === 1 ? "1 vehículo tiene" : `${vencidos} vehículos tienen`} el mantenimiento vencido.</li>}
        </ul>
      )}
      <Tabla
        filas={filas}
        enlace={(fila) => `/flota/${fila.id}`}
        vacio="No hay vehículos registrados."
        columnas={[
          {
            clave: "vehiculo",
            etiqueta: "Vehículo",
            celda: (f) => `${f.nombre}${f.placa ? ` · ${f.placa}` : ""}${f.activo ? "" : " (inactivo)"}`,
          },
          { clave: "estado", etiqueta: "Estado", celda: (f) => <InsigniaVehiculo estado={f.estado} /> },
          {
            clave: "km",
            etiqueta: "Kilometraje actual",
            numerica: true,
            celda: (f) => (f.km_actual === null ? "Sin registros" : `${formatearKm(f.km_actual)}${f.en_recorrido ? " (en recorrido)" : ""}`),
          },
          { clave: "ultimo", etiqueta: "Último movimiento", celda: (f) => formatearFechaHora(f.ultima_fecha) },
          {
            clave: "descuadres",
            etiqueta: "Descuadres",
            numerica: true,
            celda: (f) => (f.descuadres ? <span className="insignia insignia-peligro">{f.descuadres}</span> : "0"),
          },
          {
            clave: "mantenimiento",
            etiqueta: "Próximo mantenimiento",
            celda: (f) => (
              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                <InsigniaMantenimiento
                  estado={estadoMantenimiento({ km_para_mantenimiento: f.km_para_mantenimiento, proxima_fecha: f.proxima_fecha }, hoy)}
                />
                {[f.proximo_km !== null && formatearKm(f.proximo_km), f.proxima_fecha && formatearFecha(f.proxima_fecha)]
                  .filter(Boolean)
                  .join(" o ")}
              </span>
            ),
          },
        ]}
      />
    </>
  );
}
