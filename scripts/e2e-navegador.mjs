// Prueba de extremo a extremo en un navegador real (Edge/Chrome sin interfaz)
// controlado por el protocolo DevTools, sin dependencias adicionales.
//
// Requiere la app en ejecución (npm run build && npm start) y:
//   E2E_CREDENCIALES=/ruta/credenciales.env  (usuarios ficticios; nunca en Git)
//   E2E_NAVEGADOR=/ruta/msedge.exe           (opcional)
//   E2E_URL=http://localhost:3000            (opcional)
//   E2E_CAPTURAS=/ruta/carpeta               (opcional, guarda capturas PNG)
// Crea registros ficticios marcados con "[PRUEBA E1]". No elimina nada.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as esperarMs } from "node:timers/promises";
import { cargarEntorno, crearReporte, MARCA_PRUEBA } from "./comun.mjs";

const env = cargarEntorno();
const APP = process.env.E2E_URL ?? "http://localhost:3000";
const NAVEGADOR =
  process.env.E2E_NAVEGADOR ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const CAPTURAS = process.env.E2E_CAPTURAS;
const PUERTO = 9333;
const { comprobar, terminar } = crearReporte();
const sufijo = Date.now().toString(36).toUpperCase();

// --- Navegador y protocolo DevTools --------------------------------------
const perfilTemporal = mkdtempSync(join(tmpdir(), "erp-e2e-"));
const proceso = spawn(NAVEGADOR, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfilTemporal}`, "about:blank",
], { stdio: "ignore" });

let objetivo;
for (let intento = 0; intento < 50 && !objetivo; intento++) {
  await esperarMs(200);
  try {
    const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
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
  await cdp("Page.navigate", { url: `${APP}${destino}` });
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

async function capturar(nombre) {
  if (!CAPTURAS) return;
  const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(join(CAPTURAS, `${nombre}.png`), Buffer.from(data, "base64"));
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

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Network.enable");
await vista(1280, 800, false);

try {
  // 1. Protección de rutas sin sesión
  await cdp("Network.clearBrowserCookies");
  await ir("/clientes");
  comprobar("sin sesión /clientes redirige al login", (await ruta()) === "/login?siguiente=%2Fclientes", await ruta());
  await ir("/configuracion/usuarios");
  comprobar("sin sesión /configuracion/usuarios redirige al login", (await ruta()).startsWith("/login"));
  const textoLogin = await texto();
  comprobar("el login no ofrece registro público", !/regist|crear cuenta|sign ?up/i.test(textoLogin));
  await capturar("01-login-escritorio");

  // 2. Credenciales incorrectas y usuario inactivo
  await iniciarSesion(env.E2E_OPERADOR_CORREO, "clave-incorrecta");
  comprobar("contraseña incorrecta muestra error", await esperar("document.body.innerText.includes('Correo o contraseña incorrectos')"));
  await iniciarSesion(env.E2E_INACTIVO_CORREO, env.E2E_INACTIVO_CLAVE);
  comprobar("usuario inactivo no entra", await esperar("document.body.innerText.includes('no está habilitado')"));
  await ir("/clientes");
  comprobar("tras el rechazo no queda sesión", (await ruta()).startsWith("/login"));

  // 3. Operador: inicio de sesión con regreso a la ruta pedida
  await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE, "/login?siguiente=%2Fclientes");
  comprobar("operador entra y vuelve a /clientes", await esperar("location.pathname === '/clientes'"), await ruta());
  await ir("/login");
  comprobar("con sesión, /login redirige al panel", (await ruta()) === "/");
  comprobar("el panel muestra el perfil", await esperar("document.body.innerText.includes('Perfil: Operador')"));
  comprobar("operador no ve el menú Usuarios",
    (await esperar("document.querySelector('a[href=\"/clientes\"]')")) &&
    !(await evaluar("Boolean(document.querySelector('a[href=\"/configuracion/usuarios\"]'))")));

  // 4. Registro, validación, edición y duplicados de clientes
  const nombreCliente = `${MARCA_PRUEBA} Navegador ${sufijo}`;
  await ir("/clientes/nuevo");
  await pulsar("Registrar");
  comprobar("nombre obligatorio validado en servidor", await esperar("document.body.innerText.includes('Este campo es obligatorio')"));
  await llenar("#campo-nombre", nombreCliente);
  await llenar("#campo-correo", "no-es-correo");
  await pulsar("Registrar");
  comprobar("correo inválido rechazado", await esperar("document.body.innerText.includes('Correo electrónico no válido')"));
  comprobar("los datos escritos se conservan tras el error", (await evaluar("document.querySelector('#campo-nombre').value")) === nombreCliente);
  await llenar("#campo-correo", "");
  await pulsar("Registrar");
  comprobar("cliente registrado", await esperar("/^\\/clientes\\/[0-9a-f-]{36}$/.test(location.pathname) && document.body.innerText.includes('Datos guardados')"), await ruta());
  const rutaCliente = await evaluar("location.pathname");

  await llenar("#campo-telefono", "2222-3333");
  await llenar("#campo-tipo", "juridica");
  await pulsar("Guardar cambios");
  await esperarMs(500);
  await listo();
  await ir(rutaCliente);
  comprobar("edición de cliente persistida",
    (await evaluar("document.querySelector('#campo-telefono').value")) === "2222-3333" &&
    (await evaluar("document.querySelector('#campo-tipo').value")) === "juridica");

  await ir("/clientes/nuevo");
  await llenar("#campo-nombre", nombreCliente.toLowerCase());
  await pulsar("Registrar");
  comprobar("posible duplicado genera advertencia", await esperar("document.body.innerText.includes('Ya existen clientes')"));
  await pulsar("Registrar de todos modos");
  comprobar("se puede registrar tras confirmar", await esperar("document.body.innerText.includes('Datos guardados')"));

  await ir(`/clientes?q=${encodeURIComponent(`Navegador ${sufijo}`)}`);
  comprobar("la búsqueda encuentra ambos registros", (await evaluar("document.querySelectorAll('tbody tr').length")) === 2);
  await ir(`/clientes?q=${encodeURIComponent(`Navegador ${sufijo}`)}&estado=inactivos`);
  comprobar("filtro de inactivos", (await texto()).includes("No hay registros que coincidan"));

  // 5. Vehículos
  const codigo = `prb-nav-${sufijo}`.toLowerCase();
  await ir("/vehiculos/nuevo");
  await llenar("#campo-codigo", codigo);
  await llenar("#campo-tipo", "ambulancia");
  await llenar("#campo-anio", "2021");
  await pulsar("Registrar");
  comprobar("vehículo registrado con código en mayúsculas",
    await esperar(`document.body.innerText.includes('Datos guardados') && document.querySelector('h1')?.textContent === ${JSON.stringify(codigo.toUpperCase())}`));
  const rutaVehiculo = await evaluar("location.pathname");
  await llenar("#campo-estado", "mantenimiento");
  await llenar("#campo-marca", "Toyota");
  await pulsar("Guardar cambios");
  await esperarMs(500);
  await ir(rutaVehiculo);
  comprobar("edición de vehículo persistida",
    (await evaluar("document.querySelector('#campo-estado').value")) === "mantenimiento" &&
    (await evaluar("document.querySelector('#campo-marca').value")) === "Toyota");
  await ir("/vehiculos/nuevo");
  await llenar("#campo-codigo", codigo);
  await llenar("#campo-tipo", "mixto");
  await pulsar("Registrar");
  comprobar("código de vehículo repetido muestra error en el campo", await esperar("document.body.innerText.includes('Ya existe un vehículo con este código')"));

  // 6. Restricciones del operador
  await ir("/planes");
  comprobar("operador ve planes sin botón de alta", !(await texto()).includes("Nuevo plan"));
  await ir("/planes/nuevo");
  comprobar("operador no puede registrar planes", (await texto()).includes("Su rol no permite"));
  await ir("/finanzas/cuentas/nuevo");
  comprobar("operador no puede registrar cuentas", (await texto()).includes("Su rol no permite"));
  await ir("/configuracion/usuarios");
  comprobar("operador no administra usuarios", (await texto()).includes("Solo el administrador"));

  // 7. Móvil
  await vista(390, 844, true);
  await ir("/clientes");
  comprobar("móvil: sin desplazamiento horizontal", await evaluar("document.documentElement.scrollWidth <= window.innerWidth"));
  comprobar("móvil: listado en tarjetas", await evaluar("getComputedStyle(document.querySelector('ul.sm\\\\:hidden')).display !== 'none'"));
  comprobar("móvil: menú plegado", await evaluar("getComputedStyle(document.querySelector('#menu-principal')).display === 'none'"));
  await capturar("02-clientes-movil");
  await pulsar("Menú");
  comprobar("móvil: el botón despliega el menú", await esperar("getComputedStyle(document.querySelector('#menu-principal')).display !== 'none'"));
  await capturar("03-menu-movil");
  await ir(rutaCliente);
  comprobar("móvil: formulario sin desplazamiento horizontal", await evaluar("document.documentElement.scrollWidth <= window.innerWidth"));
  await capturar("04-cliente-movil");
  await vista(1280, 800, false);
  await ir("/clientes");
  await capturar("05-clientes-escritorio");

  // 8. Cierre de sesión
  await pulsar("Cerrar sesión");
  comprobar("cerrar sesión lleva al login", await esperar("location.pathname === '/login'"));
  await ir("/vehiculos");
  comprobar("tras cerrar sesión las rutas vuelven a estar protegidas", (await ruta()).startsWith("/login"));

  // 9. Finanzas: consulta sin edición de clientes
  await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
  await esperar("location.pathname === '/'");
  await ir(rutaCliente);
  comprobar("finanzas consulta el cliente en solo lectura",
    (await texto()).includes("Su rol permite consultar") && !(await evaluar("Boolean(document.querySelector('form #campo-nombre'))")));
  await ir("/proveedores/nuevo");
  comprobar("finanzas puede registrar proveedores", await evaluar("Boolean(document.querySelector('#campo-nombre'))"));

  // 10. Administrador
  await iniciarSesion(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
  await esperar("location.pathname === '/'");
  comprobar("administrador ve el menú Usuarios", await esperar("document.querySelector('a[href=\"/configuracion/usuarios\"]')"));
  await ir("/configuracion/usuarios");
  comprobar("administrador lista los perfiles", (await texto()).includes("Prueba Operador"));
  await capturar("06-usuarios-escritorio");
  const idPropio = await evaluar(`[...document.querySelectorAll("a")].find((a) => a.textContent.includes("(usted)"))?.getAttribute("href")`);
  await ir(idPropio);
  comprobar("en su propio perfil, rol y estado están bloqueados",
    await evaluar("document.querySelector('#rol').disabled && document.querySelector('input[name=activo]').disabled"));
  await ir("/configuracion/usuarios");
  const idFinanzas = await evaluar(`[...document.querySelectorAll("a")].find((a) => a.textContent.includes("Prueba Finanzas"))?.getAttribute("href")`);
  await ir(idFinanzas);
  await llenar("#rol", "operador");
  await pulsar("Guardar cambios");
  comprobar("cambio de rol sin motivo es rechazado en la interfaz", await esperar("document.body.innerText.includes('Indique el motivo')"));
  await ir(idFinanzas);
  await llenar("#nombre", "Prueba Finanzas (ficticio)");
  await pulsar("Guardar cambios");
  comprobar("administrador guarda un perfil", await esperar("document.body.innerText.includes('Usuario actualizado')"));
  await ir("/planes/nuevo");
  await llenar("#campo-nombre", `${MARCA_PRUEBA} Plan navegador ${sufijo}`);
  await llenar("#campo-precio_mensual", "1,250.5");
  await llenar("#campo-cupo_mensual", "3");
  await llenar("#campo-modalidad_cupo", "individual");
  await llenar("#campo-dias_gracia", "5");
  await pulsar("Registrar");
  comprobar("administrador registra plan", await esperar("document.body.innerText.includes('Datos guardados')"));
  comprobar("el precio se guarda como 1250.50", (await evaluar("document.querySelector('#campo-precio_mensual').value")) === "1250.50");
  await ir("/planes");
  comprobar("listado de planes en HNL", (await texto()).includes("L\u00a01,250.50"));
} finally {
  ws.close();
  proceso.kill();
  terminar();
}
