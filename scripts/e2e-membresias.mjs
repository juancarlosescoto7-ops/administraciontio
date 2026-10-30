// Prueba de extremo a extremo del módulo de membresías (E3) en un navegador
// real. Requiere la app en ejecución (npm run build && npm start) y las mismas
// variables que e2e-navegador.mjs. Prepara por la API un plan, un cliente,
// beneficiarios, una caja y una membresía morosa, y recorre los flujos con los
// tres roles. Crea registros marcados con "[PRUEBA E3]". No elimina nada.
import { randomUUID } from "node:crypto";
import { cargarEntorno, crearClienteRest, crearReporte } from "./comun.mjs";
import { abrirNavegador } from "./navegador.mjs";

const MARCA = "[PRUEBA E3]";
const env = cargarEntorno();
const { comprobar, terminar } = crearReporte();
const { iniciarSesion: sesionApi, api } = crearClienteRest(env);
const sufijo = Date.now().toString(36).toUpperCase();
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date());
const restarDias = (f, n) => new Date(Date.parse(`${f}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

// --- Datos de partida por la API ------------------------------------------
const adminApi = await sesionApi(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const crear = async (tabla, fila) => (await api(adminApi.token, "POST", tabla, fila)).datos[0].id;
const plan = await crear("planes", {
  nombre: `${MARCA} Plan navegador ${sufijo}`, precio_mensual: 500, cupo_mensual: 2, modalidad_cupo: "compartido", dias_gracia: 5,
});
const nombreCliente = `${MARCA} Cliente navegador ${sufijo}`;
const cliente = await crear("clientes", { nombre: nombreCliente });
const clienteMoroso = await crear("clientes", { nombre: `${MARCA} Cliente moroso ${sufijo}` });
const ana = await crear("beneficiarios", { nombre: `${MARCA} Ana ${sufijo}` });
const luis = await crear("beneficiarios", { nombre: `${MARCA} Luis ${sufijo}` });
const caja = await crear("cuentas_dinero", { nombre: `${MARCA} Caja navegador ${sufijo}`, tipo: "caja" });
// Inició hace ~70 días y no pagó: queda suspendida por morosidad.
const morosa = (await api(adminApi.token, "POST", "rpc/registrar_membresia", {
  p_idempotencia: randomUUID(), p_cliente_id: clienteMoroso, p_plan_id: plan, p_fecha_inicio: restarDias(hoy, 70),
  p_beneficiarios: [luis], p_condiciones: null,
})).datos;
// Otra morosa cuya deuda se pagará por la API (sin pasar por la aplicación):
// la reactiva la actualización que lanza el panel al abrirse.
const clientePanel = await crear("clientes", { nombre: `${MARCA} Cliente panel ${sufijo}` });
const morosaPanel = (await api(adminApi.token, "POST", "rpc/registrar_membresia", {
  p_idempotencia: randomUUID(), p_cliente_id: clientePanel, p_plan_id: plan, p_fecha_inicio: restarDias(hoy, 70),
  p_beneficiarios: [ana], p_condiciones: null,
})).datos;
const estadoDe = async (id) => (await api(adminApi.token, "GET", `membresias?id=eq.${id}&select=estado`)).datos[0].estado;

const { evaluar, esperar, ruta, texto, ir, llenar, pulsar, capturar, vista, iniciarSesion, cerrar, abrirVentana } = await abrirNavegador();
const marcar = (selector) => evaluar(`document.querySelector(${JSON.stringify(selector)}).click()`);
const contiene = async (fragmento) => (await texto()).includes(fragmento);
/** Fragmentos que no aparecen en la página (vacío = todos presentes). */
const faltan = async (...fragmentos) => {
  const actual = await texto();
  return fragmentos.filter((f) => !actual.includes(f));
};
// Intl separa el símbolo con un espacio de no separación (U+00A0).
const L = (importe) => `L ${importe}`;

try {
  // 1. Operador: alta de membresía en tres pasos
  await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
  await esperar("location.pathname === '/'");
  comprobar("menú con Membresías", await esperar("Boolean(document.querySelector('nav a[href=\"/membresias\"]'))"));

  await ir("/membresias/nueva");
  await llenar("input[name=q]", `Cliente navegador ${sufijo}`);
  await pulsar("Buscar");
  await esperar(`[...document.querySelectorAll('a')].some((a) => a.textContent.includes(${JSON.stringify(nombreCliente)}))`);
  await evaluar(`[...document.querySelectorAll('a')].find((a) => a.textContent.includes(${JSON.stringify(nombreCliente)})).click()`);
  await esperar("document.querySelector('select[name=plan]')");
  await llenar("select[name=plan]", plan);
  await llenar("input[name=inicio]", hoy);
  await pulsar("Revisar condiciones");
  // El contenido llega por streaming oculto: se espera a que sea visible.
  await esperar(`document.querySelector('#campo-beneficiario_${ana}')?.checkVisibility()`);
  const revision = await faltan(L("500.00"), "Compartido entre beneficiarios", "Primeros períodos", `Ana ${sufijo}`);
  comprobar("revisión de condiciones: precio, cupo, gracia, primeros períodos y beneficiarios", revision.length === 0, revision.join(" | "));
  comprobar("el operador no ve condiciones particulares",
    !(await evaluar("Boolean(document.querySelector('#campo-precio'))")) &&
      !(await evaluar("[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Pactar condiciones particulares'))")));
  await capturar("e3-01-nueva-membresia");

  await marcar(`#campo-beneficiario_${ana}`);
  await pulsar("Confirmar membresía");
  comprobar("sin confirmar la casilla se rechaza y conserva la selección",
    (await esperar("document.body.innerText.includes('Marque la casilla')")) &&
      (await evaluar(`document.querySelector('#campo-beneficiario_${ana}').checked`)));
  await marcar("#campo-confirmar");
  await pulsar("Confirmar membresía");
  comprobar("membresía registrada",
    await esperar("location.pathname.startsWith('/membresias/') && document.body.innerText.includes('Membresía registrada')", 20000));
  const rutaMembresia = (await ruta()).split("?")[0];
  const detalle = await faltan("Activa", L("500.00"), "Pendiente", "Cubierto", `Ana ${sufijo}`);
  comprobar("detalle: activa, cuota de L 500 pendiente y beneficiario cubierto", detalle.length === 0, detalle.join(" | "));
  comprobar("el operador no edita condiciones ni cancela", !(await contiene("Editar condiciones")) && !(await contiene("Cancelar membresía")));

  await abrirVentana("Agregar beneficiario");
  await llenar("#campo-beneficiario_id", luis);
  await pulsar("Agregar");
  comprobar("beneficiario agregado (el mismo de otra membresía)",
    (await esperar("document.body.innerText.includes('Beneficiario agregado')", 20000)) && (await contiene(`Luis ${sufijo}`)));
  await capturar("e3-02-detalle-membresia");

  await ir(`/membresias?q=${encodeURIComponent(sufijo)}&estado=todas`);
  const listado = await faltan(nombreCliente, "Suspendida por morosidad", L("500.00"));
  comprobar("listado: busca por cliente y muestra estado y saldo", listado.length === 0, listado.join(" | "));
  await ir(`/membresias?q=${encodeURIComponent(sufijo)}&estado=suspendida`);
  comprobar("filtro por estado: solo la suspendida", (await contiene("Cliente moroso")) && !(await contiene(nombreCliente)));

  // 2. Finanzas: panel, cobro de la deuda vencida y reactivación automática
  await api(adminApi.token, "POST", "rpc/registrar_cobro", {
    p_idempotencia: randomUUID(), p_cliente_id: clientePanel, p_cuenta_dinero_id: caja, p_fecha: hoy, p_metodo: "efectivo",
    p_referencia: null, p_monto: "500.00",
  });
  await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE, `/login?siguiente=/membresias/${morosaPanel}`);
  await esperar(`location.pathname === '/membresias/${morosaPanel}'`);
  comprobar("abrir un detalle (GET) no escribe: la pagada fuera sigue suspendida",
    (await esperar("document.body.innerText.includes('Suspendida por morosidad desde')")) && (await estadoDe(morosaPanel)) === "suspendida");
  await ir("/");
  comprobar("panel con indicadores de membresías",
    await esperar("document.body.innerText.includes('Membresías activas') && document.body.innerText.includes('Cuotas vencidas')"));
  comprobar("al abrir el panel (POST) se actualizan las mensualidades y se reactiva",
    (await esperar("document.body.innerText.includes('Mensualidades al día')", 20000)) && (await estadoDe(morosaPanel)) === "activa");
  await ir(`/membresias/${morosa}`);
  comprobar("suspendida: aviso de morosidad y sin cobertura",
    (await contiene("Suspendida por morosidad desde")) && (await contiene("No cubierto")) && (await contiene("Vencida")));
  comprobar("finanzas no gestiona beneficiarios ni condiciones", !(await contiene("Agregar beneficiario")) && !(await contiene("Editar condiciones")));
  await pulsar("Registrar cobro");
  await esperar("location.pathname === '/finanzas/cobros/nuevo'");
  await esperar("document.querySelector('#campo-monto')");
  await llenar("#campo-monto", "500");
  await llenar("#campo-cuenta_dinero_id", caja);
  await pulsar("Registrar cobro");
  comprobar("cobro de la cuota vencida registrado",
    await esperar("location.pathname.startsWith('/finanzas/cobros/') && document.body.innerText.includes('Cobro registrado')", 20000));
  await ir(`/membresias/${morosa}`);
  comprobar("al saldar la deuda se reactiva con un ciclo nuevo y su cuota pendiente",
    (await contiene("Activa")) && !(await contiene("Suspendida por morosidad desde")) && (await contiene("Reactivación")) &&
      (await contiene("Ciclo nuevo desde")) && (await contiene("Pagada")));
  await pulsar("Actualizar mensualidades");
  comprobar("botón Actualizar mensualidades (idempotente: 0 nuevas)",
    await esperar("document.body.innerText.includes('Mensualidades al día: 0 mensualidades generadas')", 20000));
  await capturar("e3-03-reactivada");

  // 3. Administrador: condiciones para ciclos futuros y cancelación
  await iniciarSesion(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
  await esperar("location.pathname === '/'");
  await ir(rutaMembresia);
  await abrirVentana("Editar condiciones");
  comprobar("editar condiciones muestra las vigentes", (await evaluar("document.querySelector('#campo-condiciones-precio').value")) === "500.00");
  await llenar("#campo-condiciones-precio", "650");
  await llenar("#campo-condiciones-motivo", `${MARCA} ajuste de precio`);
  await pulsar("Guardar condiciones");
  comprobar("condiciones actualizadas: L 650 para los próximos ciclos; la cuota generada sigue en L 500",
    (await esperar("document.body.innerText.includes('Condiciones actualizadas')", 20000)) && (await contiene(L("650.00"))) &&
      (await evaluar("[...document.querySelectorAll('h2')].some((h) => h.textContent === 'Mensualidades')")) && (await contiene(L("500.00"))));
  await abrirVentana("Cancelar la membresía");
  await llenar("#campo-cancelar-motivo", `${MARCA} el cliente se retira`);
  await pulsar("Cancelar membresía");
  comprobar("cancelar sin confirmar se rechaza", await esperar("document.body.innerText.includes('Marque la casilla')"));
  await marcar("#campo-cancelar-confirmar");
  await pulsar("Cancelar membresía");
  comprobar("membresía cancelada con motivo en el historial; la deuda se conserva",
    (await esperar("document.body.innerText.includes('Membresía cancelada.')", 20000)) && (await contiene("Cancelación")) &&
      (await contiene("el cliente se retira")) && (await contiene(L("500.00"))));

  await ir(`/membresias/nueva?cliente=${cliente}&plan=${plan}&inicio=${hoy}`);
  comprobar("condiciones particulares ocultas tras un botón visible para el administrador",
    (await esperar("[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Pactar condiciones particulares') && b.checkVisibility())")) &&
      !(await evaluar("Boolean(document.querySelector('#campo-precio')?.checkVisibility())")));
  await pulsar("Pactar condiciones particulares");
  comprobar("el administrador puede pactar condiciones particulares", await esperar("document.querySelector('#campo-precio')?.checkVisibility()"));

  // 4. Móvil
  await vista(390, 844, true);
  await ir(`/membresias?q=${encodeURIComponent(sufijo)}&estado=todas`);
  comprobar("móvil: listado sin desplazamiento horizontal", await evaluar("document.documentElement.scrollWidth <= window.innerWidth"));
  await capturar("e3-04-listado-movil");
  await ir(`/membresias/${morosa}`);
  comprobar("móvil: detalle sin desplazamiento horizontal", await evaluar("document.documentElement.scrollWidth <= window.innerWidth"));
  await capturar("e3-05-detalle-movil");
} finally {
  cerrar();
  terminar();
}
