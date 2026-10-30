"use server";

import { ETIQUETAS_ESTADO_ALQUILER } from "@/lib/alquileres/definiciones";
import { ETIQUETAS_ESTADO_TRASLADO } from "@/lib/ambulancias/definiciones";
import { usuarioActivoOpcional } from "@/lib/auth/sesion";
import { filtroBusqueda, limpiarBusqueda } from "@/lib/catalogos/validacion";
import { formatearFechaHora } from "@/lib/formato";
import { ETIQUETAS_ESTADO_MEMBRESIA } from "@/lib/membresias/definiciones";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETAS_ESTADO_TRANSPORTE } from "@/lib/transportes/definiciones";
import { interpretar, permitida, type OpcionBusqueda } from "./intencion";

const POR_TIPO = 4;
const CLIENTES_ASISTENTE = 3;

const unir = (...partes: (string | null | undefined)[]) => partes.filter(Boolean).join(" · ");

function filas<T>(resultado: { data: T[] | null; error: unknown }): T[] {
  return resultado.error ? [] : (resultado.data ?? []);
}

/**
 * Buscador universal: registros que el usuario puede ver (la RLS filtra) y,
 * si pidió una acción («cobro Juan»), esa acción para los clientes hallados.
 * Una consulta que falla solo deja fuera su tipo de registro.
 */
export async function buscarUniversal(consulta: string): Promise<OpcionBusqueda[]> {
  const usuario = await usuarioActivoOpcional();
  if (!usuario) return [];
  const { intencion: pedida, texto: bruto } = interpretar(limpiarBusqueda(consulta));
  const intencion = pedida && permitida(pedida, usuario.rol) ? pedida : null;
  const texto = bruto.length >= 2 ? bruto : "";

  const general: OpcionBusqueda[] = intencion
    ? [{ clave: `asistente-${intencion.clave}`, href: intencion.general, etiqueta: intencion.etiqueta, contexto: "Elegir cliente", icono: intencion.icono, seccion: "Asistente" }]
    : [];
  if (!texto) return general;

  const supabase = await createClient();
  const [clientes, beneficiarios, vehiculos, conductores, proveedores, membresias, traslados, transportes, alquileres] = await Promise.all([
    supabase.from("clientes").select("id, nombre, identificacion, telefono").or(filtroBusqueda(["nombre", "identificacion", "telefono", "correo"], texto)).order("nombre").limit(POR_TIPO),
    supabase.from("beneficiarios").select("id, nombre, identificacion, telefono").or(filtroBusqueda(["nombre", "identificacion", "telefono"], texto)).order("nombre").limit(POR_TIPO),
    supabase.from("vehiculos").select("id, codigo, placa, marca, modelo").or(filtroBusqueda(["codigo", "placa", "marca", "modelo"], texto)).order("codigo").limit(POR_TIPO),
    supabase.from("conductores").select("id, nombre, telefono").or(filtroBusqueda(["nombre", "identificacion", "telefono"], texto)).order("nombre").limit(POR_TIPO),
    supabase.from("proveedores").select("id, nombre, telefono").or(filtroBusqueda(["nombre", "identificacion", "telefono"], texto)).order("nombre").limit(POR_TIPO),
    supabase.from("saldos_membresias").select("id, cliente_nombre, plan_nombre, estado").or(filtroBusqueda(["cliente_nombre", "plan_nombre"], texto)).order("created_at", { ascending: false }).limit(POR_TIPO),
    supabase.from("saldos_traslados").select("id, cliente_nombre, paciente, origen, destino, inicio_previsto, estado").or(filtroBusqueda(["cliente_nombre", "paciente", "beneficiario_nombre", "origen", "destino", "vehiculo_codigo"], texto)).order("inicio_previsto", { ascending: false }).limit(POR_TIPO),
    supabase.from("saldos_transportes").select("id, cliente_nombre, origen, destino, inicio_previsto, estado").or(filtroBusqueda(["cliente_nombre", "origen", "destino", "vehiculo_codigo"], texto)).order("inicio_previsto", { ascending: false }).limit(POR_TIPO),
    supabase.from("saldos_alquileres").select("id, cliente_nombre, vehiculo_codigo, entrega_prevista, estado").or(filtroBusqueda(["cliente_nombre", "vehiculo_codigo", "vehiculo_placa"], texto)).order("entrega_prevista", { ascending: false }).limit(POR_TIPO),
  ]);
  

  const listaClientes = filas(clientes);
  const asistente: OpcionBusqueda[] = intencion
    ? listaClientes.slice(0, CLIENTES_ASISTENTE).map((c) => ({
        clave: `asistente-${intencion.clave}-${c.id}`,
        href: intencion.paraCliente(c.id),
        etiqueta: `${intencion.etiqueta}: ${c.nombre}`,
        contexto: "Cliente",
        icono: intencion.icono,
        seccion: "Asistente",
      }))
    : [];

  const registro = (tipo: string, id: string | null, href: string, etiqueta: string | null, detalle: string, icono: OpcionBusqueda["icono"]): OpcionBusqueda[] =>
    id ? [{ clave: `${tipo}-${id}`, href, etiqueta: [etiqueta ?? "—", detalle].filter(Boolean).join(" · "), contexto: tipo, icono, seccion: "Registros" }] : [];

  const registros: OpcionBusqueda[] = [
    ...listaClientes.flatMap((c) => registro("Cliente", c.id, `/clientes/${c.id}`, c.nombre, unir(c.identificacion, c.telefono), "clientes")),
    ...filas(beneficiarios).flatMap((b) => registro("Beneficiario", b.id, `/beneficiarios/${b.id}`, b.nombre, unir(b.identificacion, b.telefono), "clientes")),
    ...filas(membresias).flatMap((m) => registro("Membresía", m.id, `/membresias/${m.id}`, m.cliente_nombre, unir(m.plan_nombre, m.estado && ETIQUETAS_ESTADO_MEMBRESIA[m.estado]), "membresia")),
    ...filas(traslados).flatMap((t) => registro("Traslado", t.id, `/ambulancias/${t.id}`, t.paciente || t.cliente_nombre, unir(t.inicio_previsto && formatearFechaHora(t.inicio_previsto), t.estado && ETIQUETAS_ESTADO_TRASLADO[t.estado]), "servicios")),
    ...filas(transportes).flatMap((t) => registro("Transporte", t.id, `/transportes/${t.id}`, t.cliente_nombre, unir(t.inicio_previsto && formatearFechaHora(t.inicio_previsto), t.estado && ETIQUETAS_ESTADO_TRANSPORTE[t.estado]), "flota")),
    ...filas(alquileres).flatMap((a) => registro("Alquiler", a.id, `/alquileres/${a.id}`, a.cliente_nombre, unir(a.vehiculo_codigo, a.estado && ETIQUETAS_ESTADO_ALQUILER[a.estado]), "llave")),
    ...filas(vehiculos).flatMap((v) => registro("Vehículo", v.id, `/vehiculos/${v.id}`, v.codigo, unir(v.placa, [v.marca, v.modelo].filter(Boolean).join(" ")), "flota")),
    ...filas(conductores).flatMap((c) => registro("Conductor", c.id, `/conductores/${c.id}`, c.nombre, unir(c.telefono), "clientes")),
    ...filas(proveedores).flatMap((p) => registro("Proveedor", p.id, `/proveedores/${p.id}`, p.nombre, unir(p.telefono), "finanzas")),
  ];

  return [...asistente, ...general, ...registros];
}
