// Control de un navegador real (Edge/Chrome sin interfaz) mediante el
// protocolo DevTools, sin dependencias adicionales. Compartido por las
// pruebas de extremo a extremo.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as esperarMs } from "node:timers/promises";

export async function abrirNavegador({
  app = process.env.E2E_URL ?? "http://localhost:3000",
  navegador = process.env.E2E_NAVEGADOR ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  capturas = process.env.E2E_CAPTURAS,
  puerto = 9333,
} = {}) {
  const perfilTemporal = mkdtempSync(join(tmpdir(), "erp-e2e-"));
  const proceso = spawn(navegador, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfilTemporal}`, "about:blank",
  ], { stdio: "ignore" });

  let objetivo;
  for (let intento = 0; intento < 50 && !objetivo; intento++) {
    await esperarMs(200);
    try {
      const lista = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
      objetivo = lista.find((t) => t.type === "page");
    } catch {
      // El navegador aún no abre el puerto.
    }
  }
  if (!objetivo) throw new Error("No se pudo conectar con el navegador.");

  const ws = new WebSocket(objetivo.webSocketDebuggerUrl);
  await new Promise((resolver) => ws.addEventListener("open", resolver, { once: true }));
  let siguienteId = 0;
  const pendientes = new Map();
  ws.addEventListener("message", (evento) => {
    const mensaje = JSON.parse(evento.data);
    if (mensaje.id && pendientes.has(mensaje.id)) {
      const { resolver, rechazar } = pendientes.get(mensaje.id);
      pendientes.delete(mensaje.id);
      if (mensaje.error) rechazar(new Error(mensaje.error.message));
      else resolver(mensaje.result);
    }
  });
  function cdp(method, params = {}) {
    const id = ++siguienteId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolver, rechazar) => pendientes.set(id, { resolver, rechazar }));
  }

  async function evaluar(expresion) {
    const { result, exceptionDetails } = await cdp("Runtime.evaluate", {
      expression: expresion, returnByValue: true, awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  }

  async function esperar(expresion, ms = 15000) {
    const limite = Date.now() + ms;
    while (Date.now() < limite) {
      try {
        if (await evaluar(`Boolean(${expresion})`)) return true;
      } catch {
        // La página puede estar navegando.
      }
      await esperarMs(150);
    }
    return false;
  }

  const ruta = () => evaluar("location.pathname + location.search");
  const texto = () => evaluar("document.body.innerText");
  const listo = () => esperar("document.readyState === 'complete' && !document.querySelector('[role=status]')?.textContent?.includes('Cargando')");

  async function ir(destino) {
    await cdp("Page.navigate", { url: `${app}${destino}` });
    await esperarMs(300);
    await listo();
  }

  async function llenar(selector, valor) {
    await evaluar(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error("No existe " + ${JSON.stringify(selector)});
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
        : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(valor)});
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
  }

  async function pulsar(textoBoton) {
    // Los botones de envío se habilitan cuando React termina de hidratar.
    await esperar(`[...document.querySelectorAll("button, a")].some((b) => b.textContent.trim() === ${JSON.stringify(textoBoton)} && !b.disabled)`);
    await evaluar(`(() => {
      const boton = [...document.querySelectorAll("button, a")].find((b) => b.textContent.trim() === ${JSON.stringify(textoBoton)});
      if (!boton) throw new Error("No existe el botón " + ${JSON.stringify(textoBoton)});
      boton.click();
    })()`);
  }

  /**
   * Abre una ventana flotante por el texto de su botón. Si el botón está en una
   * caja cerrada (contenido inerte), primero abre la caja, como haría un usuario.
   */
  async function abrirVentana(texto) {
    const boton = `[...document.querySelectorAll('button[aria-haspopup=dialog]')].find((b) => b.textContent.includes(${JSON.stringify(texto)}))`;
    await esperar(`${boton} && !${boton}.disabled`);
    await evaluar(`(() => {
      const panel = ${boton}.closest('[inert]');
      if (panel) document.querySelector('[aria-controls="' + panel.id + '"]')?.click();
    })()`);
    await esperar(`!${boton}.closest('[inert]')`);
    await evaluar(`${boton}.click()`);
    await esperar("document.querySelector('dialog[open]')");
  }

  async function capturar(nombre) {
    if (!capturas) return;
    const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(join(capturas, `${nombre}.png`), Buffer.from(data, "base64"));
  }

  async function vista(ancho, alto, movil) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width: ancho, height: alto, deviceScaleFactor: movil ? 2 : 1, mobile: movil,
    });
  }

  async function iniciarSesion(correo, clave, destino = "/login") {
    await cdp("Network.clearBrowserCookies");
    await ir(destino);
    await esperar("document.querySelector('input[name=correo]')");
    await llenar("input[name=correo]", correo);
    await llenar("input[name=contrasena]", clave);
    await pulsar("Iniciar sesión");
  }

  function cerrar() {
    ws.close();
    proceso.kill();
  }

  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Network.enable");
  await vista(1280, 800, false);

  return { cdp, evaluar, esperar, ruta, texto, listo, ir, llenar, pulsar, abrirVentana, capturar, vista, iniciarSesion, cerrar };
}
