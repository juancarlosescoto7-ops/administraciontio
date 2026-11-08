import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MODULOS } from "@/lib/auth/permisos";
import type { EstadoPermisos } from "@/lib/permisos/estado";
import { EditorPermisos } from "./editor-permisos";

const accion = async (anterior: EstadoPermisos) => anterior;

function pintar(denegadosIniciales: string[], bloqueadasPorRol: string[] = []) {
  return renderToStaticMarkup(createElement(EditorPermisos, { accion, denegadosIniciales, bloqueadasPorRol }));
}

const ocultos = (html: string) => [...html.matchAll(/name="denegado" value="([^"]*)"/g)].map((m) => m[1]);
const interruptor = (html: string, id: string) => new RegExp(`<input id="${id}"[^>]*>`).exec(html)?.[0] ?? "";

describe("editor de permisos", () => {
  it("con todo encendido: un interruptor por módulo y por función, sin campos ocultos", () => {
    const html = pintar([]);
    const funciones = MODULOS.reduce((total, m) => total + m.funciones.length, 0);
    expect(html.match(/role="switch"/g)?.length).toBe(MODULOS.length + funciones);
    expect(ocultos(html)).toEqual([]);
    expect(html).toContain(`${MODULOS.length} de ${MODULOS.length} módulos encendidos`);
    expect(html).toContain("Sin cambios");
  });

  it("envía lo apagado y deshabilita las funciones de un módulo apagado", () => {
    const html = pintar(["modulo.cuentas", "corregir"]);
    expect(ocultos(html).sort()).toEqual(["corregir", "modulo.cuentas"]);
    expect(interruptor(html, "modulo-modulo.cuentas")).not.toContain(" checked=\"\"");
    const transferir = interruptor(html, "funcion-modulo.cuentas-transferir");
    expect(transferir).toContain("disabled");
    expect(transferir).not.toContain(" checked=\"\"");
    expect(html).toContain("Apagada junto con el módulo");
    expect(interruptor(html, "funcion-modulo.correcciones-corregir")).not.toContain(" checked=\"\"");
    expect(html).toContain(`${MODULOS.length - 1} de ${MODULOS.length} módulos encendidos`);
  });

  it("lo que el rol no permite se ve apagado y bloqueado", () => {
    const html = pintar([], ["editar.planes"]);
    const planes = interruptor(html, "funcion-modulo.planes-editar.planes");
    expect(planes).toContain("disabled");
    expect(planes).not.toContain(" checked=\"\"");
    expect(html).toContain("Su rol no lo permite");
  });
});
