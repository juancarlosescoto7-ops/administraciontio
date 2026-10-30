import { Suspense } from "react";
import { puede } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { PaginaDetalle } from "@/components/catalogos/paginas";
import { esUuid, primerValor } from "@/lib/catalogos/presentacion";
import { registrarApertura } from "@/lib/finanzas/acciones";
import { LIMITE_LISTADO } from "@/lib/finanzas/consultas";
import { camposApertura, ETIQUETAS_TIPO_MOVIMIENTO } from "@/lib/finanzas/definiciones";
import { formatearFecha, formatearMoneda, hoyEnTegucigalpa } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando } from "@/components/encabezado";
import type { ParametrosBusqueda } from "@/components/finanzas/filtros";
import { AvisoOperacion, FormularioCorreccion, FormularioOperacion } from "@/components/finanzas/operaciones";
import { ResumenImportes, Seccion } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";
import { Desplegable } from "@/components/operaciones";

export default function Page({ params, searchParams }: PageProps<"/finanzas/cuentas/[id]">) {
  return (
    <>
      <PaginaDetalle clave="cuentas_dinero" params={params} searchParams={searchParams} />
      <Suspense fallback={<Cargando />}>
        <Tesoreria params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Saldo, saldo inicial y movimientos de la cuenta (administrador y finanzas). */
async function Tesoreria({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: ParametrosBusqueda }) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  const parametros = await searchParams;
  if (!esUuid(id) || !puede("verTesoreria", usuario.rol)) return null;

  const supabase = await createClient();
  const [{ data: cuenta }, { data: aperturas }, { data: movimientos }] = await Promise.all([
    supabase.from("saldos_cuentas_dinero").select("id, nombre, activo, saldo").eq("id", id).maybeSingle(),
    supabase
      .from("movimientos_dinero")
      .select("origen_id, evento, fecha, monto_con_signo")
      .eq("cuenta_dinero_id", id)
      .eq("origen_tipo", "apertura"),
    supabase
      .from("movimientos_dinero")
      .select("id, fecha, tipo, monto_con_signo, origen_tipo, origen_id, evento, asientos(concepto)")
      .eq("cuenta_dinero_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(LIMITE_LISTADO),
  ]);
  if (!cuenta) return null;

  // Los pagos de gasto enlazan al gasto que pagan.
  const idsPagos = (movimientos ?? []).filter((m) => m.origen_tipo === "pago_gasto").map((m) => m.origen_id);
  const { data: pagos } = idsPagos.length
    ? await supabase.from("pagos_gasto").select("id, gasto_id").in("id", idsPagos)
    : { data: [] };
  const gastoDePago = new Map((pagos ?? []).map((p) => [p.id, p.gasto_id]));
  const enlace = (m: { origen_tipo: string; origen_id: string }) =>
    m.origen_tipo === "cobro" ? `/finanzas/cobros/${m.origen_id}`
    : m.origen_tipo === "transferencia" ? `/finanzas/cuentas/transferencias/${m.origen_id}`
    : m.origen_tipo === "pago_gasto" && gastoDePago.has(m.origen_id) ? `/finanzas/gastos/${gastoDePago.get(m.origen_id)}`
    : null;

  // Saldo inicial vigente: apertura registrada sin su reverso.
  const apertura = aperturas?.find(
    (m) => m.evento === "registro" && !aperturas.some((r) => r.evento === "reverso" && r.origen_id === m.origen_id),
  );
  const corrige = puede("corregir", usuario.rol);
  const ruta = `/finanzas/cuentas/${id}`;

  return (
    <>
      <AvisoOperacion
        parametros={parametros}
        mensajes={{ apertura: "Saldo inicial registrado.", corregido: "Saldo inicial reversado." }}
      />
      <Seccion titulo="Saldo" abierta={primerValor(parametros.reversar_apertura) === "1"}>
        <ResumenImportes
          importes={[
            { etiqueta: "Saldo actual", valor: cuenta.saldo, destacado: true, ayuda: "Suma de movimientos confirmados" },
            { etiqueta: "Saldo inicial", valor: apertura?.monto_con_signo ?? 0, ayuda: apertura ? formatearFecha(apertura.fecha) : "Sin registrar" },
          ]}
        />
        {corrige && !apertura && cuenta.activo && (
          <div className="tarjeta p-4 sm:p-6">
            <h3 className="mb-1 font-semibold">Registrar saldo inicial</h3>
            <p className="mb-4 text-sm texto-tenue">
              Movimiento de apertura documentado, con contrapartida en «Capital y saldos iniciales». Solo puede haber uno vigente.
            </p>
            <FormularioOperacion campos={camposApertura(hoyEnTegucigalpa())} accion={registrarApertura.bind(null, id)} textoEnviar="Registrar saldo inicial" />
          </div>
        )}
        {corrige && apertura && (
          <Desplegable titulo="Corregir el saldo inicial (reverso)" peligro abierto={primerValor(parametros.reversar_apertura) === "1"}>
            <p className="mb-4 text-sm">Reversa el saldo inicial de {formatearMoneda(apertura.monto_con_signo)}; luego puede registrar el correcto.</p>
            <FormularioCorreccion
              tipo="apertura"
              id={apertura.origen_id}
              volver={ruta}
              textoEnviar="Reversar saldo inicial"
              confirmacion="Confirmo el reverso del saldo inicial"
            />
          </Desplegable>
        )}
      </Seccion>

      <Seccion titulo="Movimientos">
        <Tabla
          filas={movimientos ?? []}
          enlace={enlace}
          vacio="Esta cuenta todavía no tiene movimientos."
          columnas={[
            { clave: "concepto", etiqueta: "Concepto", celda: (m) => `${m.asientos?.concepto ?? "Movimiento"}${m.evento === "reverso" ? " (reverso)" : ""}` },
            { clave: "fecha", etiqueta: "Fecha", celda: (m) => formatearFecha(m.fecha) },
            { clave: "tipo", etiqueta: "Tipo", celda: (m) => ETIQUETAS_TIPO_MOVIMIENTO[m.tipo] },
            { clave: "monto", etiqueta: "Importe", numerica: true, celda: (m) => formatearMoneda(m.monto_con_signo) },
          ]}
        />
      </Seccion>
    </>
  );
}
