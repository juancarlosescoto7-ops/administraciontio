// Verifica el alta integrada de membresías y el contrato contra la API REST
// real de Supabase (desarrollo): atomicidad, idempotencia (también con envíos
// simultáneos), titular como beneficiario, permisos, plantilla versionada,
// contrato congelado e inmutable, y RLS de las tablas nuevas.
// Uso: E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-membresia-contrato.mjs
// Crea registros ficticios marcados con "[PRUEBA E6.6]". Deja la plantilla
// con el mismo texto que tenía (como versión nueva). No elimina nada.
import { randomUUID } from "node:crypto";
import { cargarEntorno, crearClienteRest, crearReporte, denegado } from "./comun.mjs";

const MARCA = "[PRUEBA E6.6]";
const env = cargarEntorno();
const { iniciarSesion, api } = crearClienteRest(env);
const { comprobar, terminar } = crearReporte();
const sufijo = Date.now().toString(36).toUpperCase();
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date());

const rpc = (sesion, funcion, args) => api(sesion?.token ?? null, "POST", `rpc/${funcion}`, args);
const leer = async (sesion, ruta) => (await api(sesion.token, "GET", ruta)).datos;
const exigir = (r, que) => {
  if (r.estado < 200 || r.estado >= 300) throw new Error(`${que}: HTTP ${r.estado} ${JSON.stringify(r.datos)}`);
  return r.datos;
};
const contar = async (ruta) => (await leer(admin, ruta))?.length ?? -1;

const admin = await iniciarSesion(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const operador = await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
const finanzas = await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);

const plan = exigir(
  await api(admin.token, "POST", "planes", {
    nombre: `${MARCA} Plan ${sufijo}`, precio_mensual: "750.00", cupo_mensual: 2, modalidad_cupo: "compartido", dias_gracia: 5,
  }),
  "plan",
)[0].id;
const nombre = (texto) => `${MARCA} ${texto} ${sufijo}`;
const enc = (texto) => encodeURIComponent(texto);
const alta = (sesion, args) =>
  rpc(sesion, "registrar_membresia_completa", {
    p_idempotencia: randomUUID(), p_cliente_id: null, p_cliente: null, p_plan_id: plan, p_fecha_inicio: hoy,
    p_beneficiarios: [], p_nuevos_beneficiarios: [], p_titular_beneficiario: false, p_condiciones: null, ...args,
  });
const vinculos = (membresia) =>
  leer(admin, `membresia_beneficiarios?membresia_id=eq.${membresia}&activo=eq.true&select=beneficiario_id,beneficiarios(nombre,identificacion)`);
const contrato = async (membresia) => (await leer(admin, `contratos_membresia?membresia_id=eq.${membresia}&select=*`))?.[0];

const plantillaOriginal = (await leer(admin, "plantillas_contrato?select=version,contenido&order=version.desc&limit=1"))[0];

// --- 1. Titular nuevo, dos beneficiarios nuevos y el titular como beneficiario
let membresia1;
const titular1 = nombre("Titular Uno");
{
  const clave = randomUUID();
  const args = {
    p_idempotencia: clave,
    p_cliente: { tipo: "natural", nombre: titular1, identificacion: `ID-${sufijo}`, telefono: "9999-0001", correo: "titular@ejemplo.hn" },
    p_nuevos_beneficiarios: [
      { nombre: nombre("Hijo"), fecha_nacimiento: "2015-05-10" },
      { nombre: nombre("Hija"), identificacion: `H-${sufijo}`, tutor: titular1 },
    ],
    p_titular_beneficiario: true,
  };
  const r = await alta(admin, args);
  membresia1 = r.datos;
  comprobar("1. alta con titular nuevo: membresía registrada", r.estado === 200 && typeof membresia1 === "string", JSON.stringify(r.datos));
  const clientes = await leer(admin, `clientes?nombre=eq.${enc(titular1)}&select=id,identificacion,correo`);
  comprobar("1. el cliente titular se creó una vez con sus datos", clientes.length === 1 && clientes[0].correo === "titular@ejemplo.hn");
  const lista = await vinculos(membresia1);
  comprobar("1. tres beneficiarios: dos nuevos y el titular", lista.length === 3 && lista.some((v) => v.beneficiarios.nombre === titular1));
  const c = await contrato(membresia1);
  comprobar("1. contrato congelado con la plantilla vigente y sin variables pendientes",
    c && c.plantilla_version === plantillaOriginal.version && c.contenido.includes(titular1) && c.contenido.includes(nombre("Hija")) &&
      !c.contenido.includes("{{") && c.datos.numero_beneficiarios === "3" && c.datos.precio_mensual === "L 750.00");
  const periodos = await leer(admin, `periodos_membresia?membresia_id=eq.${membresia1}&select=id,cargo_id`);
  comprobar("1. la primera mensualidad se generó como en el alta de E3", periodos.length === 1 && periodos[0].cargo_id);

  // 2. Idempotencia
  const repetida = await alta(admin, args);
  comprobar("2. reintento con la misma clave: la misma membresía, sin duplicar cliente ni beneficiarios",
    repetida.datos === membresia1 && (await contar(`clientes?nombre=eq.${enc(titular1)}&select=id`)) === 1 &&
      (await contar(`beneficiarios?nombre=eq.${enc(nombre("Hijo"))}&select=id`)) === 1);
}

// --- 3. Envíos simultáneos con la misma clave
{
  const clave = randomUUID();
  const titular = nombre("Simultáneo");
  const args = { p_idempotencia: clave, p_cliente: { nombre: titular }, p_nuevos_beneficiarios: [{ nombre: nombre("Beneficiario simultáneo") }] };
  const resultados = await Promise.all([alta(operador, args), alta(operador, args), alta(operador, args)]);
  const ids = new Set(resultados.map((r) => r.datos));
  comprobar("3. tres envíos simultáneos: una membresía, un cliente y un beneficiario",
    resultados.every((r) => r.estado === 200) && ids.size === 1 &&
      (await contar(`clientes?nombre=eq.${enc(titular)}&select=id`)) === 1 &&
      (await contar(`beneficiarios?nombre=eq.${enc(nombre("Beneficiario simultáneo"))}&select=id`)) === 1,
    JSON.stringify(resultados.map((r) => r.estado)));
}

// --- 4. Atomicidad: si algo falla, no queda nada creado
{
  const casos = [
    ["beneficiario sin nombre", { p_cliente: { nombre: nombre("Atómico A") }, p_nuevos_beneficiarios: [{ nombre: nombre("Válido A") }, { nombre: "  " }] }, "Atómico A", "Válido A"],
    ["correo inválido", { p_cliente: { nombre: nombre("Atómico B"), correo: "no-es-correo" }, p_nuevos_beneficiarios: [{ nombre: nombre("Válido B") }] }, "Atómico B", "Válido B"],
    ["fecha de nacimiento futura", { p_cliente: { nombre: nombre("Atómico C") }, p_nuevos_beneficiarios: [{ nombre: nombre("Válido C"), fecha_nacimiento: "2999-01-01" }] }, "Atómico C", "Válido C"],
    ["plan inexistente", { p_plan_id: randomUUID(), p_cliente: { nombre: nombre("Atómico D") }, p_nuevos_beneficiarios: [{ nombre: nombre("Válido D") }] }, "Atómico D", "Válido D"],
    ["sin beneficiarios", { p_cliente: { nombre: nombre("Atómico E") } }, "Atómico E", null],
    ["persona jurídica como beneficiaria", { p_cliente: { tipo: "juridica", nombre: nombre("Atómico F") }, p_titular_beneficiario: true }, "Atómico F", null],
    ["condiciones particulares del operador", { p_cliente: { nombre: nombre("Atómico G") }, p_nuevos_beneficiarios: [{ nombre: nombre("Válido G") }], p_condiciones: { precio: "1.00" } }, "Atómico G", "Válido G"],
  ];
  for (const [caso, args, cliente, beneficiario] of casos) {
    const sesion = caso.includes("operador") ? operador : admin;
    const r = await alta(sesion, args);
    const sinCliente = (await contar(`clientes?nombre=eq.${enc(nombre(cliente))}&select=id`)) === 0;
    const sinBeneficiario = beneficiario === null || (await contar(`beneficiarios?nombre=eq.${enc(nombre(beneficiario))}&select=id`)) === 0;
    comprobar(`4. ${caso}: rechazado y sin cliente ni beneficiarios creados`,
      (r.codigo === "22023" || r.codigo === "42501") && sinCliente && sinBeneficiario, `${r.codigo} ${r.mensaje}`);
  }
  const ambos = await alta(admin, { p_cliente_id: randomUUID(), p_cliente: { nombre: "x" }, p_beneficiarios: [] });
  comprobar("4. cliente existente y nuevo a la vez: rechazado", ambos.codigo === "22023");
}

// --- 5. Titular existente, beneficiario existente y reutilización de la ficha del titular
{
  const cliente = exigir(await api(operador.token, "POST", "clientes", { nombre: nombre("Titular existente"), identificacion: `TE-${sufijo}` }), "cliente")[0].id;
  const fichaTitular = exigir(await api(operador.token, "POST", "beneficiarios", { nombre: nombre("Ficha previa del titular"), identificacion: `te-${sufijo}` }), "beneficiario")[0].id;
  const otro = exigir(await api(operador.token, "POST", "beneficiarios", { nombre: nombre("Beneficiario existente") }), "beneficiario")[0].id;
  const r = await alta(operador, {
    p_cliente_id: cliente, p_beneficiarios: [otro, fichaTitular], p_titular_beneficiario: true,
    p_nuevos_beneficiarios: [{ nombre: nombre("Nuevo con existente") }],
  });
  const lista = await vinculos(r.datos);
  comprobar("5. operador: titular existente + existentes + nuevo; la ficha del titular se reutiliza sin duplicarse",
    r.estado === 200 && lista.length === 3 && lista.some((v) => v.beneficiario_id === fichaTitular) &&
      (await contar(`beneficiarios?identificacion=ilike.te-${sufijo}&select=id`)) === 1, JSON.stringify(r.datos));
}

// --- 6. Permisos
{
  const f = await alta(finanzas, { p_cliente: { nombre: nombre("Finanzas") }, p_nuevos_beneficiarios: [{ nombre: nombre("De finanzas") }] });
  const a = await alta(null, { p_cliente: { nombre: nombre("Anónimo") }, p_nuevos_beneficiarios: [{ nombre: nombre("Anónimo b") }] });
  comprobar("6. finanzas no registra membresías (42501) y no deja cliente", f.codigo === "42501" && (await contar(`clientes?nombre=eq.${enc(nombre("Finanzas"))}&select=id`)) === 0);
  comprobar("6. sin sesión: rechazado", denegado(a));
  const p1 = await rpc(operador, "guardar_plantilla_contrato", { p_contenido: "x" });
  const p2 = await rpc(finanzas, "vista_previa_contrato", { p_contenido: "x" });
  comprobar("6. operador no edita la plantilla y finanzas no usa la vista previa (42501)", p1.codigo === "42501" && p2.codigo === "42501");
}

// --- 7. Plantilla versionada: el contrato existente no cambia
{
  const desconocida = await rpc(admin, "guardar_plantilla_contrato", { p_contenido: "Hola {{cliente_nonbre}}" });
  const vacia = await rpc(admin, "guardar_plantilla_contrato", { p_contenido: "   " });
  comprobar("7. variable desconocida o texto vacío: rechazados (22023)", desconocida.codigo === "22023" && vacia.codigo === "22023",
    `${desconocida.mensaje} / ${vacia.mensaje}`);
  const previa = await rpc(admin, "vista_previa_contrato", { p_contenido: "Titular {{ cliente_nombre }}, {{precio_mensual}}" });
  comprobar("7. vista previa con datos de ejemplo y espacios dentro de las llaves", previa.datos === "Titular María Ejemplo López, L 800.00",
    JSON.stringify(previa.datos));

  const antes = await contrato(membresia1);
  const nueva = exigir(await rpc(admin, "guardar_plantilla_contrato", { p_contenido: `${MARCA} Versión de prueba para {{cliente_nombre}}.` }), "guardar");
  comprobar("7. guardar crea una versión nueva", nueva === plantillaOriginal.version + 1, String(nueva));
  const despues = await contrato(membresia1);
  comprobar("7. el contrato ya generado no cambia al cambiar la plantilla",
    despues.contenido === antes.contenido && despues.plantilla_version === antes.plantilla_version);
  const r = await alta(admin, { p_cliente: { nombre: nombre("Con versión nueva") }, p_nuevos_beneficiarios: [{ nombre: nombre("B versión nueva") }] });
  const c = await contrato(r.datos);
  comprobar("7. una membresía nueva usa la versión nueva", c?.plantilla_version === nueva && c.contenido === `${MARCA} Versión de prueba para ${nombre("Con versión nueva")}.`);
  // Restaurar el texto original como versión vigente.
  const restaurada = exigir(await rpc(admin, "guardar_plantilla_contrato", { p_contenido: plantillaOriginal.contenido }), "restaurar");
  const vigente = (await leer(admin, "plantillas_contrato?select=version,contenido&order=version.desc&limit=1"))[0];
  comprobar("7. se restauró el texto original como versión vigente", vigente.version === restaurada && vigente.contenido === plantillaOriginal.contenido);
}

// --- 8. Generar contrato para una membresía antigua y agregar beneficiario nuevo
{
  const cliente = exigir(await api(operador.token, "POST", "clientes", { nombre: nombre("Membresía antigua") }), "cliente")[0].id;
  const beneficiario = exigir(await api(operador.token, "POST", "beneficiarios", { nombre: nombre("Beneficiario antiguo") }), "beneficiario")[0].id;
  const antigua = exigir(await rpc(admin, "registrar_membresia", {
    p_idempotencia: randomUUID(), p_cliente_id: cliente, p_plan_id: plan, p_fecha_inicio: hoy, p_beneficiarios: [beneficiario],
  }), "membresía antigua");
  comprobar("8. una membresía registrada con la función anterior no tiene contrato", (await contrato(antigua)) === undefined);
  const f = await rpc(finanzas, "generar_contrato_membresia", { p_membresia_id: antigua });
  const g1 = await rpc(operador, "generar_contrato_membresia", { p_membresia_id: antigua });
  const g2 = await rpc(operador, "generar_contrato_membresia", { p_membresia_id: antigua });
  comprobar("8. generar contrato: finanzas no puede; el operador lo genera una sola vez", f.codigo === "42501" && g1.estado === 200 && g1.datos === g2.datos);

  const clave = randomUUID();
  const args = { p_idempotencia: clave, p_membresia_id: antigua, p_beneficiario: { nombre: nombre("Agregado en el detalle"), telefono: "9999-0002" } };
  const a1 = await rpc(operador, "agregar_beneficiario_nuevo_membresia", args);
  const a2 = await rpc(operador, "agregar_beneficiario_nuevo_membresia", args);
  const af = await rpc(finanzas, "agregar_beneficiario_nuevo_membresia", { ...args, p_idempotencia: randomUUID() });
  comprobar("8. beneficiario nuevo desde el detalle: creado y vinculado una sola vez; finanzas no puede",
    a1.estado === 200 && a1.datos === a2.datos && af.codigo === "42501" && (await vinculos(antigua)).length === 2 &&
      (await contar(`beneficiarios?nombre=eq.${enc(nombre("Agregado en el detalle"))}&select=id`)) === 1, `${a1.mensaje ?? ""}`);
}

// --- 9. RLS e inmutabilidad de las tablas nuevas
{
  const anon1 = await api(null, "GET", "plantillas_contrato?select=id&limit=1");
  const anon2 = await api(null, "GET", "contratos_membresia?select=id&limit=1");
  comprobar("9. sin sesión no se leen plantillas ni contratos", denegado(anon1) && denegado(anon2));
  const lecturaOperador = await leer(operador, "contratos_membresia?select=id&limit=1");
  comprobar("9. el operador consulta contratos", Array.isArray(lecturaOperador) && lecturaOperador.length === 1);
  const ins1 = await api(admin.token, "POST", "plantillas_contrato", { version: 999, contenido: "x" });
  const ins2 = await api(admin.token, "POST", "contratos_membresia", { membresia_id: membresia1, plantilla_version: 1, contenido: "x", datos: {} });
  const upd = await api(admin.token, "PATCH", `contratos_membresia?membresia_id=eq.${membresia1}`, { contenido: "alterado" });
  const del = await api(admin.token, "DELETE", `contratos_membresia?membresia_id=eq.${membresia1}`);
  const intacto = await contrato(membresia1);
  comprobar("9. nadie escribe, modifica ni borra plantillas o contratos por la API (ni el administrador)",
    denegado(ins1) && denegado(ins2) && (denegado(upd) || (Array.isArray(upd.datos) && upd.datos.length === 0)) &&
      (denegado(del) || (Array.isArray(del.datos) && del.datos.length === 0)) && intacto && intacto.contenido !== "alterado",
    [ins1.estado, ins2.estado, upd.estado, del.estado].join());
}

terminar();
