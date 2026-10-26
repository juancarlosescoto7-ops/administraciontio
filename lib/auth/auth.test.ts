import { describe, expect, it } from "vitest";
import { esRol, puedeAdministrarUsuarios, puedeEditar } from "./roles";
import { destinoSeguro, esRutaPublica } from "./rutas";

describe("permisos por rol (espejo de RLS)", () => {
  it("administrador edita todo y gestiona usuarios", () => {
    for (const clave of ["clientes", "vehiculos", "planes", "tarifas", "cuentas_dinero"] as const) {
      expect(puedeEditar(clave, "administrador")).toBe(true);
    }
    expect(puedeAdministrarUsuarios("administrador")).toBe(true);
  });

  it("operador gestiona catálogos operativos pero no configuración sensible ni usuarios", () => {
    expect(puedeEditar("clientes", "operador")).toBe(true);
    expect(puedeEditar("beneficiarios", "operador")).toBe(true);
    expect(puedeEditar("vehiculos", "operador")).toBe(true);
    expect(puedeEditar("conductores", "operador")).toBe(true);
    expect(puedeEditar("planes", "operador")).toBe(false);
    expect(puedeEditar("tarifas", "operador")).toBe(false);
    expect(puedeEditar("cuentas_dinero", "operador")).toBe(false);
    expect(puedeAdministrarUsuarios("operador")).toBe(false);
  });

  it("finanzas consulta catálogos operativos y solo edita proveedores", () => {
    expect(puedeEditar("clientes", "finanzas")).toBe(false);
    expect(puedeEditar("vehiculos", "finanzas")).toBe(false);
    expect(puedeEditar("proveedores", "finanzas")).toBe(true);
    expect(puedeEditar("cuentas_dinero", "finanzas")).toBe(false);
    expect(puedeAdministrarUsuarios("finanzas")).toBe(false);
  });

  it("reconoce solo los tres roles", () => {
    expect(esRol("operador")).toBe(true);
    expect(esRol("admin")).toBe(false);
    expect(esRol(null)).toBe(false);
  });
});

describe("rutas", () => {
  it("solo /login es pública", () => {
    expect(esRutaPublica("/login")).toBe(true);
    expect(esRutaPublica("/")).toBe(false);
    expect(esRutaPublica("/loginx")).toBe(false);
    expect(esRutaPublica("/clientes")).toBe(false);
    expect(esRutaPublica("/sin-acceso")).toBe(false);
  });

  it("evita redirecciones abiertas tras el login", () => {
    expect(destinoSeguro("/clientes?q=ana")).toBe("/clientes?q=ana");
    expect(destinoSeguro("https://malicioso.example")).toBe("/");
    expect(destinoSeguro("//malicioso.example")).toBe("/");
    expect(destinoSeguro("/\\malicioso.example")).toBe("/");
    expect(destinoSeguro("/login")).toBe("/");
    expect(destinoSeguro(null)).toBe("/");
  });
});
