import Link from "next/link";
import { Suspense } from "react";
import { puede, puedeEditar } from "@/lib/auth/roles";
import { requerirUsuario } from "@/lib/auth/sesion";
import { sumarMontos } from "@/lib/finanzas/montos";
import { formatearFecha, formatearMoneda } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Cargando, Encabezado, InsigniaEstado } from "@/components/encabezado";
import { ResumenImportes } from "@/components/finanzas/resumen";
import { Tabla } from "@/components/finanzas/tabla";

export default function PaginaCuentas() {
  return (
    <>
      <Encabezado
        titulo="Cajas y bancos"
        descripcion="Cuentas de dinero en HNL. El saldo es la suma de sus movimientos confirmados; nunca se edita a mano."
        acciones={
          <Suspense fallback={null}>
            <Acciones />
          </Suspense>
        }
      />
      <Suspense fallback={<Cargando />}>
        <Listado />
      </Suspense>
    </>
  );
}

async function Acciones() {
  const usuario = await requerirUsuario();
  return (
    <>
      {puede("transferir", usuario.rol) && (
        <Link href="/finanzas/cuentas/transferir" className="boton boton-secundario">Transferir</Link>
      )}
      {puedeEditar("cuentas_dinero", usuario.rol) && (
        <Link href="/finanzas/cuentas/nuevo" className="boton boton-primario">Nueva cuenta</Link>
      )}
    </>
  );
}

async function Listado() {
  const usuario = await requerirUsuario();
  const supabase = await createClient();
  const tipo = (t: string | null) => (t === "caja" ? "Caja" : "Banco");

  if (!puede("verTesoreria", usuario.rol)) {
    const { data } = await supabase.from("cuentas_dinero").select("id, nombre, tipo, banco, activo").order("nombre");
    return (
      <Tabla
        filas={data ?? []}
        enlace={(c) => `/finanzas/cuentas/${c.id}`}
        vacio="Todavía no hay cuentas."
        columnas={[
          { clave: "nombre", etiqueta: "Nombre", celda: (c) => c.nombre },
          { clave: "tipo", etiqueta: "Tipo", celda: (c) => tipo(c.tipo) },
          { clave: "banco", etiqueta: "Banco", celda: (c) => c.banco ?? "—" },
          { clave: "estado", etiqueta: "Estado", celda: (c) => <InsigniaEstado activo={c.activo} /> },
        ]}
      />
    );
  }

  const { data, error } = await supabase
    .from("saldos_cuentas_dinero")
    .select("id, nombre, tipo, banco, numero_cuenta, activo, saldo, ultimo_movimiento")
    .order("activo", { ascending: false })
    .order("nombre");
  if (error) return <p role="alert" className="aviso aviso-error">No se pudieron cargar los saldos.</p>;

  const filas = (data ?? []).map((c) => ({ ...c, id: c.id! }));
  const total = sumarMontos(filas.map((c) => c.saldo));
  const cajas = sumarMontos(filas.filter((c) => c.tipo === "caja").map((c) => c.saldo));
  const bancos = sumarMontos(filas.filter((c) => c.tipo === "banco").map((c) => c.saldo));

  return (
    <>
      <ResumenImportes
        importes={[
          { etiqueta: "Dinero disponible", valor: total, destacado: true },
          { etiqueta: "En cajas", valor: cajas },
          { etiqueta: "En bancos", valor: bancos },
        ]}
      />
      <Tabla
        filas={filas}
        enlace={(c) => `/finanzas/cuentas/${c.id}`}
        vacio="Todavía no hay cuentas."
        columnas={[
          { clave: "nombre", etiqueta: "Nombre", celda: (c) => c.nombre },
          { clave: "tipo", etiqueta: "Tipo", celda: (c) => tipo(c.tipo) },
          { clave: "banco", etiqueta: "Banco", celda: (c) => [c.banco, c.numero_cuenta].filter(Boolean).join(" · ") || "—" },
          { clave: "ultimo", etiqueta: "Último movimiento", celda: (c) => formatearFecha(c.ultimo_movimiento) },
          { clave: "saldo", etiqueta: "Saldo", numerica: true, celda: (c) => formatearMoneda(c.saldo) },
          { clave: "estado", etiqueta: "Estado", celda: (c) => <InsigniaEstado activo={Boolean(c.activo)} /> },
        ]}
        totales={{ saldo: formatearMoneda(total) }}
      />
    </>
  );
}
