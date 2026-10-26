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

/** Cliente mínimo de la API REST de Supabase con la clave publicable. */
export function crearClienteRest(env) {
  const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
  const CLAVE = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  async function iniciarSesion(correo, clave) {
    const respuesta = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: CLAVE, "Content-Type": "application/json" },
      body: JSON.stringify({ email: correo, password: clave }),
    });
    const cuerpo = await respuesta.json();
    if (!respuesta.ok) throw new Error(`No se pudo iniciar sesión con ${correo}: ${cuerpo.msg ?? respuesta.status}`);
    return { token: cuerpo.access_token, id: cuerpo.user.id };
  }

  async function api(token, metodo, ruta, cuerpo) {
    const respuesta = await fetch(`${URL_BASE}/rest/v1/${ruta}`, {
      method: metodo,
      headers: {
        apikey: CLAVE,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const texto = await respuesta.text();
    let datos = null;
    try {
      datos = texto ? JSON.parse(texto) : null;
    } catch {
      datos = texto;
    }
    return { estado: respuesta.status, datos, codigo: datos?.code, mensaje: datos?.message };
  }

  return { iniciarSesion, api };
}

export const denegado = (r) => r.estado === 401 || r.estado === 403 || r.codigo === "42501";
