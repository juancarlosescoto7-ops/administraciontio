// Prueba de extremo a extremo del módulo de traslados (E4) en un navegador
// real. Requiere la app en ejecución (npm run build && npm start) y las mismas
// variables que e2e-navegador.mjs. Prepara por la API un plan, un cliente con
// membresía, una ambulancia, un conductor, una caja, una tarifa y un anticipo,
// y recorre los flujos cubierto y particular con los tres roles.
// Crea registros marcados con "[PRUEBA E4]". No elimina nada.
import { randomUUID } from "node:crypto";
import { cargarEntorno, crearClienteRest, crearReporte } from "./comun.mjs";
import { abrirNavegador } from "./navegador.mjs";

const MARCA = "[PRUEBA E4]";
const env = cargarEntorno();
const { comprobar, terminar } = crearReporte();
const { iniciarSesion: sesionApi, api } = crearClienteRest(env);
const sufijo = Date.now().toString(36).toUpperCase();
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date());
const manana = new Date(Date.parse(`${hoy}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

// --- Datos de partida por la API ------------------------------------------
const adminApi = await sesionApi(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const crear = async (tabla, fila) => (await api(adminApi.token, "POST", tabla, fila)).datos[0].id;
const plan = await crear("planes", { nombre: `${MARCA} Plan navegador ${sufijo}`, precio_mensual: 400, cupo_mensual: 2, modalidad_cupo: "compartido", dias_gracia: 30 });
const nombreCliente = `${MARCA} Cliente navegador ${sufijo}`;
const cliente = await crear("clientes", { nombre: nombreCliente });
const ana = await crear("beneficiarios", { nombre: `${MARCA} Ana ${sufijo}` });
const codigo = `E4N-${sufijo}`;
const ambulancia = await crear("vehiculos", { codigo, tipo: "ambulancia" });
const conductor = await crear("conductores", { nombre: `${MARCA} Conductor navegador ${sufijo}` });
const caja = await crear("cuentas_dinero", { nombre: `${MARCA} Caja navegador ${sufijo}`, tipo: "caja" });
const tarifa = await crear("tarifas", { actividad: "ambulancias", nombre: `${MARCA} Tarifa navegador ${sufijo}`, unidad: "servicio", precio_base: 1200 });
await api(adminApi.token, "POST", "rpc/registrar_membresia", {
  p_idempotencia: randomUUID(), p_cliente_id: cliente, p_plan_id: plan, p_fecha_inicio: hoy, p_beneficiarios: [ana], p_condiciones: null,
});
// Anticipo de L 500 para el servicio particular.
await api(adminApi.token, "POST", "rpc/registrar_cobro", {
  p_idempotencia: randomUUID(), p_cliente_id: cliente, p_cuenta_dinero_id: caja, p_fecha: hoy, p_metodo: "efectivo",
  p_referencia: null, p_monto: "500.00", p_aplicaciones: [],
});

const { evaluar, esperar, ruta, texto, ir, llenar, pulsar, capturar, vista, iniciarSesion, cerrar } = await abrirNavegador();
const marcar = (selector) => evaluar(`document.querySelector(${JSON.stringify(selector)}).click()`);
const abrir = (titulo) => evaluar(`[...document.querySelectorAll('summary')].find((s) => s.textContent.includes(${JSON.stringify(titulo)})).click()`);
const visible = (selector) => esperar(`document.querySelector(${JSON.stringify(selector)})?.checkVisibility()`);
const faltan = async (...fragmentos) => {
  const actual = await texto();
  return fragmentos.filter((f) => !actual.includes(f));
};
// Intl separa el símbolo con un espacio de no separación (U+00A0).
const L = (importe) => `L ${importe}`;
const elegirCliente = async () => {
  await llenar("input[name=q]", `Cliente navegador ${sufijo}`);
  await pulsar("Buscar");
  await esperar(`[...document.querySelectorAll('a')].some((a) => a.textContent.includes(${JSON.stringify(nombreCliente)}))`);
  await evaluar(`[...document.querySelectorAll('a')].find((a) => a.textContent.includes(${JSON.stringify(nombreCliente)})).click()`);
};

try {
  // 1. Operador: traslado cubierto de principio a fin
  await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
  await esperar("location.pathname === '/'");
  comprobar("menú con Traslados de ambulancia y panel con sus indicadores",
    (await esperar("Boolean(document.querySelector('nav a[href=\"/ambulancias\"]'))")) &&
      (await esperar("document.body.innerText.includes('Traslados de hoy')")));

  await ir("/ambulancias/nuevo");
  await elegirCliente();
  await esperar("[...document.querySelectorAll('a')].some((a) => a.textContent.includes('Cubierto:'))");
  await evaluar("[...document.querySelectorAll('a')].find((a) => a.textContent.includes('Cubierto:')).click()");
  await visible("#campo-beneficiario_id");
  const cobertura = await faltan("Cobertura hoy", "Cubierto", "2 de 2");
  comprobar("nueva solicitud cubierta: muestra la cobertura de hoy por beneficiario", cobertura.length === 0, cobertura.join(" | "));
  await capturar("e4-01-nueva-cubierta");
  await llenar("#campo-beneficiario_id", ana);
  await llenar("#campo-inicio", `${manana}T08:00`);
  await llenar("#campo-origen", `${MARCA} Colonia Kennedy`);
  await llenar("#campo-destino", "Hospital Escuela");
  await llenar("#campo-vehiculo_id", ambulancia);
  await llenar("#campo-conductor_id", conductor);
  await marcar("#campo-programar");
  await pulsar("Registrar solicitud");
  comprobar("solicitud cubierta registrada y programada",
    await esperar("location.pathname.startsWith('/ambulancias/') && document.body.innerText.includes('Solicitud registrada')", 20000));
  const rutaCubierto = (await ruta()).split("?")[0];
  const detalle = await faltan("Programado", "Cobertura válida", "Beneficio reservado", codigo, "no genera cargo");
  comprobar("detalle: programado, cobertura válida con beneficio reservado y recursos asignados", detalle.length === 0, detalle.join(" | "));

  await pulsar("Iniciar traslado");
  comprobar("iniciar: en curso con hora real",
    (await esperar("document.body.innerText.includes('Traslado iniciado')", 20000)) && (await faltan("En curso", "Inicio real")).length === 0);
  await visible("#campo-finalizar-notas_finales");
  await llenar("#campo-finalizar-notas_finales", `${MARCA} paciente entregado`);
  await pulsar("Finalizar traslado");
  const fin = await esperar("document.body.innerText.includes('Traslado completado.')", 20000);
  const consumido = await faltan("Completado", "Beneficio consumido", "paciente entregado");
  comprobar("finalizar: completado, beneficio consumido y sin cargo", fin && consumido.length === 0, consumido.join(" | "));
  comprobar("un completado no ofrece acciones operativas", !(await texto()).includes("Iniciar traslado") && !(await texto()).includes("Cancelar traslado"));
  await capturar("e4-02-cubierto-completado");

  // 2. Operador: particular urgente sin recursos, con tarifa y anticipo
  await ir(`/ambulancias/nuevo?cliente=${cliente}&tipo=particular`);
  await visible("select[name=tarifa]");
  await llenar("select[name=tarifa]", tarifa);
  await pulsar("Proponer");
  // El contenido llega por streaming oculto: se espera a que sea visible.
  comprobar("la tarifa propone el precio y avisa del saldo a favor",
    (await esperar("document.querySelector('#campo-precio')?.checkVisibility() && document.querySelector('#campo-precio').value === '1200.00'")) &&
      (await esperar("document.body.innerText.includes('a favor')")));
  await llenar("#campo-pasajero", `${MARCA} Pasajero urgente`);
  await llenar("#campo-origen", `${MARCA} Mercado Zonal Belén`);
  await pulsar("Registrar solicitud");
  comprobar("solicitud particular urgente registrada sin recursos ni destino",
    await esperar("location.pathname.startsWith('/ambulancias/') && document.body.innerText.includes('Solicitud registrada')", 20000));
  const rutaParticular = (await ruta()).split("?")[0];
  comprobar("detalle particular: sin asignar y sin cargo todavía", (await faltan("Sin asignar", "Sin cargo todavía", L("1,200.00"))).length === 0);
  await pulsar("Iniciar traslado");
  comprobar("no se inicia sin destino ni recursos (mensaje claro)", await esperar("document.body.innerText.includes('Indique el destino antes de iniciar')"));

  await abrir("Editar datos");
  await llenar("#campo-editar-destino", "Hospital San Felipe");
  await pulsar("Guardar datos");
  await esperar("document.body.innerText.includes('Datos actualizados')", 20000);
  await abrir("Asignar ambulancia y conductor");
  await llenar("#campo-recursos-vehiculo_id", ambulancia);
  await llenar("#campo-recursos-conductor_id", conductor);
  await pulsar("Guardar recursos");
  comprobar("asignar recursos después de registrar",
    (await esperar("document.body.innerText.includes('Recursos actualizados')", 20000)) && (await texto()).includes(codigo));
  await pulsar("Iniciar traslado");
  await esperar("document.body.innerText.includes('Traslado iniciado')", 20000);
  await visible("#campo-finalizar-aplicar_anticipo");
  await llenar("#campo-finalizar-aplicar_anticipo", "500");
  await pulsar("Finalizar traslado");
  await esperar("document.body.innerText.includes('Traslado completado.')", 20000);
  const financiero = await faltan("Pagado parcialmente", L("500.00"), L("700.00"), "Ver cargo");
  comprobar("finalizar particular: cargo de L 1,200 con el anticipo de L 500 aplicado y L 700 pendientes", financiero.length === 0, financiero.join(" | "));
  await capturar("e4-03-particular-completado");

  // 3. Cancelación con motivo
  await ir(`/ambulancias/nuevo?cliente=${cliente}&tipo=particular`);
  await visible("#campo-origen");
  await llenar("#campo-origen", `${MARCA} Origen a cancelar`);
  await pulsar("Registrar solicitud");
  await esperar("document.body.innerText.includes('Solicitud registrada')", 20000);
  await abrir("Cancelar traslado");
  await llenar("#campo-cancelar-motivo", `${MARCA} el cliente desiste`);
  await pulsar("Cancelar traslado");
  comprobar("cancelar sin confirmar se rechaza", await esperar("document.body.innerText.includes('Marque la casilla')"));
  await marcar("#campo-cancelar-confirmar");
  await pulsar("Cancelar traslado");
  comprobar("traslado cancelado con motivo y conservado",
    (await esperar("document.body.innerText.includes('Traslado cancelado.')", 20000)) && (await faltan("Motivo de cancelación", "el cliente desiste")).length === 0);

  await ir(`/ambulancias?q=${encodeURIComponent(sufijo)}&estado=todos&tipo=particular`);
  const listado = await faltan("Pasajero urgente", "Completado", "Cancelado", codigo);
  comprobar("listado con búsqueda, estado y tipo", listado.length === 0 && !(await texto()).includes("Cubierto por membresía"), listado.join(" | "));

  // 4. Finanzas: consulta y cobro, sin acciones operativas
  await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
  await esperar("location.pathname === '/'");
  await ir("/ambulancias");
  comprobar("finanzas no ve «Nueva solicitud»", !(await texto()).includes("Nueva solicitud"));
  await ir(rutaParticular);
  comprobar("finanzas ve los datos financieros y puede registrar el cobro",
    (await faltan("Datos financieros", L("700.00"), "Registrar cobro")).length === 0 && !(await texto()).includes("Editar datos"));
  await ir(rutaCubierto);
  comprobar("finanzas ve el historial del servicio", (await faltan("Historial", "Completado", "Iniciado", "Solicitud registrada")).length === 0);

  // 5. Móvil
  await vista(390, 844, true);
  await ir(`/ambulancias?q=${encodeURIComponent(sufijo)}&estado=todos`);
  comprobar("móvil: listado sin desplazamiento horizontal", await evaluar("document.documentElement.scrollWidth <= window.innerWidth"));
  await capturar("e4-04-listado-movil");
  await ir(rutaParticular);
  comprobar("móvil: detalle sin desplazamiento horizontal", await evaluar("document.documentElement.scrollWidth <= window.innerWidth"));
  await capturar("e4-05-detalle-movil");
} finally {
  cerrar();
  terminar();
}
