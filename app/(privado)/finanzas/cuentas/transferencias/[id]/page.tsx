import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid } from "@/lib/catalogos/presentacion";
import { formatearFecha, formatearFechaHora } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, SinPermiso } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioCorreccion } from "@/components/finanzas/operaciones";
import { Desplegable } from "@/components/operaciones";
import { AsientosDocumento, Datos, InsigniaFinanciera, ResumenImportes, Seccion } from "@/components/finanzas/resumen";

export default function PaginaTransferencia({ params, searchParams }: PageProps<"/finanzas/cuentas/transferencias/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  if (!puede("verTesoreria", usuario.rol)) {
    return <SinPermiso mensaje="Las transferencias las consultan el administrador y finanzas." />;
  }
  const { id } = await params;
  const parametros = await searchParams;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const { data: transferencia } = await supabase
    .from("transferencias")
    .select(
      "*, origen:cuentas_dinero!transferencias_cuenta_origen_id_fkey(id, nombre), destino:cuentas_dinero!transferencias_cuenta_destino_id_fkey(id, nombre)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!transferencia) notFound();

  const ruta = `/finanzas/cuentas/transferencias/${id}`;
  const cuenta = (c: { id: string; nombre: string } | null) =>
    c ? <Link href={`/finanzas/cuentas/${c.id}`} className="text-enlace hover:underline">{c.nombre}</Link> : "—";

  return (
    <>
      <Encabezado
        titulo={`Transferencia de ${transferencia.origen?.nombre} a ${transferencia.destino?.nombre}`}
        descripcion={<InsigniaFinanciera estado={transferencia.estado} />}
        volver={{ href: "/finanzas/cuentas", etiqueta: "Cajas y bancos" }}
      />
      <AvisoOperacion
        parametros={parametros}
        mensajes={{ guardado: "Transferencia registrada.", corregido: "Transferencia reversada." }}
      />
      <ResumenImportes importes={[{ etiqueta: "Importe transferido", valor: transferencia.monto, destacado: true }]} />
      <Datos
        filas={[
          ["Desde", cuenta(transferencia.origen)],
          ["Hacia", cuenta(transferencia.destino)],
          ["Fecha", formatearFecha(transferencia.fecha)],
          ["Referencia", transferencia.referencia],
          ["Registrada", formatearFechaHora(transferencia.created_at)],
          ...(transferencia.estado === "reversado"
            ? ([["Motivo del reverso", transferencia.motivo_reverso], ["Reversada", formatearFechaHora(transferencia.reversado_en)]] as [string, string | null][])
            : []),
        ]}
      />

      {puede("corregir", usuario.rol) && transferencia.estado === "confirmado" && (
        <Seccion titulo="Correcciones">
          <Desplegable titulo="Reversar transferencia" peligro>
            <FormularioCorreccion
              tipo="transferencia"
              id={id}
              volver={ruta}
              textoEnviar="Reversar transferencia"
              confirmacion="Confirmo el reverso de esta transferencia"
            />
          </Desplegable>
        </Seccion>
      )}

      <Seccion titulo="Asientos contables">
        <AsientosDocumento origenes={[{ tipo: "transferencia", id }]} />
      </Seccion>
    </>
  );
}
