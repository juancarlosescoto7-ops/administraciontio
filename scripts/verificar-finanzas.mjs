// Verifica el núcleo financiero de E2 contra la API REST real de Supabase
// (desarrollo) con usuarios ficticios: saldos, idempotencia, concurrencia,
// aislamiento entre clientes, asientos balanceados, permisos y reversos.
// Uso: E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-finanzas.mjs
// Crea registros ficticios marcados con "[PRUEBA E2]". No elimina nada.
import { randomUUID } from "node:crypto";
import { cargarEntorno, crearClienteRest, crearReporte, denegado } from "./comun.mjs";

const MARCA = "[PRUEBA E2]";
const env = cargarEntorno();
const { iniciarSesion, api } = crearClienteRest(env);
const { comprobar, terminar } = crearReporte();
const sufijo = Date.now().toString(36).toUpperCase();
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date());

/** Importe JSON → centavos enteros (para comparar sin float). */
const c = (valor) => Math.round(Number(valor) * 100);
const rpc = (sesion, funcion, args) => api(sesion?.token ?? null, "POST", `rpc/${funcion}`, args);
const ok = (r) => r.estado >= 200 && r.estado < 300;
const leer = async (sesion, ruta) => (await api(sesion.token, "GET", ruta)).datos;
const uno = async (sesion, ruta) => (await leer(sesion, ruta))?.[0];

const admin = await iniciarSesion(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const operador = await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
const finanzas = await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
const inactivo = await iniciarSesion(env.E2E_INACTIVO_CORREO, env.E2E_INACTIVO_CLAVE);

const saldoCuenta = async (id) => c((await uno(admin, `saldos_cuentas_dinero?id=eq.${id}&select=saldo`))?.saldo);
const movimientosDe = (origen, id) => leer(admin, `movimientos_dinero?origen_tipo=eq.${origen}&origen_id=eq.${id}&select=*`);
const asientosDe = (origen, id) =>
  leer(admin, `asientos?origen_tipo=eq.${origen}&origen_id=eq.${id}&select=id,evento,estado,lineas_asiento(debe,haber,cuenta_dinero_id,cuentas_contables(codigo))`);
const cuadra = (asiento) =>
  asiento.lineas_asiento.length >= 2 &&
  asiento.lineas_asiento.reduce((s, l) => s + c(l.debe), 0) === asiento.lineas_asiento.reduce((s, l) => s + c(l.haber), 0);
/** Líneas como "1200D150000" para comparar plantillas contables. */
const plantilla = (asiento) =>
  asiento.lineas_asiento
    .map((l) => `${l.cuentas_contables.codigo}${c(l.debe) > 0 ? `D${c(l.debe)}` : `H${c(l.haber)}`}`)
    .sort()
    .join(" ");

// --- Datos ficticios ---------------------------------------------------
const crearCliente = async (nombre) =>
  (await api(operador.token, "POST", "clientes", { nombre: `${MARCA} ${nombre} ${sufijo}` })).datos?.[0]?.id;
const clienteA = await crearCliente("Cliente A");
const clienteB = await crearCliente("Cliente B");
const clienteC = await crearCliente("Cliente C");
const caja = (await api(admin.token, "POST", "cuentas_dinero", { nombre: `${MARCA} Caja A ${sufijo}`, tipo: "caja" })).datos?.[0]?.id;
const banco = (await api(admin.token, "POST", "cuentas_dinero", { nombre: `${MARCA} Banco B ${sufijo}`, tipo: "banco", banco: "Banco ficticio" })).datos?.[0]?.id;
const combustible = (await uno(admin, "categorias_gasto?nombre=eq.Combustible&select=id"))?.id;
comprobar("datos ficticios creados", clienteA && clienteB && clienteC && caja && banco && combustible);

// --- 0. Sin sesión e inactivos -------------------------------------------
{
  const tablas = [
    "cargos_cliente", "cobros_cliente", "aplicaciones_cobro", "gastos", "pagos_gasto", "movimientos_dinero",
    "transferencias", "asientos", "lineas_asiento", "cuentas_contables", "categorias_gasto",
    "saldos_cargos", "saldos_cobros", "saldos_clientes", "saldos_gastos", "saldos_cuentas_dinero",
  ];
  let todasDenegadas = true;
  for (const tabla of tablas) {
    const r = await api(null, "GET", `${tabla}?select=*&limit=1`);
    if (!denegado(r)) todasDenegadas = false;
  }
  comprobar("anon no lee ninguna tabla ni vista financiera (16)", todasDenegadas);
  const r = await rpc(null, "registrar_cobro", { p_idempotencia: randomUUID(), p_cliente_id: clienteA, p_cuenta_dinero_id: caja, p_fecha: hoy, p_metodo: "efectivo", p_referencia: null, p_monto: 1 });
  comprobar("anon no ejecuta registrar_cobro", denegado(r), `HTTP ${r.estado}`);
  const i = await rpc(inactivo, "registrar_cobro", { p_idempotencia: randomUUID(), p_cliente_id: clienteA, p_cuenta_dinero_id: caja, p_fecha: hoy, p_metodo: "efectivo", p_referencia: null, p_monto: 1 });
  comprobar("usuario inactivo no registra cobros", i.codigo === "42501", JSON.stringify(i.datos));
  const lectura = await leer(inactivo, "cargos_cliente?select=id&limit=1");
  comprobar("usuario inactivo no ve cargos", Array.isArray(lectura) && lectura.length === 0);
}

// --- Saldo inicial (apertura) ---------------------------------------------
{
  const clave = randomUUID();
  const r = await rpc(admin, "registrar_apertura", { p_idempotencia: clave, p_cuenta_dinero_id: caja, p_fecha: hoy, p_monto: "5000.00" });
  const repetida = await rpc(admin, "registrar_apertura", { p_idempotencia: clave, p_cuenta_dinero_id: caja, p_fecha: hoy, p_monto: "5000.00" });
  const otra = await rpc(admin, "registrar_apertura", { p_idempotencia: randomUUID(), p_cuenta_dinero_id: caja, p_fecha: hoy, p_monto: "100.00" });
  const [asiento] = await asientosDe("apertura", clave);
  comprobar("saldo inicial de L 5,000 en Caja A", r.estado === 200 && (await saldoCuenta(caja)) === 500000, JSON.stringify(r.datos));
  comprobar("saldo inicial: reintento con la misma clave no duplica", repetida.estado === 200 && (await movimientosDe("apertura", clave)).length === 1);
  comprobar("saldo inicial: un segundo saldo inicial vigente es rechazado", otra.codigo === "22023", JSON.stringify(otra.datos));
  comprobar("saldo inicial: D 1100 / H 3100", asiento && plantilla(asiento) === "1100D500000 3100H500000");
  const fin = await rpc(finanzas, "registrar_apertura", { p_idempotencia: randomUUID(), p_cuenta_dinero_id: banco, p_fecha: hoy, p_monto: "1.00" });
  comprobar("finanzas no registra saldos iniciales", fin.codigo === "42501");
}

// --- 1. Cargo de L 1,500 y cobro parcial de L 500 -----------------------
let cargo1500;
let cobro500;
{
  const r = await rpc(admin, "registrar_cargo", {
    p_idempotencia: randomUUID(), p_cliente_id: clienteA, p_cuenta_ingreso: "4300",
    p_concepto: `${MARCA} Alquiler`, p_fecha: hoy, p_vencimiento: null, p_monto: "1500.00",
  });
  cargo1500 = r.datos;
  const saldoAntes = await saldoCuenta(caja);
  const cobro = await rpc(operador, "registrar_cobro", {
    p_idempotencia: randomUUID(), p_cliente_id: clienteA, p_cuenta_dinero_id: caja, p_fecha: hoy,
    p_metodo: "efectivo", p_referencia: null, p_monto: "500.00",
    p_aplicaciones: [{ cargo_id: cargo1500, monto: "500.00" }],
  });
  cobro500 = cobro.datos;
  const cargo = await uno(admin, `saldos_cargos?id=eq.${cargo1500}&select=monto,aplicado,pendiente`);
  const movs = await movimientosDe("cobro", cobro500);
  comprobar("1. cargo total L 1,500", c(cargo?.monto) === 150000, JSON.stringify(r.datos));
  comprobar("1. total aplicado L 500", c(cargo?.aplicado) === 50000, JSON.stringify(cobro.datos));
  comprobar("1. pendiente L 1,000", c(cargo?.pendiente) === 100000);
  comprobar("1. una sola entrada de L 500 en caja", movs.length === 1 && c(movs[0].monto_con_signo) === 50000 && (await saldoCuenta(caja)) - saldoAntes === 50000);
  const [asientoCargo] = await asientosDe("cargo", cargo1500);
  const [asientoCobro] = await asientosDe("cobro", cobro500);
  const aplicaciones = await leer(admin, `aplicaciones_cobro?cobro_id=eq.${cobro500}&select=id`);
  const [asientoAplicacion] = await asientosDe("aplicacion", aplicaciones[0].id);
  comprobar("1. asiento del cargo: D 1200 CxC / H 4300 alquileres", plantilla(asientoCargo) === "1200D150000 4300H150000");
  comprobar("1. asiento del cobro: D 1100 caja / H 2200 anticipos", plantilla(asientoCobro) === "1100D50000 2200H50000");
  comprobar("1. asiento de la aplicación: D 2200 / H 1200, sin mover caja",
    plantilla(asientoAplicacion) === "1200H50000 2200D50000" && (await movimientosDe("aplicacion", aplicaciones[0].id)).length === 0);
  const deudaCliente = await uno(operador, `saldos_clientes?cliente_id=eq.${clienteA}&select=pendiente,saldo_a_favor`);
  comprobar("1. el operador consulta el saldo del cliente (pendiente L 1,000, a favor 0)", c(deudaCliente?.pendiente) === 100000 && c(deudaCliente?.saldo_a_favor) === 0);
}

// --- 2. Anticipo previo al cargo y aplicación posterior -------------------
{
  const saldoAntes = await saldoCuenta(caja);
  const anticipo = await rpc(finanzas, "registrar_cobro", {
    p_idempotencia: randomUUID(), p_cliente_id: clienteB, p_cuenta_dinero_id: caja, p_fecha: hoy,
    p_metodo: "transferencia", p_referencia: "ANT-1", p_monto: "700.00",
  });
  const tras = await uno(admin, `saldos_clientes?cliente_id=eq.${clienteB}&select=pendiente,saldo_a_favor`);
  comprobar("2. anticipo de L 700: queda como saldo a favor", anticipo.estado === 200 && c(tras?.saldo_a_favor) === 70000 && c(tras?.pendiente) === 0, JSON.stringify(anticipo.datos));
  comprobar("2. el anticipo aumenta la caja L 700", (await saldoCuenta(caja)) - saldoAntes === 70000);

  const cargo = (await rpc(admin, "registrar_cargo", {
    p_idempotencia: randomUUID(), p_cliente_id: clienteB, p_cuenta_ingreso: "4400",
    p_concepto: `${MARCA} Transporte`, p_fecha: hoy, p_vencimiento: hoy, p_monto: "1000.00",
  })).datos;
  const saldoPrevio = await saldoCuenta(caja);
  const movimientosPrevios = (await leer(admin, `movimientos_dinero?cuenta_dinero_id=eq.${caja}&select=id`)).length;
  const aplicar = await rpc(operador, "aplicar_saldo_a_favor", { p_idempotencia: randomUUID(), p_cargo_id: cargo, p_monto: "700.00" });
  const despues = await uno(admin, `saldos_cargos?id=eq.${cargo}&select=aplicado,pendiente`);
  const cliente = await uno(admin, `saldos_clientes?cliente_id=eq.${clienteB}&select=saldo_a_favor,pendiente`);
  comprobar("2. aplicación del anticipo: cargo L 1,000 queda con L 300 pendientes", aplicar.estado === 200 && c(despues?.aplicado) === 70000 && c(despues?.pendiente) === 30000, JSON.stringify(aplicar.datos));
  comprobar("2. saldo a favor consumido (0) y deuda L 300", c(cliente?.saldo_a_favor) === 0 && c(cliente?.pendiente) === 30000);
  comprobar("2. aplicar el anticipo no crea una nueva entrada de dinero",
    (await saldoCuenta(caja)) === saldoPrevio && (await leer(admin, `movimientos_dinero?cuenta_dinero_id=eq.${caja}&select=id`)).length === movimientosPrevios);
}

// --- 3. Gasto de L 800 con pago parcial de L 300 --------------------------
let gasto800;
{
  const saldoAntes = await saldoCuenta(caja);
  const clave = randomUUID();
  const r = await rpc(finanzas, "registrar_gasto", {
    p_idempotencia: clave, p_proveedor_id: null, p_categoria_id: combustible, p_actividad: "ambulancias",
    p_fecha: hoy, p_vencimiento: null, p_concepto: `${MARCA} Combustible`, p_monto: "800.00", p_notas: null,
    p_pago: { cuenta_dinero_id: caja, metodo: "efectivo", referencia: null, monto: "300.00" },
  });
  gasto800 = r.datos;
  const gasto = await uno(admin, `saldos_gastos?id=eq.${gasto800}&select=monto,pagado,pendiente`);
  const [asientoGasto] = await asientosDe("gasto", gasto800);
  const pagos = await leer(admin, `pagos_gasto?gasto_id=eq.${gasto800}&select=id`);
  const [asientoPago] = await asientosDe("pago_gasto", pagos[0]?.id);
  comprobar("3. gasto reconocido L 800", c(gasto?.monto) === 80000, JSON.stringify(r.datos));
  comprobar("3. salida de caja L 300", (await saldoCuenta(caja)) - saldoAntes === -30000);
  comprobar("3. cuenta por pagar L 500", c(gasto?.pendiente) === 50000 && c(gasto?.pagado) === 30000);
  comprobar("3. asiento del gasto: D 5100 combustible / H 2100 CxP", plantilla(asientoGasto) === "2100H80000 5100D80000");
  comprobar("3. asiento del pago: D 2100 / H 1100, sin duplicar el gasto",
    plantilla(asientoPago) === "1100H30000 2100D30000" && (await leer(admin, `asientos?origen_tipo=eq.gasto&origen_id=eq.${gasto800}&select=id`)).length === 1);
  const abono = await rpc(finanzas, "registrar_pago_gasto", {
    p_idempotencia: randomUUID(), p_gasto_id: gasto800, p_cuenta_dinero_id: caja, p_fecha: hoy,
    p_metodo: "efectivo", p_referencia: null, p_monto: "600.00",
  });
  comprobar("3. un abono mayor que lo pendiente (L 600 > L 500) es rechazado", abono.codigo === "22023", JSON.stringify(abono.datos));
}

// --- 4. Transferencia interna de L 1,000 -----------------------------------
let transferencia;
{
  const cajaAntes = await saldoCuenta(caja);
  const bancoAntes = await saldoCuenta(banco);
  const r = await rpc(finanzas, "registrar_transferencia", {
    p_idempotencia: randomUUID(), p_cuenta_origen_id: caja, p_cuenta_destino_id: banco,
    p_fecha: hoy, p_monto: "1000.00", p_referencia: `${MARCA} depósito`,
  });
  transferencia = r.datos;
  const [asiento] = await asientosDe("transferencia", transferencia);
  comprobar("4. Caja A disminuye L 1,000", (await saldoCuenta(caja)) - cajaAntes === -100000, JSON.stringify(r.datos));
  comprobar("4. Banco B aumenta L 1,000", (await saldoCuenta(banco)) - bancoAntes === 100000);
  comprobar("4. el saldo combinado no cambia", (await saldoCuenta(caja)) + (await saldoCuenta(banco)) === cajaAntes + bancoAntes);
  comprobar("4. no es ingreso ni gasto: solo líneas de 1100 (D destino / H origen)",
    plantilla(asiento) === "1100D100000 1100H100000" &&
    asiento.lineas_asiento.find((l) => c(l.debe) > 0).cuenta_dinero_id === banco &&
    asiento.lineas_asiento.find((l) => c(l.haber) > 0).cuenta_dinero_id === caja);
  const misma = await rpc(admin, "registrar_transferencia", {
    p_idempotencia: randomUUID(), p_cuenta_origen_id: caja, p_cuenta_destino_id: caja, p_fecha: hoy, p_monto: "1.00", p_referencia: null,
  });
  comprobar("4. transferencia a la misma cuenta rechazada", misma.codigo === "22023");
}

// --- 5. Idempotencia ante reintentos ---------------------------------------
{
  const clave = randomUUID();
  const args = {
    p_idempotencia: clave, p_cliente_id: clienteC, p_cuenta_dinero_id: caja, p_fecha: hoy,
    p_metodo: "efectivo", p_referencia: null, p_monto: "500.00",
  };
  const r1 = await rpc(operador, "registrar_cobro", args);
  const r2 = await rpc(operador, "registrar_cobro", args);
  comprobar("5. reintento secuencial del mismo cobro devuelve el mismo id", r1.estado === 200 && r1.datos === r2.datos);
  const simultaneos = await Promise.all([1, 2, 3].map(() => rpc(finanzas, "registrar_cobro", args)));
  comprobar("5. tres reintentos simultáneos devuelven el mismo cobro", simultaneos.every((r) => r.datos === r1.datos), JSON.stringify(simultaneos.map((r) => r.datos)));
  const cobros = await leer(admin, `cobros_cliente?idempotencia=eq.${clave}&select=id`);
  comprobar("5. existe un solo cobro y un solo movimiento de dinero",
    cobros.length === 1 && (await movimientosDe("cobro", r1.datos)).length === 1 && (await asientosDe("cobro", r1.datos)).length === 1);
  const distinto = await rpc(operador, "registrar_cobro", { ...args, p_monto: "999.00" });
  comprobar("5. reutilizar la clave con otros datos es rechazado", distinto.codigo === "22023", JSON.stringify(distinto.datos));

  const claveCargo = randomUUID();
  const argsCargo = { p_idempotencia: claveCargo, p_cliente_id: clienteC, p_cuenta_ingreso: "4100", p_concepto: `${MARCA} Cuota`, p_fecha: hoy, p_vencimiento: null, p_monto: "250.00" };
  const cargos = await Promise.all([rpc(admin, "registrar_cargo", argsCargo), rpc(admin, "registrar_cargo", argsCargo)]);
  comprobar("5. cargo con el mismo origen no se duplica",
    cargos[0].datos === cargos[1].datos && (await leer(admin, `cargos_cliente?origen_id=eq.${claveCargo}&select=id`)).length === 1);

  const claveGasto = randomUUID();
  const argsGasto = { p_idempotencia: claveGasto, p_proveedor_id: null, p_categoria_id: combustible, p_actividad: "general", p_fecha: hoy, p_vencimiento: null, p_concepto: `${MARCA} Reintento`, p_monto: "100.00", p_notas: null, p_pago: { cuenta_dinero_id: caja, metodo: "efectivo", monto: "100.00" } };
  const gastos = await Promise.all([rpc(finanzas, "registrar_gasto", argsGasto), rpc(finanzas, "registrar_gasto", argsGasto)]);
  const pagosGasto = await leer(admin, `pagos_gasto?gasto_id=eq.${gastos[0].datos}&select=id`);
  comprobar("5. gasto pagado de contado reintentado: un gasto y un pago",
    gastos[0].datos === gastos[1].datos && (await leer(admin, `gastos?idempotencia=eq.${claveGasto}&select=id`)).length === 1 && pagosGasto.length === 1);

  const claveTr = randomUUID();
  const argsTr = { p_idempotencia: claveTr, p_cuenta_origen_id: banco, p_cuenta_destino_id: caja, p_fecha: hoy, p_monto: "10.00", p_referencia: null };
  const trs = await Promise.all([rpc(finanzas, "registrar_transferencia", argsTr), rpc(finanzas, "registrar_transferencia", argsTr)]);
  comprobar("5. transferencia reintentada: dos movimientos, no cuatro",
    trs[0].datos === trs[1].datos && (await movimientosDe("transferencia", trs[0].datos)).length === 2);

  // Aplicación de saldo a favor reintentada con la misma clave.
  const cargoC = (await rpc(admin, "registrar_cargo", { ...argsCargo, p_idempotencia: randomUUID(), p_monto: "200.00" })).datos;
  const claveAp = randomUUID();
  await Promise.all([1, 2].map(() => rpc(operador, "aplicar_saldo_a_favor", { p_idempotencia: claveAp, p_cargo_id: cargoC, p_monto: "200.00" })));
  const aps = await leer(admin, `aplicaciones_cobro?operacion_id=eq.${claveAp}&select=monto`);
  comprobar("5. aplicación reintentada en paralelo se registra una vez", aps.length === 1 && c(aps[0].monto) === 20000, JSON.stringify(aps));
}

// --- 6. Sin sobreaplicaciones (y concurrencia sobre el mismo anticipo) -----
{
  // clienteC: cobro 500 - 200 aplicados = 300 a favor; cargo de 250 sin pagar.
  const cargoC = (await leer(admin, `cargos_cliente?cliente_id=eq.${clienteC}&monto=eq.250&select=id`))[0].id;
  const exceso = await rpc(operador, "aplicar_saldo_a_favor", { p_idempotencia: randomUUID(), p_cargo_id: cargoC, p_monto: "260.00" });
  comprobar("6. aplicar más que el pendiente del cargo es rechazado", exceso.codigo === "22023", JSON.stringify(exceso.datos));
  const cargoGrande = (await rpc(admin, "registrar_cargo", { p_idempotencia: randomUUID(), p_cliente_id: clienteC, p_cuenta_ingreso: "4200", p_concepto: `${MARCA} Traslado`, p_fecha: hoy, p_vencimiento: null, p_monto: "900.00" })).datos;
  const sinSaldo = await rpc(operador, "aplicar_saldo_a_favor", { p_idempotencia: randomUUID(), p_cargo_id: cargoGrande, p_monto: "400.00" });
  comprobar("6. aplicar más que el saldo a favor (L 400 > L 300) es rechazado", sinSaldo.codigo === "22023", JSON.stringify(sinSaldo.datos));
  const clave = randomUUID();
  const sobre = await rpc(operador, "registrar_cobro", {
    p_idempotencia: clave, p_cliente_id: clienteC, p_cuenta_dinero_id: caja, p_fecha: hoy, p_metodo: "efectivo",
    p_referencia: null, p_monto: "100.00", p_aplicaciones: [{ cargo_id: cargoGrande, monto: "150.00" }],
  });
  comprobar("6. aplicar más que el importe del cobro es rechazado y no se registra el cobro",
    sobre.codigo === "22023" && (await leer(admin, `cobros_cliente?idempotencia=eq.${clave}&select=id`)).length === 0, JSON.stringify(sobre.datos));

  // Dos aplicaciones simultáneas de L 300 contra un saldo a favor de L 300.
  const intentos = await Promise.all([cargoC, cargoGrande].map((cargo) =>
    rpc(operador, "aplicar_saldo_a_favor", { p_idempotencia: randomUUID(), p_cargo_id: cargo, p_monto: cargo === cargoC ? "250.00" : "300.00" }),
  ));
  const exitos = intentos.filter((r) => r.estado === 200).length;
  const cliente = await uno(admin, `saldos_clientes?cliente_id=eq.${clienteC}&select=saldo_a_favor`);
  const cobrosC = await leer(admin, `saldos_cobros?cliente_id=eq.${clienteC}&select=monto,aplicado,disponible`);
  comprobar("6. dos aplicaciones simultáneas no gastan dos veces el mismo anticipo",
    exitos === 1 && c(cliente?.saldo_a_favor) >= 0 && cobrosC.every((x) => c(x.aplicado) <= c(x.monto) && c(x.disponible) >= 0),
    JSON.stringify(intentos.map((r) => r.datos)));
}

// --- 7. Aislamiento entre clientes -----------------------------------------
{
  // clienteA tiene cargo con L 1,000 pendientes; clienteB no tiene saldo a favor.
  const clave = randomUUID();
  const ajeno = await rpc(operador, "registrar_cobro", {
    p_idempotencia: clave, p_cliente_id: clienteB, p_cuenta_dinero_id: caja, p_fecha: hoy, p_metodo: "efectivo",
    p_referencia: null, p_monto: "100.00", p_aplicaciones: [{ cargo_id: cargo1500, monto: "100.00" }],
  });
  comprobar("7. el cobro de un cliente no se aplica al cargo de otro", ajeno.codigo === "22023" && /otro/.test(ajeno.mensaje ?? ""), JSON.stringify(ajeno.datos));
  comprobar("7. … y el cobro rechazado no deja rastro", (await leer(admin, `cobros_cliente?idempotencia=eq.${clave}&select=id`)).length === 0);
  const anticipoB = await rpc(finanzas, "registrar_cobro", { p_idempotencia: randomUUID(), p_cliente_id: clienteB, p_cuenta_dinero_id: caja, p_fecha: hoy, p_metodo: "efectivo", p_referencia: null, p_monto: "50.00" });
  const usarAjeno = await rpc(operador, "aplicar_saldo_a_favor", { p_idempotencia: randomUUID(), p_cargo_id: cargo1500, p_monto: "50.00" });
  const saldoB = await uno(admin, `saldos_clientes?cliente_id=eq.${clienteB}&select=saldo_a_favor`);
  comprobar("7. el saldo a favor de un cliente no paga cargos de otro",
    anticipoB.estado === 200 && usarAjeno.codigo === "22023" && c(saldoB?.saldo_a_favor) === 5000, JSON.stringify(usarAjeno.datos));
}

// --- 9. Permisos por rol ---------------------------------------------------
{
  const cargoOp = await rpc(operador, "registrar_cargo", { p_idempotencia: randomUUID(), p_cliente_id: clienteA, p_cuenta_ingreso: "4300", p_concepto: "x", p_fecha: hoy, p_vencimiento: null, p_monto: "1.00" });
  const cargoFin = await rpc(finanzas, "registrar_cargo", { p_idempotencia: randomUUID(), p_cliente_id: clienteA, p_cuenta_ingreso: "4300", p_concepto: "x", p_fecha: hoy, p_vencimiento: null, p_monto: "1.00" });
  comprobar("9. operador y finanzas no registran cargos administrativos", cargoOp.codigo === "42501" && cargoFin.codigo === "42501");
  const gastoOp = await rpc(operador, "registrar_gasto", { p_idempotencia: randomUUID(), p_proveedor_id: null, p_categoria_id: combustible, p_actividad: "general", p_fecha: hoy, p_vencimiento: null, p_concepto: "x", p_monto: "1.00", p_notas: null });
  comprobar("9. operador no registra gastos", gastoOp.codigo === "42501");
  const trOp = await rpc(operador, "registrar_transferencia", { p_idempotencia: randomUUID(), p_cuenta_origen_id: caja, p_cuenta_destino_id: banco, p_fecha: hoy, p_monto: "1.00", p_referencia: null });
  comprobar("9. operador no registra transferencias", trOp.codigo === "42501");
  const revOp = await rpc(operador, "reversar_cobro", { p_cobro_id: cobro500, p_motivo: "x" });
  const revFin = await rpc(finanzas, "reversar_cobro", { p_cobro_id: cobro500, p_motivo: "x" });
  const anuOp = await rpc(operador, "anular_cargo", { p_cargo_id: cargo1500, p_motivo: "x" });
  comprobar("9. solo el administrador reversa cobros y anula cargos", revOp.codigo === "42501" && revFin.codigo === "42501" && anuOp.codigo === "42501");
  const movOp = await leer(operador, "movimientos_dinero?select=id&limit=1");
  const asiOp = await leer(operador, "asientos?select=id&limit=1");
  const gasOp = await leer(operador, "gastos?select=id&limit=1");
  const salOp = await leer(operador, "saldos_cuentas_dinero?select=id&limit=1");
  comprobar("9. operador no ve movimientos, asientos, gastos ni saldos de caja",
    [movOp, asiOp, gasOp, salOp].every((d) => Array.isArray(d) && d.length === 0));
  const movFin = await leer(finanzas, `movimientos_dinero?cuenta_dinero_id=eq.${caja}&select=id&limit=1`);
  comprobar("9. finanzas consulta movimientos de caja", Array.isArray(movFin) && movFin.length === 1);

  const directos = await Promise.all([
    api(admin.token, "POST", "cobros_cliente", { cliente_id: clienteA, cuenta_dinero_id: caja, fecha: hoy, metodo: "efectivo", monto: 1, idempotencia: randomUUID() }),
    api(admin.token, "POST", "movimientos_dinero", { cuenta_dinero_id: caja, fecha: hoy, tipo: "ingreso", monto_con_signo: 1, origen_tipo: "cobro", origen_id: randomUUID(), evento: "registro", asiento_id: randomUUID() }),
    api(admin.token, "POST", "asientos", { fecha: hoy, concepto: "x", origen_tipo: "cobro", origen_id: randomUUID(), evento: "registro" }),
    api(admin.token, "POST", "lineas_asiento", { asiento_id: randomUUID(), cuenta_contable_id: randomUUID(), debe: 1 }),
    api(admin.token, "POST", "aplicaciones_cobro", { cobro_id: cobro500, cargo_id: cargo1500, cliente_id: clienteA, monto: 1, fecha: hoy, operacion_id: randomUUID() }),
  ]);
  comprobar("9. ni el administrador inserta directamente cobros, movimientos, asientos, líneas ni aplicaciones", directos.every(denegado), JSON.stringify(directos.map((r) => r.estado)));
  const editar = await api(admin.token, "PATCH", `cobros_cliente?id=eq.${cobro500}`, { monto: 1 });
  const borrarCobro = await api(admin.token, "DELETE", `cobros_cliente?id=eq.${cobro500}`);
  const borrarMov = await api(admin.token, "DELETE", `movimientos_dinero?origen_id=eq.${cobro500}`);
  const borrarAsiento = await api(finanzas.token, "DELETE", `asientos?origen_id=eq.${cobro500}`);
  comprobar("9. un pago confirmado no se edita ni se elimina directamente", [editar, borrarCobro, borrarMov, borrarAsiento].every(denegado));
  comprobar("9. … y sigue intacto", (await leer(admin, `cobros_cliente?id=eq.${cobro500}&select=monto,estado`))[0]?.estado === "confirmado");
}

// --- 10. Sin duplicaciones cuando falla un paso intermedio -----------------
{
  const clave = randomUUID();
  const r = await rpc(finanzas, "registrar_gasto", {
    p_idempotencia: clave, p_proveedor_id: null, p_categoria_id: combustible, p_actividad: "general", p_fecha: hoy,
    p_vencimiento: null, p_concepto: `${MARCA} Falla intermedia`, p_monto: "200.00", p_notas: null,
    p_pago: { cuenta_dinero_id: caja, metodo: "efectivo", monto: "250.00" },
  });
  comprobar("10. gasto cuyo pago falla: se rechaza todo y no queda gasto ni asiento",
    r.codigo === "22023" && (await leer(admin, `gastos?idempotencia=eq.${clave}&select=id`)).length === 0, JSON.stringify(r.datos));

  const cargoA2 = (await rpc(admin, "registrar_cargo", { p_idempotencia: randomUUID(), p_cliente_id: clienteA, p_cuenta_ingreso: "4300", p_concepto: `${MARCA} Segundo`, p_fecha: hoy, p_vencimiento: null, p_monto: "100.00" })).datos;
  const saldoAntes = await saldoCuenta(caja);
  const claveCobro = randomUUID();
  const r2 = await rpc(operador, "registrar_cobro", {
    p_idempotencia: claveCobro, p_cliente_id: clienteA, p_cuenta_dinero_id: caja, p_fecha: hoy, p_metodo: "efectivo",
    p_referencia: null, p_monto: "500.00",
    p_aplicaciones: [{ cargo_id: cargoA2, monto: "100.00" }, { cargo_id: cargo1500, monto: "1200.00" }],
  });
  const ap = await leer(admin, `aplicaciones_cobro?operacion_id=eq.${claveCobro}&select=id`);
  comprobar("10. cobro cuya segunda aplicación falla: sin cobro, sin aplicaciones y sin dinero",
    r2.codigo === "22023" && (await leer(admin, `cobros_cliente?idempotencia=eq.${claveCobro}&select=id`)).length === 0 &&
    ap.length === 0 && (await saldoCuenta(caja)) === saldoAntes, JSON.stringify(r2.datos));
  const reintento = await rpc(operador, "registrar_cobro", {
    p_idempotencia: claveCobro, p_cliente_id: clienteA, p_cuenta_dinero_id: caja, p_fecha: hoy, p_metodo: "efectivo",
    p_referencia: null, p_monto: "500.00", p_aplicaciones: [{ cargo_id: cargoA2, monto: "100.00" }],
  });
  comprobar("10. corregido el error, el reintento con la misma clave registra una sola vez",
    reintento.estado === 200 && (await saldoCuenta(caja)) - saldoAntes === 50000 &&
    c((await uno(admin, `saldos_cargos?id=eq.${cargoA2}&select=pendiente`)).pendiente) === 0);
}

// --- 11. Reversos: historial conservado -------------------------------------
{
  const sinMotivo = await rpc(admin, "reversar_cobro", { p_cobro_id: cobro500, p_motivo: "  " });
  comprobar("11. reversar sin motivo es rechazado", sinMotivo.codigo === "22023");

  const saldoAntes = await saldoCuenta(caja);
  const rev = await rpc(admin, "reversar_cobro", { p_cobro_id: cobro500, p_motivo: `${MARCA} cobro duplicado por error` });
  const cobro = await uno(admin, `cobros_cliente?id=eq.${cobro500}&select=estado,motivo_reverso,reversado_por`);
  const aplicaciones = await leer(admin, `aplicaciones_cobro?cobro_id=eq.${cobro500}&select=estado`);
  const asientos = await asientosDe("cobro", cobro500);
  const movs = await movimientosDe("cobro", cobro500);
  const cargo = await uno(admin, `saldos_cargos?id=eq.${cargo1500}&select=pendiente`);
  comprobar("11. el cobro reversado se conserva con motivo y autor", ok(rev) && cobro?.estado === "reversado" && cobro.reversado_por === admin.id, JSON.stringify(rev.datos));
  comprobar("11. sus aplicaciones se conservan como reversadas y el cargo vuelve a L 1,500 pendientes",
    aplicaciones.length === 1 && aplicaciones[0].estado === "reversada" && c(cargo?.pendiente) === 150000);
  comprobar("11. asiento original marcado y asiento espejo registrado",
    asientos.length === 2 && asientos.some((a) => a.evento === "registro" && a.estado === "reversado") &&
    asientos.some((a) => a.evento === "reverso" && plantilla(a) === "1100H50000 2200D50000"));
  comprobar("11. contramovimiento de -L 500: el dinero sale de caja",
    movs.length === 2 && movs.some((m) => m.evento === "reverso" && c(m.monto_con_signo) === -50000) && (await saldoCuenta(caja)) - saldoAntes === -50000);
  const doble = await rpc(admin, "reversar_cobro", { p_cobro_id: cobro500, p_motivo: "otra vez" });
  comprobar("11. un cobro no se reversa dos veces", doble.codigo === "22023");

  const anularConPagos = await rpc(admin, "anular_gasto", { p_gasto_id: gasto800, p_motivo: "x" });
  comprobar("11. un gasto con pagos confirmados no se anula", anularConPagos.codigo === "22023");
  const pago = (await leer(admin, `pagos_gasto?gasto_id=eq.${gasto800}&select=id`))[0].id;
  const revPago = await rpc(admin, "reversar_pago_gasto", { p_pago_id: pago, p_motivo: `${MARCA} pago mal registrado` });
  const anular = await rpc(admin, "anular_gasto", { p_gasto_id: gasto800, p_motivo: `${MARCA} gasto duplicado` });
  const gasto = await uno(admin, `saldos_gastos?id=eq.${gasto800}&select=estado,pendiente`);
  comprobar("11. reversado el pago, el gasto se anula y se conserva", ok(revPago) && ok(anular) && gasto?.estado === "anulado" && c(gasto.pendiente) === 0);

  const cajaAntes = await saldoCuenta(caja);
  const bancoAntes = await saldoCuenta(banco);
  const revTr = await rpc(admin, "reversar_transferencia", { p_transferencia_id: transferencia, p_motivo: `${MARCA} cuenta equivocada` });
  comprobar("11. reverso de transferencia devuelve L 1,000 a Caja A",
    ok(revTr) && (await saldoCuenta(caja)) - cajaAntes === 100000 && (await saldoCuenta(banco)) - bancoAntes === -100000);

  // Anular un cargo con pagos aplicados: lo pagado vuelve al saldo a favor.
  const cargoB = (await leer(admin, `cargos_cliente?cliente_id=eq.${clienteB}&select=id`))[0].id;
  const aFavorAntes = c((await uno(admin, `saldos_clientes?cliente_id=eq.${clienteB}&select=saldo_a_favor`)).saldo_a_favor);
  const anularCargo = await rpc(admin, "anular_cargo", { p_cargo_id: cargoB, p_motivo: `${MARCA} servicio no prestado` });
  const aFavorDespues = c((await uno(admin, `saldos_clientes?cliente_id=eq.${clienteB}&select=saldo_a_favor`)).saldo_a_favor);
  const [asientoAnulacion] = (await asientosDe("cargo", cargoB)).filter((a) => a.evento === "reverso");
  comprobar("11. anular un cargo devuelve lo aplicado (L 700) al saldo a favor y reversa el ingreso",
    ok(anularCargo) && aFavorDespues - aFavorAntes === 70000 && plantilla(asientoAnulacion) === "1200H100000 4400D100000");
  const bitacora = await leer(admin, `bitacora?accion=in.(reversar_cobro,anular_gasto,reversar_pago_gasto,reversar_transferencia,anular_cargo)&registro_id=in.(${cobro500},${gasto800},${pago},${transferencia},${cargoB})&select=accion,motivo,actor_id`);
  comprobar("11. los cinco reversos/anulaciones quedan en la bitácora con motivo y autor",
    bitacora.length === 5 && bitacora.every((b) => b.motivo && b.actor_id === admin.id), JSON.stringify(bitacora));
}

// --- 8. Asientos balanceados (todo el libro) -------------------------------
{
  const asientos = await leer(admin, "asientos?select=id,origen_tipo,lineas_asiento(debe,haber,cuenta_dinero_id,cuentas_contables(codigo))&limit=10000");
  const descuadrados = asientos.filter((a) => !cuadra(a));
  comprobar(`8. los ${asientos.length} asientos tienen Debe = Haber`, asientos.length > 0 && descuadrados.length === 0, JSON.stringify(descuadrados.slice(0, 3)));
  const porEvento = new Map();
  for (const a of await leer(admin, "asientos?select=origen_tipo,origen_id,evento&limit=10000")) {
    const llave = `${a.origen_tipo}/${a.origen_id}/${a.evento}`;
    porEvento.set(llave, (porEvento.get(llave) ?? 0) + 1);
  }
  comprobar("8. ningún evento tiene dos asientos", [...porEvento.values()].every((n) => n === 1));
  // Por cada caja/banco: saldo de movimientos = Debe - Haber de sus líneas de 1100.
  const movimientos = await leer(admin, "movimientos_dinero?select=cuenta_dinero_id,monto_con_signo&limit=10000");
  const porCuenta = new Map();
  for (const m of movimientos) porCuenta.set(m.cuenta_dinero_id, (porCuenta.get(m.cuenta_dinero_id) ?? 0) + c(m.monto_con_signo));
  const libro = new Map();
  for (const a of asientos) for (const l of a.lineas_asiento) {
    if (l.cuentas_contables.codigo === "1100") libro.set(l.cuenta_dinero_id, (libro.get(l.cuenta_dinero_id) ?? 0) + c(l.debe) - c(l.haber));
  }
  const cuentas = new Set([...porCuenta.keys(), ...libro.keys()]);
  comprobar("8. cada caja/banco: movimientos = líneas contables de Caja y bancos", [...cuentas].every((id) => (porCuenta.get(id) ?? 0) === (libro.get(id) ?? 0)));
}

terminar();
