-- Bienes de la empresa: compras, bienes que ya tenía, pagos, depreciación,
-- bajas, anulaciones, permisos y estados financieros. Datos ficticios, sin
-- persistencia (rollback); ejecutable en desarrollo o PostgreSQL temporal (PGlite).
begin;
set local statement_timeout='60s';
do $$ declare u uuid; r text; begin
  -- La fecha de hoy de las funciones (otras pruebas la simulan redefiniendo private.hoy).
  perform set_config('prueba.hoy',private.hoy()::text,true);
  foreach r in array array['administrador','operador','finanzas'] loop
    u:=gen_random_uuid();
    insert into auth.users(id,email) values(u,u::text||'@example.invalid');
    update public.perfiles set rol=r::public.rol_usuario,activo=true where id=u;
    perform set_config('prueba.'||r,u::text,true);
  end loop;
end $$;
set local role authenticated;
do $$
declare
  hoy date := current_setting('prueba.hoy')::date;
  caja uuid; prov uuid; veh uuid; veh2 uuid;
  contado uuid; credito uuid; edificio uuid; terreno uuid; mensual uuid;
  k uuid := gen_random_uuid(); kp uuid := gen_random_uuid();
  pago uuid; pago2 uuid; esperadas integer; n integer;
  asiento uuid;
begin
  perform set_config('request.jwt.claim.sub',current_setting('prueba.administrador'),true);
  insert into public.cuentas_dinero(nombre,tipo) values('Caja ficticia bienes','caja') returning id into caja;
  perform public.registrar_apertura(gen_random_uuid(),caja,date '2023-12-01',2000000);
  insert into public.proveedores(nombre) values('Proveedor ficticio bienes') returning id into prov;
  insert into public.vehiculos(codigo,tipo,marca,modelo) values('BIEN-'||upper(left(gen_random_uuid()::text,8)),'mixto','MARCA','FICTICIA') returning id into veh;
  insert into public.vehiculos(codigo,tipo) values('BIEN-'||upper(left(gen_random_uuid()::text,8)),'alquiler') returning id into veh2;

  -- 1 Permisos: el operador no registra ni ve bienes.
  perform set_config('request.jwt.claim.sub',current_setting('prueba.operador'),true);
  begin
    perform public.registrar_bien(gen_random_uuid(),'Escritorio','mobiliario',null,'general',null,'compra',null,hoy,null,null,1000,null,null,60);
    raise exception 'Operador registró un bien';
  exception when insufficient_privilege then null; end;
  begin
    perform public.actualizar_depreciaciones();
    raise exception 'Operador actualizó depreciaciones';
  exception when insufficient_privilege then null; end;

  -- 2 Compra de contado con fecha pasada: se paga completa y recibe todas sus cuotas.
  -- (1000 − 100) / 7 = 128.571… → seis cuotas de 128.57 y la última de 128.58.
  perform set_config('request.jwt.claim.sub',current_setting('prueba.finanzas'),true);
  contado := public.registrar_bien(k,'Vehículo ficticio','vehiculo','Serie X','alquileres',veh,'compra',prov,
    date '2024-01-10',null,null,1000,null,100,7,
    jsonb_build_object('cuenta_dinero_id',caja,'metodo','efectivo','referencia','R-1','monto','1000.00'));
  assert (select count(*)=7 and sum(monto)=900 and max(mes)=date '2024-08-01' from public.depreciaciones_bien where bien_id=contado), '2 siete cuotas';
  assert (select monto=128.58 from public.depreciaciones_bien where bien_id=contado and mes=date '2024-08-01'), '2 última cuota ajusta';
  assert (select count(*)=6 from public.depreciaciones_bien where bien_id=contado and monto=128.57), '2 seis cuotas iguales';
  assert (select fecha=date '2024-02-29' from public.asientos x join public.depreciaciones_bien d on d.id=x.origen_id
    where x.origen_tipo='depreciacion' and d.bien_id=contado and d.mes=date '2024-02-01'), '2 asiento al cierre del mes (bisiesto)';
  assert (select valor_en_libros=100 and depreciacion_acumulada=900 and por_pagar=0 and pagado=1000 and cuota_mensual=128.57
    from public.saldos_bienes where id=contado), '2 saldos del bien';
  assert (select count(*)=1 and sum(monto_con_signo)=-1000 from public.movimientos_dinero where origen_tipo='pago_bien'
    and origen_id in (select id from public.pagos_bien where bien_id=contado)), '2 una salida de caja';
  assert (select actividad='alquileres' from public.asientos where origen_tipo='bien' and origen_id=contado), '2 actividad del asiento';
  assert (select bool_and(l.debe>0) from public.lineas_asiento l join public.asientos x on x.id=l.asiento_id
    join public.cuentas_contables c on c.id=l.cuenta_contable_id
    where x.origen_tipo='bien' and x.origen_id=contado and c.codigo='1530'), '2 debe en 1530 Vehículos';

  -- 3 Reintento con la misma clave: el mismo bien, sin otro pago; otra operación con la clave, error.
  assert public.registrar_bien(k,'Vehículo ficticio','vehiculo','Serie X','alquileres',veh,'compra',prov,
    date '2024-01-10',null,null,1000,null,100,7,
    jsonb_build_object('cuenta_dinero_id',caja,'metodo','efectivo','referencia','R-1','monto','1000.00'))=contado, '3 idempotente';
  assert (select count(*)=1 from public.pagos_bien where bien_id=contado), '3 sin pago duplicado';
  begin
    perform public.registrar_bien(k,'Otro','equipo',null,'general',null,'compra',null,hoy,null,null,50,null,null,12);
    raise exception 'Clave reutilizada con otros datos';
  exception when sqlstate '22023' then null; end;

  -- 4 Validaciones.
  begin
    perform public.registrar_bien(gen_random_uuid(),'Segundo registro','vehiculo',null,'general',veh,'compra',null,hoy,null,null,10,null,null,12);
    raise exception 'Vehículo registrado dos veces';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_bien(gen_random_uuid(),'Lote','terreno',null,'general',null,'compra',null,hoy,null,null,10,null,null,12);
    raise exception 'Terreno con vida útil';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_bien(gen_random_uuid(),'Silla','mobiliario',null,'general',null,'compra',null,hoy,null,null,10,null,null,null);
    raise exception 'Mueble sin vida útil';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_bien(gen_random_uuid(),'Silla','mobiliario',null,'general',null,'compra',null,hoy,null,null,10,1,null,12);
    raise exception 'Compra con depreciación previa';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_bien(gen_random_uuid(),'Silla','mobiliario',null,'general',null,'existente',prov,hoy,null,null,10,null,null,12);
    raise exception 'Bien existente con proveedor';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_bien(gen_random_uuid(),'Silla','mobiliario',null,'general',veh2,'compra',null,hoy,null,null,10,null,null,12);
    raise exception 'Mueble vinculado a un vehículo';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_bien(gen_random_uuid(),'Silla','mobiliario',null,'general',null,'existente',null,hoy,null,null,10,6,5,12);
    raise exception 'Previa + residual supera el costo';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_bien(gen_random_uuid(),'Silla','mobiliario',null,'general',null,'compra',null,hoy+1,null,null,10,null,null,12);
    raise exception 'Compra con fecha futura';
  exception when sqlstate '22023' then null; end;

  -- 5 Compra a crédito de hoy: por pagar completo, sin cuotas todavía; abonos parciales.
  credito := public.registrar_bien(gen_random_uuid(),'Equipo ficticio','equipo',null,'ambulancias',null,'compra',prov,
    hoy,null,hoy+30,5000,null,null,24);
  assert (select por_pagar=5000 and valor_en_libros=5000 and depreciacion_acumulada=0 from public.saldos_bienes where id=credito), '5 por pagar';
  assert not exists(select 1 from public.depreciaciones_bien where bien_id=credito), '5 sin cuotas el primer mes';
  pago := public.registrar_pago_bien(kp,credito,caja,hoy,'transferencia','T-1',2000);
  assert public.registrar_pago_bien(kp,credito,caja,hoy,'transferencia','T-1',2000)=pago, '5 pago idempotente';
  assert (select count(*)=1 from public.movimientos_dinero where origen_tipo='pago_bien' and origen_id=pago), '5 un solo movimiento';
  assert (select por_pagar=3000 and pagado=2000 from public.saldos_bienes where id=credito), '5 abono parcial';
  begin
    perform public.registrar_pago_bien(gen_random_uuid(),credito,caja,hoy,'efectivo',null,3000.01);
    raise exception 'Sobrepago';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_pago_bien(gen_random_uuid(),credito,caja,hoy-1,'efectivo',null,10);
    raise exception 'Pago anterior a la compra';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.registrar_pago_bien(gen_random_uuid(),contado,caja,hoy,'efectivo',null,1);
    raise exception 'Pago sobre compra ya pagada';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.reversar_pago_bien(pago,'Finanzas no reversa');
    raise exception 'Finanzas reversó un pago';
  exception when insufficient_privilege then null; end;
  begin
    perform public.anular_bien(credito,'Finanzas no anula');
    raise exception 'Finanzas anuló un bien';
  exception when insufficient_privilege then null; end;

  -- 6 Bien que ya tenía (edificio de 1995): costo, depreciación previa y capital.
  edificio := public.registrar_bien(gen_random_uuid(),'Edificio ficticio','edificio',null,'general',null,'existente',null,
    date '1995-06-01',hoy,null,2000000,500000,0,480);
  assert (select count(*)=3 from public.lineas_asiento l join public.asientos x on x.id=l.asiento_id
    join public.cuentas_contables c on c.id=l.cuenta_contable_id
    where x.origen_tipo='bien' and x.origen_id=edificio and (
      (c.codigo='1520' and l.debe=2000000) or (c.codigo='1600' and l.haber=500000) or (c.codigo='3100' and l.haber=1500000))), '6 asiento de incorporación';
  assert (select valor_en_libros=1500000 and por_pagar=0 and cuota_mensual=4166.67 from public.saldos_bienes where id=edificio), '6 valor en libros';
  assert not exists(select 1 from public.movimientos_dinero where origen_id=edificio), '6 no mueve caja';
  terreno := public.registrar_bien(gen_random_uuid(),'Terreno ficticio','terreno',null,'general',null,'existente',null,
    date '2010-03-01',date '2024-01-01',null,800000,null,null,null);
  assert not exists(select 1 from public.depreciaciones_bien where bien_id=terreno), '6 el terreno no se deprecia';
  begin
    perform public.registrar_bien(gen_random_uuid(),'Mal fechado','equipo',null,'general',null,'existente',null,
      date '2024-05-01',date '2024-04-01',null,100,null,null,12);
    raise exception 'Incorporación anterior a la adquisición';
  exception when sqlstate '22023' then null; end;

  -- 7 Bien a mitad de su vida: cuotas de los meses cumplidos y actualización idempotente.
  mensual := public.registrar_bien(gen_random_uuid(),'Mobiliario ficticio','mobiliario',null,'transportes',null,'existente',null,
    date '2025-12-20',date '2026-01-15',null,12000,null,null,120);
  select count(*) into esperadas from generate_series(date '2026-02-01', hoy, interval '1 month') m
  where (m + interval '1 month' - interval '1 day')::date <= hoy;
  assert (select count(*)=esperadas and coalesce(sum(monto),0)=esperadas*100 from public.depreciaciones_bien where bien_id=mensual), '7 cuotas cumplidas';
  n := public.actualizar_depreciaciones();
  assert n=0, '7 actualizar no duplica';
  assert (select count(*)=esperadas from public.depreciaciones_bien where bien_id=mensual), '7 sigue igual';
  assert (select bool_and(actividad='transportes') from public.asientos x join public.depreciaciones_bien d on d.id=x.origen_id
    where x.origen_tipo='depreciacion' and d.bien_id=mensual), '7 depreciación en su actividad';
  if esperadas>0 then
    begin
      perform public.dar_de_baja_bien(mensual,date '2026-01-20','Baja antes de la última cuota');
      raise exception 'Baja anterior a una cuota registrada';
    exception when sqlstate '22023' then null; end;
  end if;

  -- 8 Edición limitada con bitácora.
  perform public.editar_bien(contado,'Vehículo ficticio renombrado','Serie Y');
  assert (select nombre='Vehículo ficticio renombrado' from public.bienes where id=contado), '8 nombre corregido';

  -- 9 Baja del vehículo totalmente depreciado: sale costo y acumulada; el residual es pérdida.
  perform public.dar_de_baja_bien(contado,hoy,'Venta ficticia');
  select id into asiento from public.asientos where origen_tipo='baja_bien' and origen_id=contado;
  assert (select count(*)=3 from public.lineas_asiento l join public.cuentas_contables c on c.id=l.cuenta_contable_id
    where l.asiento_id=asiento and ((c.codigo='1600' and l.debe=900) or (c.codigo='5700' and l.debe=100) or (c.codigo='1530' and l.haber=1000))), '9 asiento de baja';
  assert (select estado='dado_de_baja' and valor_en_libros=0 from public.saldos_bienes where id=contado), '9 dado de baja';
  begin
    perform public.dar_de_baja_bien(contado,hoy,'Otra vez');
    raise exception 'Baja dos veces';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.editar_bien(contado,'No','No');
    raise exception 'Editó un bien dado de baja';
  exception when sqlstate '22023' then null; end;

  -- 10 Correcciones del administrador.
  perform set_config('request.jwt.claim.sub',current_setting('prueba.administrador'),true);
  begin
    perform public.anular_bien(contado,'Ya está dado de baja');
    raise exception 'Anuló un bien dado de baja';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.anular_bien(credito,'Con pagos');
    raise exception 'Anuló con pagos confirmados';
  exception when sqlstate '22023' then null; end;
  perform public.reversar_pago_bien(pago,'Pago ficticio equivocado');
  assert (select por_pagar=5000 from public.saldos_bienes where id=credito), '10 reverso devuelve el pendiente';
  assert (select sum(monto_con_signo)=0 from public.movimientos_dinero where origen_tipo='pago_bien' and origen_id=pago), '10 contramovimiento';
  perform public.anular_bien(credito,'Compra ficticia equivocada');
  assert (select estado='anulado' and por_pagar=0 and valor_en_libros=0 from public.saldos_bienes where id=credito), '10 anulado';
  perform public.anular_bien(mensual,'Registro ficticio equivocado');
  -- La bitácora no se lee desde la API: se consulta como propietario.
  reset role;
  assert exists(select 1 from public.bitacora where registro_id=contado and accion='editar_bien'), '10 bitácora de edición';
  assert exists(select 1 from public.bitacora where registro_id=contado and accion='dar_de_baja_bien' and motivo='Venta ficticia'), '10 bitácora de baja';
  assert exists(select 1 from public.bitacora where registro_id=mensual and accion='anular_bien'), '10 bitácora de anulación';
  set local role authenticated;
  assert not exists(select 1 from public.depreciaciones_bien where bien_id=mensual and estado='confirmado'), '10 cuotas reversadas';
  assert (select count(*)=esperadas+1 from public.asientos where evento='reverso' and (origen_id=mensual
    or origen_id in (select id from public.depreciaciones_bien where bien_id=mensual))), '10 un reverso por asiento';

  -- 11 Escritura directa bloqueada para todos los roles.
  begin
    insert into public.bienes(nombre,clase,actividad,origen,fecha_adquisicion,fecha_registro,costo,idempotencia)
    values('Directo','otro','general','compra',hoy,hoy,1,gen_random_uuid());
    raise exception 'Insertó un bien directamente';
  exception when insufficient_privilege then null; end;
  begin
    update public.bienes set costo=1 where id=edificio;
    raise exception 'Modificó un bien directamente';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.pagos_bien where id=pago;
    raise exception 'Borró un pago directamente';
  exception when insufficient_privilege then null; end;

  -- 12 El operador no ve bienes; finanzas sí.
  perform set_config('request.jwt.claim.sub',current_setting('prueba.operador'),true);
  assert not exists(select 1 from public.saldos_bienes), '12 operador no ve saldos';
  assert not exists(select 1 from public.depreciaciones_bien), '12 operador no ve depreciaciones';
  perform set_config('request.jwt.claim.sub',current_setting('prueba.finanzas'),true);
  assert (select count(*)>=4 from public.saldos_bienes), '12 finanzas consulta';
end $$;
-- Dispara las comprobaciones diferidas de cada asiento (Debe = Haber, caja = movimientos).
set constraints all immediate;
do $$
declare hoy date := current_setting('prueba.hoy')::date; r record;
begin
  perform set_config('request.jwt.claim.sub',current_setting('prueba.finanzas'),true);
  for r in select * from public.comprobaciones_financieras(hoy) loop
    assert r.cuadra is distinct from false, format('13 comprobación %s: %s (diferencia %s)', r.orden, r.control, r.diferencia);
  end loop;
  assert (select count(*)=10 from public.comprobaciones_financieras(hoy)), '13 diez controles';
  assert (select count(*)=7 from public.situacion_financiera(hoy)
    where cuenta_codigo in ('1510','1520','1530','1540','1550','1590','1600')), '13 bienes en el balance';
  assert (select count(*)=1 from public.situacion_financiera(hoy) where cuenta_codigo='2110'), '13 por pagar por bienes en el balance';
  assert (select total>=900 from public.estado_resultados(date '2024-01-01',date '2024-12-31') where cuenta_codigo='5600'), '13 depreciación en resultados';
  assert (select alquileres>=900 from public.estado_resultados(date '2024-01-01',date '2024-12-31') where cuenta_codigo='5600'), '13 depreciación por actividad';
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.saldos_bienes limit 1;
    raise exception 'anon leyó bienes';
  exception when insufficient_privilege then null; end;
  begin
    perform public.actualizar_depreciaciones();
    raise exception 'anon ejecutó actualizar_depreciaciones';
  exception when insufficient_privilege then null; end;
end $$;
select '13 grupos de pruebas de bienes (compras, existentes, pagos, depreciación, bajas, anulaciones, permisos y estados financieros) completados' as resultado;
rollback;
