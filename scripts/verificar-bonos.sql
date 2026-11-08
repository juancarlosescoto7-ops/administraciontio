-- Bonos por servicio, vouchers y permisos. Datos ficticios, sin persistencia;
-- ejecutable en desarrollo (BEGIN/ROLLBACK) o en PostgreSQL temporal.
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
declare e uuid; d uuid; prov uuid; c uuid; t uuid; a uuid; cuenta uuid; bonos uuid; comb uuid; salarios uuid;
  ids uuid[]; ids2 uuid[]; general uuid; pago uuid; n0 bigint; k1 uuid:=gen_random_uuid(); k2 uuid:=gen_random_uuid();
  lineas jsonb; hoy date:=(now() at time zone 'America/Tegucigalpa')::date; n integer:=0;
begin
  perform set_config('request.jwt.claim.sub',current_setting('prueba.administrador'),true);
  insert into public.conductores(nombre) values('Conductor ficticio') returning id into d;
  insert into public.clientes(nombre) values('Cliente ficticio') returning id into c;
  insert into public.proveedores(nombre) values('Gasolinera ficticia') returning id into prov;
  insert into public.cuentas_dinero(nombre,tipo) values('Caja ficticia','caja') returning id into cuenta;
  t:=public.registrar_transporte(gen_random_uuid(),c,'2027-05-01 08:00-06',60,'Origen','Destino',null,5000,null);
  select id into bonos from public.categorias_gasto where nombre='Bonos';
  select id into comb from public.categorias_gasto where nombre='Combustible';
  select id into salarios from public.categorias_gasto where nombre='Salarios';
  assert bonos is not null, 'categoría Bonos'; n:=n+1;
  assert (select cc.codigo='5350' from public.categorias_gasto cg join public.cuentas_contables cc on cc.id=cg.cuenta_contable_id where cg.id=bonos), 'cuenta 5350'; n:=n+1;

  perform set_config('request.jwt.claim.sub',current_setting('prueba.finanzas'),true);
  insert into public.empleados(nombre,puesto) values('Empleado ficticio','Ventas') returning id into e;
  general:=public.registrar_gasto(gen_random_uuid(),null,comb,'general',hoy,null,'Gasto general',100,null,null);
  select coalesce(max(numero),0) into n0 from public.comprobantes_pago;

  -- El operador registra un bono pagado y un gasto pendiente en una sola operación.
  perform set_config('request.jwt.claim.sub',current_setting('prueba.operador'),true);
  lineas:=jsonb_build_array(
    jsonb_build_object('idempotencia',k1,'categoria_id',bonos,'empleado_id',e,'concepto','Bono por servicio','monto','500.00',
      'pago',jsonb_build_object('cuenta_dinero_id',cuenta,'metodo','efectivo','monto','500.00')),
    jsonb_build_object('idempotencia',k2,'categoria_id',comb,'proveedor_id',prov,'concepto','Combustible','monto','800.00'));
  ids:=public.registrar_gastos_de_servicio('transporte',t,lineas);
  assert cardinality(ids)=2, 'dos líneas'; n:=n+1;
  assert (select count(*)=2 from public.gastos_de_servicio where transporte_id=t), 'vista del servicio'; n:=n+1;
  assert (select pagado=500 and pendiente=0 and destinatario='Empleado ficticio' and categoria_nombre='Bonos' from public.gastos_de_servicio where gasto_id=ids[1]), 'bono pagado'; n:=n+1;
  assert (select pagado=0 and pendiente=800 and destinatario='Gasolinera ficticia' from public.gastos_de_servicio where gasto_id=ids[2]), 'gasto pendiente'; n:=n+1;
  assert (select actividad='transportes' from public.gastos where id=ids[1]), 'actividad del servicio'; n:=n+1;
  assert (select c.numero=n0+1 from public.comprobantes_pago c join public.pagos_gasto p on p.id=c.pago_gasto_id where p.gasto_id=ids[1]), 'voucher consecutivo'; n:=n+1;

  -- Reintento: mismas claves, nada duplicado.
  ids2:=public.registrar_gastos_de_servicio('transporte',t,lineas);
  assert ids2=ids, 'reintento idempotente'; n:=n+1;
  assert (select count(*)=1 from public.pagos_gasto where gasto_id=ids[1]), 'pago único'; n:=n+1;
  assert (select count(*)=1 from public.comprobantes_pago c join public.pagos_gasto p on p.id=c.pago_gasto_id where p.gasto_id=ids[1]), 'voucher único'; n:=n+1;

  -- Todo o nada: una línea inválida impide registrar las demás.
  begin
    perform public.registrar_gastos_de_servicio('transporte',t,jsonb_build_array(
      jsonb_build_object('idempotencia',gen_random_uuid(),'categoria_id',comb,'concepto','Peaje','monto','50.00'),
      jsonb_build_object('idempotencia',gen_random_uuid(),'categoria_id',bonos,'concepto','Bono sin persona','monto','100.00')));
    raise exception 'Permitió bono sin destinatario';
  exception when sqlstate '22023' then null; end;
  assert (select count(*)=2 from public.gastos_de_servicio where transporte_id=t), 'todo o nada'; n:=n+1;
  begin
    perform public.registrar_gastos_de_servicio('transporte',t,'[]'::jsonb);
    raise exception 'Permitió lista vacía';
  exception when sqlstate '22023' then null; end;
  n:=n+1;
  begin
    perform public.registrar_gastos_de_servicio('alquiler',t,lineas);
    raise exception 'Permitió servicio inexistente';
  exception when sqlstate '22023' then null; end;
  n:=n+1;

  -- Pago posterior del pendiente por el operador: voucher siguiente.
  pago:=public.registrar_pago_gasto_servicio(gen_random_uuid(),ids[2],cuenta,hoy,'transferencia','TRF-1',300);
  assert (select numero=n0+2 from public.comprobantes_pago where pago_gasto_id=pago), 'voucher del abono'; n:=n+1;
  assert (select pendiente=500 from public.gastos_de_servicio where gasto_id=ids[2]), 'abono parcial'; n:=n+1;
  begin
    perform public.registrar_pago_gasto_servicio(gen_random_uuid(),ids[2],cuenta,hoy,'efectivo',null,600);
    raise exception 'Permitió pagar de más';
  exception when sqlstate '22023' then null; end;
  n:=n+1;

  -- El operador no toca gastos generales ni ve sus datos.
  begin
    perform public.registrar_pago_gasto_servicio(gen_random_uuid(),general,cuenta,hoy,'efectivo',null,10);
    raise exception 'Operador pagó gasto general';
  exception when sqlstate '22023' then null; end;
  n:=n+1;
  begin
    perform public.registrar_gasto(gen_random_uuid(),null,comb,'general',hoy,null,'No',10,null,null);
    raise exception 'Operador registró gasto general';
  exception when insufficient_privilege then null; end;
  n:=n+1;
  begin
    perform public.registrar_pago_gasto(gen_random_uuid(),general,cuenta,hoy,'efectivo',null,10);
    raise exception 'Operador usó el pago general';
  exception when insufficient_privilege then null; end;
  n:=n+1;
  assert not exists(select 1 from public.gastos where id=general), 'RLS gasto general'; n:=n+1;
  assert (select count(*)=2 from public.gastos where id=any(ids)), 'RLS gastos del servicio'; n:=n+1;
  -- Ve exactamente los vouchers de gastos de servicio (también los ya existentes en desarrollo).
  assert (select count(*) from public.comprobantes_pago)
    = (select count(*) from public.pagos_gasto p join public.gastos_servicio s on s.gasto_id=p.gasto_id), 'RLS vouchers del servicio'; n:=n+1;
  assert (select count(*)>=2 from public.comprobantes_pago c join public.pagos_gasto p on p.id=c.pago_gasto_id where p.gasto_id=any(ids)), 'vouchers propios visibles'; n:=n+1;
  assert exists(select 1 from public.empleados where id=e), 'operador elige empleados'; n:=n+1;
  assert not exists(select 1 from public.asientos), 'operador sin contabilidad'; n:=n+1;
  begin
    update public.empleados set nombre='Cambio' where id=e;
    if found then raise exception 'Operador modificó empleado'; end if;
  exception when insufficient_privilege then null; end;
  n:=n+1;

  -- Contabilidad: bono a la cuenta 5350, asientos cuadrados.
  perform set_config('request.jwt.claim.sub',current_setting('prueba.finanzas'),true);
  assert (select count(*)=1 from public.asientos a2 join public.lineas_asiento l on l.asiento_id=a2.id
    join public.cuentas_contables cc on cc.id=l.cuenta_contable_id
    where a2.origen_tipo='gasto' and a2.origen_id=ids[1] and cc.codigo='5350' and l.debe=500), 'asiento del bono'; n:=n+1;
  assert not exists(select 1 from public.asientos a2 join public.lineas_asiento l on l.asiento_id=a2.id
    where a2.origen_id = any(ids || pago) group by a2.id having sum(l.debe)<>sum(l.haber)), 'asientos cuadrados'; n:=n+1;
  assert (select count(*)=n0+2 from public.comprobantes_pago), 'finanzas ve todos los vouchers'; n:=n+1;

  -- Bono a un conductor desde Gastos (finanzas) y salario con categoría errónea.
  perform public.registrar_gasto_personal(gen_random_uuid(),null,bonos,'transportes',hoy,null,'Bono conductor',200,null,null,'transporte',t,null,d);
  n:=n+1;
  begin
    perform public.registrar_gasto_personal(gen_random_uuid(),null,comb,'general',hoy,null,'Bono',200,null,null,null,null,e,null);
    raise exception 'Permitió categoría errónea para el personal';
  exception when sqlstate '22023' then null; end;
  n:=n+1;
  begin
    update public.comprobantes_pago set numero=999 where pago_gasto_id=pago;
    if found then raise exception 'Permitió cambiar el voucher'; end if;
  exception when insufficient_privilege then null; end;
  n:=n+1;

  perform set_config('prueba.total',n::text,true);
end $$;
set constraints all immediate;
select current_setting('prueba.total') || ' comprobaciones de bonos, vouchers, pagos y permisos completadas' as resultado;
rollback;
