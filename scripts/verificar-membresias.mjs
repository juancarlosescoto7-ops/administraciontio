// Verifica las membresías de E3 contra la API REST real de Supabase
// (desarrollo) con usuarios ficticios: alta, condiciones, mensualidades,
// aniversarios 28–31, idempotencia y concurrencia, pagos con E2, morosidad,
// suspensión, reactivación, cancelación, cupos, permisos y asientos.
// Uso: E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-membresias.mjs
// Crea registros ficticios marcados con "[PRUEBA E3]". No elimina nada.
import { randomUUID } from "node:crypto";
import { cargarEntorno, crearClienteRest, crearReporte, denegado } from "./comun.mjs";

const MARCA = "[PRUEBA E3]";
const env = cargarEntorno();
const { iniciarSesion, api } = crearClienteRest(env);
const { comprobar, terminar } = crearReporte();
const sufijo = Date.now().toString(36).toUpperCase();
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date());

const c = (valor) => Math.round(Number(valor) * 100);
const rpc = (sesion, funcion, args) => api(sesion?.token ?? null, "POST", `rpc/${funcion}`, args);
const ok = (r) => r.estado >= 200 && r.estado < 300;
const leer = async (sesion, ruta) => (await api(sesion.token, "GET", ruta)).datos;
const uno = async (sesion, ruta) => (await leer(sesion, ruta))?.[0];

// --- Fechas (mismo cálculo que private.siguiente_renovacion) -------------
const partes = (f) => f.split("-").map(Number);
const fecha = (a, m, d) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const diasMes = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();
const siguiente = (f, dia) => {
  const [a, m] = partes(f);
  const [na, nm] = m === 12 ? [a + 1, 1] : [a, m + 1];
  return fecha(na, nm, Math.min(dia, diasMes(na, nm)));
};
const sumarDias = (f, n) => {
  const [a, m, d] = partes(f);
  const r = new Date(Date.UTC(a, m - 1, d + n));
  return fecha(r.getUTCFullYear(), r.getUTCMonth() + 1, r.getUTCDate());
};
const restarMeses = (f, n) => {
  let [a, m, d] = partes(f);
  m -= n;
  while (m < 1) { m += 12; a -= 1; }
  return fecha(a, m, Math.min(d, diasMes(a, m)));
};
/** Inicios de período esperados desde `inicio` hasta hoy. */
const serieHastaHoy = (inicio) => {
  const dia = partes(inicio)[2];
  const serie = [];
  for (let x = inicio; x <= hoy; x = siguiente(x, dia)) serie.push(x);
  return serie;
};

const admin = await iniciarSesion(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const operador = await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
const finanzas = await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
const inactivo = await iniciarSesion(env.E2E_INACTIVO_CORREO, env.E2E_INACTIVO_CLAVE);

const membresia = (id) => uno(admin, `saldos_membresias?id=eq.${id}&select=*`);
const periodos = (id) => leer(admin, `saldos_periodos?membresia_id=eq.${id}&select=*&order=inicio`);
const vinculos = (id) => leer(admin, `membresia_beneficiarios?membresia_id=eq.${id}&select=*&order=created_at`);
const movimientosDe = (origen, id) => leer(admin, `movimientos_dinero?origen_tipo=eq.${origen}&origen_id=eq.${id}&select=*`);
const asientosDe = (origen, id) =>
  leer(admin, `asientos?origen_tipo=eq.${origen}&origen_id=eq.${id}&select=id,evento,lineas_asiento(debe,haber,cuentas_contables(codigo))`);
const cuadra = (a) =>
  a.lineas_asiento.length >= 2 &&
  a.lineas_asiento.reduce((s, l) => s + c(l.debe), 0) === a.lineas_asiento.reduce((s, l) => s + c(l.haber), 0);
const plantilla = (a) =>
  a.lineas_asiento.map((l) => `${l.cuentas_contables.codigo}${c(l.debe) > 0 ? `D${c(l.debe)}` : `H${c(l.haber)}`}`).sort().join(" ");
const cobertura = async (sesion, m, b, f = hoy) =>
  (await rpc(sesion, "consultar_cobertura", { p_membresia_id: m, p_beneficiario_id: b, p_fecha: f })).datos?.[0];
const registrar = (sesion, args) =>
  rpc(sesion, "registrar_membresia", { p_idempotencia: randomUUID(), p_condiciones: null, ...args });
const cobrar = (sesion, cliente, monto, aplicaciones = []) =>
  rpc(sesion, "registrar_cobro", {
    p_idempotencia: randomUUID(), p_cliente_id: cliente, p_cuenta_dinero_id: caja, p_fecha: hoy,
    p_metodo: "efectivo", p_referencia: null, p_monto: monto, p_aplicaciones: aplicaciones,
  });

// --- Datos ficticios ---------------------------------------------------
const crear = async (sesion, tabla, fila) => (await api(sesion.token, "POST", tabla, fila)).datos?.[0]?.id;
const planCompartido = await crear(admin, "planes", {
  nombre: `${MARCA} Plan compartido ${sufijo}`, precio_mensual: 500, cupo_mensual: 2, modalidad_cupo: "compartido", dias_gracia: 5,
});
const planIndividual = await crear(admin, "planes", {
  nombre: `${MARCA} Plan individual ${sufijo}`, precio_mensual: 800, cupo_mensual: 1, modalidad_cupo: "individual", dias_gracia: 10,
});
const clientes = {};
for (const nombre of ["Titular 1", "Titular 2", "Titular 3", "Titular 4", "Morosidad", "Renovacion", "Aniversarios", "Gracia"]) {
  clientes[nombre] = await crear(operador, "clientes", { nombre: `${MARCA} ${nombre} ${sufijo}` });
}
const b1 = await crear(operador, "beneficiarios", { nombre: `${MARCA} Beneficiario 1 ${sufijo}` });
const b2 = await crear(operador, "beneficiarios", { nombre: `${MARCA} Beneficiario 2 (menor, sin identidad) ${sufijo}`, fecha_nacimiento: "2019-05-10" });
const b3 = await crear(operador, "beneficiarios", { nombre: `${MARCA} Beneficiario 3 ${sufijo}` });
const caja = await crear(admin, "cuentas_dinero", { nombre: `${MARCA} Caja ${sufijo}`, tipo: "caja" });
comprobar("datos ficticios creados", planCompartido && planIndividual && Object.values(clientes).every(Boolean) && b1 && b2 && b3 && caja);

// --- 18a. Sin sesión e inactivos -----------------------------------------
{
  let todas = true;
  for (const tabla of ["membresias", "membresia_beneficiarios", "periodos_membresia", "saldos_membresias", "saldos_periodos"]) {
    if (!denegado(await api(null, "GET", `${tabla}?select=*&limit=1`))) todas = false;
  }
  comprobar("anon no lee tablas ni vistas de membresías (5)", todas);
  let funciones = true;
  for (const [f, args] of [
    ["registrar_membresia", { p_idempotencia: randomUUID(), p_cliente_id: clientes["Titular 1"], p_plan_id: planCompartido, p_fecha_inicio: hoy, p_beneficiarios: [b1] }],
    ["actualizar_mensualidades", {}],
    ["consultar_cobertura", { p_membresia_id: randomUUID(), p_beneficiario_id: b1, p_fecha: hoy }],
    ["historial_membresia", { p_membresia_id: randomUUID() }],
  ]) {
    if (!denegado(await rpc(null, f, args))) funciones = false;
  }
  comprobar("anon no ejecuta funciones de membresías", funciones);
  const r = await registrar(inactivo, { p_cliente_id: clientes["Titular 1"], p_plan_id: planCompartido, p_fecha_inicio: hoy, p_beneficiarios: [b1] });
  comprobar("usuario inactivo no registra membresías", r.codigo === "42501", JSON.stringify(r.datos));
  const a = await rpc(inactivo, "actualizar_mensualidades", {});
  comprobar("usuario inactivo no actualiza mensualidades", a.codigo === "42501");
}

// --- 1 y 3. Alta con beneficiarios y primera mensualidad ------------------
let m1;
{
  const clave = randomUUID();
  const args = { p_idempotencia: clave, p_cliente_id: clientes["Titular 1"], p_plan_id: planCompartido, p_fecha_inicio: hoy, p_beneficiarios: [b1, b2], p_condiciones: null };
  const r = await rpc(operador, "registrar_membresia", args);
  m1 = r.datos;
  comprobar("1. operador crea membresía con dos beneficiarios", ok(r) && typeof m1 === "string", JSON.stringify(r.datos));
  const m = await membresia(m1);
  comprobar("1. condiciones copiadas del plan (500, cupo 2 compartido, gracia 5)",
    m && c(m.precio_pactado) === 50000 && m.cupo_pactado === 2 && m.modalidad_cupo === "compartido" && m.dias_gracia === 5 && m.estado === "activa");
  comprobar("1. fecha de afiliación y día de anclaje", m.fecha_inicio === hoy && m.dia_ancla === partes(hoy)[2]);
  const v = await vinculos(m1);
  comprobar("1. dos vínculos activos con alta en la fecha de inicio", v.length === 2 && v.every((x) => x.activo && x.fecha_alta === hoy));

  const ps = await periodos(m1);
  const fin = sumarDias(siguiente(hoy, partes(hoy)[2]), -1);
  comprobar("3. primera mensualidad: un período de hoy al día anterior a la renovación",
    ps.length === 1 && ps[0].inicio === hoy && ps[0].fin === fin && c(ps[0].precio) === 50000 && ps[0].cupo_asignado === 2,
    JSON.stringify(ps.map((p) => [p.inicio, p.fin])));
  const cargo = await uno(admin, `saldos_cargos?id=eq.${ps[0].cargo_id}&select=*`);
  comprobar("3. un cargo de L 500 de origen periodo_membresia, vence al inicio del período",
    cargo && c(cargo.monto) === 50000 && cargo.origen_tipo === "periodo_membresia" && cargo.origen_id === ps[0].id &&
      cargo.fecha === hoy && cargo.vencimiento === hoy && cargo.actividad === "ambulancias");
  const [asiento] = await asientosDe("cargo", ps[0].cargo_id);
  comprobar("3. asiento D 1200 CxC / H 4100 Ingreso por membresías", asiento && plantilla(asiento) === "1200D50000 4100H50000");
  comprobar("3. el cargo no mueve caja", (await movimientosDe("cargo", ps[0].cargo_id)).length === 0);
  comprobar("3. próxima renovación = siguiente aniversario", m.proxima_renovacion === siguiente(hoy, partes(hoy)[2]));

  const repetida = await rpc(operador, "registrar_membresia", args);
  comprobar("1. reintento con la misma clave devuelve la misma membresía", repetida.datos === m1);
  comprobar("1. el reintento no duplica períodos ni cargos", (await periodos(m1)).length === 1);
  const otra = await rpc(operador, "registrar_membresia", { ...args, p_plan_id: planIndividual });
  comprobar("1. clave reutilizada con otros datos se rechaza", otra.codigo === "22023");

  const sinBeneficiarios = await registrar(operador, { p_cliente_id: clientes["Titular 1"], p_plan_id: planCompartido, p_fecha_inicio: hoy, p_beneficiarios: [] });
  comprobar("1. sin beneficiarios se rechaza", sinBeneficiarios.codigo === "22023");
  const particularOperador = await registrar(operador, {
    p_cliente_id: clientes["Titular 1"], p_plan_id: planCompartido, p_fecha_inicio: hoy, p_beneficiarios: [b1], p_condiciones: { precio: "1.00" },
  });
  comprobar("18. el operador no pacta condiciones particulares", particularOperador.codigo === "42501");
}

// --- 2. Condiciones particulares y edición para ciclos futuros ------------
let m2;
{
  const r = await registrar(admin, {
    p_cliente_id: clientes["Titular 2"], p_plan_id: planCompartido, p_fecha_inicio: hoy, p_beneficiarios: [b1, b3],
    p_condiciones: { precio: "450.00", cupo: 3, modalidad: "individual", dias_gracia: 10 },
  });
  m2 = r.datos;
  const m = await membresia(m2);
  comprobar("2. administrador crea membresía con condiciones particulares",
    ok(r) && c(m.precio_pactado) === 45000 && m.cupo_pactado === 3 && m.modalidad_cupo === "individual" && m.dias_gracia === 10);
  const [p] = await periodos(m2);
  comprobar("2. el período toma las condiciones pactadas", c(p.precio) === 45000 && p.cupo_asignado === 3 && p.modalidad_cupo === "individual" && p.dias_gracia === 10);
  const plan = await uno(admin, `planes?id=eq.${planCompartido}&select=precio_mensual`);
  comprobar("2. el plan no cambia", c(plan.precio_mensual) === 50000);

  const editar = (sesion, motivo = `${MARCA} ajuste`) =>
    rpc(sesion, "actualizar_condiciones_membresia", { p_membresia_id: m2, p_precio: "600.00", p_cupo: 4, p_modalidad: "individual", p_dias_gracia: 10, p_motivo: motivo });
  comprobar("18. operador y finanzas no editan condiciones", (await editar(operador)).codigo === "42501" && (await editar(finanzas)).codigo === "42501");
  comprobar("2. editar condiciones exige motivo", (await editar(admin, "")).codigo === "22023");
  const e = await editar(admin);
  const despues = await membresia(m2);
  const [pDespues] = await periodos(m2);
  comprobar("2. condiciones nuevas para ciclos futuros (L 600, cupo 4)", ok(e) && c(despues.precio_pactado) === 60000 && despues.cupo_pactado === 4);
  comprobar("2. el período ya generado conserva L 450 y cupo 3", c(pDespues.precio) === 45000 && pDespues.cupo_asignado === 3);
  await api(admin.token, "PATCH", `planes?id=eq.${planCompartido}`, { precio_mensual: 550 });
  const trasPlan = await membresia(m1);
  comprobar("2. cambiar el precio del plan no altera membresías ni períodos",
    c(trasPlan.precio_pactado) === 50000 && c((await periodos(m1))[0].precio) === 50000);
  await api(admin.token, "PATCH", `planes?id=eq.${planCompartido}`, { precio_mensual: 500 });
  const historial = (await rpc(operador, "historial_membresia", { p_membresia_id: m2 })).datos ?? [];
  comprobar("2. historial visible para el operador con alta y cambio de condiciones",
    historial.some((h) => h.accion === "actualizar_condiciones" && h.motivo) && historial.some((h) => h.accion === "registrar_membresia"));
}

// --- 4 y 6. Renovación mensual; dos ejecuciones no duplican ---------------
let mRenovacion;
{
  const inicio = restarMeses(hoy, 1);
  const r = await registrar(admin, {
    p_cliente_id: clientes.Renovacion, p_plan_id: planCompartido, p_fecha_inicio: inicio, p_beneficiarios: [b1],
    p_condiciones: { dias_gracia: 40 },
  });
  mRenovacion = r.datos;
  const esperado = serieHastaHoy(inicio);
  const ps = await periodos(mRenovacion);
  comprobar(`4. renovación mensual: ${esperado.length} períodos desde ${inicio}`,
    ok(r) && JSON.stringify(ps.map((p) => p.inicio)) === JSON.stringify(esperado), JSON.stringify(ps.map((p) => p.inicio)));
  comprobar("4. períodos contiguos (fin = día anterior al siguiente inicio)",
    ps.every((p, i) => i === ps.length - 1 || p.fin === sumarDias(ps[i + 1].inicio, -1)));
  comprobar("4. un cargo por período", ps.every((p) => p.cargo_id) && new Set(ps.map((p) => p.cargo_id)).size === ps.length);
  const m = await membresia(mRenovacion);
  comprobar("4. no genera mensualidades futuras", m.proxima_renovacion > hoy && ps.every((p) => p.inicio <= hoy));

  const primera = await rpc(finanzas, "actualizar_mensualidades", { p_membresia_id: mRenovacion });
  const segunda = await rpc(operador, "actualizar_mensualidades", { p_membresia_id: mRenovacion });
  const cargos = await leer(admin, `cargos_cliente?cliente_id=eq.${clientes.Renovacion}&select=id`);
  comprobar("6. dos ejecuciones seguidas no generan nada nuevo",
    ok(primera) && ok(segunda) && primera.datos.periodos === 0 && segunda.datos.periodos === 0 &&
      (await periodos(mRenovacion)).length === esperado.length && cargos.length === esperado.length);
}

// --- 5. Aniversarios 28, 29, 30 y 31 (precio 0: sin cargos) ---------------
{
  const casos = ["2026-01-28", "2026-01-29", "2026-01-30", "2026-01-31", "2024-01-29", "2023-12-31"].filter((f) => f <= hoy);
  for (const inicio of casos) {
    const r = await registrar(admin, {
      p_cliente_id: clientes.Aniversarios, p_plan_id: planCompartido, p_fecha_inicio: inicio, p_beneficiarios: [b3],
      p_condiciones: { precio: "0.00", dias_gracia: 0 },
    });
    const ps = await periodos(r.datos);
    const esperado = serieHastaHoy(inicio);
    comprobar(`5. aniversario ${inicio}: ${esperado.slice(0, 4).join(", ")}…`,
      ok(r) && JSON.stringify(ps.map((p) => p.inicio)) === JSON.stringify(esperado) && ps.every((p) => p.cargo_id === null),
      JSON.stringify(ps.slice(0, 5).map((p) => p.inicio)));
    if (inicio === "2026-01-31") {
      const fechas = ps.map((p) => p.inicio);
      comprobar("5. día 31: 28/02/2026, vuelve a 31/03 y 30/04 sin perder el anclaje",
        fechas.includes("2026-02-28") && fechas.includes("2026-03-31") && fechas.includes("2026-04-30") && fechas.includes("2026-05-31"));
    }
    if (inicio === "2023-12-31") {
      comprobar("5. año bisiesto: 29/02/2024", ps.some((p) => p.inicio === "2024-02-29" && p.fin === "2024-03-30"));
    }
  }
  const sinCargos = await leer(admin, `cargos_cliente?cliente_id=eq.${clientes.Aniversarios}&select=id`);
  comprobar("5. membresías sin costo no generan cargos", sinCargos.length === 0);
}

// --- 8. Pago completo (finanzas) -----------------------------------------
{
  const [p] = await periodos(m1);
  const r = await cobrar(finanzas, clientes["Titular 1"], "500.00", [{ cargo_id: p.cargo_id, monto: "500.00" }]);
  const [pagado] = await periodos(m1);
  const movs = await movimientosDe("cobro", r.datos);
  comprobar("8. pago completo: cuota L 500 aplicada, pendiente 0", ok(r) && c(pagado.aplicado) === 50000 && c(pagado.pendiente) === 0);
  comprobar("8. una sola entrada de L 500 en caja", movs.length === 1 && c(movs[0].monto_con_signo) === 50000);
  comprobar("8. la membresía no tiene saldo pendiente", c((await membresia(m1)).pendiente) === 0);
}

// --- 9. Pago parcial (operador): 500 / 300 / 200 -------------------------
let m3;
{
  m3 = (await registrar(operador, { p_cliente_id: clientes["Titular 3"], p_plan_id: planCompartido, p_fecha_inicio: hoy, p_beneficiarios: [b2] })).datos;
  const [p] = await periodos(m3);
  const r = await cobrar(operador, clientes["Titular 3"], "300.00", [{ cargo_id: p.cargo_id, monto: "300.00" }]);
  const [parcial] = await periodos(m3);
  const cargo = await uno(admin, `saldos_cargos?id=eq.${p.cargo_id}&select=monto,aplicado,pendiente`);
  const movs = await movimientosDe("cobro", r.datos);
  comprobar("9. pago parcial: cargo L 500, aplicado L 300, pendiente L 200",
    ok(r) && c(cargo.monto) === 50000 && c(cargo.aplicado) === 30000 && c(cargo.pendiente) === 20000 && c(parcial.pendiente) === 20000);
  comprobar("9. entrada de dinero L 300 (una vez)", movs.length === 1 && c(movs[0].monto_con_signo) === 30000);
  const m = await membresia(m3);
  comprobar("9. dentro de la gracia la membresía sigue activa y la cuota no está vencida", m.estado === "activa" && c(m.vencido) === 0 && !parcial.vencida);
  const cob = await cobertura(operador, m3, b2);
  comprobar("9. cubierto con aviso de cuota pendiente dentro de la gracia", cob?.cubierto === true && /gracia/.test(cob.aviso ?? ""));
}

// --- 10. Anticipo existente aplicado a la cuota ---------------------------
{
  const cliente = clientes["Titular 4"];
  const anticipo = await cobrar(finanzas, cliente, "500.00");
  const m4 = (await registrar(operador, { p_cliente_id: cliente, p_plan_id: planCompartido, p_fecha_inicio: hoy, p_beneficiarios: [b3] })).datos;
  const [p] = await periodos(m4);
  const saldoAntes = await uno(admin, `saldos_clientes?cliente_id=eq.${cliente}&select=saldo_a_favor,pendiente`);
  const r = await rpc(operador, "aplicar_saldo_a_favor", { p_idempotencia: randomUUID(), p_cargo_id: p.cargo_id, p_monto: "500.00" });
  const saldo = await uno(admin, `saldos_clientes?cliente_id=eq.${cliente}&select=saldo_a_favor,pendiente`);
  const movs = await leer(admin, `movimientos_dinero?cuenta_dinero_id=eq.${caja}&origen_tipo=eq.cobro&origen_id=eq.${anticipo.datos}&select=id`);
  const aplicaciones = await leer(admin, `aplicaciones_cobro?cargo_id=eq.${p.cargo_id}&select=id`);
  const [asientoAplicacion] = await asientosDe("aplicacion", aplicaciones[0]?.id);
  comprobar("10. antes de aplicar: anticipo L 500 y cuota L 500 pendiente", c(saldoAntes.saldo_a_favor) === 50000 && c(saldoAntes.pendiente) === 50000);
  comprobar("10. anticipo aplicado: pendiente 0 y saldo a favor 0", ok(r) && c(saldo.saldo_a_favor) === 0 && c(saldo.pendiente) === 0);
  comprobar("10. sin nueva entrada de dinero (solo la del anticipo)", movs.length === 1 && (await movimientosDe("aplicacion", aplicaciones[0]?.id)).length === 0);
  comprobar("10. la aplicación es D 2200 / H 1200, sin segundo ingreso", asientoAplicacion && plantilla(asientoAplicacion) === "1200H50000 2200D50000");
  const ingresos = await leer(admin, `asientos?origen_tipo=eq.cargo&origen_id=eq.${p.cargo_id}&select=id`);
  comprobar("10. el ingreso de la cuota se reconoce una sola vez", ingresos.length === 1);
}

// --- 11. Suspensión por morosidad y 13b. reactivación dentro del ciclo ------
{
  const inicio = sumarDias(hoy, -10);
  const r = await registrar(admin, {
    p_cliente_id: clientes.Gracia, p_plan_id: planCompartido, p_fecha_inicio: inicio, p_beneficiarios: [b1], p_condiciones: { dias_gracia: 3 },
  });
  const id = r.datos;
  let m = await membresia(id);
  comprobar("11. cuota impaga pasada la gracia: suspendida desde límite + 1",
    ok(r) && m.estado === "suspendida" && m.suspendida_desde === sumarDias(inicio, 4) && c(m.vencido) === 50000 && m.cuotas_vencidas === 1,
    JSON.stringify({ estado: m?.estado, desde: m?.suspendida_desde }));
  const cob = await cobertura(finanzas, id, b1);
  comprobar("11. suspendida no habilita traslados cubiertos", cob && cob.cubierto === false && /suspendida/.test(cob.motivo));

  const [p] = await periodos(id);
  await cobrar(finanzas, clientes.Gracia, "500.00", [{ cargo_id: p.cargo_id, monto: "500.00" }]);
  const a = await rpc(finanzas, "actualizar_mensualidades", { p_cliente_id: clientes.Gracia });
  m = await membresia(id);
  comprobar("13. saldada antes de la renovación: se reactiva y el ciclo sigue igual",
    ok(a) && a.datos.reactivadas === 1 && m.estado === "activa" && m.dia_ancla === partes(inicio)[2] &&
      m.proxima_renovacion === siguiente(inicio, partes(inicio)[2]) && (await periodos(id)).length === 1);
}

// --- 12, 13 y 7. Suspensión sin nuevos períodos; reactivación con ciclo nuevo
//     sin cobrar lo suspendido; generaciones concurrentes ----------------
{
  const cliente = clientes.Morosidad;
  const inicio = sumarDias(restarMeses(hoy, 2), -5);
  const id = (await registrar(admin, { p_cliente_id: cliente, p_plan_id: planCompartido, p_fecha_inicio: inicio, p_beneficiarios: [b2] })).datos;
  let m = await membresia(id);
  comprobar("12. renovación tras la morosidad no se genera: un solo período y suspendida",
    m.estado === "suspendida" && m.suspendida_desde === sumarDias(inicio, 6) && (await periodos(id)).length === 1,
    JSON.stringify({ estado: m.estado, desde: m.suspendida_desde, inicio }));
  const repetir = await rpc(operador, "actualizar_mensualidades", { p_membresia_id: id });
  comprobar("12. actualizar mientras está suspendida no crea períodos", ok(repetir) && repetir.datos.periodos === 0 && (await periodos(id)).length === 1);
  comprobar("12. la deuda vencida se conserva", c((await membresia(id)).vencido) === 50000);

  const [p] = await periodos(id);
  const pago = await cobrar(operador, cliente, "500.00", [{ cargo_id: p.cargo_id, monto: "500.00" }]);
  // 7. Tres actualizaciones simultáneas de la misma membresía.
  const simultaneas = await Promise.all([1, 2, 3].map(() => rpc(finanzas, "actualizar_mensualidades", { p_membresia_id: id })));
  m = await membresia(id);
  const ps = await periodos(id);
  comprobar("7. tres actualizaciones simultáneas: una reactivación y un solo período nuevo",
    ok(pago) && simultaneas.every(ok) && simultaneas.reduce((s, r) => s + r.datos.periodos, 0) === 1 &&
      simultaneas.reduce((s, r) => s + r.datos.reactivadas, 0) === 1 && ps.length === 2,
    JSON.stringify(simultaneas.map((r) => r.datos)));
  comprobar("13. reactivada: ciclo nuevo desde hoy con su cuota pendiente",
    m.estado === "activa" && m.suspendida_desde === null && ps[1].inicio === hoy && c(ps[1].pendiente) === 50000 &&
      m.dia_ancla === partes(hoy)[2] && m.proxima_renovacion === siguiente(hoy, partes(hoy)[2]));
  comprobar("13. los meses suspendidos no se cobran (2 cuotas en total, L 1,000)",
    (await leer(admin, `cargos_cliente?cliente_id=eq.${cliente}&select=monto`)).reduce((s, x) => s + c(x.monto), 0) === 100000);
  comprobar("13. se conserva la fecha original de afiliación", m.fecha_inicio === inicio);
  const historial = (await rpc(finanzas, "historial_membresia", { p_membresia_id: id })).datos ?? [];
  const reactivacion = historial.filter((h) => h.accion === "reactivar_membresia");
  comprobar("13. historial: suspensión y una reactivación con el cambio de día de renovación",
    historial.some((h) => h.accion === "suspender_por_morosidad") && reactivacion.length === 1 &&
      reactivacion[0].despues.ciclo_nuevo === true && reactivacion[0].antes.dia_ancla === partes(inicio)[2] &&
      reactivacion[0].despues.dia_ancla === partes(hoy)[2]);
}

// 7. Altas simultáneas con la misma clave y actualizaciones generales en paralelo.
{
  const clave = randomUUID();
  const args = { p_idempotencia: clave, p_cliente_id: clientes["Titular 2"], p_plan_id: planIndividual, p_fecha_inicio: restarMeses(hoy, 1), p_beneficiarios: [b2], p_condiciones: { dias_gracia: 60 } };
  const altas = await Promise.all([1, 2, 3].map(() => rpc(admin, "registrar_membresia", args)));
  const ids = new Set(altas.map((r) => r.datos));
  const filas = await leer(admin, `membresias?idempotencia=eq.${clave}&select=id`);
  const ps = await periodos(filas[0]?.id);
  comprobar("7. tres altas simultáneas con la misma clave: una membresía y sus períodos una vez",
    altas.every(ok) && ids.size === 1 && filas.length === 1 && ps.length === serieHastaHoy(args.p_fecha_inicio).length,
    JSON.stringify(altas.map((r) => r.datos)));
  const generales = await Promise.all([admin, operador, finanzas].map((s) => rpc(s, "actualizar_mensualidades", {})));
  comprobar("7. tres actualizaciones generales simultáneas terminan sin error", generales.every(ok), JSON.stringify(generales.map((r) => r.datos)));
}

// --- 14. Cancelación ------------------------------------------------------
{
  comprobar("18. el operador no cancela", (await rpc(operador, "cancelar_membresia", { p_membresia_id: m3, p_motivo: "x" })).codigo === "42501");
  comprobar("14. cancelar exige motivo", (await rpc(admin, "cancelar_membresia", { p_membresia_id: m3, p_motivo: " " })).codigo === "22023");
  const r = await rpc(admin, "cancelar_membresia", { p_membresia_id: m3, p_motivo: `${MARCA} el cliente se retira` });
  const m = await membresia(m3);
  comprobar("14. membresía cancelada; la deuda de L 200 se conserva", ok(r) && m.estado === "cancelada" && c(m.pendiente) === 20000);
  comprobar("14. no se cancela dos veces", (await rpc(admin, "cancelar_membresia", { p_membresia_id: m3, p_motivo: "otra" })).codigo === "22023");
  const a = await rpc(admin, "actualizar_mensualidades", { p_membresia_id: m3 });
  comprobar("14. cancelada: actualizar no la revisa ni genera renovaciones", ok(a) && a.datos.revisadas === 0 && (await periodos(m3)).length === 1);
  const [p] = await periodos(m3);
  await cobrar(operador, clientes["Titular 3"], "200.00", [{ cargo_id: p.cargo_id, monto: "200.00" }]);
  await rpc(operador, "actualizar_mensualidades", { p_cliente_id: clientes["Titular 3"] });
  comprobar("14. pagar la deuda no reactiva una membresía cancelada", (await membresia(m3)).estado === "cancelada");
  const cob = await cobertura(admin, m3, b2);
  comprobar("14. cancelada no cubre traslados", cob && !cob.cubierto && /cancelada/.test(cob.motivo));
  comprobar("14. no se agregan beneficiarios a una cancelada",
    (await rpc(admin, "agregar_beneficiario_membresia", { p_membresia_id: m3, p_beneficiario_id: b1 })).codigo === "22023");
}

// --- 15. Un beneficiario en dos membresías; altas y bajas con historial ----
{
  const deB1 = await leer(admin, `membresia_beneficiarios?beneficiario_id=eq.${b1}&activo=is.true&membresia_id=in.(${m1},${m2})&select=membresia_id`);
  comprobar("15. el mismo beneficiario está activo en dos membresías", new Set(deB1.map((v) => v.membresia_id)).size === 2);
  const repetido = await rpc(operador, "agregar_beneficiario_membresia", { p_membresia_id: m1, p_beneficiario_id: b1 });
  comprobar("15. agregar un beneficiario ya vinculado no duplica el vínculo",
    ok(repetido) && (await vinculos(m1)).filter((v) => v.beneficiario_id === b1).length === 1);
  const finanzasAgrega = await rpc(finanzas, "agregar_beneficiario_membresia", { p_membresia_id: m1, p_beneficiario_id: b3 });
  comprobar("18. finanzas no modifica beneficiarios de membresías", finanzasAgrega.codigo === "42501");

  const vinculo = (await vinculos(m1)).find((v) => v.beneficiario_id === b2);
  const sinMotivo = await rpc(operador, "inactivar_beneficiario_membresia", { p_vinculo_id: vinculo.id, p_motivo: "" });
  const baja = await rpc(operador, "inactivar_beneficiario_membresia", { p_vinculo_id: vinculo.id, p_motivo: `${MARCA} baja de prueba` });
  const tras = await cobertura(operador, m1, b2);
  comprobar("15. baja con motivo: el beneficiario deja de estar cubierto",
    sinMotivo.codigo === "22023" && ok(baja) && tras && !tras.cubierto && /vinculado/.test(tras.motivo));
  const alta = await rpc(operador, "agregar_beneficiario_membresia", { p_membresia_id: m1, p_beneficiario_id: b2 });
  const v = (await vinculos(m1)).filter((x) => x.beneficiario_id === b2);
  comprobar("15. nueva alta tras la baja conserva el historial (2 vínculos, 1 activo)",
    ok(alta) && v.length === 2 && v.filter((x) => x.activo).length === 1 && v.some((x) => !x.activo && x.motivo_baja));
}

// --- 16 y 17. Modalidades y cupo por período ------------------------------
{
  const comp1 = await cobertura(operador, m1, b1);
  const comp3 = await cobertura(operador, m1, b3);
  comprobar("16. compartido: cupo del período 2 para la membresía (cubierto)",
    comp1?.cubierto && comp1.modalidad === "compartido" && comp1.cupo === 2 && comp1.disponibles === 2 && comp1.usados === 0);
  comprobar("16. beneficiario no vinculado no está cubierto", comp3 && !comp3.cubierto && /vinculado/.test(comp3.motivo));
  const ind = await cobertura(finanzas, m2, b1);
  const ind3 = await cobertura(finanzas, m2, b3);
  comprobar("16. individual: cada beneficiario tiene su cupo de 3 del período",
    ind?.cubierto && ind.modalidad === "individual" && ind.cupo === 3 && ind.disponibles === 3 && ind3?.disponibles === 3);

  const ps = await periodos(mRenovacion);
  const primero = await cobertura(admin, mRenovacion, b1, ps[0].inicio);
  const ultimo = await cobertura(admin, mRenovacion, b1, ps[ps.length - 1].inicio);
  comprobar("17. cada período tiene su propio cupo (2 y 2, no 4)",
    primero?.periodo_id === ps[0].id && ultimo?.periodo_id === ps[ps.length - 1].id && primero.cupo === 2 && ultimo.cupo === 2 && ultimo.disponibles === 2);
  const futuro = await cobertura(admin, mRenovacion, b1, sumarDias((await membresia(mRenovacion)).proxima_renovacion, 1));
  comprobar("17. fecha de un período no generado: pendiente de validación, sin cupo",
    futuro && !futuro.cubierto && futuro.periodo_id === null && /pendiente de validación/.test(futuro.motivo));
}

// --- 18. Escrituras directas, lectura por rol -----------------------------
{
  const insertar = await api(admin.token, "POST", "membresias", {
    cliente_id: clientes["Titular 1"], plan_id: planCompartido, fecha_inicio: hoy, dia_ancla: 1, proxima_renovacion: hoy,
    precio_pactado: 1, cupo_pactado: 1, modalidad_cupo: "compartido", dias_gracia: 1, idempotencia: randomUUID(),
  });
  const editar = await api(admin.token, "PATCH", `membresias?id=eq.${m3}`, { estado: "activa" });
  const [p] = await periodos(m1);
  const editarPeriodo = await api(admin.token, "PATCH", `periodos_membresia?id=eq.${p.id}`, { precio: 1 });
  const borrar = await api(admin.token, "DELETE", `periodos_membresia?id=eq.${p.id}`);
  const vinculo = await api(operador.token, "POST", "membresia_beneficiarios", { membresia_id: m1, beneficiario_id: b3, fecha_alta: hoy });
  comprobar("18. nadie (ni el administrador) inserta, edita o borra membresías, períodos o vínculos directamente",
    denegado(insertar) && denegado(editar) && denegado(editarPeriodo) && denegado(borrar) && denegado(vinculo),
    [insertar, editar, editarPeriodo, borrar, vinculo].map((r) => r.estado).join(","));
  comprobar("18. la membresía cancelada sigue cancelada y el período intacto",
    (await membresia(m3)).estado === "cancelada" && c((await periodos(m1))[0].precio) === 50000);
  const lecturas = await Promise.all([admin, operador, finanzas].map((s) => leer(s, `saldos_membresias?id=eq.${m1}&select=id`)));
  comprobar("18. los tres roles consultan membresías", lecturas.every((l) => l?.length === 1));
  comprobar("18. finanzas no registra membresías",
    (await registrar(finanzas, { p_cliente_id: clientes["Titular 1"], p_plan_id: planCompartido, p_fecha_inicio: hoy, p_beneficiarios: [b1] })).codigo === "42501");
}

// --- 19 y 20. Sin movimientos duplicados; asientos balanceados ------------
{
  const ids = Object.values(clientes).join(",");
  const cargos = await leer(admin, `cargos_cliente?cliente_id=in.(${ids})&select=id,origen_tipo,origen_id`);
  const ps = await leer(admin, `periodos_membresia?select=id,cargo_id,precio,membresias!inner(cliente_id)&membresias.cliente_id=in.(${ids})`);
  const conPrecio = ps.filter((p) => c(p.precio) > 0);
  comprobar("19. un cargo por período con precio y ninguno más",
    cargos.length === conPrecio.length && cargos.every((x) => x.origen_tipo === "periodo_membresia") &&
      new Set(cargos.map((x) => x.origen_id)).size === cargos.length && conPrecio.every((p) => cargos.some((x) => x.id === p.cargo_id)));
  const cobros = await leer(admin, `cobros_cliente?cliente_id=in.(${ids})&select=id,monto`);
  const movimientos = await leer(admin, `movimientos_dinero?cuenta_dinero_id=eq.${caja}&select=origen_tipo,origen_id,monto_con_signo`);
  comprobar("19. cada cobro tiene un único movimiento de caja y nada más mueve dinero",
    movimientos.length === cobros.length && movimientos.every((m) => m.origen_tipo === "cobro") &&
      cobros.every((x) => movimientos.filter((m) => m.origen_id === x.id && c(m.monto_con_signo) === c(x.monto)).length === 1));
  const aplicaciones = await leer(admin, `aplicaciones_cobro?cliente_id=in.(${ids})&select=id`);
  const origenes = [
    ...cargos.map((x) => `and(origen_tipo.eq.cargo,origen_id.eq.${x.id})`),
    ...cobros.map((x) => `and(origen_tipo.eq.cobro,origen_id.eq.${x.id})`),
    ...aplicaciones.map((x) => `and(origen_tipo.eq.aplicacion,origen_id.eq.${x.id})`),
  ];
  const asientos = await leer(admin, `asientos?or=(${origenes.join(",")})&select=id,origen_tipo,origen_id,evento,lineas_asiento(debe,haber,cuentas_contables(codigo))`);
  comprobar(`20. ${asientos.length} asientos de la prueba balanceados, uno por evento`,
    asientos.length === origenes.length && asientos.every(cuadra) &&
      new Set(asientos.map((a) => `${a.origen_tipo}/${a.origen_id}/${a.evento}`)).size === asientos.length);
}

terminar();
