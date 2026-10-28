import { puede, puedeEditar, type Rol } from "@/lib/auth/roles";
import type { NombreIcono } from "@/components/iconos";

export type Tono = "azul" | "verde" | "morado" | "naranja";

export type AccesoRapido = { href: string; etiqueta: string; icono: NombreIcono; tono: Tono };

/**
 * Altas y registros frecuentes que el rol puede iniciar. Es solo navegación:
 * cada página y la base vuelven a validar el permiso.
 */
export function accesosRapidos(rol: Rol): AccesoRapido[] {
  const candidatos: (AccesoRapido | false)[] = [
    puede("gestionarTraslados", rol) && { href: "/ambulancias/nuevo", etiqueta: "Nueva solicitud de traslado", icono: "servicios", tono: "azul" },
    puede("gestionarTransportes", rol) && { href: "/transportes/nuevo", etiqueta: "Nueva solicitud de transporte", icono: "flota", tono: "morado" },
    puede("gestionarAlquileres", rol) && { href: "/alquileres/nuevo", etiqueta: "Nueva reserva de alquiler", icono: "llave", tono: "verde" },
    puede("registrarMembresia", rol) && { href: "/membresias/nueva", etiqueta: "Nueva membresía", icono: "membresia", tono: "naranja" },
    puede("registrarCobro", rol) && { href: "/finanzas/cobros/nuevo", etiqueta: "Registrar cobro", icono: "dinero", tono: "verde" },
    puede("gestionarGastos", rol) && { href: "/finanzas/gastos/nuevo", etiqueta: "Registrar gasto", icono: "finanzas", tono: "naranja" },
    puedeEditar("clientes", rol) && { href: "/clientes/nuevo", etiqueta: "Nuevo cliente", icono: "clientes", tono: "azul" },
  ];
  return candidatos.filter((acceso): acceso is AccesoRapido => Boolean(acceso));
}

/** Minúsculas y sin tildes, para buscar «membresia» y encontrar «Membresías». */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Coincide si cada palabra de la consulta aparece en alguno de los textos. */
export function coincide(consulta: string, ...textos: (string | null | undefined)[]): boolean {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  const pajar = normalizar(textos.filter(Boolean).join(" "));
  return palabras.every((palabra) => pajar.includes(palabra));
}
