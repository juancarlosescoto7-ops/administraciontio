// Prueba de extremo a extremo de /reportes y de los filtros de gastos (E6) en un
// navegador real. Requiere la app en ejecución y las mismas variables que
// e2e-navegador.mjs. Prepara por la API un cargo, un cobro parcial y un gasto
// en un mes pasado elegido al azar, y comprueba que la interfaz muestra las
// mismas cifras que las funciones public.reporte_* para ese período.
// Crea registros marcados con "[PRUEBA E6]". No elimina nada.
import { randomUUID } from "node:crypto";
import { cargarEntorno, crearClienteRest, crearReporte } from "./comun.mjs";
import { abrirNavegador } from "./navegador.mjs";

const MARCA = "[PRUEBA E6]";
const env = cargarEntorno();
const { comprobar, terminar } = crearReporte();
const { iniciarSesion: sesionApi, api } = crearClienteRest(env);
const sufijo = Date.now().toString(36).toUpperCase();
const moneda = new Intl.NumberFormat("es-HN", { style: "currency", currency: "HNL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const L = (valor) => moneda.format(Number(valor));

// --- Datos de partida por la API ------------------------------------------
const anio = 2001 + Math.floor(Math.random() * 19);
const mes = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
const ultimo = new Date(Date.UTC(anio, Number(mes), 0)).getUTCDate();
const desde = `${anio}-${mes}-01`;
const hasta = `${anio}-${mes}-${ultimo}`;
const dia = (n) => `${anio}-${mes}-${String(n).padStart(2, "0")}`;

const adminApi = await sesionApi(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const finanzasApi = await sesionApi(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
const exigir = (r, que) => {
  if (r.estado < 200 || r.estado >= 300) throw new Error(`${que}: HTTP ${r.estado} ${JSON.stringify(r.datos)}`);
  return r.datos;
};
const nombreCliente = `${MARCA} Navegador ${sufijo}`;
const cliente = exigir(await api(adminApi.token, "POST", "clientes", { nombre: nombreCliente }), "cliente")[0].id;
const caja = exigir(await api(adminApi.token, "POST", "cuentas_dinero", { nombre: `${MARCA} Caja N ${sufijo}`, tipo: "caja" }), "caja")[0].id;
exigir(await api(adminApi.token, "POST", "rpc/registrar_apertura", { p_idempotencia: randomUUID(), p_cuenta_dinero_id: caja, p_fecha: dia(1), p_monto: "3000.00" }), "apertura");
const conceptoCargo = `${MARCA} Transporte navegador ${sufijo}`;
exigir(await api(adminApi.token, "POST", "rpc/registrar_cargo", {
  p_idempotencia: randomUUID(), p_cliente_id: cliente, p_cuenta_ingreso: "4400", p_concepto: conceptoCargo,
  p_fecha: dia(3), p_vencimiento: dia(10), p_monto: "1234.56",
}), "cargo");
exigir(await api(adminApi.token, "POST", "rpc/registrar_cobro", {
  p_idempotencia: randomUUID(), p_cliente_id: cliente, p_cuenta_dinero_id: caja, p_fecha: dia(4), p_metodo: "efectivo",
  p_referencia: null, p_monto: "234.56",
}), "cobro");
const categoria = (await api(adminApi.token, "GET", "categorias_gasto?activo=eq.true&select=id,nombre&order=nombre&limit=1")).datos[0];
const conceptoGasto = `${MARCA} Gasto general navegador ${sufijo}`;
const gasto = exigir(await api(finanzasApi.token, "POST", "rpc/registrar_gasto", {
  p_idempotencia: randomUUID(), p_proveedor_id: null, p_categoria_id: categoria.id, p_actividad: "general",
  p_fecha: dia(ultimo), p_vencimiento: dia(ultimo), p_concepto: conceptoGasto, p_monto: "345.67", p_notas: null,
}), "gasto");
const [resumenApi] = exigir(await api(adminApi.token, "POST", "rpc/reporte_resumen", { p_desde: desde, p_hasta: hasta }), "resumen");
const actividadesApi = exigir(await api(adminApi.token, "POST", "rpc/reporte_resultados_actividad", { p_desde: desde, p_hasta: hasta }), "actividades");
const consultaPeriodo = `periodo=personalizado&desde=${desde}&hasta=${hasta}`;

const { evaluar, esperar, ir, llenar, pulsar, capturar, vista, iniciarSesion, cerrar } = await abrirNavegador();
// Con streaming, el contenido llega después del esqueleto: se espera a que el
// elemento exista y sea visible antes de leerlo. Las tablas se pintan dos veces
// (tarjetas en móvil y tabla en escritorio): se usa la copia visible.
const primeroVisible = (selector) => `[...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.checkVisibility())`;
const visible = (selector) => esperar(primeroVisible(selector));
const textoDe = async (selector) => ((await visible(selector)) ? evaluar(`${primeroVisible(selector)}.innerText`) : "");
const sinDesbordeHorizontal = () => evaluar("document.documentElement.scrollWidth <= window.innerWidth + 1");

try {
  // 1. Finanzas: menú, período por defecto y rango personalizado desde el formulario
  await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
  await esperar("location.pathname === '/'");
  comprobar("finanzas ve Reportes en el menú", await esperar("document.querySelector('nav a[href=\"/reportes\"]')"));
  await ir("/reportes");
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date());
  const nombreMes = new Intl.DateTimeFormat("es-HN", { month: "long", timeZone: "UTC" }).format(new Date(`${hoy.slice(0, 7)}-15T12:00:00Z`));
  comprobar("por defecto: mes actual en Tegucigalpa", (await textoDe("[data-periodo]")) === `${nombreMes} de ${hoy.slice(0, 4)}`,
    await textoDe("[data-periodo]"));
  await llenar("select[name=periodo]", "personalizado");
  await llenar("input[name=desde]", desde);
  await llenar("input[name=hasta]", hasta);
  await pulsar("Ver");
  await esperar(`location.search.includes("desde=${desde}") && location.search.includes("hasta=${hasta}")`);
  const resumen = await textoDe("[data-reporte=resumen]");
  comprobar("rango personalizado: resumen con ingresos, gastos y resultado de la base",
    resumen.includes(L(resumenApi.ingresos)) && resumen.includes(L(resumenApi.gastos)) && resumen.includes(L(resumenApi.resultado)),
    JSON.stringify(resumenApi));
  comprobar("resumen: cobros separados de ingresos y aviso de que no es utilidad fiscal",
    resumen.includes("Cobros recibidos") && resumen.includes(L(resumenApi.cobros_periodo)) && resumen.includes("no es utilidad fiscal"));
  comprobar("resumen: saldos actuales rotulados con la fecha de corte", resumen.includes("Saldos actuales al"));
  await capturar("e6-01-resumen");

  // 2. Resultados por actividad: cuatro filas y consolidado
  await ir(`/reportes?vista=actividades&${consultaPeriodo}`);
  const actividades = await textoDe("[data-reporte=actividades]");
  comprobar("por actividad: cuatro actividades, incluida la general",
    ["Ambulancias y membresías", "Alquileres", "Transporte con conductor", "General"].every((a) => actividades.includes(a)));
  comprobar("por actividad: el total es el consolidado y no hay aviso de descuadre",
    actividades.includes(L(resumenApi.resultado)) && !actividades.includes("no coincide"));
  const transportes = actividadesApi.find((a) => a.actividad === "transportes");
  comprobar("por actividad: ingresos de transporte iguales a la base", actividades.includes(L(transportes.ingresos)));

  // 3. Ingresos y gastos del período
  await ir(`/reportes?vista=ingresos&${consultaPeriodo}`);
  comprobar("ingresos: aparece el cargo con su cliente", (await textoDe("[data-reporte=ingresos]")).includes(conceptoCargo) &&
    (await textoDe("[data-reporte=ingresos]")).includes(nombreCliente));
  comprobar("ingresos: total igual al de la base", (await textoDe("[data-total=ingresos]")) === L(resumenApi.ingresos));
  await ir(`/reportes?vista=gastos&${consultaPeriodo}&actividad=general`);
  const gastos = await textoDe("[data-reporte=gastos]");
  comprobar("gastos (filtro general): aparece el gasto del último día, pendiente", gastos.includes(conceptoGasto) && gastos.includes("Pendiente"));
  comprobar("gastos: totales por categoría y por actividad", gastos.includes("Totales por categoría") && gastos.includes("Totales por actividad"));
  const general = actividadesApi.find((a) => a.actividad === "general");
  comprobar("gastos (filtro general): total igual a la fila general de la base", (await textoDe("[data-total=gastos]")) === L(general.gastos));

  // 4. Cuentas por cobrar y por pagar
  await ir("/reportes?vista=cobrar&filtro=vencidos");
  const cobrar = await textoDe("[data-reporte=cobrar]");
  comprobar("CxC vencidos: el cargo con pago parcial, pendiente L 1,000.00",
    cobrar.includes(conceptoCargo) && cobrar.includes(L(1000)) && cobrar.includes("Parcial") && cobrar.includes("Vencido"));
  comprobar("CxC: saldo a favor en sección aparte", await visible("[data-reporte=saldo-a-favor]"));
  await ir("/reportes?vista=pagar");
  comprobar("CxP: el gasto vencido aparece en «Vencidas»", (await textoDe("[data-reporte=pagar]")).includes(conceptoGasto) &&
    (await evaluar(`(() => { const t = document.querySelector('[data-reporte=pagar]').innerText; return t.indexOf(${JSON.stringify(conceptoGasto)}) < t.indexOf("No vencidas"); })()`)));

  // 5. Caja y bancos con movimientos de una cuenta
  await ir(`/reportes?vista=caja&${consultaPeriodo}&cuenta=${caja}`);
  const cajaTexto = await textoDe("[data-reporte=movimientos]");
  comprobar("caja: movimientos de la cuenta con saldo final L 3,234.56 (3,000 + 234.56)",
    cajaTexto.includes(`${MARCA} Caja N ${sufijo}`) && cajaTexto.includes(L(3234.56)) && cajaTexto.includes("Saldo inicial"));
  await capturar("e6-02-caja");

  // 6. Móvil
  await vista(390, 844, true);
  for (const v of ["resumen", "actividades", "gastos", "caja"]) {
    await ir(`/reportes?vista=${v}&${consultaPeriodo}`);
    await visible(`[data-reporte=${v}]`);
    comprobar(`móvil 390 px: ${v} sin desplazamiento horizontal`, await sinDesbordeHorizontal());
  }
  await capturar("e6-03-movil");
  await vista(1280, 900, false);

  // 7. Filtros del listado de gastos
  await ir(`/finanzas/gastos?estado=todos&actividad=general&categoria=${categoria.id}&desde=${dia(ultimo)}&hasta=${dia(ultimo)}`);
  await esperar(`document.body.innerText.includes(${JSON.stringify(conceptoGasto)})`);
  comprobar("gastos: filtros de categoría y actividad aplicados",
    (await evaluar(`document.querySelector('select[name=actividad]').value`)) === "general" &&
      (await evaluar(`document.querySelector('select[name=categoria]').value`)) === categoria.id &&
      (await evaluar(`document.body.innerText.includes(${JSON.stringify(conceptoGasto)})`)));
  await ir(`/finanzas/gastos?estado=todos&actividad=alquileres&desde=${dia(ultimo)}&hasta=${dia(ultimo)}`);
  await visible("form");
  comprobar("gastos: otra actividad excluye el gasto general",
    await esperar(`!document.body.innerText.includes(${JSON.stringify(conceptoGasto)}) && document.querySelector('select[name=actividad]')?.value === 'alquileres'`));
  await ir(`/finanzas/gastos/${gasto}`);
  comprobar("detalle del gasto: actividad «General» y pagos disponibles", await esperar("document.body.innerText.includes('General') && document.body.innerText.includes('Registrar pago')"));

  // 8. Operador: sin acceso
  await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
  await esperar("location.pathname === '/'");
  comprobar("operador no ve Reportes en el menú", !(await evaluar("Boolean(document.querySelector('nav a[href=\"/reportes\"]'))")));
  comprobar("operador no ve el resultado del mes en el panel", !(await evaluar("document.body.innerText.includes('Resultado del mes')")));
  await ir("/reportes?vista=caja");
  comprobar("operador en /reportes: aviso de permiso y ninguna cifra",
    (await esperar("document.body.innerText.includes('los consultan el administrador y finanzas')")) &&
      !(await evaluar("Boolean(document.querySelector('[data-reporte]'))")));

  // 9. Administrador: menú y panel
  await iniciarSesion(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
  await esperar("location.pathname === '/'");
  comprobar("administrador ve Reportes en el menú", await esperar("document.querySelector('nav a[href=\"/reportes\"]')"));
  comprobar("panel: resultado del mes para el administrador y sin «Próximamente»",
    (await esperar("document.body.innerText.includes('Resultado del mes')")) && !(await evaluar("document.body.innerText.includes('Próximamente')")));
} catch (error) {
  comprobar("la prueba termina sin errores inesperados", false, error.message);
} finally {
  await cerrar();
  terminar();
}
