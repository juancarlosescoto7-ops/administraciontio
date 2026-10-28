// Prueba de extremo a extremo de la interfaz financiera (E2) en un navegador
// real. Requiere la app en ejecución (npm run build && npm start) y las mismas
// variables que e2e-navegador.mjs. Prepara datos ficticios por la API (cliente,
// cuentas, saldo inicial y un cargo) y recorre los flujos con los tres roles.
// Crea registros marcados con "[PRUEBA E2]". No elimina nada.
import { randomUUID } from "node:crypto";
import { cargarEntorno, crearClienteRest, crearReporte } from "./comun.mjs";
import { abrirNavegador } from "./navegador.mjs";

const MARCA = "[PRUEBA E2]";
const env = cargarEntorno();
const { comprobar, terminar } = crearReporte();
const { iniciarSesion: sesionApi, api } = crearClienteRest(env);
const sufijo = Date.now().toString(36).toUpperCase();
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date());

// --- Datos de partida por la API ------------------------------------------
const adminApi = await sesionApi(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const nombreCliente = `${MARCA} Navegador ${sufijo}`;
const cliente = (await api(adminApi.token, "POST", "clientes", { nombre: nombreCliente })).datos[0].id;
const caja = (await api(adminApi.token, "POST", "cuentas_dinero", { nombre: `${MARCA} Caja N ${sufijo}`, tipo: "caja" })).datos[0].id;
const banco = (await api(adminApi.token, "POST", "cuentas_dinero", { nombre: `${MARCA} Banco N ${sufijo}`, tipo: "banco" })).datos[0].id;
await api(adminApi.token, "POST", "rpc/registrar_apertura", { p_idempotencia: randomUUID(), p_cuenta_dinero_id: caja, p_fecha: hoy, p_monto: "2000.00" });
const cargo = (await api(adminApi.token, "POST", "rpc/registrar_cargo", {
  p_idempotencia: randomUUID(), p_cliente_id: cliente, p_cuenta_ingreso: "4300", p_concepto: `${MARCA} Alquiler navegador`,
  p_fecha: hoy, p_vencimiento: null, p_monto: "1500.00",
})).datos;

const { evaluar, esperar, ruta, texto, ir, llenar, pulsar, capturar, vista, iniciarSesion, cerrar } = await abrirNavegador();
const marcar = (selector) => evaluar(`document.querySelector(${JSON.stringify(selector)}).click()`);
const contiene = async (fragmento) => (await texto()).includes(fragmento);
const L = (importe) => `L ${importe}`;

try {
  // 1. Operador: menú y registro de un cobro parcial aplicado al cargo
  await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
  await esperar("location.pathname === '/'");
  comprobar("operador ve Cobros, Cargos, Pendientes y Cajas en el menú",
    await esperar("['/finanzas/cobros','/finanzas/cargos','/finanzas/pendientes','/finanzas/cuentas'].every((h) => document.querySelector(`nav a[href=\"${h}\"]`))"));
  comprobar("operador no ve Gastos en el menú", !(await evaluar("Boolean(document.querySelector('nav a[href=\"/finanzas/gastos\"]'))")));

  await ir("/finanzas/cobros/nuevo");
  await llenar("input[name=q]", `Navegador ${sufijo}`);
  await pulsar("Buscar");
  await esperar(`[...document.querySelectorAll('a')].some((a) => a.textContent.includes(${JSON.stringify(nombreCliente)}))`);
  await evaluar(`[...document.querySelectorAll('a')].find((a) => a.textContent.includes(${JSON.stringify(nombreCliente)})).click()`);
  comprobar("buscar y elegir cliente muestra el formulario con el cargo pendiente",
    await esperar(`document.querySelector('#campo-aplicar_${cargo}')`));
  await capturar("e2-01-cobro-formulario");

  await llenar("#campo-monto", "500");
  await llenar("#campo-cuenta_dinero_id", caja);
  await llenar(`#campo-aplicar_${cargo}`, "600");
  await pulsar("Registrar cobro");
  comprobar("aplicar más que lo recibido se rechaza y conserva lo escrito",
    (await esperar("document.body.innerText.includes('supera el importe recibido')")) &&
    (await evaluar(`document.querySelector('#campo-aplicar_${cargo}').value`)) === "600");

  await llenar(`#campo-aplicar_${cargo}`, "500");
  await pulsar("Registrar cobro");
  comprobar("cobro de L 500 registrado", await esperar("location.pathname.startsWith('/finanzas/cobros/') && document.body.innerText.includes('Cobro registrado')", 20000));
  const rutaCobro = (await ruta()).split("?")[0];
  comprobar("detalle del cobro: recibido L 500, aplicado L 500, saldo a favor L 0",
    (await contiene(L("500.00"))) && (await contiene("Aplicado a cargos")) && (await contiene(L("0.00"))));
  comprobar("el operador no ve asientos ni puede reversar", !(await contiene("Asientos contables")) && !(await contiene("Reversar cobro")));

  await ir(`/finanzas/pendientes/${cliente}`);
  comprobar("estado de cuenta: total L 1,500, pagado L 500, pendiente L 1,000",
    (await contiene(L("1,500.00"))) && (await contiene(L("1,000.00"))) && (await contiene("Saldo a favor")));
  await ir("/finanzas/gastos");
  comprobar("operador no consulta gastos", await contiene("consultan el administrador y finanzas"));
  await ir("/finanzas/cuentas");
  comprobar("operador ve las cuentas sin saldos", !(await contiene("Dinero disponible")) && (await contiene(`Caja N ${sufijo}`)));

  // 2. Finanzas: gasto con abono y transferencia
  await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
  await esperar("location.pathname === '/'");
  await ir("/finanzas/gastos/nuevo");
  await llenar("#campo-concepto", `${MARCA} Diésel ${sufijo}`);
  await llenar("#campo-monto", "800");
  await llenar("#campo-categoria_id", await evaluar("document.querySelector('#campo-categoria_id').options[1].value"));
  await llenar("#campo-actividad", "ambulancias");
  await llenar("#campo-pago_monto", "300");
  await llenar("#campo-pago_cuenta_dinero_id", caja);
  await capturar("e2-02-gasto-formulario");
  await pulsar("Registrar gasto");
  comprobar("gasto de L 800 con abono de L 300 registrado",
    await esperar("location.pathname.startsWith('/finanzas/gastos/') && document.body.innerText.includes('Gasto registrado')", 20000));
  comprobar("detalle del gasto: reconocido L 800, pagado L 300, por pagar L 500",
    (await contiene(L("800.00"))) && (await contiene(L("300.00"))) && (await contiene(L("500.00"))) && (await contiene("Asientos contables")));

  await ir("/finanzas/cuentas/transferir");
  await llenar("#campo-cuenta_origen_id", caja);
  await llenar("#campo-cuenta_destino_id", banco);
  await llenar("#campo-monto", "1000");
  await pulsar("Registrar transferencia");
  comprobar("transferencia de L 1,000 registrada",
    await esperar("location.pathname.startsWith('/finanzas/cuentas/transferencias/') && document.body.innerText.includes('Transferencia registrada')", 20000));
  await ir(`/finanzas/cuentas/${caja}`);
  // 2,000 inicial + 500 cobro - 300 pago - 1,000 transferencia
  comprobar("saldo de Caja N: L 1,200 (movimientos confirmados)", (await contiene(L("1,200.00"))) && (await contiene("Saldo inicial")));
  await ir(`/finanzas/cuentas/${banco}`);
  comprobar("saldo de Banco N: L 1,000", await contiene(L("1,000.00")));
  comprobar("finanzas no registra saldos iniciales", !(await contiene("Registrar saldo inicial")));
  await ir("/finanzas/cuentas");
  comprobar("finanzas ve el dinero disponible", await contiene("Dinero disponible"));

  // 3. Administrador: anticipo, aplicación de saldo a favor y reverso
  await iniciarSesion(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
  await esperar("location.pathname === '/'");
  comprobar("panel con indicadores financieros",
    await esperar("document.body.innerText.includes('Por cobrar (CxC)') && document.body.innerText.includes('Dinero disponible')"));
  await ir(`/finanzas/cobros/nuevo?cliente=${cliente}`);
  await llenar("#campo-monto", "200");
  await llenar("#campo-cuenta_dinero_id", caja);
  await pulsar("Registrar cobro");
  comprobar("cobro de L 200 sin aplicar queda como saldo a favor",
    (await esperar("document.body.innerText.includes('Cobro registrado')", 20000)) && (await contiene(L("200.00"))));
  await ir(`/finanzas/cargos/${cargo}`);
  comprobar("el cargo ofrece aplicar el saldo a favor", await contiene("Aplicar saldo a favor"));
  await llenar("#campo-monto", "200");
  await pulsar("Aplicar saldo");
  comprobar("saldo a favor aplicado: el cargo queda con L 800 pendientes",
    (await esperar("document.body.innerText.includes('Saldo a favor aplicado')", 20000)) && (await contiene(L("800.00"))));

  await ir(rutaCobro);
  await evaluar("[...document.querySelectorAll('summary')].find((s) => s.textContent.includes('Reversar cobro')).click()");
  await llenar("#campo-cobro-motivo", `${MARCA} prueba de reverso`);
  await pulsar("Reversar cobro");
  comprobar("reverso sin confirmar la casilla se rechaza", await esperar("document.body.innerText.includes('Marque la casilla')"));
  await marcar("#campo-cobro-confirmar");
  await pulsar("Reversar cobro");
  comprobar("cobro reversado con motivo y conservado",
    (await esperar("document.body.innerText.includes('Corrección registrada')", 20000)) && (await contiene("Reversado")) && (await contiene("Motivo del reverso")));
  await ir(`/finanzas/cargos/${cargo}`);
  comprobar("tras el reverso el cargo vuelve a L 1,300 pendientes", await contiene(L("1,300.00")));
  await capturar("e2-03-cargo-escritorio");

  // 4. Móvil
  await vista(390, 844, true);
  await ir("/finanzas/cobros");
  comprobar("móvil: cobros sin desplazamiento horizontal", await evaluar("document.documentElement.scrollWidth <= window.innerWidth"));
  comprobar("móvil: cobros en tarjetas", await evaluar("getComputedStyle(document.querySelector('main ul')).display !== 'none' && getComputedStyle(document.querySelector('main table').parentElement).display === 'none'"));
  await capturar("e2-04-cobros-movil");
  await ir(`/finanzas/pendientes/${cliente}`);
  comprobar("móvil: estado de cuenta sin desplazamiento horizontal", await evaluar("document.documentElement.scrollWidth <= window.innerWidth"));
  await ir(`/finanzas/cobros/nuevo?cliente=${cliente}`);
  comprobar("móvil: formulario de cobro sin desplazamiento horizontal", await evaluar("document.documentElement.scrollWidth <= window.innerWidth"));
  await capturar("e2-05-cobro-movil");
} finally {
  cerrar();
  terminar();
}
