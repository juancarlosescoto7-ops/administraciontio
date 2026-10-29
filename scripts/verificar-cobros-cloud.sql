-- Ejecutar por Supabase MCP EXCLUSIVAMENTE en cgohbizokewvivxmvbij (desarrollo).
-- Prueba de PostgreSQL real; no sustituye Auth, PostgREST ni concurrencia.
-- Todos los usuarios y datos ficticios se revierten, también al fallar un ASSERT.
begin;
set local statement_timeout = '30s';
do $$
declare
  v_id uuid;
  v_rol text;
begin
  foreach v_rol in array array['administrador', 'operador', 'finanzas', 'inactivo'] loop
    v_id := gen_random_uuid();
    insert into auth.users(id, email) values (v_id, v_id::text || '@example.invalid');
    update public.perfiles
    set rol = (case when v_rol = 'inactivo' then 'operador' else v_rol end)::public.rol_usuario,
        activo = v_rol <> 'inactivo'
    where id = v_id;
    perform set_config('prueba.' || v_rol, v_id::text, true);
  end loop;
end $$;
set local role authenticated;
do $$
declare
  v_cliente uuid;
  v_otro uuid;
  v_caja uuid;
  v_enero uuid;
  v_febrero uuid;
  v_marzo uuid;
  v_ajeno uuid;
  v_anulado uuid;
  v_pago uuid;
  v_pago2 uuid;
  v_anticipo uuid;
  v_decimal uuid;
  v_clave uuid := gen_random_uuid();
  v_hoy date := (now() at time zone 'America/Tegucigalpa')::date;
  v_antes bigint;
begin
  perform set_config('request.jwt.claim.sub', current_setting('prueba.administrador'), true);
  insert into public.clientes(nombre) values ('[PRUEBA FIFO ROLLBACK] Principal') returning id into v_cliente;
  insert into public.clientes(nombre) values ('[PRUEBA FIFO ROLLBACK] Otro') returning id into v_otro;
  insert into public.cuentas_dinero(nombre, tipo) values ('[PRUEBA FIFO ROLLBACK] Caja', 'caja') returning id into v_caja;
  v_marzo := public.registrar_cargo(gen_random_uuid(), v_cliente, '4100', 'Marzo', '2026-03-01', null, 1200);
  v_enero := public.registrar_cargo(gen_random_uuid(), v_cliente, '4100', 'Enero', '2026-01-01', null, 400);
  v_febrero := public.registrar_cargo(gen_random_uuid(), v_cliente, '4100', 'Febrero', '2026-02-01', null, 600);
  v_ajeno := public.registrar_cargo(gen_random_uuid(), v_otro, '4100', 'Ajeno', '2025-01-01', null, 50);
  v_anulado := public.registrar_cargo(gen_random_uuid(), v_cliente, '4100', 'Anulado', '2025-01-01', null, 99);
  perform public.anular_cargo(v_anulado, '[PRUEBA FIFO ROLLBACK] Anulación');

  perform set_config('request.jwt.claim.sub', current_setting('prueba.operador'), true);
  v_pago := public.registrar_cobro_automatico(v_clave, v_cliente, v_caja, v_hoy, 'efectivo', null, 1200);
  assert (select pendiente = 0 from public.saldos_cargos where id = v_enero), '01: prioridad enero';
  assert (select pendiente = 0 from public.saldos_cargos where id = v_febrero), '02: prioridad febrero';
  assert (select pendiente = 1000 from public.saldos_cargos where id = v_marzo), '03: parcial marzo sin coincidencia de monto';
  assert (select pendiente = 50 from public.saldos_cargos where id = v_ajeno), '04: aislamiento';
  assert not exists(select 1 from public.aplicaciones_cobro where cargo_id = v_anulado), '05: omitir anulado';
  assert public.registrar_cobro_automatico(v_clave, v_cliente, v_caja, v_hoy, 'efectivo', null, 1200) = v_pago, '06: reintento';
  assert (select count(*) = 3 from public.aplicaciones_cobro where cobro_id = v_pago), '07: no duplicados';

  perform set_config('request.jwt.claim.sub', current_setting('prueba.finanzas'), true);
  v_pago2 := public.registrar_cobro_automatico(gen_random_uuid(), v_cliente, v_caja, v_hoy, 'efectivo', null, 1100);
  assert (select pendiente = 0 from public.saldos_cargos where id = v_marzo), '08: saldo restante';
  assert (select disponible = 100 from public.saldos_cobros where id = v_pago2), '09: excedente';
  assert (select count(*) = 1 from public.movimientos_dinero where origen_id = v_pago), '10: entrada única';
  assert (select sum(monto_con_signo) = 2300 from public.movimientos_dinero where cuenta_dinero_id = v_caja), '11: caja no duplicada';

  perform set_config('request.jwt.claim.sub', current_setting('prueba.administrador'), true);
  insert into public.clientes(nombre) values ('[PRUEBA FIFO ROLLBACK] Anticipo') returning id into v_otro;
  v_anticipo := public.registrar_cobro_automatico(gen_random_uuid(), v_otro, v_caja, v_hoy, 'efectivo', null, 10);
  assert (select disponible = 10 from public.saldos_cobros where id = v_anticipo), '12: sin deuda';
  v_decimal := public.registrar_cargo(gen_random_uuid(), v_otro, '4100', 'Centavos', '2026-01-01', null, 0.30);
  perform public.registrar_cobro_automatico(gen_random_uuid(), v_otro, v_caja, v_hoy, 'efectivo', null, 0.10);
  assert (select pendiente = 0.20 from public.saldos_cargos where id = v_decimal), '13: centavos';
  assert (select disponible = 10 from public.saldos_cobros where id = v_anticipo), '14: anticipo anterior intacto';
  select count(*) into v_antes from public.cobros_cliente;
  begin
    perform public.registrar_cobro(gen_random_uuid(), v_otro, v_caja, v_hoy, 'efectivo', null, 1,
      jsonb_build_array(jsonb_build_object('cargo_id', v_decimal, 'monto', 1)));
    raise exception '15: aceptó reparto manual';
  exception when sqlstate '22023' then null;
  end;
  assert (select count(*) = v_antes from public.cobros_cliente), '16: rechazo atómico';
  perform public.reversar_cobro(v_pago, '[PRUEBA FIFO ROLLBACK] Reverso');
  assert (select pendiente = 400 from public.saldos_cargos where id = v_enero), '17: reverso enero';
  assert (select pendiente = 600 from public.saldos_cargos where id = v_febrero), '18: reverso febrero';
  assert (select pendiente = 200 from public.saldos_cargos where id = v_marzo), '19: reverso marzo';
  assert public.registrar_cobro_automatico(v_clave, v_cliente, v_caja, v_hoy, 'efectivo', null, 1200) = v_pago, '20: reintento reversado';
  assert (select pendiente = 400 from public.saldos_cargos where id = v_enero), '21: reintento no reaplica';
  set constraints all immediate;
  assert not exists(select a.id from public.asientos a join public.lineas_asiento l on l.asiento_id = a.id group by a.id having sum(l.debe) <> sum(l.haber)), '22: partida doble';
  assert not exists(select 1 from public.saldos_cargos where pendiente < 0), '23: cargo no sobreaplicado';
  assert not exists(select 1 from public.saldos_cobros where disponible < 0), '24: cobro no sobreaplicado';
  perform set_config('request.jwt.claim.sub', current_setting('prueba.inactivo'), true);
  begin
    perform public.registrar_cobro_automatico(gen_random_uuid(), v_cliente, v_caja, v_hoy, 'efectivo', null, 1);
    raise exception '25: inactivo autorizado';
  exception when insufficient_privilege then null;
  end;
  assert not exists(select 1 from public.cargos_cliente), '26: RLS inactivo';
  perform set_config('request.jwt.claim.sub', current_setting('prueba.operador'), true);
  begin
    insert into public.aplicaciones_cobro(cobro_id, cargo_id, cliente_id, monto, fecha, operacion_id)
    values (v_pago2, v_enero, v_cliente, 1, v_hoy, gen_random_uuid());
    raise exception '27: escritura directa autorizada';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role anon;
do $$
begin
  begin
    perform public.registrar_cobro_automatico(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), current_date, 'efectivo', null, 1);
    raise exception '28: anon autorizado';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
select '28/28 comprobaciones PostgreSQL Cloud; transacción revertida' as resultado;
