// Solo la presentación ficticia. Sin credenciales ni escrituras en Supabase.
// Ejecutar con el servidor local activo: node scripts/e2e-demo-construccion.mjs
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
  verificaciones++;
  console.log(`OK ${verificaciones}: ${mensaje}`);
}
async function buscarTiempo(ms) {
  await n.llenar('input[type="range"]', String(ms));
  await esperar(100);
}
const tiempo = () => n.evaluar('Number(document.querySelector("input[type=range]").value)');
try {
  await n.ir("/demo-construccion");
  comprobar(await n.esperar(`document.querySelector('button[aria-label="Reproducir animación"]')`), "Presentación accesible sin sesión");
  comprobar((await n.ruta()) === "/demo-construccion", "Ruta propia, sin redirección al ERP");
  comprobar(await tiempo() === 0, "Empieza pausada en cero");
  comprobar(await n.evaluar('getComputedStyle(document.querySelector("[class*=pantalla]")).opacity === "1"'), "Primera pantalla visible estando pausada");

  await n.pulsar("Reproducir");
  comprobar(await n.esperar('Number(document.querySelector("input[type=range]").value) > 600'), "El reloj avanza al reproducir");
  await n.pulsar("Pausar");
  const pausado = await tiempo();
  await esperar(350);
  comprobar(await tiempo() === pausado, "Pausa detiene el reloj");
  await n.pulsar("Reproducir");
  comprobar(await n.esperar(`Number(document.querySelector("input[type=range]").value) > ${pausado + 300}`), "Reanuda desde la misma posición");
  await n.pulsar("Pausar");

  // Cada escena muestra escritura, datos en formulario y resultado al avanzar.
  const resultados = ["Todo empieza con una estructura.", "Cliente guardado correctamente", "Membresía creada", "Traslado programado correctamente", "Servicios finalizados", "Cobro confirmado y aplicado", "L 2,300.00"];
  for (let i = 0; i < 7; i++) {
    await buscarTiempo(i * 14000 + 2500);
    comprobar(await n.evaluar('document.querySelector("pre").innerText.length > 30'), `Escena ${i + 1}: código visible`);
    if (i > 0 && i < 6) {
      await buscarTiempo(i * 14000 + 9200);
      comprobar(await n.evaluar('[...document.querySelectorAll("[class*=valorCampo]")].every(el => el.textContent.length > 2 && !el.textContent.includes("Seleccionar"))'), `Escena ${i + 1}: campos completados`);
    }
    await buscarTiempo(i * 14000 + 12000);
    comprobar((await n.texto()).includes(resultados[i]), `Escena ${i + 1}: resultado coherente`);
    comprobar(await n.evaluar(`document.querySelector('main[data-scene="${i}"]') !== null`), `Escena ${i + 1}: búsqueda temporal`);
  }
  comprobar(await n.evaluar('document.querySelector(".dc-play").getBoundingClientRect().bottom <= innerHeight'), "Controles visibles en escritorio 1280×800");
  await n.vista(1440, 900, false);
  await n.capturar("escritorio-resultado");
  await buscarTiempo(14000 + 8500);
  await n.capturar("escritorio-formulario");
  await n.evaluar(`document.querySelector('nav[aria-label="Capítulos de la animación"] button').click()`);
  comprobar(await tiempo() === 0, "Los capítulos permiten volver al principio");

  await n.llenar("select", "2");
  await n.pulsar("Reproducir");
  await esperar(700);
  await n.pulsar("Pausar");
  comprobar(await tiempo() >= 1100 && await tiempo() < 3000, "Velocidad 2× aplicada al reloj");
  await buscarTiempo(97700);
  await n.pulsar("Reproducir");
  comprobar(await n.esperar(`document.querySelector('button[aria-label="Volver a reproducir"]')`), "El final detiene la reproducción");
  comprobar(await tiempo() === 98000, "Duración total exacta: 98 segundos");
  await n.pulsar("Ver de nuevo");
  comprobar(await tiempo() < 5000, "Repetir vuelve al principio");
  await n.pulsar("Reiniciar");
  comprobar(await tiempo() === 0 && await n.evaluar('document.querySelector("main").dataset.playing === "false"'), "Reiniciar restablece posición y pausa");

  for (const ancho of [390, 320]) {
    await n.vista(ancho, 844, true);
    for (const i of [1, 4, 6]) {
      await buscarTiempo(i * 14000 + 12000);
      comprobar(await n.evaluar('document.documentElement.scrollWidth <= innerWidth'), `Móvil ${ancho}px, escena ${i + 1}: sin desbordamiento horizontal`);
    }
  }
  await n.vista(390, 844, true);
  comprobar(await n.evaluar('document.querySelector(".dc-play").getBoundingClientRect().bottom <= innerHeight'), "Controles visibles en móvil sin desplazarse al pie");
  await n.capturar("movil-resultado");
  await n.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await buscarTiempo(14500);
  comprobar(await n.esperar('document.querySelector("main").dataset.reduced === "true"'), "Respeta movimiento reducido");
  comprobar(await n.evaluar('document.querySelector("pre").innerText.includes("Guardar cliente")'), "Movimiento reducido muestra el código completo");
  comprobar(await n.evaluar('document.querySelector("[class*=valorCampo]").textContent === "Ana Demo"'), "Movimiento reducido muestra los campos completos");
  comprobar(await n.evaluar('performance.getEntriesByType("resource").every(r => !r.name.includes("supabase.co"))'), "La presentación no hace consultas de navegador a Supabase");

  await n.ir("/clientes");
  comprobar((await n.ruta()).startsWith("/login"), "Clientes sigue protegido sin sesión");
  await n.ir("/demo-construccion/clientes");
  comprobar((await n.ruta()).startsWith("/login"), "La excepción pública no abre subrutas");
  console.log(`\n${verificaciones}/${verificaciones} comprobaciones aprobadas. Capturas: ${capturas}`);
} catch (error) {
  await n.capturar("fallo");
  console.error("Ruta al fallar:", await n.ruta());
  console.error("Título:", await n.evaluar("document.title"));
  throw error;
} finally {
  n.cerrar();
}
