// Verifica alquileres y transportes con conductor (E5) contra la API REST
// real de Supabase (desarrollo) con usuarios ficticios: reservas, entrega y
// devolución, kilometraje y combustible, cargos únicos y anticipos de E2,
// transportes, disponibilidad compartida con ambulancias, concurrencia,
// permisos, RLS y asientos.
// Uso: E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-alquileres-transportes.mjs
// Crea registros ficticios marcados con "[PRUEBA E5]". No elimina nada.
import { randomUUID } from "node:crypto";
import { cargarEntorno, crearClienteRest, crearReporte, denegado } from "./comun.mjs";

const MARCA = "[PRUEBA E5]";
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
const sumarDias = (f, n) => new Date(Date.parse(`${f}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
/** Fecha y hora de Tegucigalpa (UTC−6). */
const momento = (fecha, hora) => `${fecha}T${hora}:00-06:00`;
const dentroDe = (minutos) => new Date(Date.now() + minutos * 60000).toISOString();
const esperarMs = (ms) => new Promise((r) => setTimeout(r, ms));

const admin = await iniciarSesion(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const operador = await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
const finanzas = await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
const inactivo = await iniciarSesion(env.E2E_INACTIVO_CORREO, env.E2E_INACTIVO_CLAVE);

const alquiler = (id) => uno(admin, `saldos_alquileres?id=eq.${id}&select=*`);
const transporte = (id) => uno(admin, `saldos_transportes?id=eq.${id}&select=*`);
const ocupaciones = (origen, id) => leer(admin, `ocupaciones_recurso?origen_tipo=eq.${origen}&origen_id=eq.${id}&activa=is.true&select=*`);
const cargosDe = (origen, id) => leer(admin, `cargos_cliente?origen_tipo=eq.${origen}&origen_id=eq.${id}&select=*`);
const asientosDe = (origen, id) =>
  leer(admin, `asientos?origen_tipo=eq.${origen}&origen_id=eq.${id}&select=id,lineas_asiento(debe,haber,cuentas_contables(codigo))`);
const plantilla = (a) =>
  a.lineas_asiento.map((l) => `${l.cuentas_contables.codigo}${c(l.debe) > 0 ? `D${c(l.debe)}` : `H${c(l.haber)}`}`).sort().join(" ");

const reservar = (sesion, args) =>
  rpc(sesion, "registrar_alquiler", {
    p_idempotencia: randomUUID(), p_cliente_id: clientes.Alquiler, p_vehiculo_id: null, p_entrega_prevista: null,
    p_devolucion_prevista: null, p_tarifa_id: null, p_precio: "3600.00", p_notas: null, ...args,
  });
const entregar = (sesion, id, km = 1000, combustible = "lleno") =>
  rpc(sesion, "entregar_alquiler", { p_alquiler_id: id, p_km_salida: km, p_combustible: combustible, p_notas: `${MARCA} sin rayones` });
const devolver = (sesion, id, extra = {}) =>
  rpc(sesion, "devolver_alquiler", {
    p_alquiler_id: id, p_km_regreso: 1250, p_combustible: "medio", p_notas: `${MARCA} devuelto`,
    p_adicionales: [], p_aplicar_anticipo: null, p_motivo_correccion_km: null, ...extra,
  });
const cancelarAlquiler = (sesion, id, motivo = `${MARCA} el cliente desiste`) => rpc(sesion, "cancelar_alquiler", { p_alquiler_id: id, p_motivo: motivo });
const solicitar = (sesion, args) =>
  rpc(sesion, "registrar_transporte", {
    p_idempotencia: randomUUID(), p_cliente_id: clientes.Transporte, p_inicio_previsto: null, p_minutos_estimados: 120,
    p_origen: `${MARCA} Hotel Clarion`, p_destino: "Aeropuerto Palmerola", p_tarifa_id: null, p_precio: "800.00", p_notas: null, ...args,
  });
const asignarT = (sesion, id, vehiculo, conductor) =>
  rpc(sesion, "asignar_recursos_transporte", { p_transporte_id: id, p_vehiculo_id: vehiculo, p_conductor_id: conductor, p_motivo: null });
const iniciarT = (sesion, id) => rpc(sesion, "iniciar_transporte", { p_transporte_id: id });
const finalizarT = (sesion, id, anticipo = null) =>
  rpc(sesion, "finalizar_transporte", { p_transporte_id: id, p_notas_finales: `${MARCA} sin novedad`, p_aplicar_anticipo: anticipo });
const cancelarT = (sesion, id, motivo = `${MARCA} se suspende el viaje`) => rpc(sesion, "cancelar_transporte", { p_transporte_id: id, p_motivo: motivo });
const traslado = (sesion, args) =>
  rpc(sesion, "registrar_traslado", {
    p_idempotencia: randomUUID(), p_tipo: "particular", p_cliente_id: clientes.Integracion, p_membresia_id: null, p_beneficiario_id: null,
    p_pasajero: `${MARCA} Paciente`, p_inicio_previsto: null, p_minutos_estimados: 90, p_origen: "Colonia Kennedy", p_destino: "Hospital Escuela",
    p_motivo: null, p_precio: "1000.00", p_tarifa_id: null, p_notas: null, p_vehiculo_id: null, p_conductor_id: null, p_programar: false, ...args,
  });
const cobrar = (sesion, cliente, monto) =>
  rpc(sesion, "registrar_cobro", {
    p_idempotencia: randomUUID(), p_cliente_id: cliente, p_cuenta_dinero_id: caja, p_fecha: hoy,
    p_metodo: "efectivo", p_referencia: null, p_monto: monto,
  });

// --- Datos ficticios ---------------------------------------------------
const crear = async (sesion, tabla, fila) => (await api(sesion.token, "POST", tabla, fila)).datos?.[0]?.id;
const vehiculo = (sufijoCodigo, tipo, estado = "operativo") => crear(admin, "vehiculos", { codigo: `E5-${sufijo}-${sufijoCodigo}`, tipo, estado });
const clientes = {};
for (const nombre of ["Alquiler", "Transporte", "Integracion", "Anticipo"]) {
  clientes[nombre] = await crear(operador, "clientes", { nombre: `${MARCA} ${nombre} ${sufijo}` });
}
const v1 = await vehiculo("A1", "alquiler");
const v2 = await vehiculo("A2", "alquiler");
const v3 = await vehiculo("A3", "alquiler");
const fueraServicio = await vehiculo("FS", "alquiler", "fuera_servicio");
const t1 = await vehiculo("T1", "transporte");
const t2 = await vehiculo("T2", "transporte");
const amb = await vehiculo("AMB", "ambulancia");
const m1 = await vehiculo("M1", "mixto");
const m2 = await vehiculo("M2", "mixto");
const c1 = await crear(admin, "conductores", { nombre: `${MARCA} Conductor 1 ${sufijo}` });
const c2 = await crear(admin, "conductores", { nombre: `${MARCA} Conductor 2 ${sufijo}` });
const c3 = await crear(admin, "conductores", { nombre: `${MARCA} Conductor 3 ${sufijo}` });
const caja = await crear(admin, "cuentas_dinero", { nombre: `${MARCA} Caja ${sufijo}`, tipo: "caja" });
const tarifaDia = await crear(admin, "tarifas", { actividad: "alquileres", nombre: `${MARCA} Día ${sufijo}`, unidad: "dia", precio_base: 1200 });
const tarifaServicio = await crear(admin, "tarifas", { actividad: "transportes", nombre: `${MARCA} Aeropuerto ${sufijo}`, unidad: "servicio", precio_base: 800 });
comprobar("datos ficticios creados",
  [v1, v2, v3, fueraServicio, t1, t2, amb, m1, m2, c1, c2, c3, caja, tarifaDia, tarifaServicio].every(Boolean) && Object.values(clientes).every(Boolean));

const d = (n) => sumarDias(hoy, 10 + n);

// --- 23a. Sin sesión e inactivos -------------------------------------------
{
  let todas = true;
  for (const tabla of ["alquileres", "transportes", "cargos_adicionales_alquiler", "saldos_alquileres", "saldos_transportes"]) {
    if (!denegado(await api(null, "GET", `${tabla}?select=*&limit=1`))) todas = false;
  }
  comprobar("23. anon no lee alquileres, transportes, adicionales ni sus vistas (5)", todas);
  let funciones = true;
  for (const [f, args] of [
    ["registrar_alquiler", { p_idempotencia: randomUUID(), p_cliente_id: clientes.Alquiler, p_vehiculo_id: v1, p_entrega_prevista: momento(d(0), "08:00"), p_devolucion_prevista: momento(d(1), "08:00"), p_tarifa_id: null, p_precio: 1, p_notas: null }],
    ["registrar_transporte", { p_idempotencia: randomUUID(), p_cliente_id: clientes.Transporte, p_inicio_previsto: momento(d(0), "08:00"), p_minutos_estimados: 60, p_origen: "x", p_destino: "y", p_tarifa_id: null, p_precio: null, p_notas: null }],
    ["disponibilidad_recursos", { p_actividad: "alquileres", p_inicio: momento(d(0), "08:00"), p_fin: momento(d(1), "08:00") }],
    ["historial_operacion", { p_entidad: "alquileres", p_registro_id: randomUUID() }],
  ]) {
    if (!denegado(await rpc(null, f, args))) funciones = false;
  }
  comprobar("23. anon no ejecuta funciones de alquileres ni transportes", funciones);
  const r = await reservar(inactivo, { p_vehiculo_id: v1, p_entrega_prevista: momento(d(0), "08:00"), p_devolucion_prevista: momento(d(1), "08:00") });
  comprobar("23. usuario inactivo no reserva", r.codigo === "42501");
}

// --- 1. Reserva -------------------------------------------------------------
let rA;
{
  const clave = randomUUID();
  const args = { p_idempotencia: clave, p_vehiculo_id: v1, p_entrega_prevista: momento(d(0), "08:00"), p_devolucion_prevista: momento(d(3), "08:00"), p_tarifa_id: tarifaDia };
  const r = await reservar(operador, args);
  rA = r.datos;
  const a = await alquiler(rA);
  const occ = await ocupaciones("alquiler", rA);
  comprobar("1. reserva registrada: reservada, precio pactado L 3,600 y sin cargo todavía",
    ok(r) && a.estado === "reservado" && c(a.precio_pactado) === 360000 && a.cargo_id === null && a.estado_financiero === "sin_cargo", JSON.stringify(r.datos));
  comprobar("1. el vehículo queda ocupado en el intervalo (una ocupación planificada)", occ.length === 1 && occ[0].recurso_id === v1 && !occ[0].en_curso);
  comprobar("1/21. reintento con la misma clave: misma reserva y una sola ocupación",
    (await reservar(operador, args)).datos === rA && (await ocupaciones("alquiler", rA)).length === 1);
  const amb1 = await reservar(operador, { p_vehiculo_id: amb, p_entrega_prevista: momento(d(5), "08:00"), p_devolucion_prevista: momento(d(6), "08:00") });
  const fs = await reservar(operador, { p_vehiculo_id: fueraServicio, p_entrega_prevista: momento(d(5), "08:00"), p_devolucion_prevista: momento(d(6), "08:00") });
  comprobar("1. no se alquila una ambulancia ni un vehículo fuera de servicio", amb1.codigo === "22023" && fs.codigo === "22023");
  const fechas = await reservar(operador, { p_vehiculo_id: v2, p_entrega_prevista: momento(d(5), "08:00"), p_devolucion_prevista: momento(d(5), "07:00") });
  comprobar("1. la devolución debe ser posterior a la entrega", fechas.codigo === "22023");
  const disp = (await rpc(operador, "disponibilidad_recursos", { p_actividad: "alquileres", p_inicio: momento(d(1), "08:00"), p_fin: momento(d(2), "08:00") })).datos ?? [];
  comprobar("1. la disponibilidad marca ocupado el vehículo reservado y no ofrece ambulancias",
    disp.some((x) => x.recurso_id === v1 && x.disponible === false) && disp.some((x) => x.recurso_id === v2 && x.disponible) &&
      !disp.some((x) => x.recurso_id === amb) && !disp.some((x) => x.recurso_tipo === "conductor"));
}

// --- 2. Reservas incompatibles y simultáneas -------------------------------
{
  const solapada = await reservar(operador, { p_vehiculo_id: v1, p_entrega_prevista: momento(d(2), "08:00"), p_devolucion_prevista: momento(d(4), "08:00") });
  comprobar("2. reserva que se cruza con otra del mismo vehículo: rechazada", solapada.codigo === "22023" && /ocupado/.test(solapada.mensaje));
  const contigua = await reservar(operador, { p_vehiculo_id: v1, p_entrega_prevista: momento(d(3), "08:00"), p_devolucion_prevista: momento(d(4), "08:00") });
  comprobar("2. reserva contigua (empieza cuando termina la otra): permitida", ok(contigua));
  const simultaneas = await Promise.all([
    reservar(operador, { p_vehiculo_id: v2, p_entrega_prevista: momento(d(10), "08:00"), p_devolucion_prevista: momento(d(12), "08:00") }),
    reservar(admin, { p_vehiculo_id: v2, p_entrega_prevista: momento(d(11), "08:00"), p_devolucion_prevista: momento(d(13), "08:00") }),
  ]);
  comprobar("2. dos reservas simultáneas del mismo vehículo que se cruzan: solo una prospera",
    simultaneas.filter(ok).length === 1 && simultaneas.filter((r) => r.codigo === "22023").length === 1, JSON.stringify(simultaneas.map((r) => r.estado)));
  const sinPrecio = await reservar(operador, { p_vehiculo_id: v2, p_entrega_prevista: momento(d(20), "08:00"), p_devolucion_prevista: momento(d(21), "08:00"), p_precio: null });
  comprobar("2. la reserva exige precio pactado", sinPrecio.codigo === "22023");
  await cancelarAlquiler(operador, contigua.datos);
}

// --- 3, 4, 5, 6, 7, 8. Entrega, devolución, km, anticipo, cargo único, abonos -
{
  // 6. Anticipo antes de entregar.
  const anticipo = await cobrar(finanzas, clientes.Alquiler, "1000.00");
  comprobar("6. anticipo de L 1,000 registrado por finanzas como saldo a favor",
    ok(anticipo) && c((await uno(admin, `saldos_clientes?cliente_id=eq.${clientes.Alquiler}&select=saldo_a_favor`)).saldo_a_favor) === 100000);

  const antesEntrega = await devolver(operador, rA);
  comprobar("4. no se devuelve un vehículo que nunca fue entregado", antesEntrega.codigo === "22023" && /no ha sido entregado/.test(antesEntrega.mensaje));
  comprobar("3. la entrega exige kilometraje y combustible",
    (await rpc(operador, "entregar_alquiler", { p_alquiler_id: rA, p_km_salida: null, p_combustible: "lleno", p_notas: null })).codigo === "22023");
  const entrega = await entregar(operador, rA, 1000, "lleno");
  let a = await alquiler(rA);
  const occ = await ocupaciones("alquiler", rA);
  comprobar("3. entrega: entregado con hora real, km 1,000 y tanque lleno",
    ok(entrega) && a.estado === "entregado" && a.entrega_real && a.km_salida === 1000 && a.combustible_salida === "lleno", JSON.stringify(entrega.datos));
  comprobar("3. el vehículo sigue ocupado hasta la devolución real (ocupación en curso)", occ.length === 1 && occ[0].en_curso);
  comprobar("transición: no se cancela un alquiler entregado", (await cancelarAlquiler(operador, rA)).codigo === "22023");
  comprobar("transición: no se entrega dos veces", (await entregar(operador, rA)).codigo === "22023");

  const kmMenorOperador = await devolver(operador, rA, { p_km_regreso: 900 });
  const kmMenorAdminSinMotivo = await devolver(admin, rA, { p_km_regreso: 900 });
  comprobar("5. kilometraje final menor que el inicial: rechazado al operador y al administrador sin motivo",
    kmMenorOperador.codigo === "22023" && kmMenorAdminSinMotivo.codigo === "22023" && (await alquiler(rA)).estado === "entregado");

  // 7. Dos devoluciones simultáneas.
  const [dev1, dev2] = await Promise.all([
    devolver(operador, rA, { p_km_regreso: 1250, p_combustible: "medio", p_aplicar_anticipo: "1000.00" }),
    devolver(admin, rA, { p_km_regreso: 1250, p_combustible: "medio", p_aplicar_anticipo: "1000.00" }),
  ]);
  a = await alquiler(rA);
  const cargos = await cargosDe("alquiler", rA);
  comprobar("4/7. devolución (dos simultáneas): devuelto y un solo cargo de L 3,600",
    ok(dev1) && ok(dev2) && [dev1, dev2].filter((x) => x.datos.repetido).length === 1 && a.estado === "devuelto" &&
      cargos.length === 1 && c(cargos[0].monto) === 360000, JSON.stringify([dev1.datos, dev2.datos]));
  comprobar("5. diferencias registradas: 250 km recorridos, de lleno a medio", a.km_recorridos === 250 && a.combustible_regreso === "medio");
  comprobar("6. ejemplo de la especificación: cargo L 3,600, aplicado L 1,000, pendiente L 2,600",
    c(a.importe_total) === 360000 && c(a.aplicado) === 100000 && c(a.pendiente) === 260000 && a.estado_financiero === "parcial");
  const movimientos = await leer(admin, `movimientos_dinero?cuenta_dinero_id=eq.${caja}&origen_id=eq.${anticipo.datos}&select=id`);
  comprobar("6. dinero recibido L 1,000 una sola vez; la aplicación no mueve caja", movimientos.length === 1);
  const [asiento] = await asientosDe("cargo", cargos[0].id);
  comprobar("7. asiento D 1200 CxC / H 4300 Ingreso alquileres", asiento && plantilla(asiento) === "1200D360000 4300H360000");
  comprobar("3/4. la devolución cierra la ocupación del vehículo", (await ocupaciones("alquiler", rA)).length === 0);
  comprobar("transición: un devuelto no se cancela", (await cancelarAlquiler(operador, rA)).codigo === "22023");

  // 8. Abono posterior.
  const abono = await cobrar(finanzas, clientes.Alquiler, "600.00");
  a = await alquiler(rA);
  const saldo = await uno(admin, `saldos_clientes?cliente_id=eq.${clientes.Alquiler}&select=pendiente`);
  comprobar("8. abono de L 600: aplicado L 1,600, pendiente L 2,000 en el alquiler y en el cliente",
    ok(abono) && c(a.aplicado) === 160000 && c(a.pendiente) === 200000 && c(saldo.pendiente) === 200000);

  // 4/5. Cargos adicionales expresos y corrección de kilometraje del administrador.
  const rB = (await reservar(operador, { p_vehiculo_id: v3, p_entrega_prevista: momento(d(0), "09:00"), p_devolucion_prevista: momento(d(3), "09:00") })).datos;
  await entregar(operador, rB, 5000, "tres_cuartos");
  const sinConcepto = await devolver(operador, rB, { p_km_regreso: 5100, p_adicionales: [{ concepto: "", monto: "400.00" }] });
  comprobar("4. un cargo adicional exige concepto", sinConcepto.codigo === "22023" && (await alquiler(rB)).estado === "entregado");
  const correccion = await devolver(admin, rB, {
    p_km_regreso: 4990, p_combustible: "cuarto", p_motivo_correccion_km: `${MARCA} el odómetro se reinició`,
    p_adicionales: [{ concepto: `${MARCA} Lavado interior`, monto: "400.00" }],
  });
  const b = await alquiler(rB);
  const adicionales = await leer(admin, `cargos_adicionales_alquiler?alquiler_id=eq.${rB}&select=*`);
  comprobar("5. el administrador corrige un kilometraje menor con motivo, que queda registrado",
    ok(correccion) && b.estado === "devuelto" && b.km_recorridos === -10 && b.motivo_correccion_km);
  comprobar("4. cargo adicional de L 400 registrado: importe final L 4,000 en un solo cargo",
    adicionales.length === 1 && c(b.total_adicionales) === 40000 && c(b.importe_total) === 400000 &&
      (await cargosDe("alquiler", rB)).length === 1 && c((await cargosDe("alquiler", rB))[0].monto) === 400000);
  const historial = (await rpc(finanzas, "historial_operacion", { p_entidad: "alquileres", p_registro_id: rB })).datos ?? [];
  comprobar("historial del alquiler visible para finanzas (reserva, entrega, devolución)",
    ["registrar_alquiler", "entregar_alquiler", "devolver_alquiler"].every((x) => historial.some((h) => h.accion === x)));
}

// --- 9. Cancelar y liberar ---------------------------------------------------
{
  const r = await reservar(operador, { p_vehiculo_id: v2, p_entrega_prevista: momento(d(30), "08:00"), p_devolucion_prevista: momento(d(32), "08:00") });
  const sinMotivo = await cancelarAlquiler(operador, r.datos, " ");
  const cancelado = await cancelarAlquiler(operador, r.datos);
  const a = await alquiler(r.datos);
  comprobar("9. cancelar exige motivo; cancelado: sin cargo y sin ocupación",
    sinMotivo.codigo === "22023" && ok(cancelado) && a.estado === "cancelado" && a.cargo_id === null && (await ocupaciones("alquiler", r.datos)).length === 0);
  const otra = await reservar(operador, { p_vehiculo_id: v2, p_entrega_prevista: momento(d(30), "08:00"), p_devolucion_prevista: momento(d(32), "08:00") });
  comprobar("9. el intervalo liberado puede reservarse de nuevo", ok(otra));
  comprobar("transición: un cancelado no se entrega", (await entregar(operador, r.datos)).codigo === "22023");
  await cancelarAlquiler(operador, otra.datos);
}

// --- 10–16. Transporte con conductor -----------------------------------------
let tA;
{
  const clave = randomUUID();
  const args = { p_idempotencia: clave, p_inicio_previsto: momento(d(1), "06:00"), p_tarifa_id: tarifaServicio };
  const r = await solicitar(operador, args);
  tA = r.datos;
  const t = await transporte(tA);
  comprobar("10. solicitud registrada sin vehículo ni conductor", ok(r) && t.estado === "solicitado" && !t.vehiculo_id && !t.conductor_id && c(t.precio_pactado) === 80000);
  comprobar("10/21. reintento con la misma clave: el mismo servicio", (await solicitar(operador, args)).datos === tA);
  comprobar("10. sin destino se rechaza", (await solicitar(operador, { p_inicio_previsto: momento(d(1), "06:00"), p_destino: null })).codigo === "22023");
  comprobar("13. no se inicia sin vehículo y conductor", (await iniciarT(operador, tA)).codigo === "22023");
  comprobar("11. una ambulancia no sirve para transporte", (await asignarT(operador, tA, amb, c1)).codigo === "22023");
  const a = await asignarT(operador, tA, t1, c1);
  comprobar("11. asignar vehículo y conductor: dos ocupaciones", ok(a) && (await ocupaciones("transporte", tA)).length === 2);

  const otro = (await solicitar(operador, { p_inicio_previsto: momento(d(1), "07:00") })).datos;
  const vehOcupado = await asignarT(operador, otro, t1, c2);
  const condOcupado = await asignarT(operador, otro, t2, c1);
  comprobar("12. vehículo y conductor ocupados en un horario que se cruza: rechazados",
    vehOcupado.codigo === "22023" && condOcupado.codigo === "22023" && (await ocupaciones("transporte", otro)).length === 0);
  const tercero = (await solicitar(operador, { p_inicio_previsto: momento(d(1), "07:30") })).datos;
  const simultaneas = await Promise.all([asignarT(operador, otro, t2, c2), asignarT(admin, tercero, t2, c3)]);
  comprobar("12/21. dos asignaciones simultáneas del mismo vehículo: solo una prospera", simultaneas.filter(ok).length === 1, JSON.stringify(simultaneas.map((x) => x.estado)));
  // Otro servicio con el mismo vehículo y conductor más tarde ese día.
  const tarde = (await solicitar(operador, { p_inicio_previsto: momento(d(1), "12:00"), p_vehiculo_id: t1, p_conductor_id: c1 })).datos;
  const repro = await rpc(operador, "reprogramar_transporte", { p_transporte_id: tA, p_inicio_previsto: momento(d(1), "11:30"), p_minutos_estimados: 60, p_motivo: `${MARCA} choque` });
  const sigue = await transporte(tA);
  comprobar("12. reprogramar sobre el horario ocupado por otro servicio: rechazado y sin cambios",
    repro.codigo === "22023" && sigue.inicio_previsto.startsWith(d(1)) && sigue.minutos_estimados === 120, repro.mensaje);
  const reproLibre = await rpc(operador, "reprogramar_transporte", { p_transporte_id: tA, p_inicio_previsto: momento(d(1), "06:30"), p_minutos_estimados: 90, p_motivo: `${MARCA} cambio de hora` });
  comprobar("12. reprogramar a un horario libre conserva los recursos", ok(reproLibre) && (await ocupaciones("transporte", tA)).length === 2);
  for (const id of [otro, tercero, tarde]) await cancelarT(operador, id);

  // 15. Anticipo antes de iniciar.
  const anticipo = await cobrar(finanzas, clientes.Transporte, "300.00");
  const inicio = await iniciarT(operador, tA);
  comprobar("13. iniciar: en curso con hora real", ok(inicio) && (await transporte(tA)).estado === "en_curso" && (await transporte(tA)).inicio_real);
  comprobar("16. un servicio en curso no se cancela", (await cancelarT(operador, tA)).codigo === "22023");
  const [f1, f2] = await Promise.all([finalizarT(operador, tA, "300.00"), finalizarT(admin, tA, "300.00")]);
  const t2r = await transporte(tA);
  const cargos = await cargosDe("transporte", tA);
  comprobar("13/14. completar (dos simultáneos): completado, recursos liberados y un solo cargo de L 800",
    ok(f1) && ok(f2) && [f1, f2].filter((x) => x.datos.repetido).length === 1 && t2r.estado === "completado" && t2r.fin_real &&
      cargos.length === 1 && c(cargos[0].monto) === 80000 && (await ocupaciones("transporte", tA)).length === 0, JSON.stringify([f1.datos, f2.datos]));
  const [asiento] = await asientosDe("cargo", cargos[0].id);
  comprobar("14. asiento D 1200 CxC / H 4400 Ingreso transportes", asiento && plantilla(asiento) === "1200D80000 4400H80000");
  comprobar("15. anticipo de L 300 aplicado: pendiente L 500 sin nueva entrada de dinero",
    c(t2r.aplicado) === 30000 && c(t2r.pendiente) === 50000 &&
      (await leer(admin, `movimientos_dinero?cuenta_dinero_id=eq.${caja}&origen_id=eq.${anticipo.datos}&select=id`)).length === 1);

  const sinPrecio = (await solicitar(operador, { p_inicio_previsto: momento(d(2), "06:00"), p_precio: null, p_vehiculo_id: t1, p_conductor_id: c1 })).datos;
  await iniciarT(operador, sinPrecio);
  comprobar("14. no se completa sin precio pactado", (await finalizarT(operador, sinPrecio)).codigo === "22023" && (await cargosDe("transporte", sinPrecio)).length === 0);
  await rpc(operador, "editar_transporte", { p_transporte_id: sinPrecio, p_origen: `${MARCA} Hotel`, p_destino: "Aeropuerto", p_tarifa_id: null, p_precio: "500.00", p_notas: null });
  comprobar("14. con el precio indicado ya se completa", ok(await finalizarT(operador, sinPrecio)) && (await cargosDe("transporte", sinPrecio)).length === 1);

  const aCancelar = (await solicitar(operador, { p_inicio_previsto: momento(d(3), "06:00"), p_vehiculo_id: t2, p_conductor_id: c2 })).datos;
  const cancelado = await cancelarT(operador, aCancelar);
  comprobar("16. cancelar antes de iniciar: libera recursos y no genera cargo",
    ok(cancelado) && (await transporte(aCancelar)).estado === "cancelado" && (await ocupaciones("transporte", aCancelar)).length === 0 &&
      (await cargosDe("transporte", aCancelar)).length === 0);
  comprobar("16. un cancelado no se inicia", (await iniciarT(operador, aCancelar)).codigo === "22023");
}

// --- 17–20. Disponibilidad compartida entre los tres módulos ---------------
{
  // 17. Alquiler ↔ ambulancia (vehículo mixto).
  const alq = (await reservar(operador, { p_cliente_id: clientes.Integracion, p_vehiculo_id: m1, p_entrega_prevista: momento(d(40), "08:00"), p_devolucion_prevista: momento(d(42), "08:00") })).datos;
  const ambSobreAlq = await traslado(operador, { p_inicio_previsto: momento(d(41), "10:00"), p_vehiculo_id: m1 });
  comprobar("17. un traslado de ambulancia no usa un vehículo reservado para alquiler", ambSobreAlq.codigo === "22023" && /ocupado/.test(ambSobreAlq.mensaje), ambSobreAlq.mensaje);
  const tras = (await traslado(operador, { p_inicio_previsto: momento(d(45), "10:00"), p_vehiculo_id: m1 })).datos;
  const alqSobreAmb = await reservar(operador, { p_cliente_id: clientes.Integracion, p_vehiculo_id: m1, p_entrega_prevista: momento(d(45), "08:00"), p_devolucion_prevista: momento(d(46), "08:00") });
  comprobar("17. un alquiler no reserva un vehículo asignado a un traslado", alqSobreAmb.codigo === "22023");

  // 18. Alquiler ↔ transporte.
  const trSobreAlq = await solicitar(operador, { p_cliente_id: clientes.Integracion, p_inicio_previsto: momento(d(41), "12:00"), p_vehiculo_id: m1 });
  comprobar("18. un transporte no usa un vehículo reservado para alquiler", trSobreAlq.codigo === "22023");
  const tr = (await solicitar(operador, { p_cliente_id: clientes.Integracion, p_inicio_previsto: momento(d(50), "10:00"), p_vehiculo_id: m1 })).datos;
  const alqSobreTr = await reservar(operador, { p_cliente_id: clientes.Integracion, p_vehiculo_id: m1, p_entrega_prevista: momento(d(50), "08:00"), p_devolucion_prevista: momento(d(50), "18:00") });
  comprobar("18. un alquiler no reserva un vehículo asignado a un transporte", alqSobreTr.codigo === "22023");

  // 19. Ambulancia ↔ transporte (vehículo mixto y conductor).
  const trSobreAmb = await solicitar(operador, { p_cliente_id: clientes.Integracion, p_inicio_previsto: momento(d(45), "10:30"), p_vehiculo_id: m1 });
  const conTras = (await traslado(operador, { p_inicio_previsto: momento(d(55), "09:00"), p_conductor_id: c3 })).datos;
  const condSobreAmb = await solicitar(operador, { p_cliente_id: clientes.Integracion, p_inicio_previsto: momento(d(55), "09:30"), p_conductor_id: c3 });
  const ambSobreTr = await traslado(operador, { p_inicio_previsto: momento(d(50), "10:30"), p_vehiculo_id: m1 });
  comprobar("19. ambulancia y transporte no comparten vehículo ni conductor en horarios que se cruzan",
    trSobreAmb.codigo === "22023" && condSobreAmb.codigo === "22023" && ambSobreTr.codigo === "22023");

  // Cancelar libera para las otras actividades.
  await cancelarAlquiler(operador, alq);
  const ahoraLibre = await traslado(operador, { p_inicio_previsto: momento(d(41), "10:00"), p_vehiculo_id: m1 });
  comprobar("9/17. al cancelar el alquiler, el vehículo queda libre para un traslado", ok(ahoraLibre));
  for (const id of [tras, conTras, ahoraLibre.datos]) await rpc(operador, "cancelar_traslado", { p_traslado_id: id, p_motivo: `${MARCA} fin de prueba` });
  await cancelarT(operador, tr);

  // 20. Alquiler entregado pasado de horario: impide nuevos inicios con el vehículo.
  const vencido = (await reservar(operador, { p_cliente_id: clientes.Integracion, p_vehiculo_id: m2, p_entrega_prevista: dentroDe(-180), p_devolucion_prevista: dentroDe(-60) })).datos;
  await entregar(operador, vencido, 20000, "lleno");
  const siguiente = (await solicitar(operador, { p_cliente_id: clientes.Integracion, p_inicio_previsto: dentroDe(30), p_minutos_estimados: 60, p_vehiculo_id: m2, p_conductor_id: c1 })).datos;
  const trasSiguiente = (await traslado(operador, { p_inicio_previsto: dentroDe(100), p_vehiculo_id: m2, p_conductor_id: c2 })).datos;
  await esperarMs(65000); // la ocupación en curso supera su fin previsto (entrega + 1 minuto)
  const inicioTr = await iniciarT(operador, siguiente);
  const inicioAmb = await rpc(operador, "iniciar_traslado", { p_traslado_id: trasSiguiente });
  comprobar("20. vehículo todavía entregado después del horario previsto: no inicia un transporte ni un traslado",
    inicioTr.codigo === "22023" && /en un servicio en curso/.test(inicioTr.mensaje) && inicioAmb.codigo === "22023",
    `${inicioTr.mensaje} | ${inicioAmb.mensaje}`);
  const avisos = (await rpc(operador, "avisos_operacion", { p_origen_tipo: "alquiler", p_origen_id: vencido })).datos ?? [];
  const avisosTr = (await rpc(finanzas, "avisos_operacion", { p_origen_tipo: "transporte", p_origen_id: siguiente })).datos ?? [];
  comprobar("20. avisos: horario excedido y operaciones posteriores afectadas, sin reprogramarlas",
    avisos.some((x) => /superó el horario/.test(x)) && avisos.some((x) => /puede verse afectada/.test(x)) && avisosTr.some((x) => /pasado de su horario/.test(x)) &&
      (await transporte(siguiente)).estado === "solicitado", JSON.stringify({ avisos, avisosTr }));
  await devolver(operador, vencido, { p_km_regreso: 20100 });
  comprobar("20. tras la devolución real, el transporte ya puede iniciarse", ok(await iniciarT(operador, siguiente)));
  await finalizarT(operador, siguiente);
  await rpc(operador, "cancelar_traslado", { p_traslado_id: trasSiguiente, p_motivo: `${MARCA} fin de prueba` });
}

// --- 21. Reintentos concurrentes con la misma clave ---------------------------
{
  const claveA = randomUUID();
  const argsA = { p_idempotencia: claveA, p_cliente_id: clientes.Integracion, p_vehiculo_id: v3, p_entrega_prevista: momento(d(60), "08:00"), p_devolucion_prevista: momento(d(61), "08:00") };
  const reservas = await Promise.all([1, 2, 3].map(() => reservar(operador, argsA)));
  const filasA = await leer(admin, `alquileres?idempotencia=eq.${claveA}&select=id`);
  const claveT = randomUUID();
  const argsT = { p_idempotencia: claveT, p_cliente_id: clientes.Integracion, p_inicio_previsto: momento(d(60), "08:00") };
  const solicitudes = await Promise.all([1, 2, 3].map(() => solicitar(operador, argsT)));
  const filasT = await leer(admin, `transportes?idempotencia=eq.${claveT}&select=id`);
  comprobar("21. tres reservas y tres solicitudes simultáneas con la misma clave: un alquiler y un transporte",
    reservas.every(ok) && new Set(reservas.map((r) => r.datos)).size === 1 && filasA.length === 1 && (await ocupaciones("alquiler", filasA[0].id)).length === 1 &&
      solicitudes.every(ok) && new Set(solicitudes.map((r) => r.datos)).size === 1 && filasT.length === 1);
  await cancelarAlquiler(operador, filasA[0].id);
  await cancelarT(operador, filasT[0].id);
}

// --- 22 y 23. Permisos y escrituras directas ---------------------------------
{
  const r = (await reservar(operador, { p_cliente_id: clientes.Integracion, p_vehiculo_id: v3, p_entrega_prevista: momento(d(70), "08:00"), p_devolucion_prevista: momento(d(71), "08:00") })).datos;
  const t = (await solicitar(operador, { p_cliente_id: clientes.Integracion, p_inicio_previsto: momento(d(70), "08:00") })).datos;
  const intentos = await Promise.all([
    reservar(finanzas, { p_vehiculo_id: v2, p_entrega_prevista: momento(d(80), "08:00"), p_devolucion_prevista: momento(d(81), "08:00") }),
    entregar(finanzas, r),
    devolver(finanzas, r),
    cancelarAlquiler(finanzas, r),
    rpc(finanzas, "modificar_alquiler", { p_alquiler_id: r, p_vehiculo_id: v3, p_entrega_prevista: momento(d(70), "09:00"), p_devolucion_prevista: momento(d(71), "08:00"), p_tarifa_id: null, p_precio: "1.00", p_notas: null, p_motivo: "x" }),
    solicitar(finanzas, { p_inicio_previsto: momento(d(80), "08:00") }),
    asignarT(finanzas, t, t1, c1),
    iniciarT(finanzas, t),
    finalizarT(finanzas, t),
    cancelarT(finanzas, t),
  ]);
  comprobar("22. finanzas no reserva, entrega, devuelve, modifica ni cancela, ni gestiona transportes (10 operaciones)",
    intentos.every((x) => x.codigo === "42501"), JSON.stringify(intentos.map((x) => x.codigo)));
  const lecturas = await Promise.all([admin, operador, finanzas].map(async (s) => (await leer(s, `saldos_alquileres?id=eq.${rA}&select=id,pendiente`))?.length === 1 && (await leer(s, `saldos_transportes?id=eq.${tA}&select=id`))?.length === 1));
  comprobar("22. los tres roles consultan alquileres, transportes y sus saldos", lecturas.every(Boolean));
  const modificado = await rpc(operador, "modificar_alquiler", { p_alquiler_id: r, p_vehiculo_id: v2, p_entrega_prevista: momento(d(70), "09:00"), p_devolucion_prevista: momento(d(72), "09:00"), p_tarifa_id: tarifaDia, p_precio: "2400.00", p_notas: null, p_motivo: `${MARCA} cambia de vehículo` });
  const occ = await ocupaciones("alquiler", r);
  comprobar("22. el operador modifica una reserva con motivo: la ocupación pasa al nuevo vehículo",
    ok(modificado) && occ.length === 1 && occ[0].recurso_id === v2 && c((await alquiler(r)).precio_pactado) === 240000);
  const directos = await Promise.all([
    api(admin.token, "POST", "alquileres", { cliente_id: clientes.Integracion, vehiculo_id: v1, entrega_prevista: momento(d(90), "08:00"), devolucion_prevista: momento(d(91), "08:00"), precio_pactado: 1, idempotencia: randomUUID() }),
    api(admin.token, "PATCH", `alquileres?id=eq.${r}`, { estado: "devuelto" }),
    api(admin.token, "PATCH", `transportes?id=eq.${t}`, { estado: "completado" }),
    api(operador.token, "POST", "cargos_adicionales_alquiler", { alquiler_id: rA, concepto: "x", monto: 1 }),
    api(admin.token, "DELETE", `transportes?id=eq.${t}`),
    api(admin.token, "PATCH", `ocupaciones_recurso?origen_id=eq.${r}`, { activa: false }),
  ]);
  comprobar("23. nadie (ni el administrador) escribe directamente alquileres, transportes, adicionales u ocupaciones",
    directos.every(denegado), directos.map((x) => x.estado).join(","));
  await cancelarAlquiler(operador, r);
  await cancelarT(operador, t);
}

// --- 24 y 25. Asientos balanceados y movimientos únicos -----------------------
{
  const ids = Object.values(clientes).join(",");
  const cargos = await leer(admin, `cargos_cliente?cliente_id=in.(${ids})&select=id,origen_tipo,origen_id`);
  const devueltos = await leer(admin, `alquileres?cliente_id=in.(${ids})&estado=eq.devuelto&select=id,cargo_id`);
  const completados = await leer(admin, `transportes?cliente_id=in.(${ids})&estado=eq.completado&select=id,cargo_id`);
  comprobar("24. un cargo por alquiler devuelto y por transporte completado, y ninguno por cancelaciones",
    cargos.filter((x) => x.origen_tipo === "alquiler").length === devueltos.length &&
      cargos.filter((x) => x.origen_tipo === "transporte").length === completados.length &&
      [...devueltos, ...completados].every((x) => cargos.some((y) => y.id === x.cargo_id && y.origen_id === x.id)));
  const cobros = await leer(admin, `cobros_cliente?cliente_id=in.(${ids})&select=id,monto`);
  const aplicaciones = await leer(admin, `aplicaciones_cobro?cliente_id=in.(${ids})&select=id`);
  const origenes = [
    ...cargos.map((x) => `and(origen_tipo.eq.cargo,origen_id.eq.${x.id})`),
    ...cobros.map((x) => `and(origen_tipo.eq.cobro,origen_id.eq.${x.id})`),
    ...aplicaciones.map((x) => `and(origen_tipo.eq.aplicacion,origen_id.eq.${x.id})`),
  ];
  const asientos = await leer(admin, `asientos?or=(${origenes.join(",")})&select=id,lineas_asiento(debe,haber)`);
  const cuadra = (a) => a.lineas_asiento.length >= 2 && a.lineas_asiento.reduce((s, l) => s + c(l.debe) - c(l.haber), 0) === 0;
  comprobar(`24. ${asientos.length} asientos de la prueba balanceados, uno por evento`, asientos.length === origenes.length && asientos.every(cuadra));
  const movimientos = await leer(admin, `movimientos_dinero?cuenta_dinero_id=eq.${caja}&select=origen_tipo,origen_id,monto_con_signo`);
  comprobar("25. cada cobro tiene un único movimiento de dinero y nada más mueve caja",
    movimientos.length === cobros.length && movimientos.every((m) => m.origen_tipo === "cobro") &&
      cobros.every((x) => movimientos.filter((m) => m.origen_id === x.id && c(m.monto_con_signo) === c(x.monto)).length === 1));
}

terminar();
