// Exporta /demo-construccion a un video MP4 para un editor de video.
// Dibuja cuadro a cuadro con un reloj virtual (temporizadores, requestAnimationFrame,
// animaciones/transiciones CSS y desplazamientos suaves avanzan exactamente 1/fps por
// cuadro), así el video sale fluido aunque cada captura tarde más que un cuadro.
// No usa sesión ni toca Supabase.
//
// Uso: node scripts/exportar-demo-video.mjs [--salida ruta.mp4] [--ancho 1920] [--alto 1080] [--fps 60] [--hasta segundos]
//   E2E_URL=http://localhost:3000   (opcional)
//   FFMPEG=ruta\ffmpeg.exe          (opcional; si no, se busca en PATH y en WinGet)
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { abrirNavegador } from "./navegador.mjs";

const argumento = (nombre, valor) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : valor;
};
const ANCHO = Number(argumento("ancho", 1920));
const ALTO = Number(argumento("alto", 1080));
const FPS = Number(argumento("fps", 60));
const SALIDA = argumento("salida", join(homedir(), "Videos", "demo-construccion-erp.mp4"));
const CUADRO = 1000 / FPS;
/** Solo los primeros segundos (para revisar antes de exportar todo). */
const HASTA = Number(argumento("hasta", 0));
/** Cuadros que se mantienen al final, con el sistema quieto. */
const COLA = FPS;

function buscarFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  if (spawnSync("ffmpeg", ["-version"]).status === 0) return "ffmpeg";
  const paquetes = join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Packages");
  const ffmpeg = existsSync(paquetes) && readdirSync(paquetes).find((p) => p.startsWith("Gyan.FFmpeg"));
  if (ffmpeg) {
    const base = join(paquetes, ffmpeg);
    const version = readdirSync(base).find((d) => d.startsWith("ffmpeg-"));
    if (version && existsSync(join(base, version, "bin", "ffmpeg.exe"))) return join(base, version, "bin", "ffmpeg.exe");
  }
  throw new Error("No se encontró ffmpeg. Instálelo (winget install Gyan.FFmpeg) o indique FFMPEG=ruta.");
}

// Reloj virtual inyectado antes de cargar la página. Nada avanza hasta que se llama a __avanzar.
const RELOJ_VIRTUAL = `(() => {
  const real = { st: setTimeout.bind(window), raf: requestAnimationFrame.bind(window), ahora: Date.now() };
  let vt = 0;
  let id = 1;
  const temporizadores = new Map();
  let cuadros = new Map();
  window.requestAnimationFrame = (cb) => { const n = id++; cuadros.set(n, cb); return n; };
  window.cancelAnimationFrame = (n) => cuadros.delete(n);
  window.setTimeout = (cb, ms = 0, ...args) => { const n = id++; temporizadores.set(n, { en: vt + Math.max(0, Number(ms) || 0), cb, args, cada: 0 }); return n; };
  window.setInterval = (cb, ms = 0, ...args) => { const cada = Math.max(1, Number(ms) || 0); const n = id++; temporizadores.set(n, { en: vt + cada, cb, args, cada }); return n; };
  window.clearTimeout = window.clearInterval = (n) => temporizadores.delete(n);
  performance.now = () => vt;
  Date.now = () => real.ahora + vt;

  // Desplazamiento suave también en tiempo virtual.
  const contenedor = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p; } return document.scrollingElement; };
  const suave = (el, destino) => {
    const desde = el.scrollTop, t0 = vt, final = Math.max(0, Math.min(destino, el.scrollHeight - el.clientHeight));
    const paso = () => { const p = Math.min(1, (vt - t0) / 450); el.scrollTop = desde + (final - desde) * (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2); if (p < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  };
  const desplazar = Element.prototype.scrollTo;
  Element.prototype.scrollTo = function (a, b) { if (a && typeof a === "object" && a.behavior === "smooth") return suave(this, a.top ?? this.scrollTop); return desplazar.call(this, a, b); };
  const alVer = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (opciones) {
    if (!opciones || typeof opciones !== "object" || opciones.behavior !== "smooth") return alVer.call(this, opciones);
    const caja = contenedor(this), r = this.getBoundingClientRect(), c = caja.getBoundingClientRect();
    const centro = opciones.block === "center" ? (c.height - r.height) / 2 : 0;
    suave(caja, caja.scrollTop + (r.top - c.top) - centro);
  };

  // Animaciones y transiciones CSS: en pausa y colocadas según el tiempo virtual desde que empezaron.
  const inicio = new WeakMap();
  window.__sincronizarAnimaciones = () => {
    for (const a of document.getAnimations()) {
      if (!inicio.has(a)) { inicio.set(a, vt); a.pause(); }
      try { a.currentTime = vt - inicio.get(a); } catch {}
    }
  };
  window.__avanzar = (dt) => {
    const fin = vt + dt;
    for (;;) {
      let proximo = null;
      for (const entrada of temporizadores) if (entrada[1].en <= fin && (!proximo || entrada[1].en < proximo[1].en)) proximo = entrada;
      if (!proximo) break;
      const [n, t] = proximo;
      vt = Math.max(vt, t.en);
      if (t.cada) t.en += t.cada; else temporizadores.delete(n);
      try { if (typeof t.cb === "function") t.cb(...t.args); } catch (e) { console.error(e); }
    }
    vt = fin;
    const lote = cuadros;
    cuadros = new Map();
    for (const cb of lote.values()) { try { cb(vt); } catch (e) { console.error(e); } }
  };
  // Deja que React confirme los cambios y el navegador pinte, con el reloj real.
  window.__asentar = () => new Promise((listo) => real.st(() => real.raf(() => { window.__sincronizarAnimaciones(); real.raf(() => listo()); }), 0));
})();`;

// Fuera del video: indicador de Next en desarrollo, botón «Repetir» y barras de desplazamiento.
const ESTILO_GRABACION = `nextjs-portal, .lapso-repetir { display: none !important; } * { scrollbar-width: none !important; }`;

const ffmpeg = buscarFfmpeg();
const n = await abrirNavegador({ puerto: 9361 });
const codificador = spawn(ffmpeg, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", SALIDA], {
  stdio: ["pipe", "inherit", "inherit"],
});
const terminado = new Promise((listo, error) => codificador.on("close", (codigo) => (codigo === 0 ? listo() : error(new Error(`ffmpeg terminó con código ${codigo}`)))));
const escribir = (datos) => new Promise((listo) => (codificador.stdin.write(datos) ? listo() : codificador.stdin.once("drain", listo)));

try {
  await n.cdp("Page.addScriptToEvaluateOnNewDocument", { source: RELOJ_VIRTUAL });
  await n.cdp("Emulation.setDeviceMetricsOverride", { width: ANCHO, height: ALTO, deviceScaleFactor: 1, mobile: false });
  await n.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await n.ir("/demo-construccion");
  if (!(await n.esperar('document.querySelector(".escritorio") && document.fonts.status === "loaded"', 30000))) throw new Error("La demo no cargó.");
  await n.evaluar(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(ESTILO_GRABACION)}; document.head.append(s); })()`);
  await n.evaluar("window.__asentar()");

  let cuadro = 0;
  let restantes = COLA;
  const inicio = Date.now();
  while (restantes > 0 && (!HASTA || cuadro < HASTA * FPS)) {
    if (cuadro > 0) await n.evaluar(`window.__avanzar(${CUADRO})`);
    await n.evaluar("window.__asentar()");
    const { data } = await n.cdp("Page.captureScreenshot", { format: "png", fromSurface: true });
    await escribir(Buffer.from(data, "base64"));
    cuadro++;
    if (await n.evaluar('document.querySelector(".escritorio")?.dataset.terminado === "true"')) restantes--;
    if (cuadro % FPS === 0) process.stdout.write(`\r${(cuadro / FPS).toFixed(0)} s de video · ${((Date.now() - inicio) / 1000).toFixed(0)} s reales`);
  }
  codificador.stdin.end();
  await terminado;
  console.log(`\nVideo listo: ${SALIDA} (${ANCHO}×${ALTO}, ${FPS} fps, ${(cuadro / FPS).toFixed(1)} s, ${cuadro} cuadros)`);
} catch (error) {
  codificador.stdin.destroy();
  throw error;
} finally {
  n.cerrar();
}
