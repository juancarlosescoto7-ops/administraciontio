// Verifica el time lapse de construcción: código, historial y esquema reales, en
// pantalla dividida (editor | navegador) con apariciones de la base de datos.
// Sin credenciales ni operaciones en Supabase.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { setTimeout as esperar } from "node:timers/promises";
import { abrirNavegador } from "./navegador.mjs";

const capturas = process.env.E2E_CAPTURAS ?? ".next/demo-capturas";
mkdirSync(capturas, { recursive: true });
let verificaciones = 0;
function comprobar(valor, mensaje) {
  assert.ok(valor, mensaje);
  console.log(`OK ${++verificaciones}: ${mensaje}`);
}

// --- Los datos del lapso salen del proyecto real -----------------------------------------------
const datos = JSON.parse(readFileSync("app/demo-construccion/lapso-datos.json", "utf8"));
const esquema = JSON.parse(readFileSync("app/demo-construccion/esquema-bd.json", "utf8"));
const lineasDe = (texto) => texto.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
const coincide = (extracto, real) =>
  extracto.total === real.length &&
  extracto.cabeza.every((linea, i) => linea === real[i]) &&
  extracto.cola.every((linea, i) => linea === real[real.length - extracto.cola.length + i]);
comprobar(
  datos.etapas.every((e) => e.migraciones.every((m) => coincide(m, lineasDe(readFileSync(m.ruta, "utf8"))))),
  "Migraciones del lapso idénticas a supabase/migrations",
);
comprobar(
  datos.etapas.every((e) => coincide(e.archivo, lineasDe(e.commit ? execFileSync("git", ["show", `${e.commit.hash}:${e.archivo.ruta}`], { encoding: "utf8" }) : readFileSync(e.archivo.ruta, "utf8")))),
  "Archivos tecleados idénticos a su versión en cada commit",
);
comprobar(
  datos.etapas.filter((e) => e.commit).every((e) => execFileSync("git", ["log", "-1", "--format=%s", e.commit.hash], { encoding: "utf8" }).trim() === e.commit.mensaje),
  "Commits y mensajes reales del historial",
);
const tablasCreadas = datos.etapas.flatMap((e) => e.migraciones.flatMap((m) => m.tablas));
comprobar(
  tablasCreadas.length === Object.keys(esquema.tablas).length && tablasCreadas.every((t) => esquema.tablas[t]),
  `Cada una de las ${tablasCreadas.length} tablas de la base se crea en una migración del lapso`,
);
// Una misma ruta puede teclearse en varios commits (p. ej., lib/finanzas/acciones.ts): se admiten todas sus versiones.
const globales = readFileSync("app/globals.css", "utf8");
comprobar(
  ["--primario: #533afd", '--font-sans: "Inter Variable"', "border-radius: 0.5rem;\n    box-shadow: var(--sombra);", ".tabla td {\n    padding: 0.75rem;"].every((valor) => globales.replace(/\r\n/g, "\n").includes(valor)),
  "Los valores finales del inspector de diseño son los reales de globals.css",
);
const contenidoPorRuta = new Map();
for (const archivo of datos.etapas.flatMap((e) => [...e.migraciones, e.archivo])) {
  contenidoPorRuta.set(archivo.ruta, [...(contenidoPorRuta.get(archivo.ruta) ?? []), ...archivo.cabeza, ...archivo.cola]);
}

// --- Navegador ----------------------------------------------------------------------------------
const n = await abrirNavegador({ capturas, puerto: 9341 });
const terminado = 'document.querySelector(".escritorio")?.dataset.terminado === "true"';
const sinDesborde = "document.documentElement.scrollWidth <= innerWidth";
const repetir = 'document.querySelector(\'button[aria-label="Repetir"]\')';
// Graba el recorrido; sin repetir: líneas del editor y de la terminal, tablas y relaciones vistas en la base.
const GRABAR = (pulsar) => `(() => {
  window.__cuadros = []; window.__codigo = new Set(); window.__terminal = new Set();
  window.__tablas = new Set(); window.__relaciones = new Set(); window.__animadas = 0;
  window.__escena = [];
  window.__pruebas = new Set(); window.__fuentes = new Set(); window.__escribiendo = 0; window.__tipos = new Set(); window.__registro = new Set(); window.__incompletas = 0;
  const inicio = performance.now();
  const grabar = () => {
    const e = document.querySelector(".escritorio");
    if (e) {
      const ruta = e.querySelector(".ide-ruta")?.textContent.split(" › ").join("/");
      e.querySelectorAll(".ide-linea code").forEach((c) => window.__codigo.add(ruta + "\\u0000" + c.textContent));
      e.querySelectorAll(".ide-terminal-lineas > div").forEach((l) => window.__terminal.add(l.textContent));
      e.querySelectorAll('.panel-bd .bd-tabla[data-existente="false"]').forEach((t) => window.__tablas.add(t.dataset.tabla));
      e.querySelectorAll(".panel-bd .bd-conexion").forEach((c) => window.__relaciones.add(c.dataset.relacion));
      if (e.querySelector(".bd-cursor, .bd-banda") || [...e.querySelectorAll(".panel-bd .bd-tabla, .panel-bd .bd-conexion")].some((b) => getComputedStyle(b).animationName !== "none")) window.__animadas++;
      const sistema = e.querySelector(".ventana-navegador");
      if (e.dataset.prueba) window.__pruebas.add(e.dataset.prueba);
      if (e.dataset.prueba === "tipografia-0") window.__fuentes.add(getComputedStyle(sistema.querySelector(".sistema-real")).fontFamily);
      if (sistema.querySelector("[data-escribiendo]")) window.__escribiendo++;
      e.querySelectorAll(".bd-tipo").forEach((x) => window.__tipos.add(x.textContent));
      e.querySelectorAll(".panel-bd-registro > div").forEach((x) => window.__registro.add(x.textContent.trim()));
      if (e.querySelector('.bd-tabla[data-completa="false"]')) window.__incompletas++;
      window.__cuadros.push({
        t: performance.now() - inicio, etapa: e.dataset.etapa, flash: e.dataset.flash, final: e.dataset.final === "true", ruta, fin: ${terminado}, ancho: ${sinDesborde},
        vista: e.dataset.vista, obra: Number(e.dataset.construccion),
        hechos: sistema.querySelectorAll('[data-construido="si"]').length, pendientes: sistema.querySelectorAll('[data-construido="no"]').length,
      });
    }
    const final = document.querySelector(".lapso-final");
    if (final) {
      const aside = final.querySelector("aside").getBoundingClientRect();
      window.__escena.push({ escena: final.dataset.escena, panel: final.dataset.panel, cursor: !!document.querySelector(".prueba-cursor"), aviso: final.textContent.includes("Cobro registrado."), lateral: Math.abs(aside.top) < 2 || aside.width === 0, desplazado: final.scrollTop > 50 });
    }
    if (!(${terminado}) || window.__cuadros.length < 3) requestAnimationFrame(grabar);
  };
  ${pulsar ? `${repetir}.click();` : ""}
  requestAnimationFrame(grabar);
})()`;
async function recorrido(pulsar = true) {
  await n.evaluar(GRABAR(pulsar));
  await n.esperar("window.__cuadros.length > 3 && window.__cuadros.at(-1).fin", 60000);
  return n.evaluar("({ cuadros: window.__cuadros, codigo: [...window.__codigo], terminal: [...window.__terminal], tablas: [...window.__tablas], relaciones: [...window.__relaciones], animadas: window.__animadas, pruebas: [...window.__pruebas], fuentes: [...window.__fuentes], escribiendo: window.__escribiendo, tipos: [...window.__tipos], registro: [...window.__registro], incompletas: window.__incompletas, escena: window.__escena })");
}
const secuencia = (lista) => lista.filter((valor, i) => valor !== lista[i - 1]);

try {
  await n.cdp("Page.addScriptToEvaluateOnNewDocument", {
    source: "window.__errores = []; const e = console.error; console.error = (...a) => { window.__errores.push(a.map(String).join(' ')); e(...a); }; addEventListener('error', (ev) => window.__errores.push(ev.message));",
  });
  await n.vista(1440, 900, false);
  await n.ir("/demo-construccion");
  comprobar(await n.esperar('document.querySelector(".escritorio")'), "Accesible sin sesión");
  comprobar(await n.evaluar('document.querySelector(".escritorio").inert'), "Escritorio simulado inerte");
  comprobar(await n.evaluar('!!document.querySelector(".ventana-codigo .ide-editor") && !!document.querySelector(".ventana-navegador .sistema-real")'), "Pantalla dividida: código y el sistema");
  comprobar(
    await n.evaluar('(() => { const e = document.querySelector(".ventana-codigo .ide-editor").getBoundingClientRect(); const b = document.querySelector(".ventana-codigo .panel-bd").getBoundingClientRect(); return b.top >= e.bottom - 1; })()'),
    "La base de datos forma parte de la ventana del código, debajo del editor",
  );
  comprobar(await n.evaluar('!document.querySelector(".ventana-titulo, .ventana-puntos, .navegador-direccion")'), "Sin marcos de ventana ni botones de minimizar o cerrar");
  comprobar(await n.evaluar('document.querySelector(".ventana-navegador").getBoundingClientRect().width > document.querySelector(".ventana-codigo").getBoundingClientRect().width * 1.4'), "El sistema ocupa más espacio horizontal que el código");
  const barraContenida = '(() => { const v = document.querySelector(".ventana-navegador").getBoundingClientRect(); const a = document.querySelector(".ventana-navegador aside").getBoundingClientRect(); return a.width > 0 && a.left >= v.left - 1 && a.right <= v.right + 1; })()';
  comprobar(await n.evaluar('[...document.querySelectorAll("button,input,select,textarea")].every(el => el.closest("[inert]"))'), "Sin controles de reproductor mientras corre");
  const { cuadros, codigo, terminal, tablas, relaciones, animadas, pruebas, fuentes, escribiendo, tipos, registro, incompletas, escena } = await recorrido(false);
  comprobar(true, "Arranca sola al abrir y termina");
  comprobar(await n.evaluar(barraContenida), "La barra lateral del ERP queda dentro de la ventana del sistema");

  const etapas = secuencia(cuadros.map((c) => c.etapa));
  comprobar(JSON.stringify(etapas) === JSON.stringify(datos.etapas.map((e) => e.id)), `Etapas en orden: ${etapas.join(" → ")}`);
  const duracion = cuadros.find((c) => c.fin).t - cuadros[0].t;
  comprobar(duracion > 50000 && duracion < 64000, `Duración con la escena de prueba: ${(duracion / 1000).toFixed(1)} s`);
  const rutas = secuencia(cuadros.map((c) => c.ruta));
  const esperadas = datos.etapas.flatMap((e) => [...e.migraciones.map((m) => m.ruta), e.archivo.ruta]);
  comprobar(JSON.stringify(rutas) === JSON.stringify(esperadas), `Se teclean ${esperadas.length} archivos reales en orden`);
  const ajenas = codigo
    .map((par) => par.split("\u0000"))
    .filter(([ruta, texto]) => texto && !(contenidoPorRuta.get(ruta) ?? []).some((linea) => linea.startsWith(texto)));
  comprobar(ajenas.length === 0, `Cada línea mostrada en el editor existe en su archivo real (${codigo.length} revisadas${ajenas.length ? `; ajenas: ${JSON.stringify(ajenas.slice(0, 3))}` : ""})`);

  const flashes = secuencia(cuadros.map((c) => c.flash)).filter(Boolean);
  const conTablas = datos.etapas.flatMap((e) => e.migraciones.filter((m) => m.tablas.length).map((m) => m.nombre));
  comprobar(JSON.stringify(flashes) === JSON.stringify(conTablas), `La base se arma en ${flashes.length} tandas, una por migración con tablas, mientras se escribe el código`);
  comprobar(tablas.length === 32 && tablas.every((t) => esquema.tablas[t]), "Surgen las 32 tablas reales");
  comprobar(relaciones.length === esquema.relaciones.length && esquema.relaciones.every(([a, c]) => relaciones.includes(`${a}.${c}`)), `Se conectan sus ${esquema.relaciones.length} relaciones reales`);
  comprobar(animadas === 0, "Base de datos sobria: sin cursor, arrastres ni animaciones");
  const enObra = cuadros.filter((c) => c.hechos > 0 && c.pendientes > 0);
  const vistas = [...new Set(datos.etapas.map((e) => e.vista))].filter((v) => v !== "vacio");
  comprobar(enObra.length > 60 && vistas.every((v) => enObra.some((c) => c.vista === v)), `El sistema se construye a la par del código en cada pantalla: ${vistas.join(", ")}`);
  comprobar(cuadros.filter((c) => c.obra === 100).every((c) => c.pendientes === 0), "Terminado el archivo, su pantalla queda completa");
  const aspectos = ["tipografia", "color", "esquinas", "densidad", "sombras"];
  comprobar(aspectos.every((a) => [0, 1, 2].every((p) => pruebas.includes(`${a}-${p}`))), `Se prueba el diseño en vivo: ${aspectos.join(", ")} (dos intentos y el valor real)`);
  comprobar(fuentes.some((f) => f.includes("Georgia")), "La prueba de tipografía cambia de verdad la fuente del sistema");
  comprobar(escribiendo > 10, "Los títulos se escriben letra a letra");
  const realesTipos = new Set(Object.values(esquema.tipos).flat());
  comprobar(tipos.length > 10 && tipos.every((t) => realesTipos.has(t) || [...realesTipos].some((r) => t.endsWith("…") && r.startsWith(t.slice(0, -1)))), `La base muestra tipos de columna reales (${tipos.length} distintos)`);
  comprobar(incompletas > 20, "Las tablas se crean columna por columna");
  comprobar(
    Object.keys(esquema.tablas).every((t) => registro.includes(`› create table public.${t} (${esquema.tablas[t].length} columnas)`)) &&
      registro.filter((l) => l.startsWith("› add foreign key")).length === esquema.relaciones.length,
    "El registro de la base ejecuta cada create table y cada llave foránea reales",
  );
  comprobar(
    datos.etapas.every((e) => !e.commit || terminal.includes(`[main ${e.commit.hash}] ${e.commit.mensaje}`)),
    "La terminal registra cada commit real con su hash",
  );
  comprobar(datos.etapas.every((e) => e.migraciones.every((m) => terminal.some((l) => l.endsWith(`apply_migration ${m.nombre}`)))), "La terminal aplica cada migración real");
  comprobar(cuadros.every((c) => c.ancho), "1440 px: sin desbordamiento durante el recorrido");

  comprobar(JSON.stringify(secuencia(escena.map((c) => c.panel))) === '["cerrado","grafico","registrado"]', "Escena final: se abre el gráfico de cobros y luego se registra un cobro");
  comprobar(JSON.stringify(secuencia(escena.map((c) => c.escena))) === '["inicio","formulario","inicio"]', "Escena final: del inicio al formulario «Registrar cobro» y de vuelta");
  comprobar(escena.some((c) => c.cursor) && escena.some((c) => c.aviso) && escena.some((c) => c.desplazado), "Un cursor prueba el sistema, se desplaza por la página y aparece el aviso real");
  comprobar(escena.filter((c) => c.desplazado).every((c) => c.lateral), "La barra lateral del ERP se mantiene fija al desplazarse la página");
  comprobar(await n.evaluar('document.querySelector(".lapso-final .indicador").textContent.replace(/\\s/g, " ").includes("L 4,700.00")'), "«Cobrado hoy» refleja el cobro registrado");
  comprobar(await n.evaluar('!!document.querySelector(".lapso-final .caja-panel-abierto ul[aria-label] li")'), "El gráfico real de cobros queda abierto");
  comprobar(await n.evaluar('!!document.querySelector(".lapso-final .buscador-inicio") && document.querySelectorAll(".lapso-final .indicador").length === 4 && !!document.querySelector(".lapso-final .banda-accesos")'), "Cierre: el panel real del sistema terminado");
  comprobar(await n.evaluar(`[...document.querySelectorAll("button")].filter(el => !el.closest("[inert]")).length === 1 && !!${repetir}`), "Al final solo aparece el botón de repetir");
  await n.capturar("01-final");

  await n.evaluar(GRABAR(true));
  await n.esperar('document.querySelector(".escritorio")?.dataset.flash.includes("e2_finanzas")');
  await esperar(1700);
  await n.capturar("02-base-de-datos");
  await n.esperar('document.querySelector(".escritorio").dataset.etapa === "e3" && document.querySelector(".escritorio").dataset.flash === ""');
  await esperar(700);
  comprobar(await n.evaluar('!!document.querySelector(".ventana-navegador table.tabla") && document.querySelectorAll(".ventana-navegador .encabezado-grupo").length >= 4'), "El navegador muestra el ERP real creciendo (menú y listado)");
  await n.capturar("03-pantalla-dividida");
  await n.esperar(terminado, 60000);

  await n.vista(1280, 800, false);
  await n.evaluar(GRABAR(true));
  await n.esperar('document.querySelector(".escritorio")?.dataset.etapa === "e3"', 30000);
  comprobar(await n.evaluar(barraContenida), "1280px: la barra lateral sigue dentro de la ventana del sistema");
  await n.esperar(terminado, 60000);

  for (const [ancho, alto] of [[390, 844], [320, 640]]) {
    await n.vista(ancho, alto, true);
    const { cuadros: movil } = await recorrido(true);
    comprobar(movil.every((c) => c.ancho), `${ancho}px: sin desbordamiento durante el recorrido`);
    await esperar(800);
    comprobar(await n.evaluar(`(() => { const b = ${repetir}.getBoundingClientRect(); return b.top >= 0 && b.right <= innerWidth; })()`), `${ancho}px: repetir visible`);
    await n.capturar(`04-final-${ancho}`);
  }

  comprobar(await n.evaluar("window.__errores.length === 0"), "Sin errores en la consola");
  await n.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await n.ir("/demo-construccion");
  comprobar(await n.esperar(`document.querySelector(".escritorio")?.dataset.reduced === "true" && ${terminado} && !!document.querySelector(".lapso-final")`), "Movimiento reducido: muestra el sistema terminado");
  comprobar(await n.evaluar('performance.getEntriesByType("resource").every(r => !r.name.includes("supabase.co"))'), "Sin consultas de navegador a Supabase");
  await n.ir("/clientes");
  comprobar((await n.ruta()).startsWith("/login"), "Clientes conserva autenticación");
  console.log(`\n${verificaciones}/${verificaciones} aprobadas. Capturas: ${capturas}`);
} catch (error) {
  await n.capturar("fallo");
  throw error;
} finally { n.cerrar(); }
