-- Solo Supabase desarrollo cgohbizokewvivxmvbij. Datos ficticios con ROLLBACK.
begin;
set local statement_timeout='30s';
do $$ declare v_id uuid; v_rol text; begin
  foreach v_rol in array array['administrador','operador','finanzas'] loop
    v_id:=gen_random_uuid();
    insert into auth.users(id,email) values(v_id,v_id::text||'@example.invalid');
    update public.perfiles set rol=v_rol::public.rol_usuario,activo=true where id=v_id;
    perform set_config('prueba.'||v_rol,v_id::text,true);
  end loop;
end $$;
set local role authenticated;
do $$
declare
  c uuid; b uuid; p uuid; m uuid; t uuid; a uuid; tr uuid; veh uuid; cho uuid;
  g uuid; cat uuid; k uuid:=gen_random_uuid(); cuenta uuid; pago jsonb; r record;
  v_hoy date:=(now() at time zone 'America/Tegucigalpa')::date;
begin
  perform set_config('request.jwt.claim.sub',current_setting('prueba.administrador'),true);
  insert into public.clientes(nombre) values('[PRUEBA CAMBIOS ROLLBACK]') returning id into c;
  insert into public.beneficiarios(nombre) values('[PRUEBA CAMBIOS ROLLBACK]') returning id into b;
  insert into public.planes(nombre,precio_mensual,cupo_mensual,modalidad_cupo,dias_gracia)
    values('[PRUEBA CAMBIOS ROLLBACK]',100,2,'compartido',365) returning id into p;
  select id into cat from public.categorias_gasto where activo limit 1;
  m:=public.registrar_membresia(gen_random_uuid(),c,p,'2027-01-31',array[b],'{"fecha_fin":"2027-03-30"}');
  assert (select fecha_fin='2027-03-30' from public.membresias where id=m), '01 guardar fin';
  begin
    perform public.establecer_vencimiento_membresia(m,'2027-03-15','Prueba');
    raise exception '02 aceptó corte parcial';
  exception when sqlstate '22023' then null; end;
  perform public.establecer_vencimiento_membresia(m,'2027-02-27','Prueba fin febrero');
  assert (select fecha_fin='2027-02-27' from public.membresias where id=m), '03 aniversario 31';
  select * into r from public.consultar_cobertura(m,b,'2027-02-28');
  assert not r.cubierto and r.motivo like '%vencido%', '04 cobertura posterior';
  select * into r from public.prever_cobertura(m,b,'2027-02-28 12:00:00-06');
  assert r.condicion='no_valida', '05 reserva posterior no cubierta';

  perform set_config('request.jwt.claim.sub',current_setting('prueba.operador'),true);
  begin
    perform public.establecer_vencimiento_membresia(m,'2027-03-30','Prueba');
    raise exception '06 operador cambió fin';
  exception when insufficient_privilege then null; end;
  begin
    perform public.registrar_membresia(gen_random_uuid(),c,p,'2027-01-31',array[b],'{"fecha_fin":"2027-03-30"}');
    raise exception '07 operador pactó fin';
  exception when insufficient_privilege then null; end;
  t:=public.registrar_transporte(gen_random_uuid(),c,'2027-05-01 08:00-06',4320,'Origen','Destino',null,1500,null);
  assert (select minutos_estimados=4320 from public.transportes where id=t), '08 viaje 3 días';
  perform public.reprogramar_transporte(t,'2027-05-02 08:00-06',7200,'Cinco días');
  assert (select minutos_estimados=7200 from public.transportes where id=t), '09 reprogramar 5 días';
  perform set_config('request.jwt.claim.sub',current_setting('prueba.administrador'),true);
  insert into public.vehiculos(codigo,tipo) values('PRUEBA-'||upper(left(gen_random_uuid()::text,8)),'mixto') returning id into veh;
  insert into public.conductores(nombre) values('[PRUEBA CAMBIOS ROLLBACK]') returning id into cho;
  a:=public.registrar_alquiler(gen_random_uuid(),c,veh,'2027-05-04 08:00-06','2027-05-06 08:00-06',null,1000,null);
  begin
    perform public.asignar_recursos_transporte(t,veh,cho,'Prueba solapamiento');
    raise exception '22 solapamiento de varios días permitido';
  exception when sqlstate '22023' then null; end;
  tr:=public.registrar_traslado(gen_random_uuid(),'particular',c,null,null,null,'2027-06-01 08:00-06',2880,'Origen','Destino',null,500,null,null);

  insert into public.cuentas_dinero(nombre,tipo) values('[PRUEBA CAMBIOS ROLLBACK]','caja') returning id into cuenta;
  perform set_config('request.jwt.claim.sub',current_setting('prueba.finanzas'),true);
  pago:=jsonb_build_object('cuenta_dinero_id',cuenta,'metodo','efectivo','monto',300);
  g:=public.registrar_gasto_servicio(k,null,cat,'transportes',v_hoy,null,'Combustible',800,null,pago,'transporte',t);
  assert (select transporte_id=t from public.gastos_servicio where gasto_id=g), '10 vínculo gasto';
  assert public.registrar_gasto_servicio(k,null,cat,'transportes',v_hoy,null,'Combustible',800,null,pago,'transporte',t)=g, '11 reintento';
  assert (select count(*)=1 from public.asientos where origen_id=g), '12 asiento único';
  assert (select pagado=300 and pendiente=500 from public.saldos_gastos where id=g), '36 gasto 800 abono 300 saldo 500';
  assert (select count(*)=1 from public.pagos_gasto where gasto_id=g), '37 pago no duplicado';
  assert (select sum(monto_con_signo)=-300 from public.movimientos_dinero where cuenta_dinero_id=cuenta), '38 egreso único';
  begin
    perform public.registrar_gasto_servicio(k,null,cat,'ambulancias',v_hoy,null,'Combustible',800,null,null,'membresia',m);
    raise exception '13 reintento cambió servicio';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_gasto_servicio(gen_random_uuid(),null,cat,'general',v_hoy,null,'Prueba',50,null,null,'transporte',t);
    raise exception '14 actividad incorrecta';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_gasto_servicio(gen_random_uuid(),null,cat,'transportes',v_hoy,null,'Prueba',50,null,null,'transporte',gen_random_uuid());
    raise exception '15 servicio inexistente';
  exception when sqlstate '22023' then null; end;
  perform public.registrar_gasto_servicio(gen_random_uuid(),null,cat,'ambulancias',v_hoy,null,'Membresía',50,null,null,'membresia',m);
  perform public.registrar_gasto_servicio(gen_random_uuid(),null,cat,'alquileres',v_hoy,null,'Renta',50,null,null,'alquiler',a);
  perform public.registrar_gasto_servicio(gen_random_uuid(),null,cat,'ambulancias',v_hoy,null,'Traslado',50,null,null,'traslado',tr);
  assert (select count(*)=4 from public.gastos_servicio), '23 cuatro clases de servicio';
  perform set_config('request.jwt.claim.sub',current_setting('prueba.operador'),true);
  assert (select count(*)=0 from public.gastos_servicio), '16 RLS operador';
  begin
    perform public.registrar_gasto_servicio(gen_random_uuid(),null,cat,'transportes',v_hoy,null,'Prueba',50,null,null,'transporte',t);
    raise exception '17 operador registró gasto';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',current_setting('prueba.administrador'),true);
  begin
    insert into public.gastos_servicio(gasto_id,transporte_id) values(gen_random_uuid(),t);
    raise exception '18 escritura directa permitida';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare m uuid; c uuid; b uuid; p uuid; n integer; begin
  perform set_config('request.jwt.claim.sub',current_setting('prueba.administrador'),true);
  select id into c from public.clientes where nombre='[PRUEBA CAMBIOS ROLLBACK]';
  select id into b from public.beneficiarios where nombre='[PRUEBA CAMBIOS ROLLBACK]';
  select id into p from public.planes where nombre='[PRUEBA CAMBIOS ROLLBACK]';
  m:=public.registrar_membresia(gen_random_uuid(),c,p,'2020-01-31',array[b],'{"fecha_fin":"2020-03-30"}');
  select count(*) into n from public.periodos_membresia where membresia_id=m;
  perform public.actualizar_mensualidades(m);
  assert (select count(*)=n from public.periodos_membresia where membresia_id=m), '19 vencida no genera cuotas';
  assert not exists(select 1 from public.periodos_membresia where membresia_id=m and inicio>'2020-03-30'), '20 sin cuotas fuera contrato';
  assert not exists(select 1 from public.asientos a join public.lineas_asiento l on l.asiento_id=a.id group by a.id having sum(l.debe)<>sum(l.haber)), '21 libro balanceado';
end $$;
-- Reloj simulado dentro de la transacción; ROLLBACK restaura private.hoy.
create or replace function private.hoy() returns date language sql stable set search_path='' as $$ select date '2027-01-31' $$;
do $$ declare m uuid; c uuid; b uuid; p uuid; r record; begin
  select id into c from public.clientes where nombre='[PRUEBA CAMBIOS ROLLBACK]';
  select id into b from public.beneficiarios where nombre='[PRUEBA CAMBIOS ROLLBACK]';
  select id into p from public.planes where nombre='[PRUEBA CAMBIOS ROLLBACK]';
  m:=public.registrar_membresia(gen_random_uuid(),c,p,'2027-01-31',array[b],'{"fecha_fin":"2027-02-27"}');
  assert (select count(*)=1 from public.periodos_membresia where membresia_id=m), '24 primera cuota';
  perform set_config('prueba.membresia',m::text,true);
  select * into r from public.consultar_cobertura(m,b,'2027-02-27');
  assert r.cubierto, '25 último día incluido';
end $$;
create or replace function private.hoy() returns date language sql stable set search_path='' as $$ select date '2027-02-28' $$;
do $$ declare m uuid:=current_setting('prueba.membresia')::uuid; r record; begin
  perform public.actualizar_mensualidades(m);
  assert (select count(*)=1 from public.periodos_membresia where membresia_id=m), '26 no renueva después de vencer';
  assert (select pendiente=100 from public.saldos_membresias where id=m), '27 deuda conservada';
  select * into r from public.consultar_cobertura(m,(select beneficiario_id from public.membresia_beneficiarios where membresia_id=m limit 1),'2027-02-28');
  assert not r.cubierto, '28 cobertura vencida';
end $$;
create or replace function private.hoy() returns date language sql stable set search_path='' as $$ select date '2027-01-31' $$;
do $$ declare m uuid; c uuid; b uuid; p uuid; begin
  insert into public.clientes(nombre) values('[PRUEBA REACTIVACION ROLLBACK]') returning id into c;
  insert into public.beneficiarios(nombre) values('[PRUEBA REACTIVACION ROLLBACK]') returning id into b;
  insert into public.planes(nombre,precio_mensual,cupo_mensual,modalidad_cupo,dias_gracia)
    values('[PRUEBA REACTIVACION ROLLBACK]',100,2,'compartido',0) returning id into p;
  m:=public.registrar_membresia(gen_random_uuid(),c,p,'2027-01-31',array[b],'{"fecha_fin":"2027-05-30"}');
  perform set_config('prueba.reactivacion',m::text,true);
end $$;
create or replace function private.hoy() returns date language sql stable set search_path='' as $$ select date '2027-02-02' $$;
do $$ declare m uuid:=current_setting('prueba.reactivacion')::uuid; begin
  perform public.actualizar_mensualidades(m);
  assert (select estado='suspendida' from public.membresias where id=m), '29 suspensión';
end $$;
create or replace function private.hoy() returns date language sql stable set search_path='' as $$ select date '2027-04-15' $$;
do $$ declare m uuid:=current_setting('prueba.reactivacion')::uuid; c uuid; cuenta uuid; begin
  select cliente_id into c from public.membresias where id=m;
  insert into public.cuentas_dinero(nombre,tipo) values('[PRUEBA REACTIVACION ROLLBACK]','caja') returning id into cuenta;
  perform public.registrar_cobro_automatico(gen_random_uuid(),c,cuenta,'2027-04-15','efectivo',null,100);
  perform public.actualizar_mensualidades(m);
  assert (select dia_ancla=31 and fecha_fin='2027-05-30' and proxima_renovacion='2027-04-30' from public.membresias where id=m), '30 calendario y fin conservados';
  assert (select count(*)=2 from public.periodos_membresia where membresia_id=m), '31 no cobra meses suspendidos';
  assert exists(select 1 from public.periodos_membresia where membresia_id=m and inicio='2027-03-31' and fin='2027-04-29'), '32 ciclo original vigente';
  assert (select pendiente=100 from public.saldos_membresias where id=m), '33 cuota vigente completa';
  perform public.registrar_cobro_automatico(gen_random_uuid(),c,cuenta,'2027-04-15','efectivo',null,100);
  perform public.actualizar_mensualidades(m);
  perform public.actualizar_mensualidades(m);
  assert (select estado='activa' and dia_ancla=31 and fecha_fin='2027-05-30' from public.membresias where id=m), '34 reactiva sin extender';
  assert (select count(*)=2 from public.periodos_membresia where membresia_id=m), '35 no duplica cuotas';
end $$;
select '38 comprobaciones de servicio, vigencia, reactivación, idempotencia y permisos completadas' as resultado;
rollback;

