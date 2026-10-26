// Verifica RLS y permisos por rol contra la API REST real de Supabase (desarrollo).
// Uso: E2E_CREDENCIALES=/ruta/credenciales.env node scripts/verificar-rls.mjs
// Crea registros ficticios marcados con "[PRUEBA E1]". No elimina nada.
import { cargarEntorno, crearReporte, MARCA_PRUEBA } from "./comun.mjs";

const env = cargarEntorno();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const { comprobar, terminar } = crearReporte();
const sufijo = Date.now().toString(36).toUpperCase();

async function iniciarSesion(correo, clave) {
  const respuesta = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: CLAVE, "Content-Type": "application/json" },
    body: JSON.stringify({ email: correo, password: clave }),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) throw new Error(`No se pudo iniciar sesión con ${correo}: ${cuerpo.msg ?? respuesta.status}`);
  return { token: cuerpo.access_token, id: cuerpo.user.id };
}

async function api(token, metodo, ruta, cuerpo) {
  const respuesta = await fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    method: metodo,
    headers: {
      apikey: CLAVE,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  return { estado: respuesta.status, datos, codigo: datos?.code };
}

const denegado = (r) => r.estado === 401 || r.estado === 403 || r.codigo === "42501";
const TABLAS = [
  "perfiles", "bitacora", "clientes", "beneficiarios", "vehiculos", "conductores",
  "proveedores", "planes", "tarifas", "cuentas_dinero",
];

// 1. Sin sesión (solo clave publicable)
for (const tabla of TABLAS) {
  const r = await api(null, "GET", `${tabla}?select=*`);
  comprobar(`anon no lee ${tabla}`, denegado(r), `HTTP ${r.estado} ${JSON.stringify(r.datos)}`);
}
{
  const r = await api(null, "POST", "clientes", { nombre: `${MARCA_PRUEBA} anon` });
  comprobar("anon no inserta clientes", denegado(r), `HTTP ${r.estado}`);
  const rpc = await api(null, "POST", "rpc/actualizar_perfil", {
    p_id: "00000000-0000-0000-0000-000000000000", p_nombre: "x", p_rol: "administrador", p_activo: true,
  });
  comprobar("anon no ejecuta actualizar_perfil", denegado(rpc), `HTTP ${rpc.estado}`);
  const bootstrap = await api(null, "POST", "rpc/bootstrap_primer_administrador", { p_correo: "x", p_nombre: "x" });
  comprobar("bootstrap no está expuesto por la API", bootstrap.estado === 404 || denegado(bootstrap), `HTTP ${bootstrap.estado}`);
}

// 2. Sesiones
const admin = await iniciarSesion(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const operador = await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
const finanzas = await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
const inactivo = await iniciarSesion(env.E2E_INACTIVO_CORREO, env.E2E_INACTIVO_CLAVE);

// 3. El administrador asigna roles con el mecanismo seguro
{
  // El usuario "inactivo" nunca se activa: el intento sin motivo siempre implica un cambio.
  const sinMotivo = await api(admin.token, "POST", "rpc/actualizar_perfil", {
    p_id: inactivo.id, p_nombre: "Prueba Inactivo (ficticio)", p_rol: "operador", p_activo: true,
  });
  comprobar("cambiar estado sin motivo es rechazado", sinMotivo.codigo === "22023", JSON.stringify(sinMotivo.datos));

  for (const [usuario, nombre, rol] of [
    [operador, "Prueba Operador (ficticio)", "operador"],
    [finanzas, "Prueba Finanzas (ficticio)", "finanzas"],
  ]) {
    const r = await api(admin.token, "POST", "rpc/actualizar_perfil", {
      p_id: usuario.id, p_nombre: nombre, p_rol: rol, p_activo: true, p_motivo: "Usuario ficticio para pruebas de E1",
    });
    comprobar(`administrador activa a ${rol}`, r.estado === 204 || r.estado === 200, `HTTP ${r.estado} ${JSON.stringify(r.datos)}`);
  }
  const inactivoNombre = await api(admin.token, "POST", "rpc/actualizar_perfil", {
    p_id: inactivo.id, p_nombre: "Prueba Inactivo (ficticio)", p_rol: "operador", p_activo: false,
  });
  comprobar("administrador renombra sin cambiar acceso (sin motivo)", inactivoNombre.estado === 204, `HTTP ${inactivoNombre.estado}`);

  const propio = await api(admin.token, "POST", "rpc/actualizar_perfil", {
    p_id: admin.id, p_nombre: "Prueba Administrador (ficticio)", p_rol: "operador", p_activo: true, p_motivo: "intento",
  });
  comprobar("administrador no puede cambiar su propio rol", propio.codigo === "42501", JSON.stringify(propio.datos));
  const desactivarse = await api(admin.token, "POST", "rpc/actualizar_perfil", {
    p_id: admin.id, p_nombre: "Prueba Administrador (ficticio)", p_rol: "administrador", p_activo: false, p_motivo: "intento",
  });
  comprobar("administrador no puede desactivarse", desactivarse.codigo === "42501", JSON.stringify(desactivarse.datos));

  const perfiles = await api(admin.token, "GET", "perfiles?select=id");
  comprobar("administrador ve todos los perfiles", Array.isArray(perfiles.datos) && perfiles.datos.length >= 5, `${perfiles.datos?.length}`);
  const bitacora = await api(admin.token, "GET", `bitacora?select=accion,motivo&registro_id=eq.${operador.id}`);
  comprobar("el cambio de rol queda en la bitácora con motivo",
    Array.isArray(bitacora.datos) && bitacora.datos.some((e) => e.motivo === "Usuario ficticio para pruebas de E1"));
}

// 4. Usuario inactivo: sesión de Auth válida, pero sin datos
{
  const propio = await api(inactivo.token, "GET", "perfiles?select=id,activo");
  comprobar("inactivo solo ve su propio perfil (inactivo)",
    Array.isArray(propio.datos) && propio.datos.length === 1 && propio.datos[0].activo === false, JSON.stringify(propio.datos));
  const clientes = await api(inactivo.token, "GET", "clientes?select=id");
  comprobar("inactivo no ve clientes", Array.isArray(clientes.datos) && clientes.datos.length === 0, JSON.stringify(clientes.datos));
  const alta = await api(inactivo.token, "POST", "clientes", { nombre: `${MARCA_PRUEBA} inactivo` });
  comprobar("inactivo no registra clientes", denegado(alta), `HTTP ${alta.estado}`);
}

// 5. Operador
let clienteId;
{
  const alta = await api(operador.token, "POST", "clientes", {
    nombre: `${MARCA_PRUEBA} Cliente operador ${sufijo}`, tipo: "natural", creado_por: admin.id,
  });
  clienteId = alta.datos?.[0]?.id;
  comprobar("operador registra cliente", alta.estado === 201 && clienteId, `HTTP ${alta.estado} ${JSON.stringify(alta.datos)}`);
  comprobar("creado_por no se puede falsear (lo fija el trigger)", alta.datos?.[0]?.creado_por === operador.id);

  const edicion = await api(operador.token, "PATCH", `clientes?id=eq.${clienteId}`, { telefono: "9999-0000" });
  comprobar("operador edita cliente", edicion.estado === 200 && edicion.datos?.[0]?.telefono === "9999-0000", `HTTP ${edicion.estado}`);

  const borrar = await api(operador.token, "DELETE", `clientes?id=eq.${clienteId}`);
  comprobar("nadie borra clientes (sin privilegio DELETE)", denegado(borrar), `HTTP ${borrar.estado}`);

  const vehiculo = await api(operador.token, "POST", "vehiculos", {
    codigo: `PRB-OP-${sufijo}`, tipo: "ambulancia", estado: "operativo",
  });
  comprobar("operador registra vehículo", vehiculo.estado === 201, `HTTP ${vehiculo.estado} ${JSON.stringify(vehiculo.datos)}`);

  const menor = await api(operador.token, "POST", "beneficiarios", {
    nombre: `${MARCA_PRUEBA} Beneficiario menor ${sufijo}`, fecha_nacimiento: "2020-02-29", tutor: `${MARCA_PRUEBA} Tutor`,
  });
  comprobar("operador registra beneficiario menor sin identidad",
    menor.estado === 201 && menor.datos?.[0]?.identificacion === null, JSON.stringify(menor.datos));
  const conductor = await api(operador.token, "POST", "conductores", { nombre: `${MARCA_PRUEBA} Conductor ${sufijo}` });
  comprobar("operador registra conductor", conductor.estado === 201, `HTTP ${conductor.estado}`);
  const conductorEdit = await api(operador.token, "PATCH", `conductores?id=eq.${conductor.datos?.[0]?.id}`, { activo: false });
  comprobar("operador inactiva conductor", conductorEdit.datos?.[0]?.activo === false);

  const plan = await api(operador.token, "POST", "planes", {
    nombre: `${MARCA_PRUEBA} plan operador`, precio_mensual: "1.00", cupo_mensual: 1, modalidad_cupo: "compartido", dias_gracia: 0,
  });
  comprobar("operador NO registra planes", denegado(plan), `HTTP ${plan.estado}`);
  const tarifa = await api(operador.token, "POST", "tarifas", {
    actividad: "alquileres", nombre: `${MARCA_PRUEBA} tarifa operador`, unidad: "dia", precio_base: "1.00",
  });
  comprobar("operador NO registra tarifas", denegado(tarifa), `HTTP ${tarifa.estado}`);
  const cuenta = await api(operador.token, "POST", "cuentas_dinero", { nombre: `${MARCA_PRUEBA} caja operador`, tipo: "caja" });
  comprobar("operador NO registra cuentas de dinero", denegado(cuenta), `HTTP ${cuenta.estado}`);

  const perfiles = await api(operador.token, "GET", "perfiles?select=id");
  comprobar("operador solo ve su perfil", perfiles.datos?.length === 1 && perfiles.datos[0].id === operador.id, JSON.stringify(perfiles.datos));
  const bitacora = await api(operador.token, "GET", "bitacora?select=id");
  comprobar("operador no ve la bitácora", Array.isArray(bitacora.datos) && bitacora.datos.length === 0);

  const autoRol = await api(operador.token, "PATCH", `perfiles?id=eq.${operador.id}`, { rol: "administrador" });
  comprobar("operador no puede cambiar su rol por UPDATE directo", denegado(autoRol), `HTTP ${autoRol.estado}`);
  const autoRpc = await api(operador.token, "POST", "rpc/actualizar_perfil", {
    p_id: operador.id, p_nombre: "x", p_rol: "administrador", p_activo: true, p_motivo: "intento",
  });
  comprobar("operador no puede cambiar su rol por la función", autoRpc.codigo === "42501", JSON.stringify(autoRpc.datos));
  const otroRpc = await api(operador.token, "POST", "rpc/actualizar_perfil", {
    p_id: finanzas.id, p_nombre: "x", p_rol: "administrador", p_activo: true, p_motivo: "intento",
  });
  comprobar("operador no puede cambiar el rol de otro", otroRpc.codigo === "42501", JSON.stringify(otroRpc.datos));
  const altaPerfil = await api(operador.token, "POST", "perfiles", { id: operador.id, nombre: "x", rol: "administrador", activo: true });
  comprobar("operador no puede insertar perfiles", denegado(altaPerfil), `HTTP ${altaPerfil.estado}`);
}

// 6. Finanzas
{
  const clientes = await api(finanzas.token, "GET", "clientes?select=id");
  comprobar("finanzas consulta clientes", Array.isArray(clientes.datos) && clientes.datos.length >= 1);
  const alta = await api(finanzas.token, "POST", "clientes", { nombre: `${MARCA_PRUEBA} finanzas` });
  comprobar("finanzas NO registra clientes", denegado(alta), `HTTP ${alta.estado}`);
  const edicion = await api(finanzas.token, "PATCH", `clientes?id=eq.${clienteId}`, { telefono: "0000" });
  comprobar("finanzas NO edita clientes (0 filas afectadas)", edicion.estado === 200 && edicion.datos?.length === 0, JSON.stringify(edicion.datos));
  const beneficiario = await api(finanzas.token, "POST", "beneficiarios", { nombre: `${MARCA_PRUEBA} finanzas` });
  comprobar("finanzas NO registra beneficiarios", denegado(beneficiario), `HTTP ${beneficiario.estado}`);
  const conductor = await api(finanzas.token, "POST", "conductores", { nombre: `${MARCA_PRUEBA} finanzas` });
  comprobar("finanzas NO registra conductores", denegado(conductor), `HTTP ${conductor.estado}`);
  const vehiculo = await api(finanzas.token, "POST", "vehiculos", { codigo: `PRB-FI-${sufijo}`, tipo: "mixto" });
  comprobar("finanzas NO registra vehículos", denegado(vehiculo), `HTTP ${vehiculo.estado}`);
  const proveedor = await api(finanzas.token, "POST", "proveedores", { nombre: `${MARCA_PRUEBA} Proveedor finanzas ${sufijo}` });
  comprobar("finanzas registra proveedores", proveedor.estado === 201, `HTTP ${proveedor.estado}`);
  const cuenta = await api(finanzas.token, "POST", "cuentas_dinero", { nombre: `${MARCA_PRUEBA} banco finanzas`, tipo: "banco" });
  comprobar("finanzas NO registra cuentas de dinero", denegado(cuenta), `HTTP ${cuenta.estado}`);
  const autoRpc = await api(finanzas.token, "POST", "rpc/actualizar_perfil", {
    p_id: finanzas.id, p_nombre: "x", p_rol: "administrador", p_activo: true, p_motivo: "intento",
  });
  comprobar("finanzas no puede cambiar su rol", autoRpc.codigo === "42501", JSON.stringify(autoRpc.datos));
}

// 7. Administrador: configuración sensible y restricciones de integridad
{
  const plan = await api(admin.token, "POST", "planes", {
    nombre: `${MARCA_PRUEBA} Plan ${sufijo}`, precio_mensual: "1234.56", cupo_mensual: 2, modalidad_cupo: "compartido", dias_gracia: 5,
  });
  comprobar("administrador registra plan (numeric exacto)", plan.estado === 201 && plan.datos?.[0]?.precio_mensual === 1234.56, JSON.stringify(plan.datos));
  const negativo = await api(admin.token, "POST", "planes", {
    nombre: `${MARCA_PRUEBA} negativo`, precio_mensual: "-1", cupo_mensual: 0, modalidad_cupo: "individual", dias_gracia: 0,
  });
  comprobar("precio negativo rechazado por CHECK", negativo.codigo === "23514", JSON.stringify(negativo.datos));
  const tarifaGeneral = await api(admin.token, "POST", "tarifas", {
    actividad: "general", nombre: `${MARCA_PRUEBA} general`, unidad: "servicio", precio_base: "1.00",
  });
  comprobar("tarifa con actividad 'general' rechazada", tarifaGeneral.codigo === "23514", JSON.stringify(tarifaGeneral.datos));
  const tarifa = await api(admin.token, "POST", "tarifas", {
    actividad: "alquileres", nombre: `${MARCA_PRUEBA} Tarifa diaria ${sufijo}`, unidad: "dia", precio_base: "800.00",
  });
  comprobar("administrador registra tarifa", tarifa.estado === 201, `HTTP ${tarifa.estado}`);
  const cuenta = await api(admin.token, "POST", "cuentas_dinero", { nombre: `${MARCA_PRUEBA} Caja ${sufijo}`, tipo: "caja" });
  comprobar("administrador registra cuenta de dinero", cuenta.estado === 201, `HTTP ${cuenta.estado}`);

  const placa = `PRB${sufijo}`.slice(0, 20);
  const v1 = await api(admin.token, "POST", "vehiculos", { codigo: `PRB-AD-${sufijo}`, placa, tipo: "alquiler" });
  comprobar("administrador registra vehículo con placa", v1.estado === 201, JSON.stringify(v1.datos));
  const codigoRepetido = await api(admin.token, "POST", "vehiculos", { codigo: `PRB-AD-${sufijo}`, tipo: "alquiler" });
  comprobar("código de vehículo duplicado rechazado", codigoRepetido.codigo === "23505", JSON.stringify(codigoRepetido.datos));
  const placaRepetida = await api(admin.token, "POST", "vehiculos", { codigo: `PRB-AD2-${sufijo}`, placa, tipo: "alquiler" });
  comprobar("placa duplicada rechazada", placaRepetida.codigo === "23505", JSON.stringify(placaRepetida.datos));
  const sinPlaca1 = await api(admin.token, "POST", "vehiculos", { codigo: `PRB-SP1-${sufijo}`, tipo: "transporte" });
  const sinPlaca2 = await api(admin.token, "POST", "vehiculos", { codigo: `PRB-SP2-${sufijo}`, tipo: "transporte" });
  comprobar("varios vehículos sin placa permitidos", sinPlaca1.estado === 201 && sinPlaca2.estado === 201);
  const minusculas = await api(admin.token, "POST", "vehiculos", { codigo: "prb-minusculas", tipo: "mixto" });
  comprobar("código no normalizado rechazado por CHECK", minusculas.codigo === "23514", JSON.stringify(minusculas.datos));

  const inactivar = await api(admin.token, "PATCH", `vehiculos?id=eq.${v1.datos?.[0]?.id}`, { activo: false, estado: "mantenimiento" });
  comprobar("administrador inactiva vehículo", inactivar.datos?.[0]?.activo === false && inactivar.datos?.[0]?.actualizado_por === admin.id);
}

terminar();
