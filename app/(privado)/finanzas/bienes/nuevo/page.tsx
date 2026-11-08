import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { registrarBien } from "@/lib/bienes/acciones";
import { camposBien } from "@/lib/bienes/definiciones";
import { opcionesCuentas } from "@/lib/finanzas/consultas";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { FormularioOperacion } from "@/components/finanzas/operaciones";

export default function PaginaNuevoBien() {
  return (
    <>
      <Encabezado titulo="Registrar bien" volver={{ href: "/finanzas/bienes", etiqueta: "Bienes de la empresa" }} />
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const usuario = await requerirUsuario();
  if (!puede("gestionarBienes", usuario)) {
    return <SinPermiso mensaje="Su rol no permite registrar bienes." />;
  }
  const supabase = await createClient();
  const [proveedores, vehiculos, cuentas] = await Promise.all([
    supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("vehiculos").select("id, nombre").eq("activo", true).order("nombre"),
    opcionesCuentas(supabase),
  ]);
  if (proveedores.error || vehiculos.error) throw new Error("No se pudieron cargar proveedores y vehículos.");
  // vehiculos.nombre es una columna generada (marca, modelo y código).
  const opciones = (filas: { id: string; nombre: string | null }[] | null) =>
    (filas ?? []).map((f) => ({ valor: f.id, etiqueta: f.nombre ?? "—" }));

  return (
    <div className="tarjeta p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-1 text-sm texto-tenue">
        <p>
          <strong>Ya era de la empresa:</strong> entra al balance con su costo contra capital; no mueve caja. Si ya tenía años de uso, indique
          la depreciación acumulada hasta la fecha de incorporación.
        </p>
        <p>
          <strong>Compra de contado:</strong> sale el costo completo de la caja o banco elegido. <strong>Compra a crédito:</strong> queda por
          pagar y se abona desde la ficha del bien.
        </p>
        <p>La compra no es un gasto: el gasto es la depreciación mensual, que se registra sola al cierre de cada mes.</p>
      </div>
      <FormularioOperacion
        campos={camposBien(hoyEnTegucigalpa(), opciones(proveedores.data), opciones(vehiculos.data), cuentas)}
        accion={registrarBien}
        textoEnviar="Registrar bien"
        rutaCancelar="/finanzas/bienes"
      />
    </div>
  );
}
