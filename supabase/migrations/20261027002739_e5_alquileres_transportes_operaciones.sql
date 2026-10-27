-- E5 · Alquileres y transportes con conductor: operaciones.
--
-- Mismo patrón que E2–E4: funciones públicas SECURITY DEFINER con
-- search_path vacío que verifican auth.uid() y el rol, validan y escriben en
-- una transacción. Errores de negocio: 22023, 42501 y P0002.
--
-- Disponibilidad compartida: las tres actividades ocupan vehículos (y
-- conductores) en ocupaciones_recurso con los auxiliares de E4
-- (ocupar_recurso, ocupar_en_curso, liberar_recursos, conflicto_recurso), que
-- bloquean el recurso y comparan con las ocupaciones de cualquier origen. La
-- restricción de exclusión impide dos horarios planificados que se crucen.
-- Una reserva o servicio programado ocupa su intervalo; un alquiler
-- entregado o un servicio en curso ocupa hasta su fin real (aunque se pase
-- del horario) y bloquea nuevos inicios con el mismo recurso.
--
-- Orden de bloqueo: documento → vehículo → conductor.
--
-- Cargos (plantilla de E2, una sola vez por documento):
--   alquiler   al devolver: precio pactado + adicionales, D 1200 / H 4300
--   transporte al completar: precio pactado,             D 1200 / H 4400
-- Los anticipos del cliente se aplican con aplicar_saldo_a_favor de E2.

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------

-- Vehículo activo, operativo y apto para la actividad (el tipo mixto sirve a
-- todas; nunca se cambia el tipo de un vehículo).
create function private.exigir_vehiculo(p_vehiculo_id uuid, p_actividad public.actividad)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_codigo text;
begin
  select codigo into v_codigo
  from public.vehiculos
  where id = p_vehiculo_id and activo and estado = 'operativo'
    and tipo::text in ('mixto', case p_actividad
      when 'ambulancias' then 'ambulancia' when 'alquileres' then 'alquiler' when 'transportes' then 'transporte' end);
  if v_codigo is null then
    raise exception 'Seleccione un vehículo activo, operativo y apto para %.', p_actividad using errcode = '22023';
  end if;
  return v_codigo;
end;
$$;

-- Un recurso que sigue en un servicio en curso (o alquiler entregado) de otro
-- documento no puede empezar otro, aunque se haya pasado de su horario.
create function private.exigir_recurso_libre(
  p_recurso_tipo text, p_recurso_id uuid, p_origen_tipo public.origen_ocupacion, p_origen_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_ocupado public.ocupaciones_recurso;
begin
  perform private.bloquear_recurso(p_recurso_tipo, p_recurso_id);
  select * into v_ocupado
  from public.ocupaciones_recurso o
  where o.activa and o.en_curso and o.recurso_tipo = p_recurso_tipo and o.recurso_id = p_recurso_id
    and not (o.origen_tipo = p_origen_tipo and o.origen_id = p_origen_id)
  limit 1;
  if v_ocupado.id is not null then
    raise exception '% está %.', case p_recurso_tipo when 'vehiculo' then 'El vehículo' else 'El conductor' end,
      private.describir_ocupacion(v_ocupado) using errcode = '22023';
  end if;
end;
$$;

-- Avisos de las ocupaciones vigentes de un documento: horario excedido y
-- cruces con otros documentos (no los reprograma).
create function private.avisos_ocupacion(p_origen_tipo public.origen_ocupacion, p_origen_id uuid)
returns setof text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_propia public.ocupaciones_recurso;
  v_otra public.ocupaciones_recurso;
  v_efectivo tstzrange;
  v_nombre text;
begin
  for v_propia in
    select * from public.ocupaciones_recurso
    where origen_tipo = p_origen_tipo and origen_id = p_origen_id and activa
    order by recurso_tipo desc
  loop
    v_nombre := case v_propia.recurso_tipo when 'vehiculo' then 'El vehículo' else 'El conductor' end;
    if v_propia.en_curso then
      if now() > upper(v_propia.intervalo) then
        return next v_nombre || ' superó el horario previsto (fin previsto ' || private.momento(upper(v_propia.intervalo)) || ').';
      end if;
      v_efectivo := tstzrange(lower(v_propia.intervalo), greatest(upper(v_propia.intervalo), now()), '[]');
    else
      v_efectivo := v_propia.intervalo;
    end if;
    for v_otra in
      select o.* from public.ocupaciones_recurso o
      where o.activa and o.recurso_tipo = v_propia.recurso_tipo and o.recurso_id = v_propia.recurso_id
        and not (o.origen_tipo = p_origen_tipo and o.origen_id = p_origen_id)
        and o.en_curso <> v_propia.en_curso
        and (case when o.en_curso
              then tstzrange(lower(o.intervalo), greatest(upper(o.intervalo), now()), '[]')
              else o.intervalo end) && v_efectivo
      order by lower(o.intervalo)
    loop
      return next case
        when v_otra.en_curso then v_nombre || ' sigue ocupado ' || private.describir_ocupacion(v_otra) || '.'
        else v_nombre || ' tiene otra operación ' || private.describir_ocupacion(v_otra) || ' que puede verse afectada.'
      end;
    end loop;
  end loop;
end;
$$;

-- Saldo a favor aplicado a un cargo recién generado (la clave de la
-- aplicación es el propio cargo: no se repite).
create function private.aplicar_anticipo(p_cargo_id uuid, p_monto numeric)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(p_monto, 0) > 0 then
    perform public.aplicar_saldo_a_favor(p_cargo_id, p_cargo_id, p_monto);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Alquileres
-- ---------------------------------------------------------------------------

-- Reserva: el vehículo queda ocupado en el intervalo (comprobado en la base).
create function public.registrar_alquiler(
  p_idempotencia uuid,
  p_cliente_id uuid,
  p_vehiculo_id uuid,
  p_entrega_prevista timestamptz,
  p_devolucion_prevista timestamptz,
  p_tarifa_id uuid,
  p_precio numeric,
  p_notas text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existente public.alquileres;
  v_notas text;
  v_id uuid;
begin
  perform private.exigir_rol('administrador', 'operador');
  perform private.exigir_clave(p_idempotencia);

  select * into v_existente from public.alquileres where idempotencia = p_idempotencia;
  if v_existente.id is not null then
    perform private.exigir_misma_operacion(v_existente.vehiculo_id = p_vehiculo_id and v_existente.entrega_prevista = p_entrega_prevista);
    return v_existente.id;
  end if;

  if p_entrega_prevista is null or p_devolucion_prevista is null or p_entrega_prevista < timestamptz '2000-01-01' then
    raise exception 'Indique la fecha y hora de entrega y de devolución.' using errcode = '22023';
  end if;
  if p_devolucion_prevista <= p_entrega_prevista then
    raise exception 'La devolución debe ser posterior a la entrega.' using errcode = '22023';
  end if;
  perform private.validar_monto(p_precio);
  v_notas := private.texto(p_notas, 1000, 'las observaciones', false);
  if not exists (select 1 from public.clientes where id = p_cliente_id and activo) then
    raise exception 'Cliente no encontrado o inactivo.' using errcode = '22023';
  end if;
  perform private.exigir_vehiculo(p_vehiculo_id, 'alquileres');
  if p_tarifa_id is not null
     and not exists (select 1 from public.tarifas where id = p_tarifa_id and actividad = 'alquileres') then
    raise exception 'Seleccione una tarifa de alquileres.' using errcode = '22023';
  end if;

  insert into public.alquileres (
    cliente_id, vehiculo_id, entrega_prevista, devolucion_prevista, tarifa_id, precio_pactado, notas,
    idempotencia, creado_por, actualizado_por
  )
  values (
    p_cliente_id, p_vehiculo_id, p_entrega_prevista, p_devolucion_prevista, p_tarifa_id, p_precio, v_notas,
    p_idempotencia, auth.uid(), auth.uid()
  )
  on conflict (idempotencia) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_existente from public.alquileres where idempotencia = p_idempotencia;
    perform private.exigir_misma_operacion(v_existente.vehiculo_id = p_vehiculo_id and v_existente.entrega_prevista = p_entrega_prevista);
    return v_existente.id;
  end if;

  perform private.ocupar_recurso(
    'vehiculo', p_vehiculo_id, 'alquiler', v_id, tstzrange(p_entrega_prevista, p_devolucion_prevista, '[)')
  );
  perform private.registrar_bitacora(
    'alquileres', v_id, 'registrar_alquiler', null, null,
    jsonb_build_object('vehiculo_id', p_vehiculo_id, 'entrega_prevista', p_entrega_prevista,
      'devolucion_prevista', p_devolucion_prevista, 'precio_pactado', p_precio, 'tarifa_id', p_tarifa_id)
  );
  return v_id;
end;
$$;

-- Cambia vehículo, fechas, precio u observaciones de una reserva (con motivo).
create function public.modificar_alquiler(
  p_alquiler_id uuid,
  p_vehiculo_id uuid,
  p_entrega_prevista timestamptz,
  p_devolucion_prevista timestamptz,
  p_tarifa_id uuid,
  p_precio numeric,
  p_notas text,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_alquiler public.alquileres;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);
  select * into v_alquiler from public.alquileres where id = p_alquiler_id for update;
  if v_alquiler.id is null then
    raise exception 'Alquiler no encontrado.' using errcode = 'P0002';
  end if;
  if v_alquiler.estado <> 'reservado' then
    raise exception 'Solo se modifica una reserva que no ha sido entregada.' using errcode = '22023';
  end if;
  if p_entrega_prevista is null or p_devolucion_prevista is null or p_devolucion_prevista <= p_entrega_prevista then
    raise exception 'La devolución debe ser posterior a la entrega.' using errcode = '22023';
  end if;
  perform private.validar_monto(p_precio);
  perform private.exigir_vehiculo(p_vehiculo_id, 'alquileres');
  if p_tarifa_id is not null
     and not exists (select 1 from public.tarifas where id = p_tarifa_id and actividad = 'alquileres') then
    raise exception 'Seleccione una tarifa de alquileres.' using errcode = '22023';
  end if;

  if (p_vehiculo_id, p_entrega_prevista, p_devolucion_prevista)
     is distinct from (v_alquiler.vehiculo_id, v_alquiler.entrega_prevista, v_alquiler.devolucion_prevista) then
    perform private.ocupar_recurso(
      'vehiculo', p_vehiculo_id, 'alquiler', p_alquiler_id, tstzrange(p_entrega_prevista, p_devolucion_prevista, '[)')
    );
  end if;
  update public.alquileres
  set vehiculo_id = p_vehiculo_id, entrega_prevista = p_entrega_prevista, devolucion_prevista = p_devolucion_prevista,
    tarifa_id = p_tarifa_id, precio_pactado = p_precio, notas = private.texto(p_notas, 1000, 'las observaciones', false),
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_alquiler_id;

  perform private.registrar_bitacora(
    'alquileres', p_alquiler_id, 'modificar_alquiler', v_motivo,
    jsonb_build_object('vehiculo_id', v_alquiler.vehiculo_id, 'entrega_prevista', v_alquiler.entrega_prevista,
      'devolucion_prevista', v_alquiler.devolucion_prevista, 'precio_pactado', v_alquiler.precio_pactado),
    jsonb_build_object('vehiculo_id', p_vehiculo_id, 'entrega_prevista', p_entrega_prevista,
      'devolucion_prevista', p_devolucion_prevista, 'precio_pactado', p_precio)
  );
end;
$$;

-- Entrega real: el vehículo queda ocupado hasta su devolución real. No se
-- entrega si sigue en otro servicio o si la entrega anticipada se cruza con
-- otra operación programada.
create function public.entregar_alquiler(
  p_alquiler_id uuid, p_km_salida integer, p_combustible public.nivel_combustible, p_notas text
)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alquiler public.alquileres;
  v_intervalo tstzrange;
  v_conflicto public.ocupaciones_recurso;
begin
  perform private.exigir_rol('administrador', 'operador');
  select * into v_alquiler from public.alquileres where id = p_alquiler_id for update;
  if v_alquiler.id is null then
    raise exception 'Alquiler no encontrado.' using errcode = 'P0002';
  end if;
  if v_alquiler.estado <> 'reservado' then
    raise exception 'Solo se entrega un alquiler reservado (estado actual: %).', v_alquiler.estado using errcode = '22023';
  end if;
  if p_km_salida is null or p_km_salida < 0 then
    raise exception 'Indique el kilometraje de salida.' using errcode = '22023';
  end if;
  if p_combustible is null then
    raise exception 'Indique el nivel de combustible de salida.' using errcode = '22023';
  end if;
  perform private.exigir_vehiculo(v_alquiler.vehiculo_id, 'alquileres');
  perform private.exigir_recurso_libre('vehiculo', v_alquiler.vehiculo_id, 'alquiler', p_alquiler_id);

  v_intervalo := tstzrange(now(), greatest(v_alquiler.devolucion_prevista, now() + interval '1 minute'), '[)');
  v_conflicto := private.conflicto_recurso('vehiculo', v_alquiler.vehiculo_id, v_intervalo, 'alquiler', p_alquiler_id);
  if v_conflicto.id is not null then
    raise exception 'No se puede entregar ahora: el vehículo tiene otra operación %.', private.describir_ocupacion(v_conflicto)
      using errcode = '22023';
  end if;

  perform private.ocupar_en_curso('vehiculo', v_alquiler.vehiculo_id, 'alquiler', p_alquiler_id, v_intervalo);
  update public.alquileres
  set estado = 'entregado', entrega_real = now(), km_salida = p_km_salida, combustible_salida = p_combustible,
    notas_entrega = private.texto(p_notas, 1000, 'las observaciones de entrega', false),
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_alquiler_id;

  perform private.registrar_bitacora(
    'alquileres', p_alquiler_id, 'entregar_alquiler', null,
    jsonb_build_object('estado', 'reservado'),
    jsonb_build_object('estado', 'entregado', 'km_salida', p_km_salida, 'combustible_salida', p_combustible)
  );
  return query select private.avisos_ocupacion('alquiler', p_alquiler_id);
end;
$$;

-- Devolución real (una sola vez; repetirla no hace nada): libera el vehículo,
-- registra los cargos adicionales expresos ([{"concepto", "monto"}]) y genera
-- el cargo por precio pactado + adicionales. Un kilometraje final menor que
-- el inicial exige corrección justificada del administrador.
create function public.devolver_alquiler(
  p_alquiler_id uuid,
  p_km_regreso integer,
  p_combustible public.nivel_combustible,
  p_notas text,
  p_adicionales jsonb default '[]'::jsonb,
  p_aplicar_anticipo numeric default null,
  p_motivo_correccion_km text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alquiler public.alquileres;
  v_codigo text;
  v_motivo_km text;
  v_adicional jsonb;
  v_concepto text;
  v_total numeric(14, 2);
  v_adicionales numeric(14, 2) := 0;
  v_fin timestamptz := now();
  v_cargo uuid;
begin
  perform private.exigir_rol('administrador', 'operador');
  select * into v_alquiler from public.alquileres where id = p_alquiler_id for update;
  if v_alquiler.id is null then
    raise exception 'Alquiler no encontrado.' using errcode = 'P0002';
  end if;
  if v_alquiler.estado = 'devuelto' then
    return jsonb_build_object('devuelto', true, 'repetido', true, 'cargo_id', v_alquiler.cargo_id);
  end if;
  if v_alquiler.estado <> 'entregado' then
    raise exception 'El vehículo no ha sido entregado: no puede registrarse su devolución.' using errcode = '22023';
  end if;
  if p_km_regreso is null or p_km_regreso < 0 then
    raise exception 'Indique el kilometraje de regreso.' using errcode = '22023';
  end if;
  if p_combustible is null then
    raise exception 'Indique el nivel de combustible de regreso.' using errcode = '22023';
  end if;
  v_motivo_km := private.texto(p_motivo_correccion_km, 300, 'el motivo de la corrección', false);
  if p_km_regreso < v_alquiler.km_salida then
    if v_motivo_km is null or not private.tiene_rol('administrador') then
      raise exception 'El kilometraje de regreso (%) es menor que el de salida (%): requiere corrección justificada del administrador.',
        p_km_regreso, v_alquiler.km_salida using errcode = '22023';
    end if;
  else
    v_motivo_km := null;
  end if;

  p_adicionales := coalesce(p_adicionales, '[]'::jsonb);
  if jsonb_typeof(p_adicionales) <> 'array' then
    raise exception 'Los cargos adicionales no tienen un formato válido.' using errcode = '22023';
  end if;
  for v_adicional in select value from jsonb_array_elements(p_adicionales) loop
    v_concepto := private.texto(v_adicional ->> 'concepto', 200, 'el concepto del cargo adicional', true);
    perform private.validar_monto((v_adicional ->> 'monto')::numeric);
    insert into public.cargos_adicionales_alquiler (alquiler_id, concepto, monto, creado_por)
    values (p_alquiler_id, v_concepto, (v_adicional ->> 'monto')::numeric, auth.uid());
    v_adicionales := v_adicionales + (v_adicional ->> 'monto')::numeric;
  end loop;
  v_total := v_alquiler.precio_pactado + v_adicionales;

  perform private.liberar_recursos('alquiler', p_alquiler_id);
  select codigo into v_codigo from public.vehiculos where id = v_alquiler.vehiculo_id;
  v_cargo := private.registrar_cargo_servicio(
    v_alquiler.cliente_id, 'alquiler', p_alquiler_id, '4300',
    'Alquiler de ' || v_codigo || ' del ' || private.momento(v_alquiler.entrega_real) || ' al ' || private.momento(v_fin)
      || case when v_adicionales > 0 then ' (incluye cargos adicionales)' else '' end,
    private.fecha_local(v_fin), private.fecha_local(v_fin), v_total
  );
  update public.alquileres
  set estado = 'devuelto', devolucion_real = v_fin, km_regreso = p_km_regreso, combustible_regreso = p_combustible,
    notas_devolucion = private.texto(p_notas, 1000, 'las observaciones de devolución', false),
    motivo_correccion_km = v_motivo_km, cargo_id = v_cargo, updated_at = now(), actualizado_por = auth.uid()
  where id = p_alquiler_id;
  perform private.aplicar_anticipo(v_cargo, p_aplicar_anticipo);

  perform private.registrar_bitacora(
    'alquileres', p_alquiler_id, 'devolver_alquiler', v_motivo_km,
    jsonb_build_object('estado', 'entregado', 'km_salida', v_alquiler.km_salida, 'combustible_salida', v_alquiler.combustible_salida),
    jsonb_build_object('estado', 'devuelto', 'km_regreso', p_km_regreso, 'combustible_regreso', p_combustible,
      'cargos_adicionales', v_adicionales, 'importe', v_total, 'cargo_id', v_cargo, 'anticipo_aplicado', p_aplicar_anticipo)
  );
  return jsonb_build_object('devuelto', true, 'repetido', false, 'cargo_id', v_cargo, 'importe', v_total);
end;
$$;

-- Solo una reserva se cancela; un alquiler entregado debe devolverse.
create function public.cancelar_alquiler(p_alquiler_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_alquiler public.alquileres;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);
  select * into v_alquiler from public.alquileres where id = p_alquiler_id for update;
  if v_alquiler.id is null then
    raise exception 'Alquiler no encontrado.' using errcode = 'P0002';
  end if;
  if v_alquiler.estado = 'entregado' then
    raise exception 'El vehículo ya fue entregado: registre primero su devolución.' using errcode = '22023';
  end if;
  if v_alquiler.estado <> 'reservado' then
    raise exception 'El alquiler está % y no se puede cancelar.', v_alquiler.estado using errcode = '22023';
  end if;
  perform private.liberar_recursos('alquiler', p_alquiler_id);
  update public.alquileres
  set estado = 'cancelado', motivo_cancelacion = v_motivo, cancelado_en = now(), cancelado_por = auth.uid(),
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_alquiler_id;
  perform private.registrar_bitacora(
    'alquileres', p_alquiler_id, 'cancelar_alquiler', v_motivo,
    jsonb_build_object('estado', 'reservado'), jsonb_build_object('estado', 'cancelado')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Transportes con conductor
-- ---------------------------------------------------------------------------

create function private.bloquear_transporte(p_transporte_id uuid)
returns public.transportes
language plpgsql
set search_path = ''
as $$
declare
  v_transporte public.transportes;
begin
  select * into v_transporte from public.transportes where id = p_transporte_id for update;
  if v_transporte.id is null then
    raise exception 'Servicio de transporte no encontrado.' using errcode = 'P0002';
  end if;
  return v_transporte;
end;
$$;

-- Asigna (o quita, con nulo) vehículo y conductor de un servicio no iniciado.
create function private.ocupar_recursos_transporte(
  p_transporte public.transportes, p_vehiculo_id uuid, p_conductor_id uuid, p_intervalo tstzrange
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_vehiculo_id is null then
    perform private.liberar_recursos('transporte', p_transporte.id, 'vehiculo');
  else
    perform private.exigir_vehiculo(p_vehiculo_id, 'transportes');
    perform private.ocupar_recurso('vehiculo', p_vehiculo_id, 'transporte', p_transporte.id, p_intervalo);
  end if;
  if p_conductor_id is null then
    perform private.liberar_recursos('transporte', p_transporte.id, 'conductor');
  else
    perform private.exigir_conductor(p_conductor_id);
    perform private.ocupar_recurso('conductor', p_conductor_id, 'transporte', p_transporte.id, p_intervalo);
  end if;
end;
$$;

create function public.registrar_transporte(
  p_idempotencia uuid,
  p_cliente_id uuid,
  p_inicio_previsto timestamptz,
  p_minutos_estimados integer,
  p_origen text,
  p_destino text,
  p_tarifa_id uuid,
  p_precio numeric,
  p_notas text,
  p_vehiculo_id uuid default null,
  p_conductor_id uuid default null,
  p_programar boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existente public.transportes;
  v_transporte public.transportes;
  v_minutos integer := coalesce(p_minutos_estimados, 90);
  v_id uuid;
begin
  perform private.exigir_rol('administrador', 'operador');
  perform private.exigir_clave(p_idempotencia);

  select * into v_existente from public.transportes where idempotencia = p_idempotencia;
  if v_existente.id is not null then
    perform private.exigir_misma_operacion(v_existente.cliente_id = p_cliente_id and v_existente.inicio_previsto = p_inicio_previsto);
    return v_existente.id;
  end if;

  perform private.validar_horario(p_inicio_previsto, v_minutos);
  if p_precio is not null then
    perform private.validar_monto(p_precio);
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and activo) then
    raise exception 'Cliente no encontrado o inactivo.' using errcode = '22023';
  end if;
  if p_tarifa_id is not null
     and not exists (select 1 from public.tarifas where id = p_tarifa_id and actividad = 'transportes') then
    raise exception 'Seleccione una tarifa de transportes.' using errcode = '22023';
  end if;

  insert into public.transportes (
    cliente_id, inicio_previsto, minutos_estimados, origen, destino, tarifa_id, precio_pactado, notas, estado,
    idempotencia, creado_por, actualizado_por
  )
  values (
    p_cliente_id, p_inicio_previsto, v_minutos, private.texto(p_origen, 300, 'el origen', true),
    private.texto(p_destino, 300, 'el destino', true), p_tarifa_id, p_precio,
    private.texto(p_notas, 1000, 'las observaciones', false),
    case when p_programar then 'programado'::public.estado_transporte else 'solicitado' end,
    p_idempotencia, auth.uid(), auth.uid()
  )
  on conflict (idempotencia) do nothing
  returning * into v_transporte;

  if v_transporte.id is null then
    select * into v_existente from public.transportes where idempotencia = p_idempotencia;
    perform private.exigir_misma_operacion(v_existente.cliente_id = p_cliente_id and v_existente.inicio_previsto = p_inicio_previsto);
    return v_existente.id;
  end if;
  v_id := v_transporte.id;

  if p_vehiculo_id is not null or p_conductor_id is not null then
    perform private.ocupar_recursos_transporte(
      v_transporte, p_vehiculo_id, p_conductor_id, private.intervalo_servicio(p_inicio_previsto, v_minutos)
    );
    update public.transportes set vehiculo_id = p_vehiculo_id, conductor_id = p_conductor_id where id = v_id;
  end if;

  perform private.registrar_bitacora(
    'transportes', v_id, 'registrar_transporte', null, null,
    jsonb_build_object('estado', v_transporte.estado, 'inicio_previsto', p_inicio_previsto, 'minutos_estimados', v_minutos,
      'vehiculo_id', p_vehiculo_id, 'conductor_id', p_conductor_id, 'precio_pactado', p_precio)
  );
  return v_id;
end;
$$;

create function public.programar_transporte(p_transporte_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transporte public.transportes;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_transporte := private.bloquear_transporte(p_transporte_id);
  if v_transporte.estado <> 'solicitado' then
    raise exception 'Solo se programa un servicio solicitado (estado actual: %).', v_transporte.estado using errcode = '22023';
  end if;
  update public.transportes set estado = 'programado', updated_at = now(), actualizado_por = auth.uid() where id = p_transporte_id;
  perform private.registrar_bitacora(
    'transportes', p_transporte_id, 'programar_transporte', null,
    jsonb_build_object('estado', 'solicitado'), jsonb_build_object('estado', 'programado')
  );
end;
$$;

create function public.asignar_recursos_transporte(
  p_transporte_id uuid, p_vehiculo_id uuid, p_conductor_id uuid, p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transporte public.transportes;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_transporte := private.bloquear_transporte(p_transporte_id);
  if v_transporte.estado not in ('solicitado', 'programado') then
    raise exception 'Los recursos se asignan antes de iniciar el servicio.' using errcode = '22023';
  end if;
  if (p_vehiculo_id, p_conductor_id) is not distinct from (v_transporte.vehiculo_id, v_transporte.conductor_id) then
    raise exception 'El vehículo y el conductor indicados ya están asignados.' using errcode = '22023';
  end if;
  perform private.ocupar_recursos_transporte(
    v_transporte, p_vehiculo_id, p_conductor_id,
    private.intervalo_servicio(v_transporte.inicio_previsto, v_transporte.minutos_estimados)
  );
  update public.transportes
  set vehiculo_id = p_vehiculo_id, conductor_id = p_conductor_id, updated_at = now(), actualizado_por = auth.uid()
  where id = p_transporte_id;
  perform private.registrar_bitacora(
    'transportes', p_transporte_id, 'asignar_recursos', private.texto(p_motivo, 300, 'el motivo', false),
    jsonb_build_object('vehiculo_id', v_transporte.vehiculo_id, 'conductor_id', v_transporte.conductor_id),
    jsonb_build_object('vehiculo_id', p_vehiculo_id, 'conductor_id', p_conductor_id)
  );
end;
$$;

create function public.reprogramar_transporte(
  p_transporte_id uuid, p_inicio_previsto timestamptz, p_minutos_estimados integer, p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_transporte public.transportes;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);
  perform private.validar_horario(p_inicio_previsto, p_minutos_estimados);
  v_transporte := private.bloquear_transporte(p_transporte_id);
  if v_transporte.estado not in ('solicitado', 'programado') then
    raise exception 'Solo se reprograma un servicio que no ha comenzado.' using errcode = '22023';
  end if;
  if (p_inicio_previsto, p_minutos_estimados) is not distinct from (v_transporte.inicio_previsto, v_transporte.minutos_estimados) then
    raise exception 'La fecha, la hora y la duración indicadas son las vigentes.' using errcode = '22023';
  end if;
  perform private.ocupar_recursos_transporte(
    v_transporte, v_transporte.vehiculo_id, v_transporte.conductor_id,
    private.intervalo_servicio(p_inicio_previsto, p_minutos_estimados)
  );
  update public.transportes
  set inicio_previsto = p_inicio_previsto, minutos_estimados = p_minutos_estimados,
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_transporte_id;
  perform private.registrar_bitacora(
    'transportes', p_transporte_id, 'reprogramar_transporte', v_motivo,
    jsonb_build_object('inicio_previsto', v_transporte.inicio_previsto, 'minutos_estimados', v_transporte.minutos_estimados),
    jsonb_build_object('inicio_previsto', p_inicio_previsto, 'minutos_estimados', p_minutos_estimados)
  );
end;
$$;

-- Duración de un servicio en curso: no reprograma otros; devuelve avisos.
create function public.ajustar_duracion_transporte(p_transporte_id uuid, p_minutos_estimados integer, p_motivo text default null)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transporte public.transportes;
  v_intervalo tstzrange;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_transporte := private.bloquear_transporte(p_transporte_id);
  if v_transporte.estado <> 'en_curso' then
    raise exception 'La duración de un servicio no iniciado se cambia al reprogramarlo.' using errcode = '22023';
  end if;
  perform private.validar_horario(v_transporte.inicio_real, p_minutos_estimados);
  if p_minutos_estimados = v_transporte.minutos_estimados then
    raise exception 'La duración indicada es la vigente.' using errcode = '22023';
  end if;
  v_intervalo := private.intervalo_servicio(v_transporte.inicio_real, p_minutos_estimados);
  perform private.bloquear_recurso('vehiculo', v_transporte.vehiculo_id);
  perform private.bloquear_recurso('conductor', v_transporte.conductor_id);
  perform private.ocupar_en_curso('vehiculo', v_transporte.vehiculo_id, 'transporte', p_transporte_id, v_intervalo);
  perform private.ocupar_en_curso('conductor', v_transporte.conductor_id, 'transporte', p_transporte_id, v_intervalo);
  update public.transportes
  set minutos_estimados = p_minutos_estimados, updated_at = now(), actualizado_por = auth.uid()
  where id = p_transporte_id;
  perform private.registrar_bitacora(
    'transportes', p_transporte_id, 'ajustar_duracion', private.texto(p_motivo, 300, 'el motivo', false),
    null, jsonb_build_object('minutos_estimados', p_minutos_estimados)
  );
  return query select private.avisos_ocupacion('transporte', p_transporte_id);
end;
$$;

create function public.editar_transporte(
  p_transporte_id uuid, p_origen text, p_destino text, p_tarifa_id uuid, p_precio numeric, p_notas text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transporte public.transportes;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_transporte := private.bloquear_transporte(p_transporte_id);
  if v_transporte.estado in ('completado', 'cancelado') then
    raise exception 'Un servicio % no se edita.', v_transporte.estado using errcode = '22023';
  end if;
  if p_precio is not null then
    perform private.validar_monto(p_precio);
  end if;
  if p_tarifa_id is not null
     and not exists (select 1 from public.tarifas where id = p_tarifa_id and actividad = 'transportes') then
    raise exception 'Seleccione una tarifa de transportes.' using errcode = '22023';
  end if;
  update public.transportes
  set origen = private.texto(p_origen, 300, 'el origen', true), destino = private.texto(p_destino, 300, 'el destino', true),
    tarifa_id = p_tarifa_id, precio_pactado = p_precio, notas = private.texto(p_notas, 1000, 'las observaciones', false),
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_transporte_id;
  perform private.registrar_bitacora(
    'transportes', p_transporte_id, 'editar_transporte', null,
    jsonb_build_object('origen', v_transporte.origen, 'destino', v_transporte.destino, 'precio_pactado', v_transporte.precio_pactado),
    jsonb_build_object('origen', p_origen, 'destino', p_destino, 'precio_pactado', p_precio)
  );
end;
$$;

-- Exige vehículo y conductor asignados, aptos y libres (ninguno sigue en otro
-- servicio en curso o alquiler entregado, aunque se haya pasado de horario).
create function public.iniciar_transporte(p_transporte_id uuid)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transporte public.transportes;
  v_intervalo tstzrange;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_transporte := private.bloquear_transporte(p_transporte_id);
  if v_transporte.estado in ('en_curso', 'completado') then
    raise exception 'El servicio ya fue iniciado.' using errcode = '22023';
  end if;
  if v_transporte.estado = 'cancelado' then
    raise exception 'Un servicio cancelado no puede iniciarse.' using errcode = '22023';
  end if;
  if v_transporte.vehiculo_id is null or v_transporte.conductor_id is null then
    raise exception 'Asigne el vehículo y el conductor antes de iniciar.' using errcode = '22023';
  end if;
  perform private.exigir_vehiculo(v_transporte.vehiculo_id, 'transportes');
  perform private.exigir_conductor(v_transporte.conductor_id);
  perform private.exigir_recurso_libre('vehiculo', v_transporte.vehiculo_id, 'transporte', p_transporte_id);
  perform private.exigir_recurso_libre('conductor', v_transporte.conductor_id, 'transporte', p_transporte_id);

  v_intervalo := private.intervalo_servicio(now(), v_transporte.minutos_estimados);
  perform private.ocupar_en_curso('vehiculo', v_transporte.vehiculo_id, 'transporte', p_transporte_id, v_intervalo);
  perform private.ocupar_en_curso('conductor', v_transporte.conductor_id, 'transporte', p_transporte_id, v_intervalo);
  update public.transportes
  set estado = 'en_curso', inicio_real = now(), updated_at = now(), actualizado_por = auth.uid()
  where id = p_transporte_id;
  perform private.registrar_bitacora(
    'transportes', p_transporte_id, 'iniciar_transporte', null, null, jsonb_build_object('estado', 'en_curso')
  );
  return query select private.avisos_ocupacion('transporte', p_transporte_id);
end;
$$;

-- Completa una sola vez (repetir no hace nada): libera recursos, genera el
-- cargo por el precio pactado y, si se indica, aplica saldo a favor.
create function public.finalizar_transporte(
  p_transporte_id uuid, p_notas_finales text, p_aplicar_anticipo numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transporte public.transportes;
  v_fin timestamptz := now();
  v_cargo uuid;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_transporte := private.bloquear_transporte(p_transporte_id);
  if v_transporte.estado = 'completado' then
    return jsonb_build_object('completado', true, 'repetido', true, 'cargo_id', v_transporte.cargo_id);
  end if;
  if v_transporte.estado <> 'en_curso' then
    raise exception 'Solo se finaliza un servicio en curso.' using errcode = '22023';
  end if;
  if v_transporte.precio_pactado is null then
    raise exception 'Indique el precio pactado antes de finalizar.' using errcode = '22023';
  end if;

  perform private.liberar_recursos('transporte', p_transporte_id);
  v_cargo := private.registrar_cargo_servicio(
    v_transporte.cliente_id, 'transporte', p_transporte_id, '4400',
    'Transporte del ' || private.momento(v_transporte.inicio_real) || ': ' || v_transporte.origen || ' → ' || v_transporte.destino,
    private.fecha_local(v_fin), private.fecha_local(v_fin), v_transporte.precio_pactado
  );
  update public.transportes
  set estado = 'completado', fin_real = v_fin, cargo_id = v_cargo,
    notas_finales = private.texto(p_notas_finales, 1000, 'las observaciones finales', false),
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_transporte_id;
  perform private.aplicar_anticipo(v_cargo, p_aplicar_anticipo);

  perform private.registrar_bitacora(
    'transportes', p_transporte_id, 'finalizar_transporte', null,
    jsonb_build_object('estado', 'en_curso'),
    jsonb_build_object('estado', 'completado', 'fin_real', v_fin, 'cargo_id', v_cargo, 'anticipo_aplicado', p_aplicar_anticipo)
  );
  return jsonb_build_object('completado', true, 'repetido', false, 'cargo_id', v_cargo);
end;
$$;

create function public.cancelar_transporte(p_transporte_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_transporte public.transportes;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);
  v_transporte := private.bloquear_transporte(p_transporte_id);
  if v_transporte.estado = 'en_curso' then
    raise exception 'El servicio ya comenzó: no puede cancelarse; finalícelo.' using errcode = '22023';
  end if;
  if v_transporte.estado in ('completado', 'cancelado') then
    raise exception 'El servicio está % y no se puede cancelar.', v_transporte.estado using errcode = '22023';
  end if;
  perform private.liberar_recursos('transporte', p_transporte_id);
  update public.transportes
  set estado = 'cancelado', motivo_cancelacion = v_motivo, cancelado_en = now(), cancelado_por = auth.uid(),
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_transporte_id;
  perform private.registrar_bitacora(
    'transportes', p_transporte_id, 'cancelar_transporte', v_motivo,
    jsonb_build_object('estado', v_transporte.estado), jsonb_build_object('estado', 'cancelado')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Consultas (sin escritura)
-- ---------------------------------------------------------------------------

-- Vehículos aptos para la actividad (y conductores, salvo en alquileres),
-- libres o no en un intervalo, sin contar el documento indicado.
create function public.disponibilidad_recursos(
  p_actividad public.actividad, p_inicio timestamptz, p_fin timestamptz,
  p_origen_tipo public.origen_ocupacion default null, p_origen_id uuid default null
)
returns table (recurso_tipo text, recurso_id uuid, nombre text, disponible boolean, detalle text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_intervalo tstzrange;
  v_origen_tipo public.origen_ocupacion := coalesce(p_origen_tipo, 'traslado');
  v_origen_id uuid := coalesce(p_origen_id, '00000000-0000-0000-0000-000000000000'::uuid);
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');
  if p_inicio is null or p_fin is null or p_fin <= p_inicio then
    raise exception 'Indique un intervalo válido.' using errcode = '22023';
  end if;
  v_intervalo := tstzrange(p_inicio, p_fin, '[)');
  return query
  select 'vehiculo'::text, v.id, v.codigo || coalesce(' · ' || v.placa, ''), o.id is null, private.describir_ocupacion(o)
  from public.vehiculos v
  left join lateral (
    select * from private.conflicto_recurso('vehiculo', v.id, v_intervalo, v_origen_tipo, v_origen_id)
  ) o on true
  where v.activo and v.estado = 'operativo'
    and v.tipo::text in ('mixto', case p_actividad
      when 'ambulancias' then 'ambulancia' when 'alquileres' then 'alquiler' when 'transportes' then 'transporte' end)
  union all
  select 'conductor'::text, c.id, c.nombre, o.id is null, private.describir_ocupacion(o)
  from public.conductores c
  left join lateral (
    select * from private.conflicto_recurso('conductor', c.id, v_intervalo, v_origen_tipo, v_origen_id)
  ) o on true
  where c.activo and p_actividad <> 'alquileres'
  order by 1, 3;
end;
$$;

create function public.avisos_operacion(p_origen_tipo public.origen_ocupacion, p_origen_id uuid)
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');
  return query select private.avisos_ocupacion(p_origen_tipo, p_origen_id);
end;
$$;

-- Historial de un alquiler o transporte (bitácora) para los tres roles.
create function public.historial_operacion(p_entidad text, p_registro_id uuid)
returns table (fecha timestamptz, accion text, motivo text, antes jsonb, despues jsonb, actor text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');
  if p_entidad not in ('alquileres', 'transportes') then
    raise exception 'Historial no disponible.' using errcode = '22023';
  end if;
  return query
  select b.fecha, b.accion, b.motivo, b.antes, b.despues, p.nombre
  from public.bitacora b
  left join public.perfiles p on p.id = b.actor_id
  where b.entidad = p_entidad and b.registro_id = p_registro_id
  order by b.fecha desc
  limit 100;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'registrar_alquiler', 'modificar_alquiler', 'entregar_alquiler', 'devolver_alquiler', 'cancelar_alquiler',
      'registrar_transporte', 'programar_transporte', 'asignar_recursos_transporte', 'reprogramar_transporte',
      'ajustar_duracion_transporte', 'editar_transporte', 'iniciar_transporte', 'finalizar_transporte',
      'cancelar_transporte', 'disponibilidad_recursos', 'avisos_operacion', 'historial_operacion'
    ])
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = any (array[
      'exigir_vehiculo', 'exigir_recurso_libre', 'avisos_ocupacion', 'aplicar_anticipo', 'bloquear_transporte',
      'ocupar_recursos_transporte'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
