// PostgreSQL temporal en memoria, sin Docker ni conexión a datos del usuario.
// Preparación (dependencia aislada e ignorada por Git):
// npm install --prefix supabase/.temp/pruebas-cobros @electric-sql/pglite@0.5.13
// node scripts/verificar-cobros-automaticos.mjs
// Ejecuta las migraciones reales E1/E2 y la del ajuste; solo emula auth.uid()
// y auth.users. No sustituye la verificación de concurrencia en Supabase Cloud.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "../supabase/.temp/pruebas-cobros/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
let comprobaciones = 0;
function igual(actual, esperado, nombre) {
  assert.deepEqual(actual, esperado, nombre);
  console.log(`OK ${++comprobaciones}. ${nombre}`);
}
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) => Object.values((await query(sql, args))[0])[0];
async function rechaza(operacion, codigo, nombre) {
  await assert.rejects(operacion, (error) => error.code === codigo, nombre);
  console.log(`OK ${++comprobaciones}. ${nombre}`);
}
const rpc = async (nombre, args) => scalar(
  `select public.${nombre}(${args.map((_, i) => `$${i + 1}`).join(",")})`, args,
);
const hoy = "2026-10-28";
const claveHistorica = randomUUID();
const admin = randomUUID();
const operador = randomUUID();
const finanzas = randomUUID();
const inactivo = randomUUID();
const sesion = async (id, rol = "authenticated") => {
  await db.exec("reset role");
  await query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  await db.exec(`set role ${rol}`);
};

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const archivo of readdirSync("supabase/migrations").filter((n) => /_e[12]_/.test(n)).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${archivo}`, "utf8"));
  }
  for (const [id, rol, activo] of [[admin, "administrador", true], [operador, "operador", true], [finanzas, "finanzas", true], [inactivo, "operador", false]]) {
    await query("insert into auth.users(id, email) values ($1, $2)", [id, `${rol}-${id}@example.invalid`]);
    await query("update public.perfiles set rol = $2, activo = $3 where id = $1", [id, rol, activo]);
  }
  await sesion(admin);
  const caja = await scalar("insert into public.cuentas_dinero(nombre, tipo) values ('[PRUEBA FIFO] Caja', 'caja') returning id");
  const cliente = async () => scalar("insert into public.clientes(nombre) values ('[PRUEBA FIFO] Cliente') returning id");
  const cargo = async (clienteId, monto, fecha) => rpc("registrar_cargo", [randomUUID(), clienteId, "4100", "[PRUEBA FIFO] Cuota", fecha, null, monto]);
  const cobro = async (clienteId, monto, clave = randomUUID(), aplicaciones) => rpc(aplicaciones === undefined ? "registrar_cobro_automatico" : "registrar_cobro", [clave, clienteId, caja, hoy, "efectivo", null, monto, ...(aplicaciones === undefined ? [] : [JSON.stringify(aplicaciones)])]);
  const pendiente = async (id) => scalar("select pendiente::text from public.saldos_cargos where id = $1", [id]);
  const disponible = async (id) => scalar("select disponible::text from public.saldos_cobros where id = $1", [id]);

  const historico = await cliente();
  const cargoHistorico = await cargo(historico, "100.00", "2026-01-01");
  const aplicacionesHistoricas = [{ cargo_id: cargoHistorico, monto: "40.00" }];
  const cobroHistorico = await cobro(historico, "80.00", claveHistorica, aplicacionesHistoricas);
  await rechaza(() => cobro(historico, "1.00"), "42883", "sin migración, la UI nueva no registra cobros manuales accidentalmente");
  await db.exec("reset role");
  await db.exec(readFileSync("supabase/migrations/20261029011014_cobros_automaticos_antiguedad.sql", "utf8"));
  await sesion(admin);
  igual(await pendiente(cargoHistorico), "60.00", "la migración no redistribuye cobros anteriores");
  igual(await cobro(historico, "80.00", claveHistorica, aplicacionesHistoricas), cobroHistorico, "reintento histórico conserva identificador y distribución");

  const c = await cliente();
  // Creación desordenada; el pago de 1,200 coincide con el tercero, pero
  // debe empezar por enero y febrero, que suman 1,000.
  const tercero = await cargo(c, "1200.00", "2026-03-01");
  const primero = await cargo(c, "400.00", "2026-01-01");
  const segundo = await cargo(c, "600.00", "2026-02-01");
  const otro = await cliente();
  const ajeno = await cargo(otro, "50.00", "2025-01-01");
  const anulado = await cargo(c, "99.00", "2025-01-01");
  await rpc("anular_cargo", [anulado, "[PRUEBA FIFO] Anulación"]);
  const clave = randomUUID();
  await sesion(operador);
  const pago = await cobro(c, "1200.00", clave);
  igual(await Promise.all([pendiente(primero), pendiente(segundo), pendiente(tercero)]), ["0.00", "0.00", "1000.00"], "operador: antigüedad obligatoria, sin coincidencias, con abono parcial");
  igual(await pendiente(ajeno), "50.00", "no toca cargos de otro cliente");
  igual(await scalar("select count(*)::int from public.aplicaciones_cobro where cargo_id = $1", [anulado]), 0, "omite cargos anulados");
  igual(await cobro(c, "1200.00", clave), pago, "reintento devuelve el mismo cobro");
  igual(await scalar("select count(*)::int from public.aplicaciones_cobro where cobro_id = $1", [pago]), 3, "reintento no duplica aplicaciones");
  await rechaza(() => cobro(c, "1201.00", clave), "22023", "rechaza reintento con otro importe");
  await sesion(finanzas);
  const segundoPago = await cobro(c, "1100.00");
  igual(await pendiente(tercero), "0.00", "finanzas: siguiente pago solo cubre el saldo restante");
  igual(await disponible(segundoPago), "100.00", "exceso sobre deuda queda como saldo a favor");
  await sesion(admin);
  igual(await scalar("select count(*)::int from public.movimientos_dinero where origen_id = $1", [pago]), 1, "una sola entrada de dinero por cobro");
  igual(await scalar("select sum(monto_con_signo)::text from public.movimientos_dinero where origen_id in ($1, $2)", [pago, segundoPago]), "2300.00", "aplicaciones no duplican caja");

  const sinDeuda = await cliente();
  const anticipo = await cobro(sinDeuda, "10.00");
  igual(await disponible(anticipo), "10.00", "sin deuda, todo queda como anticipo");
  const decimal = await cargo(sinDeuda, "0.30", "2026-01-01");
  await cobro(sinDeuda, "0.10");
  igual(await pendiente(decimal), "0.20", "centavos exactos y no consume anticipos previos");
  await cobro(sinDeuda, "0.20");
  igual(await pendiente(decimal), "0.00", "segundo abono termina de liquidar la cuota");

  const empate = await cliente();
  const empate1 = await cargo(empate, "10.00", "2026-01-01");
  const empate2 = await cargo(empate, "20.00", "2026-01-01");
  await cobro(empate, "15.00");
  igual(await Promise.all([pendiente(empate1), pendiente(empate2)]), ["0.00", "15.00"], "igual fecha: primero el creado antes");
  const empateTotal = await cliente();
  await db.exec("begin");
  const ids = [await cargo(empateTotal, "10.00", "2026-01-01"), await cargo(empateTotal, "10.00", "2026-01-01")].sort();
  await db.exec("commit");
  await cobro(empateTotal, "5.00");
  igual(await Promise.all(ids.map(pendiente)), ["5.00", "10.00"], "igual fecha y creación: desempate estable por UUID");

  const antes = await scalar("select count(*)::int from public.cobros_cliente");
  await rechaza(() => cobro(empate, "1.00", randomUUID(), [{ cargo_id: empate2, monto: 1 }]), "22023", "la API rechaza saltarse el orden mediante distribución manual");
  igual(await scalar("select count(*)::int from public.cobros_cliente"), antes, "fallo revierte el cobro completo");
  await rechaza(() => cobro(empate, "0.001"), "22023", "rechaza fracciones de centavo");
  await rechaza(() => cobro(empate, "0"), "22023", "rechaza importe cero");

  // Falla después de una primera aplicación: se revierte TODO, no solo la fila.
  const fallo = await cliente();
  const fallo1 = await cargo(fallo, "10.00", "2026-01-01");
  const fallo2 = await cargo(fallo, "20.00", "2026-02-01");
  await query("select set_config('prueba.cargo_fallido', $1, false)", [fallo2]);
  await db.exec(`reset role;
    create function pg_temp.fallar_aplicacion() returns trigger language plpgsql as $$
    begin
      if new.cargo_id::text = current_setting('prueba.cargo_fallido', true) then
        raise exception 'Fallo inducido solo en pruebas' using errcode = '22023';
      end if;
      return new;
    end $$;
    create trigger prueba_fallo before insert on public.aplicaciones_cobro
      for each row execute function pg_temp.fallar_aplicacion();
  `);
  await sesion(admin);
  await rechaza(() => cobro(fallo, "15.00"), "22023", "falla inducida en la segunda aplicación");
  igual(await Promise.all([pendiente(fallo1), pendiente(fallo2)]), ["10.00", "20.00"], "fallo intermedio revierte también la primera aplicación");
  igual(await scalar("select count(*)::int from public.cobros_cliente where cliente_id = $1", [fallo]), 0, "fallo intermedio no deja cobro ni su dinero");
  await db.exec("reset role; drop trigger prueba_fallo on public.aplicaciones_cobro;");
  await sesion(admin);

  await rpc("reversar_cobro", [pago, "[PRUEBA FIFO] Corrección"]);
  igual(await Promise.all([pendiente(primero), pendiente(segundo), pendiente(tercero)]), ["400.00", "600.00", "200.00"], "reverso restaura cada cuota afectada");
  igual(await cobro(c, "1200.00", clave), pago, "reintento de un cobro reversado no vuelve a aplicar");
  igual(await pendiente(primero), "400.00", "reintento reversado conserva la deuda restaurada");
  igual(await scalar(`select count(*)::int from (
    select a.id from public.asientos a join public.lineas_asiento l on l.asiento_id = a.id
    group by a.id having sum(l.debe) <> sum(l.haber)
  ) d`), 0, "todos los asientos, incluidas aplicaciones y reversos, balancean");
  igual(await scalar("select count(*)::int from public.saldos_cargos where pendiente < 0"), 0, "ningún cargo sobreaplicado");
  igual(await scalar("select count(*)::int from public.saldos_cobros where disponible < 0"), 0, "ningún cobro sobreaplicado");

  await sesion(inactivo);
  await rechaza(() => cobro(c, "1.00"), "42501", "perfil inactivo no cobra");
  igual(await scalar("select count(*)::int from public.cargos_cliente"), 0, "RLS oculta cargos al perfil inactivo");
  await sesion(null, "anon");
  await rechaza(() => cobro(c, "1.00"), "42501", "anon no ejecuta la función");
  await sesion(operador);
  await rechaza(() => query("insert into public.aplicaciones_cobro(cobro_id, cargo_id, cliente_id, monto, fecha, operacion_id) values ($1,$2,$3,1,$4,$5)", [segundoPago, primero, c, hoy, randomUUID()]), "42501", "operador no inserta aplicaciones directamente");
  console.log(`\n${comprobaciones}/${comprobaciones} comprobaciones PostgreSQL correctas.`);
} finally {
  await db.close();
}
