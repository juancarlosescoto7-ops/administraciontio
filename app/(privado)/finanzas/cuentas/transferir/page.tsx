import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { registrarTransferencia } from "@/lib/finanzas/acciones";
import { opcionesCuentas } from "@/lib/finanzas/consultas";
import { camposTransferencia } from "@/lib/finanzas/definiciones";
import { hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import { FormularioOperacion } from "@/components/finanzas/operaciones";

export default function PaginaTransferir() {
  return (
    <>
      <Encabezado
        titulo="Transferencia entre cuentas"
        descripcion="Mueve dinero entre cajas y bancos. No es un ingreso ni un gasto: el total disponible no cambia."
        volver={{ href: "/finanzas/cuentas", etiqueta: "Cajas y bancos" }}
      />
      <Suspense fallback={<Cargando />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const usuario = await requerirUsuario();
  if (!puede("transferir", usuario.rol)) {
    return <SinPermiso mensaje="Su rol no permite registrar transferencias." />;
  }
  const cuentas = await opcionesCuentas(await createClient());
  if (cuentas.length < 2) {
    return <p className="aviso aviso-advertencia">Se necesitan al menos dos cajas o bancos activos.</p>;
  }
  return (
    <div className="tarjeta p-4 sm:p-6">
      <FormularioOperacion
        campos={camposTransferencia(cuentas, hoyEnTegucigalpa())}
        accion={registrarTransferencia}
        textoEnviar="Registrar transferencia"
        rutaCancelar="/finanzas/cuentas"
      />
    </div>
  );
}
