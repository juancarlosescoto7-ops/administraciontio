// Prueba de extremo a extremo de alquileres y transportes (E5) en un
// navegador real. Requiere la app en ejecución (npm run build && npm start) y
// las mismas variables que e2e-navegador.mjs. Prepara por la API un cliente,
// vehículos, un conductor, una caja, tarifas, un anticipo y una reserva, y
// recorre los flujos con los tres roles.
// Crea registros marcados con "[PRUEBA E5]". No elimina nada.
import { randomUUID } from "node:crypto";
import { cargarEntorno, crearClienteRest, crearReporte } from "./comun.mjs";
import { abrirNavegador } from "./navegador.mjs";

const MARCA = "[PRUEBA E5]";
const env = cargarEntorno();
const { comprobar, terminar } = crearReporte();
const { iniciarSesion: sesionApi, api } = crearClienteRest(env);
const sufijo = Date.now().toString(36).toUpperCase();
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date());
const dia = (n) => new Date(Date.parse(`${hoy}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// --- Datos de partida por la API ------------------------------------------
const adminApi = await sesionApi(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const crear = async (tabla, fila) => (await api(adminApi.token, "POST", tabla, fila)).datos[0].id;
const nombreCliente = `${MARCA} Cliente navegador ${sufijo}`;
const cliente = await crear("clientes", { nombre: nombreCliente });
const codigoAlquiler = `E5N-${sufijo}-A`;
const codigoOcupado = `E5N-${sufijo}-B`;
const codigoTransporte = `E5N-${sufijo}-T`;
const vAlquiler = await crear("vehiculos", { codigo: codigoAlquiler, tipo: "alquiler" });
const vOcupado = await crear("vehiculos", { codigo: codigoOcupado, tipo: "alquiler" });
const vTransporte = await crear("vehiculos", { codigo: codigoTransporte, tipo: "transporte" });
const conductor = await crear("conductores", { nombre: `${MARCA} Conductor navegador ${sufijo}` });
const caja = await crear("cuentas_dinero", { nombre: `${MARCA} Caja navegador ${sufijo}`, tipo: "caja" });
const tarifaDia = await crear("tarifas", { actividad: "alquileres", nombre: `${MARCA} Día navegador ${sufijo}`, unidad: "dia", precio_base: 1200 });
const tarifaServicio = await crear("tarifas", { actividad: "transportes", nombre: `${MARCA} Aeropuerto navegador ${sufijo}`, unidad: "servicio", precio_base: 800 });
await api(adminApi.token, "POST", "rpc/registrar_cobro", {
  p_idempotencia: randomUUID(), p_cliente_id: cliente, p_cuenta_dinero_id: caja, p_fecha: hoy, p_metodo: "efectivo",
  p_referencia: null, p_monto: "1000.00", p_aplicaciones: [],
});
// Reserva existente que ocupa el vehículo B del día 6 al 8.
const reservaOcupada = (await api(adminApi.token, "POST", "rpc/registrar_alquiler", {
  p_idempotencia: randomUUID(), p_cliente_id: cliente, p_vehiculo_id: vOcupado, p_entrega_prevista: `${dia(6)}T08:00:00-06:00`,
  p_devolucion_prevista: `${dia(8)}T08:00:00-06:00`, p_tarifa_id: null, p_precio: "2000.00", p_notas: null,
})).datos;

const { evaluar, esperar, ruta, texto, ir, llenar, pulsar, capturar, vista, iniciarSesion, cerrar } = await abrirNavegador();
const marcar = (selector) => evaluar(`document.querySelector(${JSON.stringify(selector)}).click()`);
const abrir = (titulo) => evaluar(`[...document.querySelectorAll('summary')].find((s) => s.textContent.includes(${JSON.stringify(titulo)})).click()`);
const visible = (selector) => esperar(`document.querySelector(${JSON.stringify(selector)})?.checkVisibility()`);
const faltan = async (...fragmentos) => {
  const actual = await texto();
  return fragmentos.filter((f) => !actual.includes(f));
};
const L = (importe) => `L ${importe}`;
const elegirCliente = async () => {
  await llenar("input[name=q]", `Cliente navegador ${sufijo}`);
  await pulsar("Buscar");
  await esperar(`[...document.querySelectorAll('a')].some((a) => a.textContent.includes(${JSON.stringify(nombreCliente)}))`);
  await evaluar(`[...document.querySelectorAll('a')].find((a) => a.textContent.includes(${JSON.stringify(nombreCliente)})).click()`);
};

try {
  // 1. Operador: reserva, entrega y devolución
  await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
  await esperar("location.pathname === '/'");
  comprobar("menú con Alquileres y Transporte; panel con sus indicadores",
    (await esperar("['/alquileres','/transportes'].every((h) => document.querySelector(`nav a[href=\"${h}\"]`))")) &&
      (await esperar("document.body.innerText.includes('Vehículos alquilados ahora')")));

  await ir("/alquileres/nuevo");
  await elegirCliente();
  await visible("input[name=entrega]");
  await llenar("input[name=entrega]", `${dia(6)}T09:00`);
  await llenar("input[name=devolucion]", `${dia(9)}T09:00`);
  await llenar("select[name=tarifa]", tarifaDia);
  await pulsar("Ver disponibilidad");
  await visible("#campo-vehiculo_id");
  const revision = await faltan("Días cobrables", "3 (bloques", L("3,600.00"), codigoAlquiler, codigoOcupado, "Ocupado", "Libre");
  comprobar("disponibilidad: 3 días, precio propuesto L 3,600 y el vehículo reservado aparece ocupado", revision.length === 0, revision.join(" | "));
  comprobar("el vehículo ocupado no se ofrece para reservar y el precio viene propuesto",
    (await evaluar(`![...document.querySelector('#campo-vehiculo_id').options].some((o) => o.value === ${JSON.stringify(vOcupado)})`)) &&
      (await evaluar("document.querySelector('#campo-precio').value")) === "3600.00");
  await capturar("e5-01-nueva-reserva");
  await llenar("#campo-vehiculo_id", vAlquiler);
  await pulsar("Confirmar reserva");
  comprobar("reserva confirmada", await esperar("location.pathname.startsWith('/alquileres/') && document.body.innerText.includes('Reserva registrada')", 20000));
  const rutaAlquiler = (await ruta()).split("?")[0];
  comprobar("detalle: reservado, sin cargo todavía y anticipo disponible", (await faltan("Reservado", "Sin cargo todavía", L("1,000.00"))).length === 0);

  await visible("#campo-entrega-km");
  await llenar("#campo-entrega-km", "1000");
  await llenar("#campo-entrega-combustible", "lleno");
  await pulsar("Registrar entrega");
  comprobar("entrega registrada: entregado con km 1,000 y tanque lleno",
    (await esperar("document.body.innerText.includes('Entrega registrada')", 20000)) && (await faltan("Entregado", "1,000", "Lleno")).length === 0);

  await visible("#campo-devolucion-km");
  await llenar("#campo-devolucion-km", "1250");
  await llenar("#campo-devolucion-combustible", "medio");
  await llenar("#campo-devolucion-adicional1_concepto", `${MARCA} Lavado`);
  await pulsar("Registrar devolución");
  comprobar("un cargo adicional sin importe se rechaza", await esperar("document.body.innerText.includes('Indique el importe del cargo adicional')"));
  await llenar("#campo-devolucion-adicional1_monto", "400");
  await llenar("#campo-devolucion-aplicar_anticipo", "1000");
  await pulsar("Registrar devolución");
  await esperar("document.body.innerText.includes('Devolución registrada')", 20000);
  const devolucion = await faltan("Devuelto", "250 km", "Lleno → 1/2", "Lavado", L("400.00"), L("3,000.00"), "Ver cargo", "Pagado parcialmente");
  comprobar("devolución: 250 km, combustible de lleno a 1/2, cargo adicional y saldo pendiente L 3,000 tras el anticipo",
    devolucion.length === 0, devolucion.join(" | "));
  comprobar("un devuelto no ofrece más acciones", !(await texto()).includes("Registrar entrega") && !(await texto()).includes("Cancelar la reserva"));
  await capturar("e5-02-alquiler-devuelto");

  // 2. Cancelar la reserva existente
  await ir(`/alquileres/${reservaOcupada}`);
  await abrir("Cancelar la reserva");
  await llenar("#campo-cancelar-motivo", `${MARCA} el cliente desiste`);
  await marcar("#campo-cancelar-confirmar");
  await pulsar("Cancelar reserva");
  comprobar("reserva cancelada con motivo",
    (await esperar("document.body.innerText.includes('Reserva cancelada.')", 20000)) && (await faltan("Cancelado", "el cliente desiste")).length === 0);

  // 3. Operador: transporte con tarifa, inicio y finalización
  await ir("/transportes/nuevo");
  await elegirCliente();
  await visible("select[name=tarifa]");
  await llenar("select[name=tarifa]", tarifaServicio);
  await pulsar("Proponer");
  comprobar("la tarifa propone el precio del transporte", await esperar("document.querySelector('#campo-precio')?.value === '800.00'"));
  await llenar("#campo-origen", `${MARCA} Hotel Real InterContinental`);
  await llenar("#campo-destino", "Aeropuerto Palmerola");
  await llenar("#campo-vehiculo_id", vTransporte);
  await llenar("#campo-conductor_id", conductor);
  await pulsar("Registrar solicitud");
  comprobar("solicitud de transporte registrada con recursos",
    (await esperar("location.pathname.startsWith('/transportes/') && document.body.innerText.includes('Solicitud registrada')", 20000)) &&
      (await faltan(codigoTransporte, "Solicitado")).length === 0);
  const rutaTransporte = (await ruta()).split("?")[0];
  await pulsar("Iniciar servicio");
  comprobar("servicio iniciado", await esperar("document.body.innerText.includes('Servicio iniciado')", 20000));
  await visible("#campo-finalizar-notas_finales");
  await llenar("#campo-finalizar-notas_finales", `${MARCA} sin novedad`);
  await pulsar("Finalizar servicio");
  await esperar("document.body.innerText.includes('Servicio completado.')", 20000);
  const fin = await faltan("Completado", "Ver cargo", L("800.00"), "Cargo pendiente");
  comprobar("transporte completado: un cargo de L 800 pendiente", fin.length === 0, fin.join(" | "));
  await capturar("e5-03-transporte-completado");

  await ir(`/transportes?q=${encodeURIComponent(sufijo)}&estado=todos`);
  comprobar("listado de transportes con búsqueda", (await faltan("Hotel Real InterContinental", codigoTransporte, "Completado")).length === 0);
  await ir(`/alquileres?q=${encodeURIComponent(sufijo)}&estado=todos`);
  comprobar("listado de alquileres con estado, precio y saldo", (await faltan(codigoAlquiler, "Devuelto", "Cancelado", L("4,000.00"), L("3,000.00"))).length === 0);

  // 4. Finanzas: consulta y cobra, sin acciones operativas
  await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
  await esperar("location.pathname === '/'");
  await ir("/transportes");
  comprobar("finanzas no ve «Nueva solicitud» de transporte", !(await texto()).includes("Nueva solicitud"));
  await ir(rutaAlquiler);
  comprobar("finanzas ve cobros e historial del alquiler y puede registrar cobro",
    (await faltan("Cobros", "Registrar cobro", "Historial", "Devuelto")).length === 0 && !(await texto()).includes("Modificar la reserva"));
  await ir(rutaTransporte);
  comprobar("finanzas no inicia ni finaliza servicios", !(await texto()).includes("Iniciar servicio") && !(await texto()).includes("Editar datos"));

  // 5. Móvil
  await vista(390, 844, true);
  await ir(`/alquileres?q=${encodeURIComponent(sufijo)}&estado=todos`);
  comprobar("móvil: listado de alquileres sin desplazamiento horizontal", await evaluar("document.documentElement.scrollWidth <= window.innerWidth"));
  await ir(rutaAlquiler);
  comprobar("móvil: detalle de alquiler sin desplazamiento horizontal", await evaluar("document.documentElement.scrollWidth <= window.innerWidth"));
  await capturar("e5-04-alquiler-movil");
  await ir(rutaTransporte);
  comprobar("móvil: detalle de transporte sin desplazamiento horizontal", await evaluar("document.documentElement.scrollWidth <= window.innerWidth"));
} finally {
  cerrar();
  terminar();
}
