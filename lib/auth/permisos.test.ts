import { describe, expect, it } from "vitest";
import { gruposNavegacion } from "@/lib/navegacion";
import { accesosRapidos } from "@/lib/accesos";
import { correoDeAcceso, DOMINIO_USUARIOS, presentarAcceso } from "./acceso";
import {
  esClavePermiso,
  etiquetaPermiso,
  funcionActiva,
  MODULOS,
  moduloDeRuta,
  normalizarDenegados,
  resumirDenegados,
  rutaPermitida,
} from "./permisos";
import { puede, puedeAdministrarUsuarios, puedeEditar, rolPermiteFuncion, ROLES } from "./roles";

const admin = (denegados: string[] = [], esDesarrollador = false) => ({
  rol: "administrador" as const,
  denegados,
  esDesarrollador,
});

describe("catálogo de módulos", () => {
  it("las claves son únicas y cumplen el formato que exige la base", () => {
    const claves = MODULOS.flatMap((m) => [m.clave, ...m.funciones.map((f) => f.clave)]);
    expect(new Set(claves).size).toBe(claves.length);
    for (const clave of claves) expect(clave).toMatch(/^[a-z][a-zA-Z0-9_.:]{0,63}$/);
  });

  it("cada ruta del menú pertenece a un módulo, salvo Inicio y Permisos", () => {
    const enlaces = gruposNavegacion(admin([], true)).flatMap((g) => g.enlaces.map((e) => e.href));
    const libres = enlaces.filter((href) => moduloDeRuta(href) === null);
    expect(libres.sort()).toEqual(["/", "/configuracion/permisos"]);
  });

  it("toda función del catálogo existe para algún rol", () => {
    for (const funcion of MODULOS.flatMap((m) => m.funciones)) {
      expect(ROLES.some((rol) => rolPermiteFuncion(funcion.clave, rol))).toBe(true);
    }
  });
});

describe("rutas por módulo", () => {
  it("elige el prefijo más largo y no confunde prefijos parecidos", () => {
    expect(moduloDeRuta("/finanzas/cuentas/transferir")?.clave).toBe("modulo.cuentas");
    expect(moduloDeRuta("/ambulancias/traslados")?.clave).toBe("modulo.ambulancias");
    expect(moduloDeRuta("/clientes/123")?.clave).toBe("modulo.clientes");
    expect(moduloDeRuta("/clientesx")).toBeNull();
    expect(moduloDeRuta("/")).toBeNull();
  });

  it("un módulo apagado bloquea sus rutas y deja las demás", () => {
    const usuario = admin(["modulo.clientes"]);
    expect(rutaPermitida(usuario, "/clientes")).toBe(false);
    expect(rutaPermitida(usuario, "/clientes/nuevo")).toBe(false);
    expect(rutaPermitida(usuario, "/beneficiarios")).toBe(true);
    expect(rutaPermitida(usuario, "/")).toBe(true);
  });

  it("Permisos solo se abre con la cuenta de desarrollador", () => {
    expect(rutaPermitida(admin(), "/configuracion/permisos")).toBe(false);
    expect(rutaPermitida(admin(), "/configuracion/permisos/abc")).toBe(false);
    expect(rutaPermitida(admin([], true), "/configuracion/permisos")).toBe(true);
  });

  it("el desarrollador ignora cualquier lista de apagados", () => {
    expect(rutaPermitida(admin(["modulo.clientes"], true), "/clientes")).toBe(true);
    expect(puede("registrarCobro", admin(["registrarCobro"], true))).toBe(true);
  });
});

describe("funciones apagadas sobre el rol", () => {
  it("sin restricciones, el usuario tiene lo mismo que su rol", () => {
    expect(puede("registrarCobro", admin())).toBe(true);
    expect(puedeEditar("planes", admin())).toBe(true);
    expect(puedeAdministrarUsuarios(admin())).toBe(true);
  });

  it("apagar una función la bloquea sin tocar las demás del módulo", () => {
    const usuario = admin(["gestionarMembresia"]);
    expect(puede("gestionarMembresia", usuario)).toBe(false);
    expect(puede("registrarMembresia", usuario)).toBe(true);
  });

  it("apagar el módulo apaga todas sus funciones", () => {
    const usuario = admin(["modulo.cuentas"]);
    expect(puede("transferir", usuario)).toBe(false);
    expect(puede("verTesoreria", usuario)).toBe(false);
    expect(puedeEditar("cuentas_dinero", usuario)).toBe(false);
    expect(funcionActiva(usuario, "registrarCobro")).toBe(true);
  });

  it("encender algo nunca supera al rol", () => {
    const operador = { rol: "operador" as const, denegados: [] };
    expect(puedeEditar("planes", operador)).toBe(false);
    expect(puedeAdministrarUsuarios(operador)).toBe(false);
    expect(puede("corregir", operador)).toBe(false);
  });

  it("apagar la edición de catálogos y la de usuarios", () => {
    const usuario = admin(["editar.clientes", "administrarUsuarios"]);
    expect(puedeEditar("clientes", usuario)).toBe(false);
    expect(puedeEditar("vehiculos", usuario)).toBe(true);
    expect(puedeAdministrarUsuarios(usuario)).toBe(false);
  });

  it("el menú y los accesos rápidos ocultan lo apagado", () => {
    const usuario = admin(["modulo.alquileres", "modulo.clientes", "modulo.beneficiarios", "registrarCobro"]);
    const enlaces = gruposNavegacion(usuario).flatMap((g) => g.enlaces.map((e) => e.href));
    expect(enlaces).not.toContain("/alquileres");
    expect(enlaces).not.toContain("/configuracion/permisos");
    expect(gruposNavegacion(usuario).map((g) => g.titulo)).not.toContain("Clientes");
    const accesos = accesosRapidos(usuario).map((a) => a.href);
    expect(accesos).not.toContain("/alquileres/nuevo");
    expect(accesos).not.toContain("/finanzas/cobros/nuevo");
    expect(accesos).not.toContain("/clientes/nuevo");
    expect(accesos).toContain("/membresias/nueva");
  });
});

describe("lista de apagados", () => {
  it("normaliza: sin duplicados, sin claves desconocidas y ordenada", () => {
    expect(normalizarDenegados(["modulo.clientes", " modulo.clientes ", "inventada", 3, "corregir"])).toEqual([
      "corregir",
      "modulo.clientes",
    ]);
    expect(esClavePermiso("modulo.reportes")).toBe(true);
    expect(esClavePermiso("modulo.nada")).toBe(false);
  });

  it("resume módulos y funciones apagados (las de un módulo apagado no cuentan dos veces)", () => {
    expect(resumirDenegados([])).toEqual({ modulos: 0, funciones: 0 });
    expect(resumirDenegados(["modulo.cuentas", "transferir", "registrarCobro"])).toEqual({ modulos: 1, funciones: 1 });
  });

  it("etiquetas legibles para la bitácora", () => {
    expect(etiquetaPermiso("modulo.reportes")).toBe("Módulo Reportes");
    expect(etiquetaPermiso("transferir")).toBe("Cajas y bancos: Transferir entre cuentas");
  });
});

describe("acceso por nombre de usuario", () => {
  it("convierte el usuario en el correo interno y deja los correos reales", () => {
    expect(correoDeAcceso(" Cantarranas ")).toBe(`cantarranas@${DOMINIO_USUARIOS}`);
    expect(correoDeAcceso("Juan@Correo.com")).toBe("juan@correo.com");
    expect(correoDeAcceso("ab")).toBeNull();
    expect(correoDeAcceso("con/barra")).toBeNull();
    expect(correoDeAcceso("")).toBeNull();
  });

  it("ignora tildes y espacios al escribir el usuario", () => {
    expect(correoDeAcceso("Administración")).toBe(`administracion@${DOMINIO_USUARIOS}`);
    expect(correoDeAcceso("Talanga 2")).toBe(`talanga2@${DOMINIO_USUARIOS}`);
  });

  it("muestra el usuario en lugar del correo interno", () => {
    expect(presentarAcceso(`talanga2@${DOMINIO_USUARIOS}`)).toBe("talanga2");
    expect(presentarAcceso("persona@gmail.com")).toBe("persona@gmail.com");
    expect(presentarAcceso(null)).toBeNull();
  });
});
