-- Kilometraje encadenado por vehículo y mantenimientos. Datos ficticios, sin
-- persistencia; ejecutable en desarrollo o PostgreSQL temporal (PGlite).
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
declare veh uuid; otro uuid; con uuid; con2 uuid; cli uuid; t1 uuid; t2 uuid; tr uuid; alq uuid; m uuid;
  k uuid:=gen_random_uuid(); r jsonb;
begin
  perform set_config('request.jwt.claim.sub',current_setting('prueba.operador'),true);
  insert into public.vehiculos(codigo,tipo) values('FLOTA-'||upper(left(gen_random_uuid()::text,8)),'mixto') returning id into veh;
  insert into public.vehiculos(codigo,tipo) values('FLOTA-'||upper(left(gen_random_uuid()::text,8)),'mixto') returning id into otro;
  insert into public.conductores(nombre) values('Conductor ficticio') returning id into con;
  insert into public.conductores(nombre) values('Conductor ficticio 2') returning id into con2;
  insert into public.clientes(nombre) values('Cliente ficticio flota') returning id into cli;
  assert public.kilometraje_vehiculo(veh) is null, '1 sin recorridos';

  t1:=public.registrar_transporte(gen_random_uuid(),cli,'2027-05-01 08:00-06',60,'Origen','Destino',null,1000,null,veh,con,true);
  t2:=public.registrar_transporte(gen_random_uuid(),cli,'2027-05-01 10:00-06',60,'Origen','Destino 2',null,900,null,veh,con2,true);
  begin
    perform public.iniciar_transporte(t1);
    raise exception 'Firma anterior inició sin kilometraje';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.iniciar_transporte(t1,null);
    raise exception 'Inició sin kilometraje';
  exception when sqlstate '22023' then null; end;
  -- Primer recorrido del vehículo: fija la base, sin descuadre.
  perform public.iniciar_transporte(t1,1000);
  assert (select km_salida=1000 and motivo_descuadre_km is null from public.transportes where id=t1), '2 salida guardada';
  begin
    perform public.iniciar_transporte(t2,1000);
    raise exception 'Inició con el vehículo en otro recorrido';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_mantenimiento(gen_random_uuid(),veh,'preventivo','Cambio de aceite',now(),now(),1000,1010);
    raise exception 'Mantenimiento con recorrido abierto';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.finalizar_transporte(t1,'Sin km');
    raise exception 'Firma anterior finalizó sin kilometraje';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.finalizar_transporte(t1,900,null);
    raise exception 'Llegada menor que salida';
  exception when sqlstate '22023' then null; end;
  r:=public.finalizar_transporte(t1,1100,null);
  assert (r->>'repetido')::boolean is false, '3 finalizado';
  r:=public.finalizar_transporte(t1,1100,null);
  assert (r->>'repetido')::boolean, '4 reintento sin duplicar';
  assert (select count(*)=1 from public.cargos_cliente where origen_id=t1), '5 cargo único';
  assert public.kilometraje_vehiculo(veh)=1100, '6 km esperado';

  begin
    perform public.iniciar_transporte(t2,1150);
    raise exception 'Aceptó descuadre sin motivo';
  exception when sqlstate '22023' then null; end;
  perform public.iniciar_transporte(t2,1100);
  perform public.finalizar_transporte(t2,1200,'Llegó bien');

  tr:=public.registrar_traslado(gen_random_uuid(),'particular',cli,null,null,'Paciente ficticio','2027-05-02 08:00-06',60,
    'Origen','Hospital',null,800,null,null,veh,con,true);
  begin
    perform public.iniciar_traslado(tr);
    raise exception 'Traslado sin kilometraje';
  exception when sqlstate '22023' then null; end;
  r:=public.iniciar_traslado(tr,1250,'Uso no registrado del fin de semana');
  assert (r->>'iniciado')::boolean, '7 traslado iniciado';
  assert (select motivo_descuadre_km='Uso no registrado del fin de semana' from public.traslados_ambulancia where id=tr), '8 motivo guardado';
  perform public.finalizar_traslado(tr,1300,null);
  assert (select km_llegada=1300 and estado='completado' from public.traslados_ambulancia where id=tr), '9 traslado cerrado';

  alq:=public.registrar_alquiler(gen_random_uuid(),cli,veh,'2027-06-01 08:00-06','2027-06-03 08:00-06',null,3000,null);
  begin
    perform public.entregar_alquiler(alq,1310,'lleno',null);
    raise exception 'Alquiler con descuadre sin motivo';
  exception when sqlstate '22023' then null; end;
  perform public.entregar_alquiler(alq,1300,'lleno',null,null);
  perform public.devolver_alquiler(alq,1400,'medio',null);

  perform set_config('request.jwt.claim.sub',current_setting('prueba.finanzas'),true);
  begin
    perform public.registrar_mantenimiento(gen_random_uuid(),veh,'preventivo','Cambio de aceite',now(),now(),1400,1410);
    raise exception 'Finanzas registró mantenimiento';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',current_setting('prueba.administrador'),true);
  begin
    perform public.registrar_mantenimiento(gen_random_uuid(),veh,'preventivo','Cambio de aceite',now()-interval '1 day',now(),1400,1410);
    raise exception 'Mantenimiento anterior al último recorrido';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_mantenimiento(gen_random_uuid(),veh,'preventivo','Cambio de aceite',now(),now()+interval '1 day',1400,1410);
    raise exception 'Mantenimiento con regreso futuro';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_mantenimiento(gen_random_uuid(),veh,'preventivo','Cambio de aceite',now(),now(),1400,1410,null,1405);
    raise exception 'Próximo km menor que el regreso';
  exception when sqlstate '22023' then null; end;
  m:=public.registrar_mantenimiento(k,veh,'preventivo','Cambio de aceite',now(),now(),1400,1410,null,6410,null,'Taller ficticio');
  assert public.registrar_mantenimiento(k,veh,'preventivo','Cambio de aceite',now(),now(),1400,1410,null,6410,null,'Taller ficticio')=m,
    '10 reintento de mantenimiento';
  assert (select count(*)=1 from public.mantenimientos_vehiculo where vehiculo_id=veh), '11 mantenimiento único';

  -- Informe: cinco recorridos encadenados, un descuadre de 50 km (el traslado).
  assert (select count(*)=5 from public.recorridos_vehiculo where vehiculo_id=veh), '12 cadena completa';
  assert (select count(*)=1 and min(diferencia)=50 and min(origen_tipo)='traslado'
    from public.recorridos_vehiculo where vehiculo_id=veh and diferencia<>0), '13 descuadre señalado';
  assert (select sum(recorrido)=360 from public.recorridos_vehiculo where vehiculo_id=veh), '14 km recorridos';
  assert (select km_actual=1410 and descuadres=1 and recorridos=5 and km_para_mantenimiento=5000 and not en_recorrido
    from public.resumen_flota where vehiculo_id=veh), '15 resumen del vehículo';
  assert (select km_actual is null and recorridos=0 from public.resumen_flota where vehiculo_id=otro), '16 vehículo sin recorridos';
  -- La cadena es por vehículo: el otro empieza con cualquier lectura.
  perform public.registrar_mantenimiento(gen_random_uuid(),otro,'correctivo','Frenos',now(),now(),50000,50020);
  assert public.kilometraje_vehiculo(otro)=50020 and public.kilometraje_vehiculo(veh)=1410, '17 cadenas independientes';

  begin
    insert into public.mantenimientos_vehiculo(vehiculo_id,tipo,descripcion,salida,regreso,km_salida,km_llegada,idempotencia)
    values(veh,'preventivo','Directo',now(),now(),1410,1420,gen_random_uuid());
    raise exception 'Inserción directa permitida';
  exception when insufficient_privilege then null; end;
  begin
    update public.transportes set km_llegada=5000 where id=t1;
    raise exception 'Modificó el kilometraje directamente';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',current_setting('prueba.finanzas'),true);
  assert (select count(*)=5 from public.recorridos_vehiculo where vehiculo_id=veh), '18 finanzas consulta el informe';
end $$;
set constraints all immediate;
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.recorridos_vehiculo limit 1;
    raise exception 'anon leyó recorridos';
  exception when insufficient_privilege then null; end;
end $$;
select '34 comprobaciones de kilometraje, descuadres, mantenimientos, idempotencia y permisos completadas' as resultado;
rollback;
