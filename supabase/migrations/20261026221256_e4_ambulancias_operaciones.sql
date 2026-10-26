-- E4 · Ambulancias: operaciones.
--
-- Mismo patrón que E2 y E3: funciones públicas SECURITY DEFINER con
-- search_path vacío que verifican auth.uid() y el rol, validan y escriben en
-- una transacción. Errores de negocio: 22023, 42501 y P0002.
--
-- Orden de bloqueo (evita interbloqueos): membresía → traslado → vehículo →
-- conductor.
--
-- Cobertura de un traslado cubierto (fecha del servicio en Tegucigalpa):
--   valida               período generado, membresía activa sin cuotas
--                        vencidas, beneficiario vinculado y cupo libre:
--                        reserva el beneficio en ese período;
--   pendiente_validacion el período de la fecha aún no existe (E3 no genera
--                        mensualidades futuras): reserva provisional en el
--                        período previsto según el ciclo actual, sin cargo;
--   no_valida            cualquier otro caso: la solicitud se conserva sin
--                        reserva y puede volver a validarse.
-- Se revalida al registrar, programar, reprogramar, antes de iniciar, a
-- pedido y cuando cambian la membresía (estado, ciclo, condiciones) o sus
-- beneficiarios. Al completar, la reserva se consume; al cancelar, se libera.
-- Nunca se convierte por sí solo en particular.
--
-- Particulares: el cargo (D 1200 / H 4200 Ingreso ambulancias particulares)
-- nace al completar, una sola vez, por el precio pactado; los anticipos del
-- cliente se aplican con aplicar_saldo_a_favor de E2.

-- ---------------------------------------------------------------------------
-- Auxiliares de fechas, cupos y cobertura
-- ---------------------------------------------------------------------------

create function private.fecha_local(p_momento timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_momento at time zone 'America/Tegucigalpa')::date
$$;

create function private.intervalo_servicio(p_inicio timestamptz, p_minutos integer)
returns tstzrange
language sql
stable
set search_path = ''
as $$
  select tstzrange(p_inicio, p_inicio + make_interval(mins => p_minutos), '[)')
$$;

create function private.momento(p_momento timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select to_char(p_momento at time zone 'America/Tegucigalpa', 'DD/MM/YYYY HH24:MI')
$$;

-- Inicio del período (todavía no generado) que contendrá una fecha igual o
-- posterior a la próxima renovación, según el ciclo vigente. Nulo si la fecha
-- es anterior a la próxima renovación.
create function private.inicio_periodo_previsto(p_membresia public.membresias, p_fecha date)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_inicio date := p_membresia.proxima_renovacion;
  v_siguiente date;
begin
  if p_fecha < v_inicio then
    return null;
  end if;
  loop
    v_siguiente := private.siguiente_renovacion(v_inicio, p_membresia.dia_ancla);
    exit when v_siguiente > p_fecha;
    v_inicio := v_siguiente;
  end loop;
  return v_inicio;
end;
$$;

-- Reservas vigentes (reservadas o consumidas) de un período de la membresía,
-- de un beneficiario o de todos (nulo), sin contar el traslado indicado.
create function private.cupo_usado(
  p_membresia_id uuid, p_periodo_inicio date, p_beneficiario_id uuid, p_excluir_traslado uuid
)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.reservas_beneficio r
  where r.membresia_id = p_membresia_id
    and r.periodo_inicio = p_periodo_inicio
    and r.estado <> 'liberada'
    and (p_beneficiario_id is null or r.beneficiario_id = p_beneficiario_id)
    and (p_excluir_traslado is null or r.traslado_id <> p_excluir_traslado)
$$;

-- Sustituye la versión de E3 (devolvía 0): ahora cuenta reservas y consumos
-- reales del período. consultar_cobertura de E3 la sigue usando.
create or replace function private.cupo_ocupado(p_periodo_id uuid, p_beneficiario_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select private.cupo_usado(p.membresia_id, p.inicio, p_beneficiario_id, null)
    from public.periodos_membresia p
    where p.id = p_periodo_id
  ), 0)
$$;

create function private.evaluar_cobertura(
  p_membresia_id uuid, p_beneficiario_id uuid, p_fecha date, p_traslado_id uuid
)
returns table (
  condicion public.condicion_cobertura,
  motivo text,
  periodo_id uuid,
  periodo_inicio date,
  cupo integer,
  disponibles integer
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_membresia public.membresias;
  v_periodo public.periodos_membresia;
  v_modalidad public.modalidad_cupo;
begin
  condicion := 'no_valida';
  select * into v_membresia from public.membresias where id = p_membresia_id;
  if v_membresia.id is null then
    motivo := 'Membresía no encontrada.';
  elsif v_membresia.estado = 'cancelada' then
    motivo := 'La membresía está cancelada.';
  elsif v_membresia.estado = 'suspendida' then
    motivo := 'La membresía está suspendida por morosidad desde el '
      || to_char(v_membresia.suspendida_desde, 'DD/MM/YYYY') || '.';
  elsif p_fecha < v_membresia.fecha_inicio then
    motivo := 'La fecha del servicio es anterior al inicio de la membresía.';
  elsif not exists (
    select 1 from public.membresia_beneficiarios mb
    where mb.membresia_id = p_membresia_id and mb.beneficiario_id = p_beneficiario_id
      and mb.fecha_alta <= p_fecha and (mb.fecha_baja is null or mb.fecha_baja > p_fecha)
  ) then
    motivo := 'El beneficiario no está vinculado a la membresía en la fecha del servicio.';
  elsif private.inicio_morosidad(p_membresia_id, private.hoy()) is not null then
    motivo := 'La membresía tiene cuotas vencidas fuera del plazo de gracia.';
  end if;
  if motivo is not null then
    return next;
    return;
  end if;

  select * into v_periodo
  from public.periodos_membresia p
  where p.membresia_id = p_membresia_id and p.inicio <= p_fecha and p.fin >= p_fecha;
  if v_periodo.id is not null then
    periodo_id := v_periodo.id;
    periodo_inicio := v_periodo.inicio;
    cupo := v_periodo.cupo_asignado;
    v_modalidad := v_periodo.modalidad_cupo;
  else
    periodo_inicio := private.inicio_periodo_previsto(v_membresia, p_fecha);
    if periodo_inicio is null then
      motivo := 'No hay un período de membresía para la fecha del servicio.';
      return next;
      return;
    end if;
    -- Período futuro: condiciones pactadas vigentes (se revalida al generarlo).
    cupo := v_membresia.cupo_pactado;
    v_modalidad := v_membresia.modalidad_cupo;
  end if;

  disponibles := private.calcular_disponibles(
    cupo, v_modalidad,
    private.cupo_usado(p_membresia_id, periodo_inicio, null, p_traslado_id),
    private.cupo_usado(p_membresia_id, periodo_inicio, p_beneficiario_id, p_traslado_id)
  );
  if disponibles <= 0 then
    motivo := 'El cupo de traslados del período está agotado.';
    periodo_id := null;
  elsif periodo_id is null then
    condicion := 'pendiente_validacion';
    motivo := 'El período del ' || to_char(periodo_inicio, 'DD/MM/YYYY')
      || ' aún no se ha generado: reserva provisional, se confirma antes de iniciar.';
  else
    condicion := 'valida';
  end if;
  return next;
end;
$$;

create function private.liberar_reserva(p_reserva_id uuid, p_motivo text)
returns void
language sql
set search_path = ''
as $$
  update public.reservas_beneficio
  set estado = 'liberada', motivo_liberacion = left(p_motivo, 300), liberada_en = now(), liberada_por = auth.uid()
  where id = p_reserva_id and estado <> 'liberada';
$$;

-- Reevalúa la cobertura de un traslado cubierto no iniciado y ajusta su
-- reserva: la conserva, la confirma (provisional → período generado), la
-- mueve de período o la libera. El llamador tiene bloqueados la membresía y
-- el traslado.
create function private.sincronizar_reserva(p_traslado_id uuid)
returns public.condicion_cobertura
language plpgsql
set search_path = ''
as $$
declare
  v_traslado public.traslados_ambulancia;
  v_fecha date;
  v_evaluacion record;
  v_reserva public.reservas_beneficio;
begin
  select * into v_traslado from public.traslados_ambulancia where id = p_traslado_id;
  if v_traslado.tipo <> 'cubierto' or v_traslado.estado not in ('solicitado', 'programado') then
    return v_traslado.condicion_cobertura;
  end if;

  v_fecha := private.fecha_local(v_traslado.inicio_previsto);
  select * into v_evaluacion
  from private.evaluar_cobertura(v_traslado.membresia_id, v_traslado.beneficiario_id, v_fecha, v_traslado.id);
  select * into v_reserva
  from public.reservas_beneficio where traslado_id = v_traslado.id and estado = 'reservada';

  if v_evaluacion.condicion = 'no_valida' then
    if v_reserva.id is not null then
      perform private.liberar_reserva(v_reserva.id, 'Sin cobertura: ' || v_evaluacion.motivo);
    end if;
  elsif v_reserva.id is not null and v_reserva.periodo_inicio = v_evaluacion.periodo_inicio
        and v_reserva.beneficiario_id = v_traslado.beneficiario_id then
    if v_reserva.periodo_id is distinct from v_evaluacion.periodo_id or v_reserva.fecha_servicio <> v_fecha then
      update public.reservas_beneficio
      set periodo_id = v_evaluacion.periodo_id, fecha_servicio = v_fecha
      where id = v_reserva.id;
    end if;
  else
    if v_reserva.id is not null then
      perform private.liberar_reserva(v_reserva.id, 'Cambio de período o de beneficiario');
    end if;
    insert into public.reservas_beneficio (
      traslado_id, membresia_id, beneficiario_id, periodo_inicio, periodo_id, fecha_servicio, creado_por
    )
    values (
      v_traslado.id, v_traslado.membresia_id, v_traslado.beneficiario_id, v_evaluacion.periodo_inicio,
      v_evaluacion.periodo_id, v_fecha, auth.uid()
    );
  end if;

  if (v_traslado.condicion_cobertura, v_traslado.motivo_cobertura, v_traslado.periodo_id)
     is distinct from (v_evaluacion.condicion, v_evaluacion.motivo, v_evaluacion.periodo_id) then
    update public.traslados_ambulancia
    set condicion_cobertura = v_evaluacion.condicion, motivo_cobertura = v_evaluacion.motivo,
      periodo_id = v_evaluacion.periodo_id, updated_at = now(), actualizado_por = auth.uid()
    where id = v_traslado.id;
    if v_traslado.condicion_cobertura is distinct from v_evaluacion.condicion then
      perform private.registrar_bitacora(
        'traslados_ambulancia', v_traslado.id, 'cambio_cobertura', v_evaluacion.motivo,
        jsonb_build_object('condicion_cobertura', v_traslado.condicion_cobertura),
        jsonb_build_object('condicion_cobertura', v_evaluacion.condicion, 'periodo_inicio', v_evaluacion.periodo_inicio)
      );
    end if;
  end if;
  return v_evaluacion.condicion;
end;
$$;

-- Revalida los traslados cubiertos no iniciados de una membresía. Primero
-- los que tienen reserva, del más reciente al más antiguo (si sobran
-- reservas, se liberan las últimas); después los no válidos, del más antiguo
-- al más reciente (el cupo liberado se asigna por orden de solicitud).
create function private.revalidar_traslados_membresia(p_membresia_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform 1 from public.membresias where id = p_membresia_id for update;
  for v_id in
    select id from public.traslados_ambulancia
    where membresia_id = p_membresia_id and estado in ('solicitado', 'programado') and condicion_cobertura <> 'no_valida'
    order by created_at desc, id
    for update
  loop
    perform private.sincronizar_reserva(v_id);
  end loop;
  for v_id in
    select id from public.traslados_ambulancia
    where membresia_id = p_membresia_id and estado in ('solicitado', 'programado') and condicion_cobertura = 'no_valida'
    order by created_at, id
    for update
  loop
    perform private.sincronizar_reserva(v_id);
  end loop;
end;
$$;

create function private.revalidar_por_membresia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.revalidar_traslados_membresia(new.id);
  return null;
end;
$$;

create trigger revalidar_traslados
after update of estado, dia_ancla, proxima_renovacion, cupo_pactado, modalidad_cupo on public.membresias
for each row
when (
  (old.estado, old.dia_ancla, old.proxima_renovacion, old.cupo_pactado, old.modalidad_cupo)
  is distinct from (new.estado, new.dia_ancla, new.proxima_renovacion, new.cupo_pactado, new.modalidad_cupo)
)
execute function private.revalidar_por_membresia();

create function private.revalidar_por_vinculo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.revalidar_traslados_membresia(new.membresia_id);
  return null;
end;
$$;

create trigger revalidar_traslados
after insert or update of activo on public.membresia_beneficiarios
for each row execute function private.revalidar_por_vinculo();

-- ---------------------------------------------------------------------------
-- Auxiliares de recursos (reutilizables por alquileres y transportes en E5)
-- ---------------------------------------------------------------------------

create function private.describir_ocupacion(p_ocupacion public.ocupaciones_recurso)
returns text
language sql
stable
set search_path = ''
as $$
  select case when p_ocupacion.id is null then null else
    case when p_ocupacion.en_curso then 'en un servicio en curso desde el ' || private.momento(lower(p_ocupacion.intervalo))
      else 'asignado del ' || private.momento(lower(p_ocupacion.intervalo)) || ' al ' || private.momento(upper(p_ocupacion.intervalo))
    end
  end
$$;

-- Primera ocupación activa de otro documento que se cruza con el intervalo.
-- Un servicio en curso ocupa al menos hasta ahora, aunque se prolongue.
create function private.conflicto_recurso(
  p_recurso_tipo text, p_recurso_id uuid, p_intervalo tstzrange,
  p_origen_tipo public.origen_ocupacion, p_origen_id uuid
)
returns public.ocupaciones_recurso
language sql
stable
set search_path = ''
as $$
  select o.*
  from public.ocupaciones_recurso o
  where o.activa and o.recurso_tipo = p_recurso_tipo and o.recurso_id = p_recurso_id
    and not (o.origen_tipo = p_origen_tipo and o.origen_id = p_origen_id)
    and (case when o.en_curso
          then tstzrange(lower(o.intervalo), greatest(upper(o.intervalo), now()), '[]')
          else o.intervalo end) && p_intervalo
  order by lower(o.intervalo)
  limit 1
$$;

-- Serializa las asignaciones de un mismo recurso.
create function private.bloquear_recurso(p_recurso_tipo text, p_recurso_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_recurso_tipo = 'vehiculo' then
    perform 1 from public.vehiculos where id = p_recurso_id for update;
  else
    perform 1 from public.conductores where id = p_recurso_id for update;
  end if;
end;
$$;

-- Ocupa un recurso para un documento en un horario planificado (sustituye la
-- ocupación anterior del mismo documento). Falla si se cruza con otra.
create function private.ocupar_recurso(
  p_recurso_tipo text, p_recurso_id uuid, p_origen_tipo public.origen_ocupacion, p_origen_id uuid,
  p_intervalo tstzrange
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_conflicto public.ocupaciones_recurso;
begin
  perform private.bloquear_recurso(p_recurso_tipo, p_recurso_id);
  v_conflicto := private.conflicto_recurso(p_recurso_tipo, p_recurso_id, p_intervalo, p_origen_tipo, p_origen_id);
  if v_conflicto.id is not null then
    raise exception '% está ocupado en ese horario (%).',
      case p_recurso_tipo when 'vehiculo' then 'El vehículo' else 'El conductor' end,
      private.describir_ocupacion(v_conflicto)
      using errcode = '22023';
  end if;
  update public.ocupaciones_recurso
  set activa = false, liberada_en = now()
  where origen_tipo = p_origen_tipo and origen_id = p_origen_id and recurso_tipo = p_recurso_tipo and activa;
  insert into public.ocupaciones_recurso (recurso_tipo, recurso_id, origen_tipo, origen_id, intervalo, creado_por)
  values (p_recurso_tipo, p_recurso_id, p_origen_tipo, p_origen_id, p_intervalo, auth.uid());
end;
$$;

-- Ocupación de un servicio que ya empezó: no compite con los horarios
-- planificados (el servicio está ocurriendo); los cruces se informan como avisos.
create function private.ocupar_en_curso(
  p_recurso_tipo text, p_recurso_id uuid, p_origen_tipo public.origen_ocupacion, p_origen_id uuid,
  p_intervalo tstzrange
)
returns void
language sql
set search_path = ''
as $$
  update public.ocupaciones_recurso
  set activa = false, liberada_en = now()
  where origen_tipo = p_origen_tipo and origen_id = p_origen_id and recurso_tipo = p_recurso_tipo and activa;
  insert into public.ocupaciones_recurso (recurso_tipo, recurso_id, origen_tipo, origen_id, intervalo, en_curso, creado_por)
  values (p_recurso_tipo, p_recurso_id, p_origen_tipo, p_origen_id, p_intervalo, true, auth.uid());
$$;

create function private.liberar_recursos(
  p_origen_tipo public.origen_ocupacion, p_origen_id uuid, p_recurso_tipo text default null
)
returns void
language sql
set search_path = ''
as $$
  update public.ocupaciones_recurso
  set activa = false, liberada_en = now()
  where origen_tipo = p_origen_tipo and origen_id = p_origen_id and activa
    and (p_recurso_tipo is null or recurso_tipo = p_recurso_tipo);
$$;

create function private.exigir_ambulancia(p_vehiculo_id uuid)
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
  where id = p_vehiculo_id and activo and tipo in ('ambulancia', 'mixto') and estado = 'operativo';
  if v_codigo is null then
    raise exception 'Seleccione una ambulancia activa y operativa.' using errcode = '22023';
  end if;
  return v_codigo;
end;
$$;

create function private.exigir_conductor(p_conductor_id uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_nombre text;
begin
  select nombre into v_nombre from public.conductores where id = p_conductor_id and activo;
  if v_nombre is null then
    raise exception 'Seleccione un conductor activo.' using errcode = '22023';
  end if;
  return v_nombre;
end;
$$;

-- Bloquea en orden membresía → traslado y devuelve el traslado.
create function private.bloquear_traslado(p_traslado_id uuid)
returns public.traslados_ambulancia
language plpgsql
set search_path = ''
as $$
declare
  v_membresia uuid;
  v_traslado public.traslados_ambulancia;
begin
  select membresia_id into v_membresia from public.traslados_ambulancia where id = p_traslado_id;
  if not found then
    raise exception 'Traslado no encontrado.' using errcode = 'P0002';
  end if;
  if v_membresia is not null then
    perform 1 from public.membresias where id = v_membresia for update;
  end if;
  select * into v_traslado from public.traslados_ambulancia where id = p_traslado_id for update;
  return v_traslado;
end;
$$;

-- Avisos operativos: servicios prolongados y cruces con servicios en curso.
create function private.avisos_traslado(p_traslado public.traslados_ambulancia)
returns setof text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_recurso record;
  v_otro record;
  v_fin_estimado timestamptz;
  v_efectivo tstzrange;
begin
  if p_traslado.estado = 'en_curso' then
    v_fin_estimado := p_traslado.inicio_real + make_interval(mins => p_traslado.minutos_estimados);
    if now() > v_fin_estimado then
      return next 'El servicio superó la duración estimada (fin previsto ' || private.momento(v_fin_estimado) || ').';
    end if;
    v_efectivo := tstzrange(p_traslado.inicio_real, greatest(v_fin_estimado, now()), '[]');
  elsif p_traslado.estado in ('solicitado', 'programado') then
    v_efectivo := private.intervalo_servicio(p_traslado.inicio_previsto, p_traslado.minutos_estimados);
  else
    return;
  end if;

  for v_recurso in
    select 'vehiculo' as tipo, p_traslado.vehiculo_id as id, 'La ambulancia' as nombre where p_traslado.vehiculo_id is not null
    union all
    select 'conductor', p_traslado.conductor_id, 'El conductor' where p_traslado.conductor_id is not null
  loop
    for v_otro in
      select o.*
      from public.ocupaciones_recurso o
      where o.activa and o.recurso_tipo = v_recurso.tipo and o.recurso_id = v_recurso.id
        and not (o.origen_tipo = 'traslado' and o.origen_id = p_traslado.id)
        and (p_traslado.estado = 'en_curso') <> o.en_curso
        and (case when o.en_curso
              then tstzrange(lower(o.intervalo), greatest(upper(o.intervalo), now()), '[]')
              else o.intervalo end) && v_efectivo
    loop
      return next case
        when v_otro.en_curso then v_recurso.nombre || ' sigue en otro servicio en curso desde el '
          || private.momento(lower(v_otro.intervalo)) || '.'
        else v_recurso.nombre || ' tiene otro servicio programado el ' || private.momento(lower(v_otro.intervalo))
          || ' que puede verse afectado.'
      end;
    end loop;
  end loop;
end;
$$;

create function private.validar_horario(p_inicio timestamptz, p_minutos integer)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_inicio is null or p_inicio < timestamptz '2000-01-01' then
    raise exception 'Indique la fecha y hora del servicio.' using errcode = '22023';
  end if;
  if p_minutos is null or p_minutos < 1 or p_minutos > 1440 then
    raise exception 'La duración estimada debe estar entre 1 y 1440 minutos.' using errcode = '22023';
  end if;
end;
$$;

create function private.estado_traslado_json(p_traslado public.traslados_ambulancia)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'estado', p_traslado.estado, 'tipo', p_traslado.tipo, 'inicio_previsto', p_traslado.inicio_previsto,
    'minutos_estimados', p_traslado.minutos_estimados, 'vehiculo_id', p_traslado.vehiculo_id,
    'conductor_id', p_traslado.conductor_id, 'condicion_cobertura', p_traslado.condicion_cobertura,
    'precio_pactado', p_traslado.precio_pactado
  )
$$;

-- ---------------------------------------------------------------------------
-- Registro y programación
-- ---------------------------------------------------------------------------

-- Una solicitud urgente se registra aunque falten recursos, destino, precio
-- o cobertura confirmada: la cobertura se evalúa y queda indicada. Un
-- cubierto exige membresía y beneficiario (sin ellos no puede validarse).
create function public.registrar_traslado(
  p_idempotencia uuid,
  p_tipo public.tipo_traslado,
  p_cliente_id uuid,
  p_membresia_id uuid,
  p_beneficiario_id uuid,
  p_pasajero text,
  p_inicio_previsto timestamptz,
  p_minutos_estimados integer,
  p_origen text,
  p_destino text,
  p_motivo text,
  p_precio numeric,
  p_tarifa_id uuid,
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
  v_existente public.traslados_ambulancia;
  v_membresia public.membresias;
  v_cliente uuid := p_cliente_id;
  v_minutos integer := coalesce(p_minutos_estimados, 90);
  v_origen text;
  v_destino text;
  v_motivo text;
  v_notas text;
  v_pasajero text;
  v_id uuid;
  v_intervalo tstzrange;
begin
  perform private.exigir_rol('administrador', 'operador');
  perform private.exigir_clave(p_idempotencia);

  select * into v_existente from public.traslados_ambulancia where idempotencia = p_idempotencia;
  if v_existente.id is not null then
    perform private.exigir_misma_operacion(v_existente.tipo = p_tipo and v_existente.inicio_previsto = p_inicio_previsto);
    return v_existente.id;
  end if;

  if p_tipo is null then
    raise exception 'Indique si el traslado es cubierto o particular.' using errcode = '22023';
  end if;
  perform private.validar_horario(p_inicio_previsto, v_minutos);
  v_origen := private.texto(p_origen, 300, 'el origen', true);
  v_destino := private.texto(p_destino, 300, 'el destino', false);
  v_motivo := private.texto(p_motivo, 500, 'el motivo', false);
  v_notas := private.texto(p_notas, 1000, 'las observaciones', false);
  v_pasajero := private.texto(p_pasajero, 200, 'el pasajero', false);

  if p_tipo = 'cubierto' then
    if p_membresia_id is null then
      raise exception 'Seleccione la membresía del traslado cubierto.' using errcode = '22023';
    end if;
    select * into v_membresia from public.membresias where id = p_membresia_id for update;
    if v_membresia.id is null then
      raise exception 'Membresía no encontrada.' using errcode = 'P0002';
    end if;
    if v_cliente is not null and v_cliente <> v_membresia.cliente_id then
      raise exception 'La membresía no pertenece al cliente indicado.' using errcode = '22023';
    end if;
    v_cliente := v_membresia.cliente_id;
    if p_beneficiario_id is null then
      raise exception 'Seleccione el beneficiario del traslado cubierto.' using errcode = '22023';
    end if;
    if p_precio is not null or p_tarifa_id is not null then
      raise exception 'Un traslado cubierto no lleva precio: lo cubre la membresía.' using errcode = '22023';
    end if;
  else
    if p_membresia_id is not null then
      raise exception 'Un traslado particular no se asocia a una membresía.' using errcode = '22023';
    end if;
    if p_precio is not null then
      perform private.validar_monto(p_precio);
    end if;
    if p_tarifa_id is not null
       and not exists (select 1 from public.tarifas where id = p_tarifa_id and actividad = 'ambulancias') then
      raise exception 'Seleccione una tarifa de ambulancias.' using errcode = '22023';
    end if;
  end if;
  if not exists (select 1 from public.clientes where id = v_cliente and activo) then
    raise exception 'Cliente no encontrado o inactivo.' using errcode = '22023';
  end if;
  if p_beneficiario_id is not null
     and not exists (select 1 from public.beneficiarios where id = p_beneficiario_id and activo) then
    raise exception 'Beneficiario no encontrado o inactivo.' using errcode = '22023';
  end if;

  insert into public.traslados_ambulancia (
    cliente_id, tipo, membresia_id, beneficiario_id, pasajero, condicion_cobertura, motivo_cobertura, estado,
    inicio_previsto, minutos_estimados, origen, destino, motivo, tarifa_id, precio_pactado, notas,
    idempotencia, creado_por, actualizado_por
  )
  values (
    v_cliente, p_tipo, p_membresia_id, p_beneficiario_id, v_pasajero,
    case when p_tipo = 'cubierto' then 'no_valida'::public.condicion_cobertura end,
    case when p_tipo = 'cubierto' then 'Sin validar' end,
    case when p_programar then 'programado'::public.estado_traslado else 'solicitado' end,
    p_inicio_previsto, v_minutos, v_origen, v_destino, v_motivo, p_tarifa_id, p_precio, v_notas,
    p_idempotencia, auth.uid(), auth.uid()
  )
  on conflict (idempotencia) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_existente from public.traslados_ambulancia where idempotencia = p_idempotencia;
    perform private.exigir_misma_operacion(v_existente.tipo = p_tipo and v_existente.inicio_previsto = p_inicio_previsto);
    return v_existente.id;
  end if;

  if p_tipo = 'cubierto' then
    perform private.sincronizar_reserva(v_id);
  end if;

  v_intervalo := private.intervalo_servicio(p_inicio_previsto, v_minutos);
  if p_vehiculo_id is not null then
    perform private.exigir_ambulancia(p_vehiculo_id);
    perform private.ocupar_recurso('vehiculo', p_vehiculo_id, 'traslado', v_id, v_intervalo);
  end if;
  if p_conductor_id is not null then
    perform private.exigir_conductor(p_conductor_id);
    perform private.ocupar_recurso('conductor', p_conductor_id, 'traslado', v_id, v_intervalo);
  end if;
  if p_vehiculo_id is not null or p_conductor_id is not null then
    update public.traslados_ambulancia set vehiculo_id = p_vehiculo_id, conductor_id = p_conductor_id where id = v_id;
  end if;

  perform private.registrar_bitacora(
    'traslados_ambulancia', v_id, 'registrar_traslado', null, null,
    (select private.estado_traslado_json(t) from public.traslados_ambulancia t where t.id = v_id)
  );
  return v_id;
end;
$$;

create function public.programar_traslado(p_traslado_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_traslado public.traslados_ambulancia;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_traslado := private.bloquear_traslado(p_traslado_id);
  if v_traslado.estado <> 'solicitado' then
    raise exception 'Solo se programa un traslado solicitado (estado actual: %).', v_traslado.estado using errcode = '22023';
  end if;
  update public.traslados_ambulancia
  set estado = 'programado', updated_at = now(), actualizado_por = auth.uid()
  where id = p_traslado_id;
  perform private.sincronizar_reserva(p_traslado_id);
  perform private.registrar_bitacora(
    'traslados_ambulancia', p_traslado_id, 'programar_traslado', null,
    jsonb_build_object('estado', 'solicitado'), jsonb_build_object('estado', 'programado')
  );
end;
$$;

-- Asigna, cambia o quita (nulo) ambulancia y conductor antes de iniciar.
create function public.asignar_recursos_traslado(
  p_traslado_id uuid, p_vehiculo_id uuid, p_conductor_id uuid, p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_traslado public.traslados_ambulancia;
  v_intervalo tstzrange;
  v_motivo text;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', false);
  v_traslado := private.bloquear_traslado(p_traslado_id);
  if v_traslado.estado not in ('solicitado', 'programado') then
    raise exception 'Los recursos se asignan antes de iniciar el traslado.' using errcode = '22023';
  end if;
  if (p_vehiculo_id, p_conductor_id) is not distinct from (v_traslado.vehiculo_id, v_traslado.conductor_id) then
    raise exception 'La ambulancia y el conductor indicados ya están asignados.' using errcode = '22023';
  end if;

  v_intervalo := private.intervalo_servicio(v_traslado.inicio_previsto, v_traslado.minutos_estimados);
  if p_vehiculo_id is distinct from v_traslado.vehiculo_id then
    if p_vehiculo_id is null then
      perform private.liberar_recursos('traslado', p_traslado_id, 'vehiculo');
    else
      perform private.exigir_ambulancia(p_vehiculo_id);
      perform private.ocupar_recurso('vehiculo', p_vehiculo_id, 'traslado', p_traslado_id, v_intervalo);
    end if;
  end if;
  if p_conductor_id is distinct from v_traslado.conductor_id then
    if p_conductor_id is null then
      perform private.liberar_recursos('traslado', p_traslado_id, 'conductor');
    else
      perform private.exigir_conductor(p_conductor_id);
      perform private.ocupar_recurso('conductor', p_conductor_id, 'traslado', p_traslado_id, v_intervalo);
    end if;
  end if;

  update public.traslados_ambulancia
  set vehiculo_id = p_vehiculo_id, conductor_id = p_conductor_id, updated_at = now(), actualizado_por = auth.uid()
  where id = p_traslado_id;
  perform private.registrar_bitacora(
    'traslados_ambulancia', p_traslado_id, 'asignar_recursos', v_motivo,
    jsonb_build_object('vehiculo_id', v_traslado.vehiculo_id, 'conductor_id', v_traslado.conductor_id),
    jsonb_build_object('vehiculo_id', p_vehiculo_id, 'conductor_id', p_conductor_id)
  );
end;
$$;

-- Cambia fecha, hora o duración de un traslado no iniciado: comprueba de
-- nuevo los recursos asignados y la cobertura del período de la nueva fecha.
create function public.reprogramar_traslado(
  p_traslado_id uuid, p_inicio_previsto timestamptz, p_minutos_estimados integer, p_motivo text
)
returns public.condicion_cobertura
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_traslado public.traslados_ambulancia;
  v_intervalo tstzrange;
  v_condicion public.condicion_cobertura;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);
  perform private.validar_horario(p_inicio_previsto, p_minutos_estimados);
  v_traslado := private.bloquear_traslado(p_traslado_id);
  if v_traslado.estado not in ('solicitado', 'programado') then
    raise exception 'Solo se reprograma un traslado que no ha comenzado.' using errcode = '22023';
  end if;
  if (p_inicio_previsto, p_minutos_estimados) is not distinct from (v_traslado.inicio_previsto, v_traslado.minutos_estimados) then
    raise exception 'La fecha, la hora y la duración indicadas son las vigentes.' using errcode = '22023';
  end if;

  v_intervalo := private.intervalo_servicio(p_inicio_previsto, p_minutos_estimados);
  if v_traslado.vehiculo_id is not null then
    perform private.ocupar_recurso('vehiculo', v_traslado.vehiculo_id, 'traslado', p_traslado_id, v_intervalo);
  end if;
  if v_traslado.conductor_id is not null then
    perform private.ocupar_recurso('conductor', v_traslado.conductor_id, 'traslado', p_traslado_id, v_intervalo);
  end if;

  update public.traslados_ambulancia
  set inicio_previsto = p_inicio_previsto, minutos_estimados = p_minutos_estimados,
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_traslado_id;
  v_condicion := private.sincronizar_reserva(p_traslado_id);

  perform private.registrar_bitacora(
    'traslados_ambulancia', p_traslado_id, 'reprogramar_traslado', v_motivo,
    jsonb_build_object('inicio_previsto', v_traslado.inicio_previsto, 'minutos_estimados', v_traslado.minutos_estimados),
    jsonb_build_object('inicio_previsto', p_inicio_previsto, 'minutos_estimados', p_minutos_estimados,
      'condicion_cobertura', v_condicion)
  );
  return v_condicion;
end;
$$;

-- Duración de un servicio en curso (se prolonga o se acorta). No reprograma
-- otros servicios: devuelve los avisos de cruces.
create function public.ajustar_duracion_traslado(p_traslado_id uuid, p_minutos_estimados integer, p_motivo text default null)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_traslado public.traslados_ambulancia;
  v_intervalo tstzrange;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_traslado := private.bloquear_traslado(p_traslado_id);
  if v_traslado.estado <> 'en_curso' then
    raise exception 'La duración de un traslado no iniciado se cambia al reprogramarlo.' using errcode = '22023';
  end if;
  perform private.validar_horario(v_traslado.inicio_real, p_minutos_estimados);
  if p_minutos_estimados = v_traslado.minutos_estimados then
    raise exception 'La duración indicada es la vigente.' using errcode = '22023';
  end if;

  v_intervalo := private.intervalo_servicio(v_traslado.inicio_real, p_minutos_estimados);
  perform private.bloquear_recurso('vehiculo', v_traslado.vehiculo_id);
  perform private.bloquear_recurso('conductor', v_traslado.conductor_id);
  perform private.ocupar_en_curso('vehiculo', v_traslado.vehiculo_id, 'traslado', p_traslado_id, v_intervalo);
  perform private.ocupar_en_curso('conductor', v_traslado.conductor_id, 'traslado', p_traslado_id, v_intervalo);
  update public.traslados_ambulancia
  set minutos_estimados = p_minutos_estimados, updated_at = now(), actualizado_por = auth.uid()
  where id = p_traslado_id
  returning * into v_traslado;
  perform private.registrar_bitacora(
    'traslados_ambulancia', p_traslado_id, 'ajustar_duracion', private.texto(p_motivo, 300, 'el motivo', false),
    null, jsonb_build_object('minutos_estimados', p_minutos_estimados)
  );
  return query select private.avisos_traslado(v_traslado);
end;
$$;

-- Datos descriptivos y precio pactado (este solo en particulares no completados).
create function public.editar_traslado(
  p_traslado_id uuid,
  p_origen text,
  p_destino text,
  p_motivo text,
  p_notas text,
  p_pasajero text,
  p_precio numeric,
  p_tarifa_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_traslado public.traslados_ambulancia;
  v_nuevo public.traslados_ambulancia;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_traslado := private.bloquear_traslado(p_traslado_id);
  if v_traslado.estado in ('completado', 'cancelado') then
    raise exception 'Un traslado % no se edita.', v_traslado.estado using errcode = '22023';
  end if;
  if v_traslado.tipo = 'cubierto' and (p_precio is not null or p_tarifa_id is not null) then
    raise exception 'Un traslado cubierto no lleva precio: lo cubre la membresía.' using errcode = '22023';
  end if;
  if p_precio is not null then
    perform private.validar_monto(p_precio);
  end if;
  if p_tarifa_id is not null
     and not exists (select 1 from public.tarifas where id = p_tarifa_id and actividad = 'ambulancias') then
    raise exception 'Seleccione una tarifa de ambulancias.' using errcode = '22023';
  end if;
  if v_traslado.estado = 'en_curso' and p_destino is null then
    raise exception 'Indique el destino.' using errcode = '22023';
  end if;

  update public.traslados_ambulancia
  set origen = private.texto(p_origen, 300, 'el origen', true),
    destino = private.texto(p_destino, 300, 'el destino', false),
    motivo = private.texto(p_motivo, 500, 'el motivo', false),
    notas = private.texto(p_notas, 1000, 'las observaciones', false),
    pasajero = private.texto(p_pasajero, 200, 'el pasajero', false),
    precio_pactado = p_precio, tarifa_id = p_tarifa_id,
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_traslado_id
  returning * into v_nuevo;

  perform private.registrar_bitacora(
    'traslados_ambulancia', p_traslado_id, 'editar_traslado', null,
    jsonb_build_object('origen', v_traslado.origen, 'destino', v_traslado.destino, 'precio_pactado', v_traslado.precio_pactado),
    jsonb_build_object('origen', v_nuevo.origen, 'destino', v_nuevo.destino, 'precio_pactado', v_nuevo.precio_pactado)
  );
end;
$$;

create function public.revalidar_cobertura_traslado(p_traslado_id uuid)
returns public.condicion_cobertura
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_traslado public.traslados_ambulancia;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_traslado := private.bloquear_traslado(p_traslado_id);
  if v_traslado.tipo <> 'cubierto' or v_traslado.estado not in ('solicitado', 'programado') then
    raise exception 'Solo se valida la cobertura de un traslado cubierto que no ha comenzado.' using errcode = '22023';
  end if;
  return private.sincronizar_reserva(p_traslado_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ejecución
-- ---------------------------------------------------------------------------

-- Exige destino, ambulancia y conductor asignados, operativos y libres (sin
-- otro servicio en curso) y, si es cubierto, cobertura válida con el
-- beneficio reservado en un período generado. Si la cobertura ya no es
-- válida, deja registrada la revalidación (reserva liberada) y devuelve
-- {"iniciado": false, "motivo": ...} sin iniciar. Un particular puede
-- iniciarse con saldo pendiente o sin precio todavía.
create function public.iniciar_traslado(p_traslado_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_traslado public.traslados_ambulancia;
  v_condicion public.condicion_cobertura;
  v_intervalo tstzrange;
  v_ocupado public.ocupaciones_recurso;
  v_recurso record;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_traslado := private.bloquear_traslado(p_traslado_id);
  if v_traslado.estado in ('en_curso', 'completado') then
    raise exception 'El traslado ya fue iniciado.' using errcode = '22023';
  end if;
  if v_traslado.estado = 'cancelado' then
    raise exception 'Un traslado cancelado no puede iniciarse.' using errcode = '22023';
  end if;
  if v_traslado.destino is null then
    raise exception 'Indique el destino antes de iniciar.' using errcode = '22023';
  end if;
  if v_traslado.vehiculo_id is null or v_traslado.conductor_id is null then
    raise exception 'Asigne la ambulancia y el conductor antes de iniciar.' using errcode = '22023';
  end if;
  perform private.exigir_ambulancia(v_traslado.vehiculo_id);
  perform private.exigir_conductor(v_traslado.conductor_id);

  if v_traslado.tipo = 'cubierto' then
    v_condicion := private.sincronizar_reserva(p_traslado_id);
    if v_condicion <> 'valida' then
      return jsonb_build_object(
        'iniciado', false,
        'motivo', 'No se puede iniciar como cubierto: '
          || coalesce((select motivo_cobertura from public.traslados_ambulancia where id = p_traslado_id), 'cobertura no válida')
      );
    end if;
  end if;

  for v_recurso in
    select 'vehiculo' as tipo, v_traslado.vehiculo_id as id
    union all select 'conductor', v_traslado.conductor_id
  loop
    perform private.bloquear_recurso(v_recurso.tipo, v_recurso.id);
    select * into v_ocupado
    from public.ocupaciones_recurso o
    where o.activa and o.en_curso and o.recurso_tipo = v_recurso.tipo and o.recurso_id = v_recurso.id
      and not (o.origen_tipo = 'traslado' and o.origen_id = p_traslado_id)
    limit 1;
    if v_ocupado.id is not null then
      raise exception '% está %.', case v_recurso.tipo when 'vehiculo' then 'La ambulancia' else 'El conductor' end,
        private.describir_ocupacion(v_ocupado) using errcode = '22023';
    end if;
  end loop;

  v_intervalo := private.intervalo_servicio(now(), v_traslado.minutos_estimados);
  perform private.ocupar_en_curso('vehiculo', v_traslado.vehiculo_id, 'traslado', p_traslado_id, v_intervalo);
  perform private.ocupar_en_curso('conductor', v_traslado.conductor_id, 'traslado', p_traslado_id, v_intervalo);
  update public.traslados_ambulancia
  set estado = 'en_curso', inicio_real = now(), updated_at = now(), actualizado_por = auth.uid()
  where id = p_traslado_id
  returning * into v_traslado;

  perform private.registrar_bitacora(
    'traslados_ambulancia', p_traslado_id, 'iniciar_traslado', null,
    null, jsonb_build_object('estado', 'en_curso', 'inicio_real', v_traslado.inicio_real)
  );
  return jsonb_build_object(
    'iniciado', true,
    'avisos', coalesce((select jsonb_agg(a) from private.avisos_traslado(v_traslado) a), '[]'::jsonb)
  );
end;
$$;

-- Completa el servicio una sola vez: repetirlo no hace nada. Cubierto:
-- consume su beneficio (sin ingreso nuevo). Particular: genera su cargo de
-- E2 por el precio pactado y, si se indica, aplica saldo a favor del cliente
-- con aplicar_saldo_a_favor de E2 (sin nueva entrada de dinero).
create function public.finalizar_traslado(
  p_traslado_id uuid, p_notas_finales text, p_aplicar_anticipo numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_traslado public.traslados_ambulancia;
  v_notas text;
  v_fin timestamptz := now();
  v_cargo uuid;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_notas := private.texto(p_notas_finales, 1000, 'las observaciones finales', false);
  v_traslado := private.bloquear_traslado(p_traslado_id);
  if v_traslado.estado = 'completado' then
    return jsonb_build_object('completado', true, 'repetido', true, 'cargo_id', v_traslado.cargo_id);
  end if;
  if v_traslado.estado <> 'en_curso' then
    raise exception 'Solo se finaliza un traslado en curso.' using errcode = '22023';
  end if;
  if v_traslado.tipo = 'particular' and v_traslado.precio_pactado is null then
    raise exception 'Indique el precio pactado antes de finalizar el traslado particular.' using errcode = '22023';
  end if;
  if p_aplicar_anticipo is not null and v_traslado.tipo <> 'particular' then
    raise exception 'Solo se aplica saldo a favor al cargo de un traslado particular.' using errcode = '22023';
  end if;

  perform private.liberar_recursos('traslado', p_traslado_id);

  if v_traslado.tipo = 'cubierto' then
    update public.reservas_beneficio
    set estado = 'consumida', consumida_en = v_fin
    where traslado_id = p_traslado_id and estado = 'reservada';
    if not found then
      raise exception 'El traslado no tiene un beneficio reservado para consumir.' using errcode = '22023';
    end if;
  else
    v_cargo := private.registrar_cargo_servicio(
      v_traslado.cliente_id, 'traslado_ambulancia', p_traslado_id, '4200',
      'Traslado en ambulancia del ' || private.momento(v_traslado.inicio_real) || ': '
        || v_traslado.origen || ' → ' || v_traslado.destino,
      private.fecha_local(v_fin), private.fecha_local(v_fin), v_traslado.precio_pactado
    );
  end if;

  update public.traslados_ambulancia
  set estado = 'completado', fin_real = v_fin, notas_finales = v_notas, cargo_id = v_cargo,
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_traslado_id;

  if coalesce(p_aplicar_anticipo, 0) > 0 then
    -- La clave de la aplicación es el propio cargo: no se repite.
    perform public.aplicar_saldo_a_favor(v_cargo, v_cargo, p_aplicar_anticipo);
  end if;

  perform private.registrar_bitacora(
    'traslados_ambulancia', p_traslado_id, 'finalizar_traslado', null,
    jsonb_build_object('estado', 'en_curso'),
    jsonb_build_object('estado', 'completado', 'fin_real', v_fin, 'cargo_id', v_cargo,
      'beneficio_consumido', v_traslado.tipo = 'cubierto', 'anticipo_aplicado', p_aplicar_anticipo)
  );
  return jsonb_build_object('completado', true, 'repetido', false, 'cargo_id', v_cargo);
end;
$$;

-- Cancela un traslado no iniciado: libera reserva y recursos, sin cargo.
-- Los anticipos del cliente siguen como saldo a favor (E2).
create function public.cancelar_traslado(p_traslado_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_traslado public.traslados_ambulancia;
  v_reserva uuid;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);
  v_traslado := private.bloquear_traslado(p_traslado_id);
  if v_traslado.estado = 'en_curso' then
    raise exception 'El traslado ya comenzó: no puede cancelarse; finalícelo.' using errcode = '22023';
  end if;
  if v_traslado.estado = 'completado' then
    raise exception 'Un traslado completado no se cancela.' using errcode = '22023';
  end if;
  if v_traslado.estado = 'cancelado' then
    raise exception 'El traslado ya está cancelado.' using errcode = '22023';
  end if;

  select id into v_reserva from public.reservas_beneficio where traslado_id = p_traslado_id and estado = 'reservada';
  if v_reserva is not null then
    perform private.liberar_reserva(v_reserva, 'Cancelación: ' || v_motivo);
  end if;
  perform private.liberar_recursos('traslado', p_traslado_id);
  update public.traslados_ambulancia
  set estado = 'cancelado', motivo_cancelacion = v_motivo, cancelado_en = now(), cancelado_por = auth.uid(),
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_traslado_id;

  perform private.registrar_bitacora(
    'traslados_ambulancia', p_traslado_id, 'cancelar_traslado', v_motivo,
    jsonb_build_object('estado', v_traslado.estado, 'reserva_liberada', v_reserva is not null),
    jsonb_build_object('estado', 'cancelado')
  );
end;
$$;

-- Nueva condición comercial particular, explícita y con motivo (aceptación
-- del cliente), para un cubierto que no ha comenzado. Libera la reserva; el
-- historial de cobertura queda en la bitácora y en las reservas liberadas.
create function public.convertir_traslado_a_particular(p_traslado_id uuid, p_precio numeric, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_traslado public.traslados_ambulancia;
  v_reserva uuid;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);
  perform private.validar_monto(p_precio);
  v_traslado := private.bloquear_traslado(p_traslado_id);
  if v_traslado.tipo <> 'cubierto' then
    raise exception 'El traslado ya es particular.' using errcode = '22023';
  end if;
  if v_traslado.estado not in ('solicitado', 'programado') then
    raise exception 'Solo se cambia la condición comercial de un traslado que no ha comenzado.' using errcode = '22023';
  end if;

  select id into v_reserva from public.reservas_beneficio where traslado_id = p_traslado_id and estado = 'reservada';
  if v_reserva is not null then
    perform private.liberar_reserva(v_reserva, 'Pasa a particular: ' || v_motivo);
  end if;
  update public.traslados_ambulancia
  set tipo = 'particular', membresia_id = null, periodo_id = null, condicion_cobertura = null,
    motivo_cobertura = null, precio_pactado = p_precio, updated_at = now(), actualizado_por = auth.uid()
  where id = p_traslado_id;

  perform private.registrar_bitacora(
    'traslados_ambulancia', p_traslado_id, 'convertir_a_particular', v_motivo,
    jsonb_build_object('tipo', 'cubierto', 'membresia_id', v_traslado.membresia_id,
      'condicion_cobertura', v_traslado.condicion_cobertura, 'motivo_cobertura', v_traslado.motivo_cobertura),
    jsonb_build_object('tipo', 'particular', 'precio_pactado', p_precio)
  );
end;
$$;

-- Corrección (solo administrador): devuelve al período el beneficio
-- consumido por un traslado completado. Los importes se corrigen con los
-- reversos de E2 (anular_cargo y un cargo nuevo).
create function public.revertir_consumo_traslado(p_traslado_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_traslado public.traslados_ambulancia;
  v_reserva uuid;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);
  v_traslado := private.bloquear_traslado(p_traslado_id);
  select id into v_reserva
  from public.reservas_beneficio where traslado_id = p_traslado_id and estado = 'consumida' for update;
  if v_traslado.estado <> 'completado' or v_reserva is null then
    raise exception 'El traslado no tiene un beneficio consumido.' using errcode = '22023';
  end if;
  perform private.liberar_reserva(v_reserva, 'Corrección: ' || v_motivo);
  perform private.registrar_bitacora(
    'traslados_ambulancia', p_traslado_id, 'revertir_consumo', v_motivo,
    jsonb_build_object('reserva', v_reserva, 'estado', 'consumida'),
    jsonb_build_object('reserva', v_reserva, 'estado', 'liberada')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Consultas (sin escritura)
-- ---------------------------------------------------------------------------

create function public.prever_cobertura(p_membresia_id uuid, p_beneficiario_id uuid, p_inicio timestamptz)
returns table (
  condicion public.condicion_cobertura, motivo text, periodo_inicio date, cupo integer, disponibles integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');
  return query
  select e.condicion, e.motivo, e.periodo_inicio, e.cupo, e.disponibles
  from private.evaluar_cobertura(p_membresia_id, p_beneficiario_id, private.fecha_local(p_inicio), null) e;
end;
$$;

-- Ambulancias operativas y conductores activos, libres o no en un horario.
create function public.recursos_disponibles(p_inicio timestamptz, p_minutos integer, p_traslado_id uuid default null)
returns table (recurso_tipo text, recurso_id uuid, nombre text, disponible boolean, detalle text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_intervalo tstzrange;
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');
  perform private.validar_horario(p_inicio, p_minutos);
  v_intervalo := private.intervalo_servicio(p_inicio, p_minutos);
  return query
  select 'vehiculo'::text, v.id, v.codigo || coalesce(' · ' || v.placa, ''), o.id is null, private.describir_ocupacion(o)
  from public.vehiculos v
  left join lateral (
    select * from private.conflicto_recurso('vehiculo', v.id, v_intervalo, 'traslado', coalesce(p_traslado_id, '00000000-0000-0000-0000-000000000000'::uuid))
  ) o on true
  where v.activo and v.tipo in ('ambulancia', 'mixto') and v.estado = 'operativo'
  union all
  select 'conductor'::text, c.id, c.nombre, o.id is null, private.describir_ocupacion(o)
  from public.conductores c
  left join lateral (
    select * from private.conflicto_recurso('conductor', c.id, v_intervalo, 'traslado', coalesce(p_traslado_id, '00000000-0000-0000-0000-000000000000'::uuid))
  ) o on true
  where c.activo
  order by 1, 3;
end;
$$;

create function public.avisos_traslado(p_traslado_id uuid)
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');
  return query
  select private.avisos_traslado(t) from public.traslados_ambulancia t where t.id = p_traslado_id;
end;
$$;

create function public.historial_traslado(p_traslado_id uuid)
returns table (fecha timestamptz, accion text, motivo text, antes jsonb, despues jsonb, actor text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');
  return query
  select b.fecha, b.accion, b.motivo, b.antes, b.despues, p.nombre
  from public.bitacora b
  left join public.perfiles p on p.id = b.actor_id
  where b.entidad = 'traslados_ambulancia' and b.registro_id = p_traslado_id
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
      'registrar_traslado', 'programar_traslado', 'asignar_recursos_traslado', 'reprogramar_traslado',
      'ajustar_duracion_traslado', 'editar_traslado', 'revalidar_cobertura_traslado', 'iniciar_traslado',
      'finalizar_traslado', 'cancelar_traslado', 'convertir_traslado_a_particular', 'revertir_consumo_traslado',
      'prever_cobertura', 'recursos_disponibles', 'avisos_traslado', 'historial_traslado'
    ])
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = any (array[
      'fecha_local', 'intervalo_servicio', 'momento', 'inicio_periodo_previsto', 'cupo_usado', 'cupo_ocupado',
      'evaluar_cobertura', 'liberar_reserva', 'sincronizar_reserva', 'revalidar_traslados_membresia',
      'revalidar_por_membresia', 'revalidar_por_vinculo', 'describir_ocupacion', 'conflicto_recurso',
      'bloquear_recurso', 'ocupar_recurso', 'ocupar_en_curso', 'liberar_recursos', 'exigir_ambulancia',
      'exigir_conductor', 'bloquear_traslado', 'avisos_traslado', 'validar_horario', 'estado_traslado_json'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
