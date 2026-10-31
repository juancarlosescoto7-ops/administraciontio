-- Solo Supabase desarrollo cgohbizokewvivxmvbij. Contratos por tipo de
-- servicio con datos ficticios y ROLLBACK: no deja nada guardado.
begin;
set local statement_timeout='30s';

do $$ begin
  assert private.texto_duracion(1440)='1 día', '00a duración 1 día';
  assert private.texto_duracion(2*1440+180)='2 días y 3 horas', '00b duración días y horas';
  assert private.texto_duracion(1440+150)='1 día, 2 horas y 30 minutos', '00c duración completa';
  assert private.fecha_en_letras('2026-10-03')='3 días del mes de octubre de 2026', '00d fecha en letras';
  assert private.fecha_en_letras('2026-08-01')='1 día del mes de agosto de 2026', '00e un día';
end $$;

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
  c uuid; b uuid; p uuid; m uuid; a uuid; a2 uuid; t uuid; tr uuid; cho uuid; veh uuid; amb uuid;
  k1 uuid; k2 uuid; txt text; v_tipo text; v_version integer;
begin
  perform set_config('request.jwt.claim.sub',current_setting('prueba.administrador'),true);
  insert into public.clientes(nombre,identificacion,direccion,telefono)
    values('[PRUEBA CONTRATOS ROLLBACK]','0824-2006-00222','Barrio La Victoria, Talanga','9999-1111') returning id into c;
  insert into public.conductores(nombre,identificacion) values('[PRUEBA CONDUCTOR]','0824-1990-00001') returning id into cho;
  insert into public.vehiculos(codigo,placa,tipo,marca,modelo,anio)
    values('[PRUEBA-MIX]','JDF 0000','mixto','Honda','CRV',2018) returning id into veh;
  insert into public.vehiculos(codigo,placa,tipo,marca,modelo,anio)
    values('[PRUEBA-AMB]','AMB 0000','ambulancia','Toyota','Hiace',2020) returning id into amb;

  -- Plantillas vigentes: una por tipo, firmadas por el representante.
  for v_tipo in select unnest(array['membresia','alquiler','transporte','traslado']) loop
    select contenido into txt from public.plantillas_contrato where tipo=v_tipo order by version desc limit 1;
    assert txt like '%JORGE ALBERTO RODRÍGUEZ LAGOS%REPRESENTANTE%', '01 firma '||v_tipo;
    txt:=public.vista_previa_contrato(txt,v_tipo);
    assert txt not like '%{{%', '02 vista previa sin variables '||v_tipo;
  end loop;

  -- Plantillas: variables por tipo y solo administrador.
  begin
    perform public.guardar_plantilla_contrato('Plan {{plan}}','alquiler');
    raise exception '03 aceptó variable de otro tipo';
  exception when sqlstate '22023' then null; end;
  v_version:=public.guardar_plantilla_contrato('Contrato {{cliente_nombre}} {{vehiculo_placa}}','alquiler');
  assert v_version=(select max(version) from public.plantillas_contrato), '04 versión nueva';
  assert (select tipo from public.plantillas_contrato order by version desc limit 1)='alquiler', '05 tipo guardado';
  v_version:=public.guardar_plantilla_contrato((select contenido from public.plantillas_contrato where version=4));
  assert v_version > 0, '06 firma anterior = membresía';
  assert (select tipo from public.plantillas_contrato order by version desc limit 1)='membresia', '07 firma anterior guarda membresía';
  -- Vuelve a dejar vigente la plantilla inicial de alquiler dentro de la prueba.
  perform public.guardar_plantilla_contrato((select contenido from public.plantillas_contrato where version=5),'alquiler');

  -- Membresía: contrato nuevo con vigencia y sin párrafo duplicado.
  insert into public.beneficiarios(nombre) values('[PRUEBA BENEFICIARIO]') returning id into b;
  insert into public.planes(nombre,precio_mensual,cupo_mensual,modalidad_cupo,dias_gracia)
    values('[PRUEBA PLAN]',650,2,'compartido',5) returning id into p;
  m:=public.registrar_membresia(gen_random_uuid(),c,p,'2027-01-15',array[b],'{"fecha_fin":"2027-06-14"}');
  perform public.generar_contrato_membresia(m);
  select contenido into txt from public.contratos_membresia where membresia_id=m;
  assert txt like '%hasta su vencimiento pactado el 14/06/2027%' and txt not like '%VENCIMIENTO PACTADO%'
    and txt like '%L 650.00%' and txt not like '%{{%', '08 contrato de membresía';

  perform set_config('request.jwt.claim.sub',current_setting('prueba.operador'),true);
  begin
    perform public.guardar_plantilla_contrato('x','alquiler');
    raise exception '09 operador editó plantilla';
  exception when insufficient_privilege then null; end;

  -- Alquiler: datos reales, montos fijos y sin copias por doble envío.
  a:=public.registrar_alquiler(gen_random_uuid(),c,veh,'2027-03-06 12:00-06','2027-03-07 12:00-06',null,3000,null);
  k1:=public.generar_contrato_servicio('alquiler',a);
  select contenido into txt from public.contratos_servicio where id=k1;
  assert txt like '%[PRUEBA CONTRATOS ROLLBACK]%' and txt like '%Placa: JDF 0000%' and txt like '%L 3,000.00 por 1 día%'
    and txt like '%06/03/2027 a las 12:00 PM%' and txt like '%L 300.00 por hora%' and txt not like '%{{%', '10 contrato de alquiler';
  k2:=public.generar_contrato_servicio('alquiler',a);
  assert k1=k2 and (select count(*) from public.contratos_servicio where servicio_id=a)=1, '11 doble envío sin copia';

  begin
    insert into public.contratos_servicio(tipo,alquiler_id,plantilla_version,contenido,datos) values('alquiler',a,5,'x','{}');
    raise exception '12 insertó directo';
  exception when insufficient_privilege then null; end;

  a2:=public.registrar_alquiler(gen_random_uuid(),c,veh,'2027-04-06 12:00-06','2027-04-08 15:00-06',null,6500,null);
  perform public.cancelar_alquiler(a2,'Prueba');
  begin
    perform public.generar_contrato_servicio('alquiler',a2);
    raise exception '13 contrato de cancelado';
  exception when sqlstate '22023' then null; end;

  -- Viaje: recursos por asignar; al asignarlos se genera una versión nueva.
  t:=public.registrar_transporte(gen_random_uuid(),c,'2027-05-01 08:00-06',360,'Talanga','Tegucigalpa',null,1500,null,null,null,false);
  k1:=public.generar_contrato_servicio('transporte',t);
  assert (select contenido like '%Conductor: Por asignar%' from public.contratos_servicio where id=k1), '14 por asignar';
  perform public.asignar_recursos_transporte(t,veh,cho,null);
  k2:=public.generar_contrato_servicio('transporte',t);
  assert k1<>k2 and (select contenido like '%Conductor: [PRUEBA CONDUCTOR], identidad No. 0824-1990-00001%'
    and contenido like '%6 horas%' from public.contratos_servicio where id=k2), '15 versión con recursos';
  assert (select count(*) from public.contratos_servicio where servicio_id=t)=2, '16 historial conservado';

  -- Traslado particular.
  tr:=public.registrar_traslado(gen_random_uuid(),'particular',c,null,null,'[PRUEBA PACIENTE]','2027-05-02 08:00-06',120,
    'Talanga','Hospital Escuela','Consulta',1200,null,null,amb,cho,true);
  k1:=public.generar_contrato_servicio('traslado',tr);
  assert (select contenido like '%del paciente [PRUEBA PACIENTE]%' and contenido like '%L 1,200.00%'
    and contenido like '%Placa: AMB 0000%' from public.contratos_servicio where id=k1), '17 contrato de traslado';

  -- Finanzas no genera contratos; todos los usuarios activos los leen.
  perform set_config('request.jwt.claim.sub',current_setting('prueba.finanzas'),true);
  begin
    perform public.generar_contrato_servicio('traslado',tr);
    raise exception '18 finanzas generó contrato';
  exception when insufficient_privilege then null; end;
  assert (select count(*) from public.contratos_servicio where servicio_id in (a,t,tr))=4, '19 lectura';
  begin
    perform public.generar_contrato_servicio('membresia',m);
    raise exception '20 tipo no válido';
  exception when insufficient_privilege or sqlstate '22023' then null; end;

  raise notice 'verificar-contratos: 20 comprobaciones correctas';
end $$;
rollback;
