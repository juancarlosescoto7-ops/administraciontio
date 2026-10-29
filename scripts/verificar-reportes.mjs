// Verifica los reportes de E6 contra la API REST real de Supabase (desarrollo):
// ingresos y gastos reconocidos por actividad, separación de cobros/anticipos/
// transferencias, CxC, CxP, caja y bancos, reversos, filtros de fechas y
// permisos. Cada cifra se contrasta con un cálculo independiente sobre el
// libro (asientos y lineas_asiento) o con las vistas de saldos de E2.
// Uso: E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-reportes.mjs
// Crea registros ficticios marcados con "[PRUEBA E6]" en un mes pasado elegido
// al azar (para aislarlos) y algunos reversos con fecha de hoy. No elimina nada.
import { randomUUID } from "node:crypto";
import { cargarEntorno, crearClienteRest, crearReporte, denegado } from "./comun.mjs";

const MARCA = "[PRUEBA E6]";
const env = cargarEntorno();
const { iniciarSesion, api } = crearClienteRest(env);
const { comprobar, terminar } = crearReporte();
const sufijo = Date.now().toString(36).toUpperCase();
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date());

/** Importe JSON → centavos enteros (para comparar sin float). */
const c = (valor) => Math.round(Number(valor ?? 0) * 100);
const rpc = (sesion, funcion, args) => api(sesion?.token ?? null, "POST", `rpc/${funcion}`, args);
const leer = async (sesion, ruta) => (await api(sesion.token, "GET", ruta)).datos;
const uno = async (sesion, ruta) => (await leer(sesion, ruta))?.[0];
/** Todas las filas, de 1000 en 1000 (PostgREST limita cada respuesta). */
async function todos(sesion, ruta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const pagina = await leer(sesion, `${ruta}&order=id&limit=1000&offset=${desde}`);
    if (!Array.isArray(pagina)) throw new Error(`Lectura fallida: ${ruta}`);
    filas.push(...pagina);
    if (pagina.length < 1000) return filas;
  }
}
const exigir = (r, que) => {
  if (r.estado < 200 || r.estado >= 300) throw new Error(`${que}: HTTP ${r.estado} ${JSON.stringify(r.datos)}`);
  return r.datos;
};

const admin = await iniciarSesion(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const operador = await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
const finanzas = await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
const inactivo = await iniciarSesion(env.E2E_INACTIVO_CORREO, env.E2E_INACTIVO_CLAVE);

// --- Mes aislado ---------------------------------------------------------
// Un mes al azar entre 2001 y 2019: los datos de otras pruebas viven en el
// presente, así que las diferencias antes/después solo reflejan este script.
const anio = 2001 + Math.floor(Math.random() * 19);
const mes = 1 + Math.floor(Math.random() * 12);
const dd = (n) => String(n).padStart(2, "0");
const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
const dia = (n) => `${anio}-${dd(mes)}-${dd(n)}`;
const M = { p_desde: dia(1), p_hasta: dia(ultimo) };
const siguiente = mes === 12 ? { a: anio + 1, m: 1 } : { a: anio, m: mes + 1 };
const M2 = { p_desde: `${siguiente.a}-${dd(siguiente.m)}-01`, p_hasta: `${siguiente.a}-${dd(siguiente.m)}-28` };
const HOY = { p_desde: hoy, p_hasta: hoy };
console.log(`Mes aislado: ${M.p_desde} a ${M.p_hasta}\n`);

const resumen = async (rango, sesion = admin) => (await rpc(sesion, "reporte_resumen", rango)).datos?.[0];
const actividades = async (rango) =>
  Object.fromEntries(((await rpc(admin, "reporte_resultados_actividad", rango)).datos ?? []).map((f) => [f.actividad, f]));
const agrupados = async (rango) => (await rpc(admin, "reporte_gastos_agrupados", rango)).datos ?? [];
const caja = async (rango) => Object.fromEntries(((await rpc(admin, "reporte_caja", rango)).datos ?? []).map((f) => [f.cuenta_dinero_id, f]));

/** Cálculo independiente desde el libro: Σ por tipo de cuenta y actividad. */
async function libro(rango) {
  const asientos = await todos(
    admin,
    `asientos?fecha=gte.${rango.p_desde}&fecha=lte.${rango.p_hasta}&select=id,actividad,origen_tipo,lineas_asiento(debe,haber,cuentas_contables(tipo,codigo))`,
  );
  const r = { ingresos: 0, gastos: 0, porActividad: {}, descuadrados: 0, asientos: asientos.length };
  for (const a of asientos) {
    let debe = 0;
    let haber = 0;
    for (const l of a.lineas_asiento) {
      debe += c(l.debe);
      haber += c(l.haber);
      const tipo = l.cuentas_contables.tipo;
      if (tipo !== "ingreso" && tipo !== "gasto") continue;
      const importe = tipo === "ingreso" ? c(l.haber) - c(l.debe) : c(l.debe) - c(l.haber);
      const fila = (r.porActividad[a.actividad] ??= { ingresos: 0, gastos: 0 });
      if (tipo === "ingreso") {
        r.ingresos += importe;
        fila.ingresos += importe;
      } else {
        r.gastos += importe;
        fila.gastos += importe;
      }
    }
    if (debe !== haber || a.lineas_asiento.length < 2) r.descuadrados += 1;
  }
  return r;
}

/** Saldo actual de una cuenta contable según el libro (debe − haber). */
async function saldoContable(codigo) {
  const lineas = await todos(admin, `lineas_asiento?select=id,debe,haber,cuentas_contables!inner(codigo)&cuentas_contables.codigo=eq.${codigo}`);
  return lineas.reduce((s, l) => s + c(l.debe) - c(l.haber), 0);
}

// --- Datos ficticios -----------------------------------------------------
const crearCliente = async (nombre) =>
  exigir(await api(operador.token, "POST", "clientes", { nombre: `${MARCA} ${nombre} ${sufijo}` }), "cliente")[0].id;
const clienteX = await crearCliente("Cliente X");
const clienteY = await crearCliente("Cliente Y (anticipo)");
const crearCuenta = async (nombre, tipo) =>
  exigir(await api(admin.token, "POST", "cuentas_dinero", { nombre: `${MARCA} ${nombre} ${sufijo}`, tipo }), "cuenta")[0].id;
const caja6 = await crearCuenta("Caja", "caja");
const banco6 = await crearCuenta("Banco", "banco");
const cuentaNegativa = await crearCuenta("Banco sin fondos", "banco");
const proveedor = exigir(await api(admin.token, "POST", "proveedores", { nombre: `${MARCA} Proveedor ${sufijo}` }), "proveedor")[0].id;
const categorias = await leer(admin, "categorias_gasto?activo=eq.true&select=id,nombre&order=nombre");
const [cat1, cat2] = [categorias[0], categorias[1] ?? categorias[0]];
comprobar("datos ficticios creados", clienteX && clienteY && caja6 && banco6 && cuentaNegativa && proveedor && cat1);

// --- Foto inicial ----------------------------------------------------------
const R0 = await resumen(M);
const A0 = await actividades(M);
const G0 = await agrupados(M);

// --- Operaciones en el mes aislado ------------------------------------------
exigir(await rpc(admin, "registrar_apertura", { p_idempotencia: randomUUID(), p_cuenta_dinero_id: caja6, p_fecha: dia(1), p_monto: "10000.00" }), "apertura caja");
exigir(await rpc(admin, "registrar_apertura", { p_idempotencia: randomUUID(), p_cuenta_dinero_id: banco6, p_fecha: dia(1), p_monto: "2000.00" }), "apertura banco");

const gasto = (actividad, monto, fecha, extra = {}) =>
  rpc(finanzas, "registrar_gasto", {
    p_idempotencia: randomUUID(), p_proveedor_id: proveedor, p_categoria_id: cat1.id, p_actividad: actividad,
    p_fecha: fecha, p_vencimiento: null, p_concepto: `${MARCA} Gasto ${actividad} ${sufijo}`, p_monto: monto, p_notas: null, ...extra,
  });
// 1–4. Un gasto por actividad (el general, el último día del mes).
const gAmb = exigir(await gasto("ambulancias", "1000.00", dia(5), { p_vencimiento: dia(20) }), "gasto ambulancias");
const gAlq = exigir(await gasto("alquileres", "800.00", dia(5), { p_categoria_id: cat2.id, p_pago: { cuenta_dinero_id: caja6, metodo: "efectivo", monto: "800.00" } }), "gasto alquileres");
const gTra = exigir(await gasto("transportes", "600.00", dia(10), { p_proveedor_id: null }), "gasto transportes");
const gGen = exigir(await gasto("general", "400.00", dia(ultimo), { p_categoria_id: cat2.id }), "gasto general");
// 5. Pago parcial de L 300 sobre el gasto de ambulancias.
const pagoParcial = exigir(
  await rpc(finanzas, "registrar_pago_gasto", { p_idempotencia: randomUUID(), p_gasto_id: gAmb, p_cuenta_dinero_id: caja6, p_fecha: dia(12), p_metodo: "efectivo", p_referencia: null, p_monto: "300.00" }),
  "pago parcial",
);

const cargo = (cliente, cuenta, monto, fecha, vencimiento = null) =>
  rpc(admin, "registrar_cargo", {
    p_idempotencia: randomUUID(), p_cliente_id: cliente, p_cuenta_ingreso: cuenta,
    p_concepto: `${MARCA} Cargo ${cuenta} ${sufijo}`, p_fecha: fecha, p_vencimiento: vencimiento, p_monto: monto,
  });
// 6. Ingreso de alquiler L 2,000 con cobro parcial de L 500.
const cAlq = exigir(await cargo(clienteX, "4300", "2000.00", dia(5), dia(15)), "cargo alquiler");
exigir(
  await rpc(operador, "registrar_cobro", {
    p_idempotencia: randomUUID(), p_cliente_id: clienteX, p_cuenta_dinero_id: caja6, p_fecha: dia(6), p_metodo: "efectivo",
    p_referencia: null, p_monto: "500.00",
  }),
  "cobro parcial",
);
// 7. Anticipo de L 1,000 sin cargo.
exigir(
  await rpc(operador, "registrar_cobro", {
    p_idempotencia: randomUUID(), p_cliente_id: clienteY, p_cuenta_dinero_id: caja6, p_fecha: dia(7), p_metodo: "efectivo",
    p_referencia: null, p_monto: "1000.00", p_aplicaciones: [],
  }),
  "anticipo",
);
const RA = await resumen(M); // tras el anticipo, antes de los demás cargos
// 8. Cargo de membresía L 700 al cliente del anticipo, luego se aplica el anticipo.
const cMem = exigir(await cargo(clienteY, "4100", "700.00", dia(8)), "cargo membresía");
exigir(await cargo(clienteX, "4200", "300.00", dia(8)), "cargo ambulancia");
const cTra = exigir(await cargo(clienteX, "4400", "900.00", dia(9)), "cargo transporte");
const anticiposAntes = c((await resumen(HOY)).anticipos);
exigir(await rpc(operador, "aplicar_saldo_a_favor", { p_idempotencia: randomUUID(), p_cargo_id: cMem, p_monto: "700.00" }), "aplicar anticipo");
const anticiposDespues = c((await resumen(HOY)).anticipos);
// 9. Transferencias: caja → banco L 250 y desde una cuenta sin fondos L 100 (queda negativa).
exigir(await rpc(finanzas, "registrar_transferencia", { p_idempotencia: randomUUID(), p_cuenta_origen_id: caja6, p_cuenta_destino_id: banco6, p_fecha: dia(15), p_monto: "250.00", p_referencia: null }), "transferencia");
exigir(await rpc(finanzas, "registrar_transferencia", { p_idempotencia: randomUUID(), p_cuenta_origen_id: cuentaNegativa, p_cuenta_destino_id: caja6, p_fecha: dia(16), p_monto: "100.00", p_referencia: null }), "transferencia sin fondos");

const R1 = await resumen(M);
const A1 = await actividades(M);
const G1 = await agrupados(M);

// --- 1–4, 10, 11. Ingresos, gastos y resultado por actividad ---------------
{
  const delta = (clave) => c(R1[clave]) - c(R0[clave]);
  const deltaA = (act, clave) => c(A1[act][clave]) - c(A0[act][clave]);
  comprobar("1. gasto de ambulancias: +L 1,000 en ambulancias", deltaA("ambulancias", "gastos") === 100000);
  comprobar("2. gasto de alquileres (pagado al registrar): +L 800 en alquileres", deltaA("alquileres", "gastos") === 80000);
  comprobar("3. gasto de transporte: +L 600 en transportes", deltaA("transportes", "gastos") === 60000);
  comprobar("4. gasto general (último día del mes): +L 400 en general, sin repartir", deltaA("general", "gastos") === 40000 && deltaA("general", "ingresos") === 0);
  comprobar("gastos reconocidos del mes: +L 2,800 (los pagos no suman gasto)", delta("gastos") === 280000, `${delta("gastos")}`);
  comprobar("ingresos reconocidos del mes: +L 3,900 (2,000 + 700 + 300 + 900)", delta("ingresos") === 390000, `${delta("ingresos")}`);
  comprobar("ingresos por actividad: ambulancias +1,000 (membresía y particular), alquileres +2,000, transportes +900",
    deltaA("ambulancias", "ingresos") === 100000 && deltaA("alquileres", "ingresos") === 200000 && deltaA("transportes", "ingresos") === 90000);
  comprobar("cobros del mes: +L 1,500 (cobro parcial y anticipo); pagos: +L 1,100", delta("cobros_periodo") === 150000 && delta("pagos_periodo") === 110000);
  comprobar("10. resultado = ingresos − gastos", c(R1.resultado) === c(R1.ingresos) - c(R1.gastos));
  const filas = Object.values(A1);
  comprobar("11. actividades + generales = consolidado (ingresos, gastos y resultado)",
    filas.length === 4 &&
      filas.reduce((s, f) => s + c(f.ingresos), 0) === c(R1.ingresos) &&
      filas.reduce((s, f) => s + c(f.gastos), 0) === c(R1.gastos) &&
      filas.reduce((s, f) => s + c(f.resultado), 0) === c(R1.resultado));
  const ind = await libro(M);
  comprobar("contraste con el libro (mes): ingresos y gastos coinciden con lineas_asiento",
    ind.ingresos === c(R1.ingresos) && ind.gastos === c(R1.gastos), JSON.stringify({ ind: [ind.ingresos, ind.gastos], rep: [R1.ingresos, R1.gastos] }));
  comprobar("contraste con el libro (mes): cada actividad coincide",
    ["ambulancias", "alquileres", "transportes", "general"].every(
      (a) => (ind.porActividad[a]?.ingresos ?? 0) === c(A1[a].ingresos) && (ind.porActividad[a]?.gastos ?? 0) === c(A1[a].gastos),
    ));
  // Agrupados: por categoría y por actividad suman lo mismo que el total de gastos.
  const suma = (lista, agrupacion) => lista.filter((g) => g.agrupacion === agrupacion).reduce((s, g) => s + c(g.importe), 0);
  comprobar("gastos agrupados: Σ categorías = Σ actividades = gastos del mes",
    suma(G1, "categoria") === c(R1.gastos) && suma(G1, "actividad") === c(R1.gastos));
  const grupo = (lista, agrupacion, clave) => c(lista.find((g) => g.agrupacion === agrupacion && g.clave === clave)?.importe);
  const esperadoCat1 = cat1.id === cat2.id ? 280000 : 160000; // ambulancias 1,000 + transportes 600
  comprobar("gastos agrupados por categoría: diferencias esperadas",
    grupo(G1, "categoria", cat1.id) - grupo(G0, "categoria", cat1.id) === esperadoCat1);
}

// --- 6–8. Cobro parcial, anticipo y aplicación posterior -------------------
{
  comprobar("7. el anticipo no cambia los ingresos (solo los cobros)",
    c(RA.ingresos) - c(R0.ingresos) === 200000 && c(RA.cobros_periodo) - c(R0.cobros_periodo) === 150000);
  comprobar("8. aplicar el anticipo baja el saldo a favor en L 700", anticiposAntes - anticiposDespues === 70000);
  // La aplicación del anticipo se fecha hoy: se miran el mes del cargo y hoy
  // (un único rango superaría el máximo de diez años).
  const filasMem = [
    ...((await rpc(admin, `reporte_ingresos?cargo_id=eq.${cMem}`, M)).datos ?? []),
    ...((await rpc(admin, `reporte_ingresos?cargo_id=eq.${cMem}`, HOY)).datos ?? []),
  ];
  comprobar("8. la aplicación no duplica el ingreso: una sola línea de L 700 (mes del cargo + hoy)",
    filasMem.length === 1 && c(filasMem[0].importe) === 70000 && filasMem[0].cliente_nombre?.includes("Cliente Y"));
  const filasMes = (await rpc(admin, "reporte_ingresos", M)).datos ?? [];
  comprobar("6. ingreso del alquiler: L 2,000 completos aunque se cobraron L 500",
    filasMes.filter((f) => f.cargo_id === cAlq).map((f) => c(f.importe)).join() === "200000");
  comprobar("ingresos del mes: solo cuentas 4x00 y Σ filas = total del resumen",
    filasMes.every((f) => f.cuenta_codigo.startsWith("4")) && filasMes.reduce((s, f) => s + c(f.importe), 0) === c(R1.ingresos));
  const cAlqSaldo = await uno(admin, `saldos_cargos?id=eq.${cAlq}&select=aplicado,pendiente,vencimiento`);
  comprobar("6. CxC del alquiler: pagado L 500, pendiente L 1,500", c(cAlqSaldo.aplicado) === 50000 && c(cAlqSaldo.pendiente) === 150000);
}

// --- 9. Transferencias y caja ----------------------------------------------
{
  const ingresosTransfer = ((await rpc(admin, "reporte_ingresos", M)).datos ?? []).some((f) => /transferencia/i.test(f.concepto));
  const gastosMes = (await rpc(admin, "reporte_gastos", M)).datos ?? [];
  comprobar("9. las transferencias no aparecen en ingresos ni en gastos",
    !ingresosTransfer && !gastosMes.some((f) => /transferencia/i.test(f.concepto)));
  comprobar("gastos del mes: Σ filas = total del resumen", gastosMes.reduce((s, f) => s + c(f.importe), 0) === c(R1.gastos));
  const filaAmb = gastosMes.find((f) => f.gasto_id === gAmb);
  comprobar("5. gasto con pago parcial: importe L 1,000, pagado L 300, pendiente L 700",
    filaAmb && c(filaAmb.importe) === 100000 && c(filaAmb.pagado) === 30000 && c(filaAmb.pendiente) === 70000 && filaAmb.proveedor?.includes(MARCA));
  const filaTra = gastosMes.find((f) => f.gasto_id === gTra);
  comprobar("gasto sin proveedor: se reporta con proveedor vacío", filaTra && filaTra.proveedor === null);
  const filaAlq = gastosMes.find((f) => f.gasto_id === gAlq);
  comprobar("gasto pagado al registrar: pendiente 0", filaAlq && c(filaAlq.pendiente) === 0 && c(filaAlq.pagado) === 80000);

  const k = await caja(M);
  const cj = k[caja6];
  comprobar("caja (mes): saldo inicial 0, aperturas 10,000, entradas 1,500, salidas −1,100, transferencias −150",
    cj && c(cj.saldo_inicial) === 0 && c(cj.aperturas) === 1000000 && c(cj.cobros) === 150000 && c(cj.pagos) === -110000 && c(cj.transferencias) === -15000,
    JSON.stringify(cj));
  comprobar("caja (mes): saldo final = inicial + movimientos = L 10,250",
    c(cj.saldo_final) === 1025000 && c(cj.saldo_final) === c(cj.saldo_inicial) + c(cj.aperturas) + c(cj.cobros) + c(cj.pagos) + c(cj.transferencias));
  comprobar("banco (mes): apertura 2,000 + transferencia 250 = 2,250", c(k[banco6].saldo_final) === 225000);
  comprobar("saldo negativo se muestra tal cual (−L 100)", c(k[cuentaNegativa].saldo_final) === -10000 && c(k[cuentaNegativa].saldo_actual) === -10000);
  const vista = await uno(admin, `saldos_cuentas_dinero?id=eq.${caja6}&select=saldo`);
  comprobar("saldo actual del reporte = vista de saldos de E2", c(cj.saldo_actual) === c(vista.saldo));
  const k2 = await caja(M2);
  comprobar("saldo inicial del mes siguiente = saldo final del mes", c(k2[caja6].saldo_inicial) === c(cj.saldo_final));
  const movs = (await rpc(admin, "reporte_movimientos", { p_cuenta_dinero_id: caja6, ...M })).datos ?? [];
  comprobar("movimientos de la caja: 7 en el mes y el saldo acumulado termina en el saldo final",
    movs.length === 7 && c(movs.at(-1).saldo) === c(cj.saldo_final) && movs.some((m) => m.tipo === "transferencia") && movs.some((m) => m.tipo === "apertura"),
    `${movs.length}`);
  const totalTransfer = Object.values(k).reduce((s, f) => s + c(f.transferencias), 0);
  comprobar("las transferencias suman cero entre todas las cuentas", totalTransfer === 0);
}

// --- 14. Filtros y fechas límite --------------------------------------------
{
  const dia5 = await resumen({ p_desde: dia(5), p_hasta: dia(5) });
  const ing5 = (await rpc(admin, "reporte_ingresos", { p_desde: dia(5), p_hasta: dia(5) })).datos ?? [];
  comprobar("rango de un solo día incluye ese día (cargo del día 5)", ing5.some((f) => f.cargo_id === cAlq) && c(dia5.ingresos) >= 200000);
  const sinUltimo = (await rpc(admin, "reporte_gastos", { p_desde: dia(1), p_hasta: dia(ultimo - 1) })).datos ?? [];
  const conUltimo = (await rpc(admin, "reporte_gastos", M)).datos ?? [];
  comprobar("el último día del mes se incluye en el mes y queda fuera de un rango que termina antes",
    conUltimo.some((f) => f.gasto_id === gGen) && !sinUltimo.some((f) => f.gasto_id === gGen));
  const siguienteMes = (await rpc(admin, "reporte_gastos", M2)).datos ?? [];
  comprobar("nada del mes aparece en el mes siguiente", !siguienteMes.some((f) => [gAmb, gAlq, gTra, gGen].includes(f.gasto_id)));
  const porActividad = (await rpc(admin, "reporte_gastos", { ...M, p_actividad: "general" })).datos ?? [];
  comprobar("filtro por actividad: solo gastos generales", porActividad.length > 0 && porActividad.every((f) => f.actividad === "general"));
  const invertido = await rpc(admin, "reporte_resumen", { p_desde: dia(10), p_hasta: dia(1) });
  const nulo = await rpc(admin, "reporte_resumen", { p_desde: null, p_hasta: dia(1) });
  const largo = await rpc(admin, "reporte_resumen", { p_desde: "2000-01-01", p_hasta: "2015-01-01" });
  comprobar("rango invertido, nulo o mayor de diez años: rechazado (22023)",
    invertido.codigo === "22023" && nulo.codigo === "22023" && largo.codigo === "22023");
}

// --- 13. Reversos y anulaciones (fechados hoy) ------------------------------
{
  const antesHoy = c((await resumen(HOY)).por_pagar);
  exigir(await rpc(admin, "anular_cargo", { p_cargo_id: cTra, p_motivo: `${MARCA} servicio no prestado` }), "anular cargo");
  exigir(await rpc(admin, "anular_gasto", { p_gasto_id: gTra, p_motivo: `${MARCA} gasto duplicado` }), "anular gasto");
  const pago = await uno(admin, `pagos_gasto?id=eq.${pagoParcial}&select=id`);
  exigir(await rpc(admin, "reversar_pago_gasto", { p_pago_id: pago.id, p_motivo: `${MARCA} pago mal registrado` }), "reversar pago");

  const RM = await resumen(M);
  comprobar("13. el mes histórico no cambia con reversos posteriores", c(RM.ingresos) === c(R1.ingresos) && c(RM.gastos) === c(R1.gastos));
  const ingHoy = (await rpc(admin, "reporte_ingresos", HOY)).datos ?? [];
  const revCargo = ingHoy.filter((f) => f.cargo_id === cTra);
  comprobar("13. anulación del cargo: −L 900 en transportes con fecha de hoy",
    revCargo.length === 1 && c(revCargo[0].importe) === -90000 && revCargo[0].evento === "reverso" && revCargo[0].actividad === "transportes");
  const gasHoy = (await rpc(admin, "reporte_gastos", HOY)).datos ?? [];
  const revGasto = gasHoy.filter((f) => f.gasto_id === gTra);
  comprobar("13. anulación del gasto: −L 600 con fecha de hoy y estado anulado",
    revGasto.length === 1 && c(revGasto[0].importe) === -60000 && revGasto[0].estado === "anulado");
  const lineasTra = [
    ...((await rpc(admin, `reporte_ingresos?cargo_id=eq.${cTra}`, M)).datos ?? []),
    ...((await rpc(admin, `reporte_ingresos?cargo_id=eq.${cTra}`, HOY)).datos ?? []),
  ];
  const neto = lineasTra.reduce((s, f) => s + c(f.importe), 0);
  comprobar("13. mes del cargo + hoy: el cargo anulado suma cero (registro + reverso)", neto === 0 && lineasTra.length === 2);
  const saldoAmb = await uno(admin, `saldos_gastos?id=eq.${gAmb}&select=pagado,pendiente`);
  comprobar("13. reverso del pago: el gasto vuelve a pendiente L 1,000", c(saldoAmb.pagado) === 0 && c(saldoAmb.pendiente) === 100000);
  const despuesHoy = c((await resumen(HOY)).por_pagar);
  comprobar("13. CxP: −600 por la anulación y +300 por el pago reversado", despuesHoy - antesHoy === -30000, `${despuesHoy - antesHoy}`);
  const k = await caja(M);
  comprobar("13. caja: el saldo al cierre del mes no cambia; el actual sí (+300)",
    c(k[caja6].saldo_final) === 1025000 && c(k[caja6].saldo_actual) === 1055000);
}

// --- 12. CxC, CxP, anticipos y dinero = libro --------------------------------
{
  const r = await resumen(HOY);
  const [l1100, l1200, l2100, l2200] = await Promise.all(["1100", "1200", "2100", "2200"].map(saldoContable));
  comprobar("12. por cobrar = saldo de la cuenta 1200 del libro", c(r.por_cobrar) === l1200, `${r.por_cobrar} vs ${l1200 / 100}`);
  comprobar("12. por pagar = saldo de la cuenta 2100 del libro", c(r.por_pagar) === -l2100, `${r.por_pagar} vs ${-l2100 / 100}`);
  comprobar("12. anticipos sin aplicar = saldo de la cuenta 2200 del libro", c(r.anticipos) === -l2200);
  comprobar("12. caja y bancos = saldo de la cuenta 1100 del libro", c(r.dinero_disponible) === l1100);
  const cargos = await todos(admin, "saldos_cargos?estado=eq.vigente&pendiente=gt.0&select=id,pendiente,vencimiento");
  const vencidoCxc = cargos.filter((f) => f.vencimiento && f.vencimiento < hoy).reduce((s, f) => s + c(f.pendiente), 0);
  comprobar("12. CxC vencido = Σ pendientes con vencimiento anterior a hoy", c(r.por_cobrar_vencido) === vencidoCxc);
  const gastos = await todos(admin, "saldos_gastos?estado=eq.registrado&pendiente=gt.0&select=id,pendiente,vencimiento");
  const vencidoCxp = gastos.filter((f) => f.vencimiento && f.vencimiento < hoy).reduce((s, f) => s + c(f.pendiente), 0);
  comprobar("12. CxP vencido = Σ pendientes con vencimiento anterior a hoy", c(r.por_pagar_vencido) === vencidoCxp);
  const amb = await uno(admin, `saldos_gastos?id=eq.${gAmb}&select=pendiente,vencimiento`);
  comprobar("12. el gasto de ambulancias (vence el día 20 del mes aislado) cuenta como vencido", amb.vencimiento === dia(20) && c(amb.pendiente) === 100000);
  const anio = hoy.slice(0, 4);
  const RY = await resumen({ p_desde: `${anio}-01-01`, p_hasta: `${anio}-12-31` });
  const ind = await libro({ p_desde: `${anio}-01-01`, p_hasta: `${anio}-12-31` });
  comprobar("contraste con el libro (año actual): ingresos, gastos y resultado",
    ind.ingresos === c(RY.ingresos) && ind.gastos === c(RY.gastos) && c(RY.resultado) === ind.ingresos - ind.gastos);
  const AY = await actividades({ p_desde: `${anio}-01-01`, p_hasta: `${anio}-12-31` });
  comprobar("11. año actual: actividades + generales = consolidado",
    Object.values(AY).reduce((s, f) => s + c(f.resultado), 0) === c(RY.resultado));
}

// --- 17. Asientos cuadrados --------------------------------------------------
{
  const mesLibro = await libro(M);
  const hoyLibro = await libro(HOY);
  comprobar("17. ningún asiento descuadrado en el mes aislado ni hoy", mesLibro.descuadrados === 0 && hoyLibro.descuadrados === 0,
    `${mesLibro.descuadrados}/${hoyLibro.descuadrados}`);
}

// --- 15–16. Permisos ---------------------------------------------------------
{
  const llamadas = [
    ["reporte_resumen", M],
    ["reporte_resultados_actividad", M],
    ["reporte_ingresos", M],
    ["reporte_gastos", M],
    ["reporte_gastos_agrupados", M],
    ["reporte_caja", M],
    ["reporte_movimientos", { p_cuenta_dinero_id: caja6, ...M }],
  ];
  const resultados = async (sesion) => Promise.all(llamadas.map(([f, args]) => rpc(sesion, f, args)));
  const deAdmin = await resultados(admin);
  const deFinanzas = await resultados(finanzas);
  const deOperador = await resultados(operador);
  const deInactivo = await resultados(inactivo);
  const deAnon = await resultados(null);
  comprobar("15. administrador: los 7 reportes responden", deAdmin.every((r) => r.estado === 200));
  comprobar("15. finanzas: los 7 reportes responden con las mismas cifras",
    deFinanzas.every((r) => r.estado === 200) && JSON.stringify(deFinanzas[0].datos) === JSON.stringify(deAdmin[0].datos));
  comprobar("15. operador: los 7 reportes rechazados (42501)", deOperador.every((r) => r.codigo === "42501"),
    deOperador.map((r) => r.codigo).join());
  comprobar("16. usuario inactivo: rechazado (42501)", deInactivo.every((r) => r.codigo === "42501"));
  comprobar("16. sin sesión: rechazado", deAnon.every(denegado), deAnon.map((r) => r.estado).join());
  const privada = await rpc(admin, "lineas_resultado", M);
  comprobar("16. las funciones auxiliares privadas no se exponen por la API", privada.estado === 404 || denegado(privada), `HTTP ${privada.estado}`);
  const mov = await leer(operador, "movimientos_dinero?select=id&limit=1");
  const cuentas = await leer(operador, "saldos_cuentas_dinero?select=id&limit=1");
  comprobar("16. el operador sigue sin ver movimientos ni saldos bancarios (RLS de E2)",
    Array.isArray(mov) && mov.length === 0 && Array.isArray(cuentas) && cuentas.length === 0);
  const escritura = await api(admin.token, "POST", "asientos", { fecha: hoy, concepto: "x", origen_tipo: "cargo", origen_id: randomUUID(), evento: "registro" });
  comprobar("16. nadie escribe directamente en el libro", denegado(escritura), `HTTP ${escritura.estado}`);
}

terminar();
