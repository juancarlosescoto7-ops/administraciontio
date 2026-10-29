// Verifica la película visual. Sin credenciales ni operaciones en Supabase.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { setTimeout as esperar } from "node:timers/promises";
import { abrirNavegador } from "./navegador.mjs";

const capturas = process.env.E2E_CAPTURAS ?? ".next/demo-capturas";
mkdirSync(capturas, { recursive: true });
const n = await abrirNavegador({ capturas, puerto: 9341 });
let verificaciones = 0;
function comprobar(valor, mensaje) {
  assert.ok(valor, mensaje);
  console.log(`OK ${++verificaciones}: ${mensaje}`);
}
async function buscarTiempo(ms) {
  await n.llenar('input[type="range"]', String(ms));
  await esperar(100);
}
async function pulsar(etiqueta) {
  const selector = `button[aria-label="${etiqueta}"]`;
  comprobar(await n.esperar(`document.querySelector(${JSON.stringify(selector)})`), `Control disponible: ${etiqueta}`);
  await n.evaluar(`document.querySelector(${JSON.stringify(selector)}).click()`);
}
const tiempo = () => n.evaluar('Number(document.querySelector("input[type=range]").value)');
const estilo = (selector, propiedad) => n.evaluar(`getComputedStyle(document.querySelector(${JSON.stringify(selector)}))[${JSON.stringify(propiedad)}]`);
try {
  await n.ir("/demo-construccion");
  comprobar(await n.esperar('document.querySelector(".ds-system")'), "Simulación accesible sin sesión");
  comprobar(await tiempo() === 0, "Empieza pausada en cero");
  comprobar(await estilo(".ds-system", "fontFamily") === '"Times New Roman", serif', "HTML inicial con tipografía nativa");
  comprobar(await estilo(".ds-system", "display") === "block", "HTML inicial sin distribución de aplicación");
  comprobar(await estilo(".ds-system a", "color") === "rgb(0, 0, 238)", "Enlaces HTML azules sin estilo de aplicación");
  comprobar(await n.evaluar('!document.querySelector("pre,code,.dc-editor,.dc-relato,.dc-capitulos")'), "Sin editor, narración ni capítulos explicativos");
  comprobar(await n.evaluar('document.querySelector(".ds-system").inert'), "Interfaz simulada inerte: no admite envíos ni navegación");
  await n.vista(1440, 900, false);
  await n.capturar("01-html");

  await buscarTiempo(7000);
  comprobar(await estilo(".ds-system", "display") === "grid", "La misma interfaz adquiere distribución");
  comprobar(await estilo(".ds-card", "borderRadius") === "0px", "Estructura todavía sin acabado visual");
  await n.capturar("02-estructura");
  await buscarTiempo(12000);
  comprobar((await estilo(".ds-system", "fontFamily")).includes("Inter"), "Se incorpora la tipografía del ERP");
  await buscarTiempo(18000);
  comprobar(await estilo(".ds-card", "borderRadius") === "8px", "Se incorpora el diseño de tarjetas");
  comprobar(await estilo(".ds-actions button", "color") === "rgb(83, 58, 253)", "Se aplica el acento índigo del sistema");
  await n.capturar("03-diseno");
  await buscarTiempo(20500);
  const barraInicial = await estilo(".ds-bar-track > div", "height");
  const contadorInicial = await n.evaluar('document.querySelectorAll(".ds-metric strong")[1].textContent');
  await buscarTiempo(22500);
  comprobar(await n.evaluar('document.querySelectorAll(".ds-metric strong")[1].textContent') !== contadorInicial, "Las cifras se animan");
  comprobar(await estilo(".ds-bar-track > div", "height") === barraInicial, "Actividad sin ingresos mantiene barra mínima");
  comprobar(await n.evaluar('document.querySelectorAll(".ds-bar-track > div")[1].getBoundingClientRect().height > 40'), "Las barras con ingresos se despliegan");

  for (const [inicio, pantalla, resultado] of [[29500, "clientes", "Cliente guardado"], [41500, "membresias", "Membresía creada"], [53500, "cobros", "Cobro registrado"]]) {
    await buscarTiempo(inicio + 500);
    comprobar(await n.evaluar(`document.querySelector('.ds-system').dataset.screen === '${pantalla}'`), `Navega a ${pantalla}`);
    comprobar(await n.evaluar('document.querySelector(".ds-modal input").value === ""'), `${pantalla}: formulario inicialmente vacío`);
    await buscarTiempo(inicio + 1100);
    comprobar(await n.evaluar('document.querySelector(".ds-modal input").value.length > 0 && document.querySelector(".ds-modal input").value.length < 8'), `${pantalla}: escritura progresiva`);
    await buscarTiempo(inicio + 6000);
    comprobar(await n.evaluar('[...document.querySelectorAll(".ds-modal input")].every(el => el.value.length > 0)'), `${pantalla}: datos completados`);
    await n.capturar(`04-formulario-${pantalla}`);
    await buscarTiempo(inicio + 7000);
    comprobar(await n.evaluar('document.querySelector(".ds-modal") === null'), `${pantalla}: cierra el formulario`);
    comprobar((await n.texto()).includes(resultado), `${pantalla}: confirma el registro simulado`);
  }
  await buscarTiempo(67000);
  comprobar(await n.evaluar('[...document.querySelectorAll(".ds-metric strong")].map(el=>el.textContent).join("|") === "L 500.00|L 2,300.00|2|1"'), "Panel final: cobro, deuda, clientes y membresía coherentes");
  comprobar((await n.texto()).includes("L 2,800.00"), "Ingresos distintos de los cobros recibidos");
  await n.capturar("05-sistema-final");
  await buscarTiempo(28000);
  comprobar(!(await n.texto()).includes("Ana Demo"), "Retroceder deshace los registros simulados");

  await pulsar("Reproducir animación");
  comprobar(await n.esperar('Number(document.querySelector("input[type=range]").value) > 28500'), "Reproducción avanza");
  await pulsar("Pausar animación");
  const pausado = await tiempo();
  const cursorPausado = await estilo(".ds-cursor", "transform");
  await esperar(300);
  comprobar(await tiempo() === pausado, "Pausa congela el reloj");
  comprobar(await estilo(".ds-cursor", "transform") === cursorPausado, "Pausa congela el cursor");
  await pulsar("Reproducir animación");
  comprobar(await n.esperar(`Number(document.querySelector("input[type=range]").value) > ${pausado + 300}`), "Reanuda desde el mismo punto");
  await pulsar("Pausar animación");
  await pulsar("Reiniciar animación");
  comprobar(await tiempo() === 0 && await estilo(".ds-system", "display") === "block", "Reiniciar vuelve al HTML sin estilos");
  await n.llenar("select", "2");
  await pulsar("Reproducir animación");
  await esperar(700);
  await pulsar("Pausar animación");
  comprobar(await tiempo() > 1100 && await tiempo() < 3000, "Velocidad 2×");
  await buscarTiempo(71700);
  await pulsar("Reproducir animación");
  comprobar(await n.esperar(`document.querySelector('button[aria-label="Volver a reproducir"]')`), "Se detiene al finalizar");
  comprobar(await tiempo() === 72000, "Duración exacta: 72 segundos");
  await pulsar("Volver a reproducir");
  comprobar(await tiempo() < 3000, "Repetir comienza en HTML");
  await pulsar("Pausar animación");

  for (const ancho of [1280, 390, 320]) {
    await n.vista(ancho, 844, ancho < 500);
    for (const momento of [0, 18000, 35000, 67000]) {
      await buscarTiempo(momento);
      comprobar(await n.evaluar('document.documentElement.scrollWidth <= innerWidth'), `${ancho}px, ${momento}ms: sin desbordamiento de página`);
      comprobar(await n.evaluar('document.querySelector(".ds-player").getBoundingClientRect().bottom <= innerHeight + 1'), `${ancho}px: reproductor visible`);
    }
  }
  await n.vista(390, 844, true);
  await buscarTiempo(35000);
  await n.capturar("06-movil-formulario");
  await n.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await buscarTiempo(30000);
  comprobar(await n.esperar('document.querySelector("main").dataset.reduced === "true"'), "Respeta movimiento reducido");
  comprobar(await n.evaluar('!document.querySelector(".ds-cursor") && document.querySelector(".ds-modal input").value === "Ana Demo"'), "Movimiento reducido: campos completos y sin cursor móvil");
  comprobar(await n.evaluar('performance.getEntriesByType("resource").every(r=>!r.name.includes("supabase.co"))'), "Sin consultas de navegador a Supabase");
  await n.ir("/clientes");
  comprobar((await n.ruta()).startsWith("/login"), "Clientes conserva autenticación");
  console.log(`\n${verificaciones}/${verificaciones} aprobadas. Capturas: ${capturas}`);
} catch (error) {
  await n.capturar("fallo");
  throw error;
} finally { n.cerrar(); }
