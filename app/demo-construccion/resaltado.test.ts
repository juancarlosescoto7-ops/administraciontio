import { describe, expect, it } from "vitest";
import { lenguajeDe, resaltar } from "./resaltado";

const clases = (linea: { texto: string; clase: string }[]) => linea.filter((t) => t.texto.trim()).map((t) => `${t.clase}:${t.texto.trim()}`);

describe("resaltado del time lapse", () => {
  it("reconoce el lenguaje por la extensión", () => {
    expect(lenguajeDe("supabase/migrations/x.sql")).toBe("sql");
    expect(lenguajeDe("app/globals.css")).toBe("css");
    expect(lenguajeDe("components/panel.tsx")).toBe("ts");
  });

  it("SQL: comentarios, palabras clave, tipos y cadenas", () => {
    const [comentario, tabla] = resaltar(["-- E1 · catálogos", "create table public.clientes (id uuid default 'x')"], "sql");
    expect(clases(comentario)).toEqual(["comentario:-- E1 · catálogos"]);
    expect(clases(tabla)).toEqual(expect.arrayContaining(["clave:create", "clave:table", "tipo:uuid", "clave:default", "cadena:'x'"]));
  });

  it("TS: comentario de bloque que cruza líneas y etiquetas JSX", () => {
    const lineas = resaltar(["/**", " * Panel", " */", 'return <Encabezado titulo="Inicio" />;'], "ts");
    expect(lineas.slice(0, 3).every((l) => l.every((t) => t.clase === "comentario"))).toBe(true);
    expect(clases(lineas[3])).toEqual(expect.arrayContaining(["clave:return", "etiqueta:<Encabezado", 'cadena:"Inicio"']));
  });

  it("conserva el texto original", () => {
    const linea = "export function Panel({ abierta }: { abierta: boolean }) { // ok";
    expect(resaltar([linea], "ts")[0].map((t) => t.texto).join("")).toBe(linea);
  });
});
