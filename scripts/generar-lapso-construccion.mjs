// Genera app/demo-construccion/lapso-datos.json para el time lapse de construcción:
// código real (migraciones y archivos en cada commit), historial de git y la
// estructura de la base de desarrollo (esquema-bd.json, leída por MCP en solo lectura).
// Uso: node scripts/generar-lapso-construccion.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const DESTINO = "app/demo-construccion/lapso-datos.json";
const CABEZA = 28;
const COLA = 18;

// Commit (null: árbol de trabajo, aún sin commit), migraciones y archivo tecleado de cada etapa.
const ETAPAS = [
  { id: "e0", commit: "de98964", migraciones: [], archivo: "app/page.tsx", vista: "vacio" },
  { id: "e1", commit: "58e37ae", migraciones: ["20261026024644_e1_perfiles_y_acceso", "20261026024721_e1_catalogos"], archivo: "components/catalogos/paginas.tsx", vista: "clientes" },
  { id: "e2", commit: "22bc0dc", migraciones: ["20261026190818_e2_finanzas_estructura"], archivo: "lib/finanzas/acciones.ts", vista: "cobros" },
  { id: "e3", commit: "9b5b864", migraciones: ["20261026210430_e3_membresias_estructura"], archivo: "app/(privado)/membresias/nueva/page.tsx", vista: "membresias" },
  { id: "e4", commit: "b9f4c3f", migraciones: ["20261026221014_e4_ambulancias_estructura"], archivo: "app/(privado)/ambulancias/nuevo/page.tsx", vista: "ambulancias" },
  { id: "e5", commit: "c41854e", migraciones: ["20261027002539_e5_alquileres_transportes_estructura"], archivo: "app/(privado)/alquileres/nuevo/page.tsx", vista: "alquileres" },
  { id: "rediseno", commit: "e974098", migraciones: [], archivo: "components/panel.tsx", vista: "inicio" },
  { id: "e6", commit: "958626c", migraciones: ["20261027222743_e6_reportes"], archivo: "app/(privado)/reportes/page.tsx", vista: "inicio" },
  { id: "contrato", commit: null, migraciones: ["20261028062802_e6_membresia_integrada_contrato"], archivo: "app/(privado)/membresias/[id]/contrato/page.tsx", vista: "membresias" },
  { id: "cobros", commit: "587ee16", migraciones: ["20261029011014_cobros_automaticos_antiguedad"], archivo: "lib/finanzas/acciones.ts", vista: "inicio" },
];

// Nada que parezca credencial, llave o correo real llega a la página pública.
const SECRETOS = [/eyJ[\w-]{20,}/, /sb_(secret|publishable)_\w+/i, /service_role\s*[:=]/i, /\bsk-[\w-]{16,}/, /password\s*[:=]\s*['"][^'"]+/i, /[\w.+-]+@(?!(example|ejemplo)\.)[\w-]+\.[\w.]+/];

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

function recorte(texto, origen) {
  const lineas = texto.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  for (const patron of SECRETOS) {
    const hallazgo = lineas.findIndex((linea) => patron.test(linea));
    if (hallazgo >= 0) throw new Error(`Posible secreto en ${origen}:${hallazgo + 1} (${patron}). No se genera.`);
  }
  return {
    total: lineas.length,
    cabeza: lineas.slice(0, CABEZA),
    cola: lineas.length > CABEZA + COLA ? lineas.slice(-COLA) : lineas.slice(CABEZA),
  };
}

const esquema = JSON.parse(readFileSync("app/demo-construccion/esquema-bd.json", "utf8"));
const asignadas = new Map();

const etapas = ETAPAS.map((etapa) => {
  const migraciones = etapa.migraciones.map((nombre) => {
    const sql = readFileSync(`supabase/migrations/${nombre}.sql`, "utf8");
    const tablas = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi)].map((m) => m[1]);
    for (const tabla of tablas) {
      if (!esquema.tablas[tabla]) throw new Error(`${nombre} crea ${tabla}, que no está en esquema-bd.json`);
      asignadas.set(tabla, nombre);
    }
    return {
      nombre,
      ruta: `supabase/migrations/${nombre}.sql`,
      tablas,
      politicas: (sql.match(/create\s+policy/gi) ?? []).length,
      funciones: (sql.match(/create\s+(or\s+replace\s+)?function/gi) ?? []).length,
      ...recorte(sql, nombre),
    };
  });
  const contenido = etapa.commit ? git("show", `${etapa.commit}:${etapa.archivo}`) : readFileSync(etapa.archivo, "utf8");
  const commit = etapa.commit
    ? {
        hash: etapa.commit,
        mensaje: git("log", "-1", "--format=%s", etapa.commit).trim(),
        resumen: git("show", "--shortstat", "--format=", etapa.commit).trim(),
      }
    : null;
  return { id: etapa.id, vista: etapa.vista, commit, migraciones, archivo: { ruta: etapa.archivo, ...recorte(contenido, etapa.archivo) } };
});

const faltantes = Object.keys(esquema.tablas).filter((tabla) => !asignadas.has(tabla));
if (faltantes.length) throw new Error(`Tablas de la base sin migración que las cree: ${faltantes.join(", ")}`);

// Árbol del explorador: rutas reales en el orden en que aparecen.
const archivos = [...new Set(etapas.flatMap((e) => [...e.migraciones.map((m) => m.ruta), e.archivo.ruta]))];

writeFileSync(DESTINO, `${JSON.stringify({ generado: "scripts/generar-lapso-construccion.mjs", etapas, archivos, esquema: { tablas: esquema.tablas, tipos: esquema.tipos, rls: esquema.rls, relaciones: esquema.relaciones } }, null, 1)}\n`);
console.log(`${DESTINO}: ${etapas.length} etapas, ${asignadas.size} tablas, ${esquema.relaciones.length} relaciones.`);
