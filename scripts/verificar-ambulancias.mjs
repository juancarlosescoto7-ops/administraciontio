// Verifica los traslados de ambulancia de E4 contra la API REST real de
// Supabase (desarrollo) con usuarios ficticios: registro cubierto y
// particular, cobertura, reservas y consumos, cupos compartido e individual,
// períodos futuros, recursos y horarios, estados, cargos y cobros con E2,
// permisos, RLS y asientos.
// Uso: E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-ambulancias.mjs
// Crea registros ficticios marcados con "[PRUEBA E4]". No elimina nada.
import { randomUUID } from "node:crypto";
import { cargarEntorno, crearClienteRest, crearReporte, denegado } from "./comun.mjs";

const MARCA = "[PRUEBA E4]";
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
/** Fecha y hora de Tegucigalpa (UTC−6, sin horario de verano). */
const momento = (fecha, hora) => `${fecha}T${hora}:00-06:00`;

const admin = await iniciarSesion(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const operador = await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
const finanzas = await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
const inactivo = await iniciarSesion(env.E2E_INACTIVO_CORREO, env.E2E_INACTIVO_CLAVE);

const traslado = (id) => uno(admin, `saldos_traslados?id=eq.${id}&select=*`);
const reservas = (id) => leer(admin, `reservas_beneficio?traslado_id=eq.${id}&select=*&order=created_at`);
const ocupaciones = (id) => leer(admin, `ocupaciones_recurso?origen_id=eq.${id}&activa=is.true&select=*`);
const cobertura = async (m, b, f) =>
  (await rpc(admin, "consultar_cobertura", { p_membresia_id: m, p_beneficiario_id: b, p_fecha: f })).datos?.[0];
const asientosDe = (origen, id) =>
  leer(admin, `asientos?origen_tipo=eq.${origen}&origen_id=eq.${id}&select=id,lineas_asiento(debe,haber,cuentas_contables(codigo))`);
const plantilla = (a) =>
  a.lineas_asiento.map((l) => `${l.cuentas_contables.codigo}${c(l.debe) > 0 ? `D${c(l.debe)}` : `H${c(l.haber)}`}`).sort().join(" ");

/** Registra un traslado; por omisión cubierto, del operador, sin recursos. */
const registrar = (sesion, args) =>
  rpc(sesion, "registrar_traslado", {
    p_idempotencia: randomUUID(), p_tipo: "cubierto", p_cliente_id: null, p_membresia_id: null, p_beneficiario_id: null,
    p_pasajero: null, p_inicio_previsto: null, p_minutos_estimados: 90, p_origen: `${MARCA} Colonia Kennedy`,
    p_destino: "Hospital Escuela", p_motivo: null, p_precio: null, p_tarifa_id: null, p_notas: null,
    p_vehiculo_id: null, p_conductor_id: null, p_programar: false, ...args,
  });
const asignar = (sesion, id, vehiculo, conductor, motivo = null) =>
  rpc(sesion, "asignar_recursos_traslado", { p_traslado_id: id, p_vehiculo_id: vehiculo, p_conductor_id: conductor, p_motivo: motivo });
const iniciar = (sesion, id) => rpc(sesion, "iniciar_traslado", { p_traslado_id: id });
const finalizar = (sesion, id, anticipo = null) =>
  rpc(sesion, "finalizar_traslado", { p_traslado_id: id, p_notas_finales: `${MARCA} sin novedad`, p_aplicar_anticipo: anticipo });
const cancelar = (sesion, id, motivo = `${MARCA} el cliente desiste`) => rpc(sesion, "cancelar_traslado", { p_traslado_id: id, p_motivo: motivo });
const cobrar = (sesion, cliente, monto, aplicaciones = []) =>
  rpc(sesion, "registrar_cobro", {
    p_idempotencia: randomUUID(), p_cliente_id: cliente, p_cuenta_dinero_id: caja, p_fecha: hoy,
    p_metodo: "efectivo", p_referencia: null, p_monto: monto, p_aplicaciones: aplicaciones,
  });

// --- Datos ficticios ---------------------------------------------------
const crear = async (sesion, tabla, fila) => (await api(sesion.token, "POST", tabla, fila)).datos?.[0]?.id;
const plan = (nombre, cupo, modalidad) =>
  crear(admin, "planes", { nombre: `${MARCA} ${nombre} ${sufijo}`, precio_mensual: 400, cupo_mensual: cupo, modalidad_cupo: modalidad, dias_gracia: 30 });
const planCompartido = await plan("Plan compartido", 2, "compartido");
const planIndividual = await plan("Plan individual", 2, "individual");
const planUno = await plan("Plan de un traslado", 1, "compartido");
const clientes = {};
for (const nombre of ["Compartido", "Individual", "Ultimo", "Morosa", "Perdida", "Particular", "Anticipo", "Cancelado", "Futuro"]) {
  clientes[nombre] = await crear(operador, "clientes", { nombre: `${MARCA} ${nombre} ${sufijo}` });
}
const ana = await crear(operador, "beneficiarios", { nombre: `${MARCA} Ana ${sufijo}` });
const beto = await crear(operador, "beneficiarios", { nombre: `${MARCA} Beto ${sufijo}` });
const ciro = await crear(operador, "beneficiarios", { nombre: `${MARCA} Ciro (no vinculado) ${sufijo}` });
const ambulancias = [];
for (const n of [1, 2, 3]) ambulancias.push(await crear(admin, "vehiculos", { codigo: `E4-${sufijo}-${n}`, tipo: "ambulancia" }));
const camion = await crear(admin, "vehiculos", { codigo: `E4-${sufijo}-ALQ`, tipo: "alquiler" });
const conductores = [];
for (const n of [1, 2, 3]) conductores.push(await crear(admin, "conductores", { nombre: `${MARCA} Conductor ${n} ${sufijo}` }));
const caja = await crear(admin, "cuentas_dinero", { nombre: `${MARCA} Caja ${sufijo}`, tipo: "caja" });
const tarifa = await crear(admin, "tarifas", { actividad: "ambulancias", nombre: `${MARCA} Traslado local ${sufijo}`, unidad: "servicio", precio_base: 1500 });

const membresia = async (cliente, planId, beneficiarios, inicio = hoy, condiciones = null) =>
  (await rpc(admin, "registrar_membresia", {
    p_idempotencia: randomUUID(), p_cliente_id: cliente, p_plan_id: planId, p_fecha_inicio: inicio,
    p_beneficiarios: beneficiarios, p_condiciones: condiciones,
  })).datos;
const mComp = await membresia(clientes.Compartido, planCompartido, [ana, beto]);
const mInd = await membresia(clientes.Individual, planIndividual, [ana, beto]);
const mUno = await membresia(clientes.Ultimo, planUno, [ana, beto]);
const mMorosa = await membresia(clientes.Morosa, planCompartido, [ana], sumarDias(hoy, -40), { dias_gracia: 5 });
const mPerdida = await membresia(clientes.Perdida, planCompartido, [beto]);
comprobar("datos ficticios creados",
  [planCompartido, planIndividual, planUno, ana, beto, ciro, ...ambulancias, camion, ...conductores, caja, tarifa, mComp, mInd, mUno, mMorosa, mPerdida]
    .every(Boolean) && Object.values(clientes).every(Boolean));

const proxima = (await uno(admin, `membresias?id=eq.${mComp}&select=proxima_renovacion`)).proxima_renovacion;
const dia1 = sumarDias(hoy, 2);
const dia2 = sumarDias(hoy, 3);

// --- 24a. Sin sesión e inactivos ------------------------------------------
{
  let todas = true;
  for (const tabla of ["traslados_ambulancia", "reservas_beneficio", "ocupaciones_recurso", "saldos_traslados"]) {
    if (!denegado(await api(null, "GET", `${tabla}?select=*&limit=1`))) todas = false;
  }
  comprobar("24. anon no lee traslados, reservas, ocupaciones ni la vista (4)", todas);
  let funciones = true;
  for (const [f, args] of [
    ["registrar_traslado", { p_idempotencia: randomUUID(), p_tipo: "particular", p_cliente_id: clientes.Particular, p_membresia_id: null, p_beneficiario_id: null, p_pasajero: null, p_inicio_previsto: momento(dia1, "08:00"), p_minutos_estimados: 60, p_origen: "x", p_destino: null, p_motivo: null, p_precio: null, p_tarifa_id: null, p_notas: null }],
    ["iniciar_traslado", { p_traslado_id: randomUUID() }],
    ["recursos_disponibles", { p_inicio: momento(dia1, "08:00"), p_minutos: 60 }],
    ["historial_traslado", { p_traslado_id: randomUUID() }],
  ]) {
    if (!denegado(await rpc(null, f, args))) funciones = false;
  }
  comprobar("24. anon no ejecuta funciones de traslados", funciones);
  const r = await registrar(inactivo, { p_membresia_id: mComp, p_beneficiario_id: ana, p_inicio_previsto: momento(dia1, "08:00") });
  comprobar("24. usuario inactivo no registra traslados", r.codigo === "42501", JSON.stringify(r.datos));
}

// --- 1, 3, 4 y 5. Cubierto: beneficiario y membresía válidos e inválidos ----
let t1;
{
  const clave = randomUUID();
  const r = await registrar(operador, { p_idempotencia: clave, p_membresia_id: mComp, p_beneficiario_id: ana, p_inicio_previsto: momento(dia1, "08:00"), p_motivo: "Control de diálisis" });
  t1 = r.datos;
  const t = await traslado(t1);
  const [reserva] = await reservas(t1);
  comprobar("1. traslado cubierto registrado: solicitado, cliente de la membresía, cobertura válida",
    ok(r) && t.estado === "solicitado" && t.cliente_id === clientes.Compartido && t.condicion_cobertura === "valida" && t.tipo === "cubierto",
    JSON.stringify(r.datos));
  comprobar("5. reserva del beneficio en el período de la fecha del servicio",
    reserva?.estado === "reservada" && reserva.periodo_id && reserva.periodo_id === t.periodo_id && reserva.fecha_servicio === dia1);
  const cob = await cobertura(mComp, beto, dia1);
  comprobar("5. el cupo compartido refleja la reserva (usados 1, disponibles 1)", cob?.usados === 1 && cob?.disponibles === 1, JSON.stringify(cob));
  const repetido = await registrar(operador, { p_idempotencia: clave, p_membresia_id: mComp, p_beneficiario_id: ana, p_inicio_previsto: momento(dia1, "08:00") });
  comprobar("1. reintento con la misma clave: mismo traslado y una sola reserva", repetido.datos === t1 && (await reservas(t1)).length === 1);

  const invalido = await registrar(operador, { p_membresia_id: mComp, p_beneficiario_id: ciro, p_inicio_previsto: momento(dia1, "11:00") });
  const ti = await traslado(invalido.datos);
  comprobar("3. beneficiario no vinculado: se registra sin cobertura y sin reserva",
    ok(invalido) && ti.condicion_cobertura === "no_valida" && /vinculado/.test(ti.motivo_cobertura) && (await reservas(invalido.datos)).length === 0);

  const morosa = await rpc(admin, "consultar_cobertura", { p_membresia_id: mMorosa, p_beneficiario_id: ana, p_fecha: hoy });
  const suspendida = await registrar(operador, { p_membresia_id: mMorosa, p_beneficiario_id: ana, p_inicio_previsto: momento(dia1, "09:00") });
  const ts = await traslado(suspendida.datos);
  comprobar("4. membresía suspendida: solicitud conservada como no válida, sin reserva",
    morosa.datos?.[0]?.cubierto === false && ok(suspendida) && ts.condicion_cobertura === "no_valida" && /suspendida/.test(ts.motivo_cobertura) &&
      (await reservas(suspendida.datos)).length === 0);
  const sinBeneficiario = await registrar(operador, { p_membresia_id: mComp, p_beneficiario_id: null, p_inicio_previsto: momento(dia1, "10:00") });
  comprobar("3. cubierto sin beneficiario se rechaza", sinBeneficiario.codigo === "22023");
  const ajena = await registrar(operador, { p_cliente_id: clientes.Individual, p_membresia_id: mComp, p_beneficiario_id: ana, p_inicio_previsto: momento(dia1, "10:00") });
  comprobar("3. membresía de otro cliente se rechaza", ajena.codigo === "22023");
}

// --- 17, 15 y 16. Recursos: sin asignar, ocupados, simultáneos --------------
{
  const sinRecursos = await iniciar(operador, t1);
  comprobar("17. no se inicia sin ambulancia y conductor", sinRecursos.codigo === "22023" && /Asigne/.test(sinRecursos.mensaje));
  const noAmbulancia = await asignar(operador, t1, camion, conductores[0]);
  comprobar("15. un vehículo de alquiler no sirve como ambulancia", noAmbulancia.codigo === "22023");
  const a = await asignar(operador, t1, ambulancias[0], conductores[0]);
  comprobar("asignar ambulancia y conductor", ok(a) && (await ocupaciones(t1)).length === 2);

  const otro = (await registrar(operador, { p_membresia_id: mComp, p_beneficiario_id: beto, p_inicio_previsto: momento(dia1, "09:00") })).datos;
  const ambOcupada = await asignar(operador, otro, ambulancias[0], conductores[1]);
  comprobar("15. ambulancia ocupada en otro servicio que se cruza: rechazado", ambOcupada.codigo === "22023" && /vehículo está ocupado/.test(ambOcupada.mensaje), ambOcupada.mensaje);
  const condOcupado = await asignar(operador, otro, ambulancias[1], conductores[0]);
  comprobar("16. conductor ocupado en otro servicio que se cruza: rechazado", condOcupado.codigo === "22023" && /conductor está ocupado/.test(condOcupado.mensaje), condOcupado.mensaje);
  comprobar("15/16. el intento fallido no deja ocupaciones", (await ocupaciones(otro)).length === 0);
  const libres = await asignar(operador, otro, ambulancias[1], conductores[1]);
  comprobar("15/16. otros recursos libres sí se asignan", ok(libres));
  await cancelar(operador, otro);

  // Dos asignaciones simultáneas de la misma ambulancia en horarios que se cruzan.
  const x = (await registrar(operador, { p_tipo: "particular", p_cliente_id: clientes.Particular, p_inicio_previsto: momento(dia2, "14:00") })).datos;
  const y = (await registrar(operador, { p_tipo: "particular", p_cliente_id: clientes.Particular, p_inicio_previsto: momento(dia2, "14:30") })).datos;
  const simultaneas = await Promise.all([asignar(operador, x, ambulancias[2], null), asignar(admin, y, ambulancias[2], null)]);
  comprobar("15. dos asignaciones simultáneas de la misma ambulancia: solo una prospera",
    simultaneas.filter(ok).length === 1 && simultaneas.filter((r) => r.codigo === "22023").length === 1,
    JSON.stringify(simultaneas.map((r) => r.estado)));
  const lejos = await rpc(operador, "reprogramar_traslado", { p_traslado_id: ok(simultaneas[0]) ? y : x, p_inicio_previsto: momento(dia2, "18:00"), p_minutos_estimados: 60, p_motivo: `${MARCA} otra hora` });
  const ahoraLibre = await asignar(operador, ok(simultaneas[0]) ? y : x, ambulancias[2], null);
  comprobar("14/15. tras reprogramar a otra hora, la misma ambulancia se asigna", ok(lejos) && ok(ahoraLibre));
  const disponibles = (await rpc(operador, "recursos_disponibles", { p_inicio: momento(dia2, "14:15"), p_minutos: 30 })).datos ?? [];
  comprobar("15. la consulta de disponibilidad marca la ambulancia ocupada",
    disponibles.some((d) => d.recurso_id === ambulancias[2] && d.disponible === false && /asignado/.test(d.detalle)));
  await cancelar(operador, x);
  await cancelar(operador, y);
}

// --- 6, 18, 8. Inicio, finalización y consumo único ------------------------
{
  const inicio = await iniciar(operador, t1);
  let t = await traslado(t1);
  comprobar("8/6. iniciar: en curso con hora real; el beneficio sigue reservado",
    ok(inicio) && inicio.datos.iniciado === true && t.estado === "en_curso" && t.inicio_real && (await reservas(t1))[0].estado === "reservada",
    JSON.stringify(inicio.datos));
  comprobar("transición: no se inicia dos veces", (await iniciar(operador, t1)).codigo === "22023");
  comprobar("transición: un traslado en curso no se cancela", (await cancelar(operador, t1)).codigo === "22023");

  const cargosAntes = (await leer(admin, `cargos_cliente?cliente_id=eq.${clientes.Compartido}&select=id`)).length;
  const fin = await finalizar(operador, t1);
  t = await traslado(t1);
  const rs = await reservas(t1);
  comprobar("18. finalizar: completado con hora real y observaciones finales",
    ok(fin) && t.estado === "completado" && t.fin_real >= t.inicio_real && t.notas_finales);
  comprobar("6. al completar se consume exactamente un beneficio", rs.length === 1 && rs[0].estado === "consumida" && rs[0].consumida_en);
  comprobar("6. un cubierto no genera cargo ni ingreso nuevo",
    t.cargo_id === null && (await leer(admin, `cargos_cliente?cliente_id=eq.${clientes.Compartido}&select=id`)).length === cargosAntes);
  comprobar("18. finalizar libera la ambulancia y el conductor", (await ocupaciones(t1)).length === 0);
  const repetido = await finalizar(operador, t1);
  comprobar("8. completar dos veces no consume otra vez", ok(repetido) && repetido.datos.repetido === true && (await reservas(t1)).length === 1);
  comprobar("transición: un completado no se cancela ni se inicia",
    (await cancelar(operador, t1)).codigo === "22023" && (await iniciar(operador, t1)).codigo === "22023");
}

// --- 7 y 10. Cupo compartido, cancelación libera --------------------------
let tBeto;
{
  const r = await registrar(operador, { p_membresia_id: mComp, p_beneficiario_id: beto, p_inicio_previsto: momento(dia2, "08:00") });
  tBeto = r.datos;
  comprobar("10. compartido: el segundo beneficiario usa el segundo cupo", (await traslado(tBeto)).condicion_cobertura === "valida");
  const tercero = await registrar(operador, { p_membresia_id: mComp, p_beneficiario_id: ana, p_inicio_previsto: momento(dia2, "10:00") });
  const t3 = await traslado(tercero.datos);
  const cob = await cobertura(mComp, ana, dia2);
  comprobar("10. compartido 2 (A completó uno, B reservó otro): disponibilidad 0 y el tercero no es válido",
    cob?.disponibles === 0 && t3.condicion_cobertura === "no_valida" && /agotado/.test(t3.motivo_cobertura), JSON.stringify(cob));

  const cancelado = await cancelar(operador, tBeto);
  const [reserva] = await reservas(tBeto);
  comprobar("7. cancelar libera la reserva con motivo y conserva el traslado",
    ok(cancelado) && reserva.estado === "liberada" && /Cancelación/.test(reserva.motivo_liberacion) && (await traslado(tBeto)).estado === "cancelado");
  comprobar("7. tras cancelar vuelve a haber 1 disponible", (await cobertura(mComp, ana, dia2))?.disponibles === 1);
  comprobar("transición: un cancelado no se inicia ni se completa",
    (await iniciar(operador, tBeto)).codigo === "22023" && (await finalizar(operador, tBeto)).codigo === "22023");
  const revalidado = await rpc(operador, "revalidar_cobertura_traslado", { p_traslado_id: tercero.datos });
  comprobar("13. al liberarse el cupo, revalidar devuelve la cobertura al tercero", revalidado.datos === "valida");
  await cancelar(operador, tercero.datos);
}

// --- 11. Cupo individual ----------------------------------------------------
{
  const a1 = await registrar(operador, { p_membresia_id: mInd, p_beneficiario_id: ana, p_inicio_previsto: momento(dia1, "07:00") });
  const a2 = await registrar(operador, { p_membresia_id: mInd, p_beneficiario_id: ana, p_inicio_previsto: momento(dia2, "07:00") });
  const a3 = await registrar(operador, { p_membresia_id: mInd, p_beneficiario_id: ana, p_inicio_previsto: momento(dia2, "15:00") });
  const b1 = await registrar(operador, { p_membresia_id: mInd, p_beneficiario_id: beto, p_inicio_previsto: momento(dia1, "07:00") });
  const estados = await Promise.all([a1, a2, a3, b1].map(async (r) => (await traslado(r.datos)).condicion_cobertura));
  comprobar("11. individual 2: A usa sus 2, el tercero de A no es válido y B conserva los suyos",
    JSON.stringify(estados) === JSON.stringify(["valida", "valida", "no_valida", "valida"]), JSON.stringify(estados));
  const cobB = await cobertura(mInd, beto, dia1);
  comprobar("11. B mantiene 1 de 2 disponibles", cobB?.disponibles === 1 && cobB?.cupo === 2, JSON.stringify(cobB));
  for (const r of [a1, a2, a3, b1]) await cancelar(operador, r.datos);
}

// --- 9. Dos reservas simultáneas del último cupo -----------------------------
{
  const simultaneas = await Promise.all([
    registrar(operador, { p_membresia_id: mUno, p_beneficiario_id: ana, p_inicio_previsto: momento(dia1, "12:00") }),
    registrar(admin, { p_membresia_id: mUno, p_beneficiario_id: beto, p_inicio_previsto: momento(dia1, "12:00") }),
  ]);
  const condiciones = await Promise.all(simultaneas.map(async (r) => (await traslado(r.datos))?.condicion_cobertura));
  const vigentes = await leer(admin, `reservas_beneficio?membresia_id=eq.${mUno}&estado=neq.liberada&select=id`);
  comprobar("9. dos solicitudes simultáneas por el último cupo: una válida, otra no",
    simultaneas.every(ok) && condiciones.filter((x) => x === "valida").length === 1 && condiciones.filter((x) => x === "no_valida").length === 1 && vigentes.length === 1,
    JSON.stringify(condiciones));
}

// --- 12. Período futuro: reserva provisional sin mensualidad ---------------
{
  const periodosAntes = (await leer(admin, `periodos_membresia?membresia_id=eq.${mComp}&select=id`)).length;
  const fecha = sumarDias(proxima, 2);
  const r = await registrar(operador, { p_membresia_id: mComp, p_beneficiario_id: ana, p_inicio_previsto: momento(fecha, "08:00") });
  const t = await traslado(r.datos);
  const [reserva] = await reservas(r.datos);
  comprobar("12. fecha de un período no generado: pendiente de validación con reserva provisional",
    t.condicion_cobertura === "pendiente_validacion" && reserva?.estado === "reservada" && reserva.periodo_id === null && reserva.periodo_inicio === proxima,
    JSON.stringify({ condicion: t.condicion_cobertura, reserva }));
  comprobar("12. no se genera la mensualidad futura", (await leer(admin, `periodos_membresia?membresia_id=eq.${mComp}&select=id`)).length === periodosAntes);
  const otro = await registrar(operador, { p_membresia_id: mComp, p_beneficiario_id: beto, p_inicio_previsto: momento(fecha, "12:00") });
  const tercero = await registrar(operador, { p_membresia_id: mComp, p_beneficiario_id: beto, p_inicio_previsto: momento(fecha, "16:00") });
  comprobar("12. el cupo del período futuro cuenta las provisionales (2 de 2, la tercera no es válida)",
    (await traslado(otro.datos)).condicion_cobertura === "pendiente_validacion" && (await traslado(tercero.datos)).condicion_cobertura === "no_valida");
  await asignar(operador, r.datos, ambulancias[0], conductores[0]);
  const inicio = await iniciar(operador, r.datos);
  comprobar("12. no se inicia como cubierto mientras el período no exista",
    ok(inicio) && inicio.datos.iniciado === false && /no se ha generado/.test(inicio.datos.motivo) &&
      (await traslado(r.datos)).estado === "solicitado" && (await reservas(r.datos))[0].estado === "reservada",
    JSON.stringify(inicio.datos));
  for (const x of [r, otro, tercero]) await cancelar(operador, x.datos);
}

// --- 13. Pérdida y recuperación de cobertura; conversión explícita ---------
{
  const r = await registrar(operador, { p_membresia_id: mPerdida, p_beneficiario_id: beto, p_inicio_previsto: momento(dia1, "16:00") });
  comprobar("13. cobertura válida al registrar", (await traslado(r.datos)).condicion_cobertura === "valida");
  const vinculo = (await leer(admin, `membresia_beneficiarios?membresia_id=eq.${mPerdida}&activo=is.true&select=id`))[0].id;
  await rpc(operador, "inactivar_beneficiario_membresia", { p_vinculo_id: vinculo, p_motivo: `${MARCA} baja temporal` });
  let t = await traslado(r.datos);
  let rs = await reservas(r.datos);
  comprobar("13. al dar de baja al beneficiario: no válida, reserva liberada y solicitud conservada",
    t.condicion_cobertura === "no_valida" && t.estado === "solicitado" && rs[0].estado === "liberada" && /Sin cobertura/.test(rs[0].motivo_liberacion));
  await asignar(operador, r.datos, ambulancias[1], conductores[1]);
  const sinCobertura = await iniciar(operador, r.datos);
  comprobar("13. sin cobertura no se inicia como cubierto ni se convierte solo en particular",
    sinCobertura.datos?.iniciado === false && (await traslado(r.datos)).tipo === "cubierto" && (await traslado(r.datos)).estado === "solicitado");
  await rpc(operador, "agregar_beneficiario_membresia", { p_membresia_id: mPerdida, p_beneficiario_id: beto });
  t = await traslado(r.datos);
  rs = await reservas(r.datos);
  comprobar("13. al restablecerse la cobertura se revalida: válida con una reserva nueva y el historial conservado",
    t.condicion_cobertura === "valida" && rs.length === 2 && rs[1].estado === "reservada" && rs[0].estado === "liberada");
  const historial = (await rpc(finanzas, "historial_traslado", { p_traslado_id: r.datos })).datos ?? [];
  comprobar("13. el historial registra la pérdida y la recuperación", historial.filter((h) => h.accion === "cambio_cobertura").length >= 2);

  const sinMotivo = await rpc(operador, "convertir_traslado_a_particular", { p_traslado_id: r.datos, p_precio: "1200.00", p_motivo: "" });
  const conversion = await rpc(operador, "convertir_traslado_a_particular", { p_traslado_id: r.datos, p_precio: "1200.00", p_motivo: `${MARCA} el cliente acepta pagar` });
  t = await traslado(r.datos);
  rs = await reservas(r.datos);
  comprobar("13. conversión explícita a particular con motivo: libera la reserva y deja constancia",
    sinMotivo.codigo === "22023" && ok(conversion) && t.tipo === "particular" && c(t.precio_pactado) === 120000 &&
      rs.every((x) => x.estado === "liberada") &&
      ((await rpc(admin, "historial_traslado", { p_traslado_id: r.datos })).datos ?? []).some((h) => h.accion === "convertir_a_particular" && h.motivo));
  await cancelar(operador, r.datos);
}

// --- 14. Reprogramación -----------------------------------------------------
{
  const r = await registrar(operador, { p_membresia_id: mComp, p_beneficiario_id: beto, p_inicio_previsto: momento(dia1, "18:00"), p_vehiculo_id: ambulancias[1], p_conductor_id: conductores[1] });
  const [antes] = await reservas(r.datos);
  const mismo = await rpc(operador, "reprogramar_traslado", { p_traslado_id: r.datos, p_inicio_previsto: momento(dia2, "18:00"), p_minutos_estimados: 120, p_motivo: `${MARCA} cambio de cita` });
  const t = await traslado(r.datos);
  const rs = await reservas(r.datos);
  const occ = await ocupaciones(r.datos);
  comprobar("14. reprogramar en el mismo período: conserva la reserva y mueve los recursos",
    ok(mismo) && mismo.datos === "valida" && rs.length === 1 && rs[0].id === antes.id && rs[0].fecha_servicio === dia2 &&
      t.minutos_estimados === 120 && occ.length === 2 &&
      occ.every((o) => o.intervalo.includes(new Date(momento(dia2, "18:00")).toISOString().slice(0, 10))),
    JSON.stringify({ r: mismo.datos, rs: rs.length }));
  const futuro = await rpc(operador, "reprogramar_traslado", { p_traslado_id: r.datos, p_inicio_previsto: momento(sumarDias(proxima, 1), "09:00"), p_minutos_estimados: 60, p_motivo: `${MARCA} se pospone` });
  const rs2 = await reservas(r.datos);
  comprobar("14. reprogramar a un período futuro: libera la reserva anterior y deja una provisional",
    futuro.datos === "pendiente_validacion" && rs2.length === 2 && rs2[0].estado === "liberada" && rs2[1].periodo_id === null);
  const ocupado = await registrar(operador, { p_tipo: "particular", p_cliente_id: clientes.Particular, p_inicio_previsto: momento(dia1, "20:00"), p_vehiculo_id: ambulancias[1] });
  const choque = await rpc(operador, "reprogramar_traslado", { p_traslado_id: r.datos, p_inicio_previsto: momento(dia1, "20:30"), p_minutos_estimados: 60, p_motivo: `${MARCA} choque` });
  comprobar("14. reprogramar sobre un horario ocupado de la ambulancia se rechaza y no cambia nada",
    choque.codigo === "22023" && (await traslado(r.datos)).inicio_previsto.startsWith(sumarDias(proxima, 1)));
  comprobar("14. reprogramar exige motivo",
    (await rpc(operador, "reprogramar_traslado", { p_traslado_id: r.datos, p_inicio_previsto: momento(dia1, "06:00"), p_minutos_estimados: 60, p_motivo: "" })).codigo === "22023");
  await cancelar(operador, r.datos);
  await cancelar(operador, ocupado.datos);
}

// --- 2, 19, 20. Particular: registro, cargo único, cobro parcial -----------
let tPart;
{
  const r = await registrar(operador, {
    p_tipo: "particular", p_cliente_id: clientes.Particular, p_pasajero: `${MARCA} Pasajero sin ficha`, p_tarifa_id: tarifa, p_precio: "1500.00",
    p_inicio_previsto: momento(dia1, "13:00"), p_minutos_estimados: 60, p_programar: true,
  });
  tPart = r.datos;
  const t = await traslado(tPart);
  comprobar("2. traslado particular registrado y programado, con precio pactado y sin cobertura",
    ok(r) && t.tipo === "particular" && t.estado === "programado" && c(t.precio_pactado) === 150000 && t.condicion_cobertura === null &&
      t.paciente.includes("Pasajero") && (await reservas(tPart)).length === 0);
  comprobar("2. un particular no lleva membresía",
    (await registrar(operador, { p_tipo: "particular", p_cliente_id: clientes.Particular, p_membresia_id: mComp, p_inicio_previsto: momento(dia1, "13:00") })).codigo === "22023");
  await asignar(operador, tPart, ambulancias[2], conductores[2]);
  const inicio = await iniciar(operador, tPart);
  comprobar("8. un particular se inicia con saldo pendiente", ok(inicio) && inicio.datos.iniciado === true);
  const [fin1, fin2] = await Promise.all([finalizar(operador, tPart), finalizar(admin, tPart)]);
  const cargos = await leer(admin, `cargos_cliente?origen_tipo=eq.traslado_ambulancia&origen_id=eq.${tPart}&select=*`);
  comprobar("19. dos finalizaciones simultáneas: un solo cargo de L 1,500",
    ok(fin1) && ok(fin2) && [fin1, fin2].filter((f) => f.datos.repetido).length === 1 && cargos.length === 1 && c(cargos[0].monto) === 150000,
    JSON.stringify([fin1.datos, fin2.datos]));
  const [asiento] = await asientosDe("cargo", cargos[0].id);
  comprobar("19. asiento D 1200 CxC / H 4200 Ingreso ambulancias particulares", asiento && plantilla(asiento) === "1200D150000 4200H150000");
  const pago = await cobrar(finanzas, clientes.Particular, "500.00", [{ cargo_id: cargos[0].id, monto: "500.00" }]);
  const tras = await traslado(tPart);
  comprobar("20. cobro parcial por finanzas: pagado L 500, pendiente L 1,000, estado financiero parcial",
    ok(pago) && c(tras.aplicado) === 50000 && c(tras.pendiente) === 100000 && tras.estado_financiero === "parcial" && tras.estado === "completado");
}

// --- 21. Anticipo antes de completar y aplicación al finalizar ---------------
{
  const cliente = clientes.Anticipo;
  const anticipo = await cobrar(finanzas, cliente, "800.00");
  const r = await registrar(operador, { p_tipo: "particular", p_cliente_id: cliente, p_precio: "1500.00", p_inicio_previsto: momento(dia2, "21:00"), p_vehiculo_id: ambulancias[0], p_conductor_id: conductores[0] });
  await iniciar(operador, r.datos);
  const fin = await finalizar(operador, r.datos, "800.00");
  const t = await traslado(r.datos);
  const saldo = await uno(admin, `saldos_clientes?cliente_id=eq.${cliente}&select=saldo_a_favor,pendiente`);
  const movimientos = await leer(admin, `movimientos_dinero?cuenta_dinero_id=eq.${caja}&origen_id=eq.${anticipo.datos}&select=id`);
  const aplicacion = (await leer(admin, `aplicaciones_cobro?cargo_id=eq.${t.cargo_id}&select=id`))[0];
  const [asiento] = await asientosDe("aplicacion", aplicacion?.id);
  comprobar("21. anticipo de L 800 aplicado al completar: pagado 800, pendiente 700, saldo a favor 0",
    ok(fin) && c(t.aplicado) === 80000 && c(t.pendiente) === 70000 && c(saldo.saldo_a_favor) === 0 && c(saldo.pendiente) === 70000);
  comprobar("21. una sola entrada de dinero (la del anticipo) y aplicación D 2200 / H 1200",
    movimientos.length === 1 && (await leer(admin, `movimientos_dinero?origen_tipo=eq.aplicacion&origen_id=eq.${aplicacion?.id}&select=id`)).length === 0 &&
      asiento && plantilla(asiento) === "1200H80000 2200D80000");
  const excesivo = await (async () => {
    const otro = await registrar(operador, { p_tipo: "particular", p_cliente_id: cliente, p_precio: "100.00", p_inicio_previsto: momento(dia2, "23:30"), p_vehiculo_id: ambulancias[0], p_conductor_id: conductores[0] });
    await iniciar(operador, otro.datos);
    const f = await finalizar(operador, otro.datos, "50.00");
    return { f, t: await traslado(otro.datos) };
  })();
  comprobar("21. aplicar más saldo a favor del disponible se rechaza y no completa nada",
    excesivo.f.codigo === "22023" && excesivo.t.estado === "en_curso" && excesivo.t.cargo_id === null);
  await finalizar(operador, excesivo.t.id);
}

// --- 22. Cancelación con anticipo: sin cargo ni movimientos nuevos ----------
{
  const cliente = clientes.Cancelado;
  const anticipo = await cobrar(finanzas, cliente, "300.00");
  const r = await registrar(operador, { p_tipo: "particular", p_cliente_id: cliente, p_precio: "900.00", p_inicio_previsto: momento(dia1, "05:00"), p_vehiculo_id: ambulancias[2], p_conductor_id: conductores[2] });
  const cancelado = await cancelar(operador, r.datos);
  const saldo = await uno(admin, `saldos_clientes?cliente_id=eq.${cliente}&select=saldo_a_favor,pendiente,total_cargos`);
  comprobar("22. cancelar: sin cargo, recursos liberados y el anticipo queda como saldo a favor",
    ok(anticipo) && ok(cancelado) && (await traslado(r.datos)).cargo_id === null && (await ocupaciones(r.datos)).length === 0 &&
      c(saldo.saldo_a_favor) === 30000 && c(saldo.total_cargos) === 0);
  comprobar("22. la cancelación no crea movimientos de dinero",
    (await leer(admin, `movimientos_dinero?cuenta_dinero_id=eq.${caja}&origen_id=eq.${anticipo.datos}&select=id`)).length === 1);
}

// --- 23 y 24. Permisos y escrituras directas --------------------------------
{
  const r = await registrar(operador, { p_tipo: "particular", p_cliente_id: clientes.Particular, p_inicio_previsto: momento(sumarDias(hoy, 5), "08:00") });
  const id = r.datos;
  const intentos = await Promise.all([
    registrar(finanzas, { p_tipo: "particular", p_cliente_id: clientes.Particular, p_inicio_previsto: momento(dia1, "08:00") }),
    rpc(finanzas, "programar_traslado", { p_traslado_id: id }),
    asignar(finanzas, id, ambulancias[0], null),
    iniciar(finanzas, id),
    cancelar(finanzas, id),
    rpc(finanzas, "reprogramar_traslado", { p_traslado_id: id, p_inicio_previsto: momento(dia1, "08:00"), p_minutos_estimados: 30, p_motivo: "x" }),
  ]);
  comprobar("23. finanzas no registra ni modifica estados operativos (6 operaciones)", intentos.every((x) => x.codigo === "42501"), JSON.stringify(intentos.map((x) => x.codigo)));
  const lecturas = await Promise.all([admin, operador, finanzas].map((s) => leer(s, `saldos_traslados?id=eq.${tPart}&select=id,pendiente`)));
  comprobar("23. los tres roles consultan servicios y su estado financiero", lecturas.every((l) => l?.length === 1));
  comprobar("23. el operador no revierte consumos (corrección del administrador)",
    (await rpc(operador, "revertir_consumo_traslado", { p_traslado_id: t1, p_motivo: "x" })).codigo === "42501");
  const reversion = await rpc(admin, "revertir_consumo_traslado", { p_traslado_id: t1, p_motivo: `${MARCA} se registró por error` });
  comprobar("23. el administrador revierte un consumo con motivo: la reserva queda liberada y el traslado completado",
    ok(reversion) && (await reservas(t1))[0].estado === "liberada" && (await traslado(t1)).estado === "completado");
  const directos = await Promise.all([
    api(admin.token, "POST", "traslados_ambulancia", { cliente_id: clientes.Particular, tipo: "particular", inicio_previsto: momento(dia1, "08:00"), origen: "x", idempotencia: randomUUID() }),
    api(admin.token, "PATCH", `traslados_ambulancia?id=eq.${id}`, { estado: "completado" }),
    api(operador.token, "POST", "reservas_beneficio", { traslado_id: t1, membresia_id: mComp, beneficiario_id: ana, periodo_inicio: hoy, fecha_servicio: hoy }),
    api(admin.token, "PATCH", `reservas_beneficio?traslado_id=eq.${t1}`, { estado: "consumida" }),
    api(admin.token, "DELETE", `ocupaciones_recurso?origen_id=eq.${id}`),
    api(admin.token, "DELETE", `traslados_ambulancia?id=eq.${id}`),
  ]);
  comprobar("24. nadie (ni el administrador) escribe directamente traslados, reservas u ocupaciones",
    directos.every(denegado), directos.map((x) => x.estado).join(","));
  await cancelar(operador, id);
}

// --- 25. Sin duplicados y asientos balanceados ------------------------------
{
  const ids = Object.values(clientes).join(",");
  const cargos = await leer(admin, `cargos_cliente?cliente_id=in.(${ids})&origen_tipo=eq.traslado_ambulancia&select=id,origen_id`);
  const completados = await leer(admin, `traslados_ambulancia?cliente_id=in.(${ids})&tipo=eq.particular&estado=eq.completado&select=id,cargo_id`);
  comprobar("25. un cargo por traslado particular completado y ninguno más",
    cargos.length === completados.length && completados.every((t) => cargos.some((x) => x.id === t.cargo_id && x.origen_id === t.id)));
  const consumos = await leer(admin, `reservas_beneficio?membresia_id=in.(${[mComp, mInd, mUno, mMorosa, mPerdida].join(",")})&estado=neq.liberada&select=traslado_id`);
  comprobar("25. ninguna reserva vigente duplicada por traslado", new Set(consumos.map((x) => x.traslado_id)).size === consumos.length);
  const todosCargos = await leer(admin, `cargos_cliente?cliente_id=in.(${ids})&select=id`);
  const cobros = await leer(admin, `cobros_cliente?cliente_id=in.(${ids})&select=id`);
  const aplicaciones = await leer(admin, `aplicaciones_cobro?cliente_id=in.(${ids})&select=id`);
  const origenes = [
    ...todosCargos.map((x) => `and(origen_tipo.eq.cargo,origen_id.eq.${x.id})`),
    ...cobros.map((x) => `and(origen_tipo.eq.cobro,origen_id.eq.${x.id})`),
    ...aplicaciones.map((x) => `and(origen_tipo.eq.aplicacion,origen_id.eq.${x.id})`),
  ];
  const asientos = await leer(admin, `asientos?or=(${origenes.join(",")})&select=id,lineas_asiento(debe,haber)`);
  const cuadra = (a) => a.lineas_asiento.length >= 2 && a.lineas_asiento.reduce((s, l) => s + c(l.debe) - c(l.haber), 0) === 0;
  comprobar(`25. ${asientos.length} asientos de la prueba balanceados, uno por evento`, asientos.length === origenes.length && asientos.every(cuadra));
  const movimientos = await leer(admin, `movimientos_dinero?cuenta_dinero_id=eq.${caja}&select=origen_tipo`);
  comprobar("25. solo los cobros mueven dinero (una vez cada uno)", movimientos.length === cobros.length && movimientos.every((m) => m.origen_tipo === "cobro"));
}

terminar();
