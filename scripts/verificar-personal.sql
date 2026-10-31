-- Datos ficticios, sin persistencia; ejecutable en desarrollo o PostgreSQL temporal.
begin;
set local statement_timeout='30s';
do $$ declare u uuid; r text; begin
  foreach r in array array['administrador','operador','finanzas'] loop
    u:=gen_random_uuid();
    insert into auth.users(id,email) values(u,u::text||'@example.invalid');
    update public.perfiles set rol=r::public.rol_usuario,activo=true where id=u;
    perform set_config('prueba.'||r,u::text,true);
  end loop;
end $$;
set local role authenticated;
do $$
declare e uuid; d uuid; cat uuid; otro uuid; cuenta uuid; g uuid; g2 uuid; c uuid; t uuid;
  k uuid:=gen_random_uuid(); pago jsonb; hoy date:=(now() at time zone 'America/Tegucigalpa')::date;
begin
  perform set_config('request.jwt.claim.sub',current_setting('prueba.administrador'),true);
  insert into public.conductores(nombre) values('Conductor ficticio') returning id into d;
  insert into public.clientes(nombre) values('Cliente ficticio') returning id into c;
  insert into public.cuentas_dinero(nombre,tipo) values('Caja ficticia','caja') returning id into cuenta;
  t:=public.registrar_transporte(gen_random_uuid(),c,'2027-05-01 08:00-06',60,'Origen','Destino',null,1000,null);
  perform set_config('request.jwt.claim.sub',current_setting('prueba.finanzas'),true);
  insert into public.empleados(nombre,puesto) values('Empleado ficticio','Administración') returning id into e;
  assert (select creado_por=auth.uid() from public.empleados where id=e), 'auditoría empleado';
  select id into cat from public.categorias_gasto where nombre='Salarios';
  select id into otro from public.categorias_gasto where nombre='Combustible';
  pago:=jsonb_build_object('cuenta_dinero_id',cuenta,'metodo','efectivo','monto',300);
  g:=public.registrar_gasto_personal(k,null,cat,'general',hoy,null,'Salario octubre',1000,null,pago,null,null,e,null);
  assert (select empleado_id=e and nombre_destinatario='Empleado ficticio' from public.gastos_personal where gasto_id=g), 'destinatario';
  assert (select pagado=300 and pendiente=700 from public.saldos_gastos where id=g), 'abono';
  assert public.registrar_gasto_personal(k,null,cat,'general',hoy,null,'Salario octubre',1000,null,pago,null,null,e,null)=g, 'reintento';
  assert (select count(*)=1 from public.pagos_gasto where gasto_id=g), 'pago único';
  assert (select count(*)=1 from public.asientos where origen_id=g), 'asiento único';
  begin
    perform public.registrar_gasto_personal(k,null,cat,'general',hoy,null,'Salario octubre',1000,null,pago,null,null,null,d);
    raise exception 'Permitió cambiar destinatario';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_gasto_personal(gen_random_uuid(),null,cat,'general',hoy,null,'Salario',1000,null,null,null,null,e,d);
    raise exception 'Permitió dos destinatarios';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_gasto_personal(gen_random_uuid(),null,otro,'general',hoy,null,'Salario',1000,null,null,null,null,e,null);
    raise exception 'Permitió categoría errónea';
  exception when sqlstate '22023' then null; end;
  g2:=public.registrar_gasto_personal(gen_random_uuid(),null,cat,'transportes',hoy,null,'Conductor viaje',300,null,pago,'transporte',t,null,d);
  assert (select conductor_id=d from public.gastos_personal where gasto_id=g2), 'conductor';
  assert (select transporte_id=t from public.gastos_servicio where gasto_id=g2), 'servicio';
  assert (select pendiente=0 from public.saldos_gastos where id=g2), 'pago completo';
  update public.empleados set activo=false,nombre='Nombre actualizado' where id=e;
  assert (select nombre_destinatario='Empleado ficticio' from public.gastos_personal where gasto_id=g), 'nombre histórico';
  assert public.registrar_gasto_personal(k,null,cat,'general',hoy,null,'Salario octubre',1000,null,pago,null,null,e,null)=g, 'reintento inactivo';
  begin
    perform public.registrar_gasto_personal(gen_random_uuid(),null,cat,'general',hoy,null,'Salario',1000,null,null,null,null,e,null);
    raise exception 'Permitió empleado inactivo';
  exception when sqlstate '22023' then null; end;
  perform public.registrar_pago_gasto(gen_random_uuid(),g,cuenta,hoy,'efectivo',null,700);
  assert (select pendiente=0 and pagado=1000 from public.saldos_gastos where id=g), 'liquidación';
  perform set_config('request.jwt.claim.sub',current_setting('prueba.operador'),true);
  assert not exists(select 1 from public.empleados), 'RLS empleados';
  assert not exists(select 1 from public.gastos_personal), 'RLS remuneraciones';
  begin
    insert into public.empleados(nombre) values('No permitido');
    raise exception 'Operador creó empleado';
  exception when insufficient_privilege then null; end;
  begin
    perform public.registrar_gasto_personal(gen_random_uuid(),null,cat,'general',hoy,null,'Salario',1000,null,null,null,null,e,null);
    raise exception 'Operador registró salario';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',current_setting('prueba.finanzas'),true);
  begin
    update public.gastos_personal set nombre_destinatario='Cambio' where gasto_id=g;
    raise exception 'Permitió modificar historial';
  exception when insufficient_privilege then null; end;
end $$;
set constraints all immediate;
select '21 comprobaciones de personal, remuneraciones, pagos, idempotencia y permisos completadas' as resultado;
rollback;
