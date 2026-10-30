import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { esUuid, primerValor } from "@/lib/catalogos/presentacion";
import { ETIQUETAS_METODO } from "@/lib/finanzas/definiciones";
import { formatearFecha, formatearFechaHora, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioCorreccion } from "@/components/finanzas/operaciones";
import { AsientosDocumento, Datos, InsigniaFinanciera, ResumenImportes, Seccion } from "@/components/finanzas/resumen";
import { Desplegable } from "@/components/operaciones";
import { Tabla } from "@/components/finanzas/tabla";

export default function PaginaCobro({ params, searchParams }: PageProps<"/finanzas/cobros/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  const parametros = await searchParams;
  if (!esUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: cobro }, { data: aplicaciones }] = await Promise.all([
    supabase.from("saldos_cobros").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("aplicaciones_cobro")
      .select("id, monto, fecha, estado, motivo_reverso, cargo_id, cargos_cliente!aplicaciones_cobro_cargo_fkey(concepto)")
      .eq("cobro_id", id)
      .order("created_at"),
  ]);
  if (!cobro) notFound();

  const ruta = `/finanzas/cobros/${id}`;
  const corrige = puede("corregir", usuario.rol);
  const aplicacionAReversar = aplicaciones?.find(
    (a) => a.id === primerValor(parametros.aplicacion) && a.estado === "vigente",
  );

  return (
    <>
      <Encabezado
        titulo={`Cobro de ${cobro.cliente_nombre}`}
        descripcion={<InsigniaFinanciera estado={cobro.estado} />}
        volver={{ href: "/finanzas/cobros", etiqueta: "Cobros" }}
      />
      <AvisoOperacion
        parametros={parametros}
        mensajes={{ guardado: "Cobro registrado.", corregido: "Corrección registrada." }}
      />

      <ResumenImportes
        importes={[
          { etiqueta: "Importe recibido", valor: cobro.monto },
          { etiqueta: "Aplicado a cargos", valor: cobro.aplicado },
          { etiqueta: "Saldo a favor", valor: cobro.disponible, destacado: true, ayuda: "Disponible para otros cargos" },
        ]}
      />
      <Datos
        filas={[
          ["Cliente", <Link key="c" href={`/finanzas/pendientes/${cobro.cliente_id}`} className="text-enlace hover:underline">{cobro.cliente_nombre}</Link>],
          ["Fecha", formatearFecha(cobro.fecha)],
          ["Caja o banco", cobro.cuenta_nombre],
          ["Método", cobro.metodo ? ETIQUETAS_METODO[cobro.metodo] : "—"],
          ["Referencia", cobro.referencia],
          ["Registrado", formatearFechaHora(cobro.created_at)],
          ...(cobro.estado === "reversado"
            ? ([["Motivo del reverso", cobro.motivo_reverso], ["Reversado", formatearFechaHora(cobro.reversado_en)]] as [string, string | null][])
            : []),
        ]}
      />

      <Seccion titulo="Aplicaciones a cargos">
        <Tabla
          filas={aplicaciones ?? []}
          enlace={(a) => `/finanzas/cargos/${a.cargo_id}`}
          vacio="Este cobro no se ha aplicado a ningún cargo."
          columnas={[
            { clave: "cargo", etiqueta: "Cargo", celda: (a) => a.cargos_cliente?.concepto ?? "Cargo" },
            { clave: "fecha", etiqueta: "Fecha", celda: (a) => formatearFecha(a.fecha) },
            { clave: "monto", etiqueta: "Importe", numerica: true, celda: (a) => formatearMoneda(a.monto) },
            { clave: "estado", etiqueta: "Estado", celda: (a) => <InsigniaFinanciera estado={a.estado} /> },
            ...(corrige
              ? [{
                  clave: "accion",
                  etiqueta: "Acción",
                  celda: (a: { id: string; estado: string }) =>
                    a.estado === "vigente" ? (
                      <Link href={`${ruta}?aplicacion=${a.id}`} className="text-sm text-enlace hover:underline">Reversar</Link>
                    ) : null,
                }]
              : []),
          ]}
        />
      </Seccion>

      {corrige && aplicacionAReversar && (
        <Desplegable titulo="Reversar aplicación" peligro abierto>
          <p className="mb-4 text-sm">
              {formatearMoneda(aplicacionAReversar.monto)} aplicados a «{aplicacionAReversar.cargos_cliente?.concepto}» vuelven al
              saldo a favor del cliente y el cargo queda pendiente otra vez. No se mueve dinero.
            </p>
            <FormularioCorreccion
              tipo="aplicacion"
              id={aplicacionAReversar.id}
              volver={ruta}
              textoEnviar="Reversar aplicación"
              confirmacion="Confirmo el reverso de esta aplicación"
            />
        </Desplegable>
      )}

      {corrige && cobro.estado === "confirmado" && !aplicacionAReversar && (
        <Seccion titulo="Correcciones">
          <Desplegable titulo="Reversar cobro" peligro>
            <p className="mb-4 text-sm">
              Registra la salida de {formatearMoneda(cobro.monto)} de {cobro.cuenta_nombre} y reversa sus aplicaciones (los cargos
              vuelven a quedar pendientes). El cobro original se conserva como reversado.
            </p>
            <FormularioCorreccion
              tipo="cobro"
              id={id}
              volver={ruta}
              textoEnviar="Reversar cobro"
              confirmacion="Confirmo el reverso de este cobro"
            />
          </Desplegable>
        </Seccion>
      )}

      {puede("verTesoreria", usuario.rol) && (
        <Seccion titulo="Asientos contables">
          <AsientosDocumento
            origenes={[{ tipo: "cobro", id }, ...(aplicaciones ?? []).map((a) => ({ tipo: "aplicacion" as const, id: a.id }))]}
          />
        </Seccion>
      )}
    </>
  );
}
