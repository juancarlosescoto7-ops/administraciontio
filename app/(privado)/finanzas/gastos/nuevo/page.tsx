import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { registrarGasto } from "@/lib/finanzas/acciones";
import { opcionesCuentas } from "@/lib/finanzas/consultas";
import { camposGasto } from "@/lib/finanzas/definiciones";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { FormularioOperacion } from "@/components/finanzas/operaciones";

export default function PaginaNuevoGasto() {
  return (
    <>
      <Encabezado titulo="Registrar gasto" volver={{ href: "/finanzas/gastos", etiqueta: "Gastos" }} />
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const usuario = await requerirUsuario();
  if (!puede("gestionarGastos", usuario.rol)) {
    return <SinPermiso mensaje="Su rol no permite registrar gastos." />;
  }
  const supabase = await createClient();
  const [{ data: categorias }, { data: proveedores }, cuentas] = await Promise.all([
    supabase.from("categorias_gasto").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre"),
    opcionesCuentas(supabase),
  ]);
  const opciones = (filas: { id: string; nombre: string }[] | null) =>
    (filas ?? []).map((fila) => ({ valor: fila.id, etiqueta: fila.nombre }));

  return (
    <div className="tarjeta p-4 sm:p-6">
      <FormularioOperacion
        campos={camposGasto(hoyEnTegucigalpa(), opciones(categorias), opciones(proveedores), cuentas)}
        accion={registrarGasto}
        textoEnviar="Registrar gasto"
        rutaCancelar="/finanzas/gastos"
      />
    </div>
  );
}
