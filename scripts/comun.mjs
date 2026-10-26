// Utilidades compartidas por los scripts de verificación (solo desarrollo).
import { readFileSync } from "node:fs";

export const PROYECTO_DESARROLLO = "cgohbizokewvivxmvbij";

function leerEnv(ruta) {
  const valores = {};
  for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const coincidencia = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (coincidencia) valores[coincidencia[1]] = coincidencia[2];
  }
  return valores;
}

/**
 * Lee .env.local y el archivo de credenciales de prueba (ruta en
 * E2E_CREDENCIALES, nunca versionado). Aborta si la URL no es la del proyecto
 * de desarrollo: estos scripts crean datos ficticios.
 */
export function cargarEntorno() {
  const env = { ...leerEnv(".env.local") };
  const rutaCredenciales = process.env.E2E_CREDENCIALES;
  if (!rutaCredenciales) {
    throw new Error("Defina E2E_CREDENCIALES con la ruta del archivo de credenciales de prueba.");
  }
  Object.assign(env, leerEnv(rutaCredenciales));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (new URL(url).hostname !== `${PROYECTO_DESARROLLO}.supabase.co`) {
    throw new Error("Estos scripts solo pueden ejecutarse contra el proyecto de desarrollo.");
  }
  return env;
}

export function crearReporte() {
  const resultados = [];
  return {
    comprobar(nombre, condicion, detalle = "") {
      resultados.push({ nombre, ok: Boolean(condicion), detalle });
      console.log(`${condicion ? "OK  " : "FALLA"} ${nombre}${!condicion && detalle ? ` → ${detalle}` : ""}`);
    },
    terminar() {
      const fallas = resultados.filter((r) => !r.ok).length;
      console.log(`\n${resultados.length - fallas}/${resultados.length} comprobaciones correctas.`);
      process.exitCode = fallas === 0 ? 0 : 1;
    },
  };
}

export const MARCA_PRUEBA = "[PRUEBA E1]";
