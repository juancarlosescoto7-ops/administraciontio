-- Flota: kilometraje encadenado por vehículo y control de mantenimientos.
--
-- * Viajes con conductor y traslados registran kilometraje de salida al
--   iniciar y de llegada al finalizar; los alquileres usan el de entrega y
--   devolución que ya tenían.
-- * Cada salida debe coincidir con la última llegada registrada del vehículo
--   (servicio o mantenimiento). Si no coincide, solo se acepta con motivo del
--   descuadre, que queda señalado en el informe (recorridos_vehiculo).
-- * Mantenimientos: registro único con km de ida y regreso del taller (entran
--   en la misma cadena) y próximo mantenimiento por km o fecha. No genera
--   gastos: el costo se registra en Gastos como hasta ahora.
-- * Las firmas anteriores de iniciar/finalizar se conservan, pero exigen ahora
--   el kilometraje (no se eliminan funciones).

alter table public.transportes
  add column km_salida integer check (km_salida is null or km_salida between 0 and 9999999),
  add column km_llegada integer check (km_llegada is null or km_llegada between 0 and 9999999),
  add column motivo_descuadre_km text check (motivo_descuadre_km is null or length(btrim(motivo_descuadre_km)) between 1 and 300),
  add constraint transportes_km_check check (km_llegada is null or km_salida is null or km_llegada >= km_salida);

alter table public.traslados_ambulancia
  add column km_salida integer check (km_salida is null or km_salida between 0 and 9999999),
  add column km_llegada integer check (km_llegada is null or km_llegada between 0 and 9999999),
  add column motivo_descuadre_km text check (motivo_descuadre_km is null or length(btrim(motivo_descuadre_km)) between 1 and 300),
  add constraint traslados_ambulancia_km_check check (km_llegada is null or km_salida is null or km_llegada >= km_salida);

alter table public.alquileres
  add column motivo_descuadre_km text check (motivo_descuadre_km is null or length(btrim(motivo_descuadre_km)) between 1 and 300);

create table public.mantenimientos_vehiculo (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null references public.vehiculos (id) on delete restrict,
  tipo text not null check (tipo in ('preventivo', 'correctivo')),
  descripcion text not null check (length(btrim(descripcion)) between 1 and 500),
  salida timestamptz not null,
  regreso timestamptz not null,
  km_salida integer not null check (km_salida between 0 and 9999999),
  km_llegada integer not null check (km_llegada between 0 and 9999999),
  motivo_descuadre_km text check (motivo_descuadre_km is null or length(btrim(motivo_descuadre_km)) between 1 and 300),
  proximo_km integer check (proximo_km is null or proximo_km between 0 and 9999999),
  proxima_fecha date,
  notas text check (notas is null or length(btrim(notas)) between 1 and 1000),
  idempotencia uuid not null constraint mantenimientos_vehiculo_idempotencia_key unique,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint mantenimientos_vehiculo_fechas_check check (regreso >= salida),
  constraint mantenimientos_vehiculo_km_check check (km_llegada >= km_salida and (proximo_km is null or proximo_km > km_llegada))
);
create index mantenimientos_vehiculo_vehiculo_idx on public.mantenimientos_vehiculo (vehiculo_id, salida);
create index mantenimientos_vehiculo_creado_por_idx on public.mantenimientos_vehiculo (creado_por);
create index transportes_vehiculo_km_idx on public.transportes (vehiculo_id, inicio_real) where km_salida is not null;
create index traslados_ambulancia_vehiculo_km_idx on public.traslados_ambulancia (vehiculo_id, inicio_real) where km_salida is not null;

create trigger impedir_borrado before delete on public.mantenimientos_vehiculo
for each row execute function private.impedir_borrado();
create trigger impedir_truncate before truncate on public.mantenimientos_vehiculo
for each statement execute function private.impedir_borrado();
create trigger impedir_modificacion before update on public.mantenimientos_vehiculo
for each row execute function private.impedir_modificacion();

alter table public.mantenimientos_vehiculo enable row level security;
revoke all on public.mantenimientos_vehiculo from anon, authenticated;
grant select on public.mantenimientos_vehiculo to authenticated;
create policy mantenimientos_vehiculo_select on public.mantenimientos_vehiculo for select to authenticated
using ((select private.es_usuario_activo()));

-- ---------------------------------------------------------------------------
-- Informe: cadena de recorridos por vehículo
-- ---------------------------------------------------------------------------

create view public.recorridos_vehiculo with (security_invoker = true) as
with movimientos as (
  select a.vehiculo_id, 'alquiler'::text as origen_tipo, a.id as origen_id, a.entrega_real as salida,
    a.devolucion_real as llegada, a.km_salida, a.km_regreso as km_llegada, a.motivo_descuadre_km,
    'Alquiler · ' || cl.nombre as detalle, null::text as conductor_nombre
  from public.alquileres a
  join public.clientes cl on cl.id = a.cliente_id
  where a.km_salida is not null and a.vehiculo_id is not null
  union all
  select t.vehiculo_id, 'transporte', t.id, t.inicio_real, t.fin_real, t.km_salida, t.km_llegada, t.motivo_descuadre_km,
    'Viaje · ' || cl.nombre || ': ' || t.origen || ' → ' || t.destino, co.nombre
  from public.transportes t
  join public.clientes cl on cl.id = t.cliente_id
  left join public.conductores co on co.id = t.conductor_id
  where t.km_salida is not null and t.vehiculo_id is not null
  union all
  select t.vehiculo_id, 'traslado', t.id, t.inicio_real, t.fin_real, t.km_salida, t.km_llegada, t.motivo_descuadre_km,
    'Traslado · ' || t.origen || ' → ' || coalesce(t.destino, 'sin destino'), co.nombre
  from public.traslados_ambulancia t
  left join public.conductores co on co.id = t.conductor_id
  where t.km_salida is not null and t.vehiculo_id is not null
  union all
  select m.vehiculo_id, 'mantenimiento', m.id, m.salida, m.regreso, m.km_salida, m.km_llegada, m.motivo_descuadre_km,
    'Mantenimiento ' || m.tipo || ' · ' || m.descripcion, null
  from public.mantenimientos_vehiculo m
)
select
  m.*,
  (m.km_llegada - m.km_salida) as recorrido,
  lag(m.km_llegada) over w as km_anterior,
  (m.km_salida - lag(m.km_llegada) over w) as diferencia
from movimientos m
window w as (partition by m.vehiculo_id order by m.salida, m.km_salida, m.origen_id);

-- Situación de cada vehículo: último kilometraje, descuadres y próximo mantenimiento.
create view public.resumen_flota with (security_invoker = true) as
select
  v.id as vehiculo_id, v.codigo, v.placa, v.tipo, v.estado, v.activo, v.marca, v.modelo,
  u.km_actual, u.ultima_fecha, coalesce(u.en_recorrido, false) as en_recorrido,
  coalesce(d.recorridos, 0)::integer as recorridos,
  coalesce(d.descuadres, 0)::integer as descuadres,
  mt.regreso as ultimo_mantenimiento, mt.proximo_km, mt.proxima_fecha,
  (mt.proximo_km - u.km_actual) as km_para_mantenimiento
from public.vehiculos v
left join lateral (
  select coalesce(r.km_llegada, r.km_salida) as km_actual, coalesce(r.llegada, r.salida) as ultima_fecha,
    r.km_llegada is null as en_recorrido
  from public.recorridos_vehiculo r
  where r.vehiculo_id = v.id
  order by r.salida desc, r.km_salida desc, r.origen_id desc
  limit 1
) u on true
left join lateral (
  select count(*) as recorridos, count(*) filter (where r.diferencia <> 0) as descuadres
  from public.recorridos_vehiculo r
  where r.vehiculo_id = v.id
) d on true
left join lateral (
  select m.regreso, m.proximo_km, m.proxima_fecha
  from public.mantenimientos_vehiculo m
  where m.vehiculo_id = v.id
  order by m.salida desc, m.id desc
  limit 1
) mt on true;

revoke all on public.recorridos_vehiculo, public.resumen_flota from anon, authenticated;
grant select on public.recorridos_vehiculo, public.resumen_flota to authenticated;

-- ---------------------------------------------------------------------------
-- Validación del kilometraje de salida
-- ---------------------------------------------------------------------------

-- Bloquea el vehículo, exige que no tenga un recorrido abierto y compara la
-- salida con la última llegada. Devuelve el motivo del descuadre (o nulo si
-- coincide o es el primer recorrido del vehículo).
create function private.validar_km_salida(
  p_vehiculo_id uuid, p_km integer, p_motivo text, p_origen_tipo text, p_origen_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_motivo text;
  v_ultimo record;
begin
  if p_km is null or p_km < 0 or p_km > 9999999 then
    raise exception 'Indique el kilometraje de salida.' using errcode = '22023';
  end if;
  v_motivo := private.texto(p_motivo, 300, 'el motivo del descuadre de kilometraje', false);
  perform private.bloquear_recurso('vehiculo', p_vehiculo_id);
  select r.km_llegada, r.detalle into v_ultimo
  from public.recorridos_vehiculo r
  where r.vehiculo_id = p_vehiculo_id and not (r.origen_tipo = p_origen_tipo and r.origen_id is not distinct from p_origen_id)
  order by r.salida desc, r.km_salida desc, r.origen_id desc
  limit 1;
  if found and v_ultimo.km_llegada is null then
    raise exception 'El vehículo tiene un recorrido sin kilometraje de llegada (%): ciérrelo antes.', v_ultimo.detalle
      using errcode = '22023';
  end if;
  if found and p_km <> v_ultimo.km_llegada then
    if v_motivo is null then
      raise exception 'El kilometraje de salida (%) no coincide con el de llegada del recorrido anterior de este vehículo (%). Revise la lectura o indique el motivo del descuadre.',
        p_km, v_ultimo.km_llegada using errcode = '22023';
    end if;
    return v_motivo;
  end if;
  return null;
end;
$$;

-- Kilometraje esperado para la próxima salida (para rellenar formularios).
create function public.kilometraje_vehiculo(p_vehiculo_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select r.km_llegada
  from public.recorridos_vehiculo r
  where r.vehiculo_id = p_vehiculo_id
  order by r.salida desc, r.km_salida desc, r.origen_id desc
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Transportes
-- ---------------------------------------------------------------------------

create function public.iniciar_transporte(p_transporte_id uuid, p_km_salida integer, p_motivo_descuadre_km text default null)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transporte public.transportes;
  v_intervalo tstzrange;
  v_motivo text;
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
  v_motivo := private.validar_km_salida(v_transporte.vehiculo_id, p_km_salida, p_motivo_descuadre_km, 'transporte', p_transporte_id);

  v_intervalo := private.intervalo_servicio(now(), v_transporte.minutos_estimados);
  perform private.ocupar_en_curso('vehiculo', v_transporte.vehiculo_id, 'transporte', p_transporte_id, v_intervalo);
  perform private.ocupar_en_curso('conductor', v_transporte.conductor_id, 'transporte', p_transporte_id, v_intervalo);
  update public.transportes
  set estado = 'en_curso', inicio_real = now(), km_salida = p_km_salida, motivo_descuadre_km = v_motivo,
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_transporte_id;
  perform private.registrar_bitacora(
    'transportes', p_transporte_id, 'iniciar_transporte', v_motivo, null,
    jsonb_build_object('estado', 'en_curso', 'km_salida', p_km_salida, 'motivo_descuadre_km', v_motivo)
  );
  return query select private.avisos_ocupacion('transporte', p_transporte_id);
end;
$$;

create function public.finalizar_transporte(
  p_transporte_id uuid, p_km_llegada integer, p_notas_finales text, p_aplicar_anticipo numeric default null
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
  if p_km_llegada is null or p_km_llegada < 0 or p_km_llegada > 9999999 then
    raise exception 'Indique el kilometraje de llegada.' using errcode = '22023';
  end if;
  if p_km_llegada < v_transporte.km_salida then
    raise exception 'El kilometraje de llegada (%) no puede ser menor que el de salida (%).',
      p_km_llegada, v_transporte.km_salida using errcode = '22023';
  end if;

  perform private.liberar_recursos('transporte', p_transporte_id);
  v_cargo := private.registrar_cargo_servicio(
    v_transporte.cliente_id, 'transporte', p_transporte_id, '4400',
    'Transporte del ' || private.momento(v_transporte.inicio_real) || ': ' || v_transporte.origen || ' → ' || v_transporte.destino,
    private.fecha_local(v_fin), private.fecha_local(v_fin), v_transporte.precio_pactado
  );
  update public.transportes
  set estado = 'completado', fin_real = v_fin, cargo_id = v_cargo, km_llegada = p_km_llegada,
    notas_finales = private.texto(p_notas_finales, 1000, 'las observaciones finales', false),
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_transporte_id;
  perform private.aplicar_anticipo(v_cargo, p_aplicar_anticipo);

  perform private.registrar_bitacora(
    'transportes', p_transporte_id, 'finalizar_transporte', null,
    jsonb_build_object('estado', 'en_curso', 'km_salida', v_transporte.km_salida),
    jsonb_build_object('estado', 'completado', 'fin_real', v_fin, 'cargo_id', v_cargo, 'anticipo_aplicado', p_aplicar_anticipo,
      'km_llegada', p_km_llegada)
  );
  return jsonb_build_object('completado', true, 'repetido', false, 'cargo_id', v_cargo);
end;
$$;

create or replace function public.iniciar_transporte(p_transporte_id uuid)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Indique el kilometraje de salida para iniciar el servicio.' using errcode = '22023';
end;
$$;

create or replace function public.finalizar_transporte(p_transporte_id uuid, p_notas_finales text, p_aplicar_anticipo numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Indique el kilometraje de llegada para finalizar el servicio.' using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- Traslados de ambulancia
-- ---------------------------------------------------------------------------

create function public.iniciar_traslado(p_traslado_id uuid, p_km_salida integer, p_motivo_descuadre_km text default null)
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
  v_motivo text;
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
  v_motivo := private.validar_km_salida(v_traslado.vehiculo_id, p_km_salida, p_motivo_descuadre_km, 'traslado', p_traslado_id);

  v_intervalo := private.intervalo_servicio(now(), v_traslado.minutos_estimados);
  perform private.ocupar_en_curso('vehiculo', v_traslado.vehiculo_id, 'traslado', p_traslado_id, v_intervalo);
  perform private.ocupar_en_curso('conductor', v_traslado.conductor_id, 'traslado', p_traslado_id, v_intervalo);
  update public.traslados_ambulancia
  set estado = 'en_curso', inicio_real = now(), km_salida = p_km_salida, motivo_descuadre_km = v_motivo,
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_traslado_id
  returning * into v_traslado;

  perform private.registrar_bitacora(
    'traslados_ambulancia', p_traslado_id, 'iniciar_traslado', v_motivo,
    null, jsonb_build_object('estado', 'en_curso', 'inicio_real', v_traslado.inicio_real,
      'km_salida', p_km_salida, 'motivo_descuadre_km', v_motivo)
  );
  return jsonb_build_object(
    'iniciado', true,
    'avisos', coalesce((select jsonb_agg(a) from private.avisos_traslado(v_traslado) a), '[]'::jsonb)
  );
end;
$$;

create function public.finalizar_traslado(
  p_traslado_id uuid, p_km_llegada integer, p_notas_finales text, p_aplicar_anticipo numeric default null
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
  if p_km_llegada is null or p_km_llegada < 0 or p_km_llegada > 9999999 then
    raise exception 'Indique el kilometraje de llegada.' using errcode = '22023';
  end if;
  if p_km_llegada < v_traslado.km_salida then
    raise exception 'El kilometraje de llegada (%) no puede ser menor que el de salida (%).',
      p_km_llegada, v_traslado.km_salida using errcode = '22023';
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
  set estado = 'completado', fin_real = v_fin, notas_finales = v_notas, cargo_id = v_cargo, km_llegada = p_km_llegada,
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_traslado_id;

  if coalesce(p_aplicar_anticipo, 0) > 0 then
    -- La clave de la aplicación es el propio cargo: no se repite.
    perform public.aplicar_saldo_a_favor(v_cargo, v_cargo, p_aplicar_anticipo);
  end if;

  perform private.registrar_bitacora(
    'traslados_ambulancia', p_traslado_id, 'finalizar_traslado', null,
    jsonb_build_object('estado', 'en_curso', 'km_salida', v_traslado.km_salida),
    jsonb_build_object('estado', 'completado', 'fin_real', v_fin, 'cargo_id', v_cargo,
      'beneficio_consumido', v_traslado.tipo = 'cubierto', 'anticipo_aplicado', p_aplicar_anticipo,
      'km_llegada', p_km_llegada)
  );
  return jsonb_build_object('completado', true, 'repetido', false, 'cargo_id', v_cargo);
end;
$$;

create or replace function public.iniciar_traslado(p_traslado_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Indique el kilometraje de salida para iniciar el traslado.' using errcode = '22023';
end;
$$;

create or replace function public.finalizar_traslado(p_traslado_id uuid, p_notas_finales text, p_aplicar_anticipo numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Indique el kilometraje de llegada para finalizar el traslado.' using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- Alquileres: la entrega valida el kilometraje contra la última llegada
-- ---------------------------------------------------------------------------

create function public.entregar_alquiler(
  p_alquiler_id uuid, p_km_salida integer, p_combustible public.nivel_combustible, p_notas text, p_motivo_descuadre_km text
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
  v_motivo text;
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
  v_motivo := private.validar_km_salida(v_alquiler.vehiculo_id, p_km_salida, p_motivo_descuadre_km, 'alquiler', p_alquiler_id);

  v_intervalo := tstzrange(now(), greatest(v_alquiler.devolucion_prevista, now() + interval '1 minute'), '[)');
  v_conflicto := private.conflicto_recurso('vehiculo', v_alquiler.vehiculo_id, v_intervalo, 'alquiler', p_alquiler_id);
  if v_conflicto.id is not null then
    raise exception 'No se puede entregar ahora: el vehículo tiene otra operación %.', private.describir_ocupacion(v_conflicto)
      using errcode = '22023';
  end if;

  perform private.ocupar_en_curso('vehiculo', v_alquiler.vehiculo_id, 'alquiler', p_alquiler_id, v_intervalo);
  update public.alquileres
  set estado = 'entregado', entrega_real = now(), km_salida = p_km_salida, combustible_salida = p_combustible,
    motivo_descuadre_km = v_motivo,
    notas_entrega = private.texto(p_notas, 1000, 'las observaciones de entrega', false),
    updated_at = now(), actualizado_por = auth.uid()
  where id = p_alquiler_id;

  perform private.registrar_bitacora(
    'alquileres', p_alquiler_id, 'entregar_alquiler', v_motivo,
    jsonb_build_object('estado', 'reservado'),
    jsonb_build_object('estado', 'entregado', 'km_salida', p_km_salida, 'combustible_salida', p_combustible,
      'motivo_descuadre_km', v_motivo)
  );
  return query select private.avisos_ocupacion('alquiler', p_alquiler_id);
end;
$$;

-- La firma anterior equivale a entregar sin motivo de descuadre.
create or replace function public.entregar_alquiler(
  p_alquiler_id uuid, p_km_salida integer, p_combustible public.nivel_combustible, p_notas text
)
returns setof text
language sql
security definer
set search_path = ''
as $$
  select * from public.entregar_alquiler(p_alquiler_id, p_km_salida, p_combustible, p_notas, null::text)
$$;

-- ---------------------------------------------------------------------------
-- Mantenimientos
-- ---------------------------------------------------------------------------

create function public.registrar_mantenimiento(
  p_idempotencia uuid, p_vehiculo_id uuid, p_tipo text, p_descripcion text,
  p_salida timestamptz, p_regreso timestamptz, p_km_salida integer, p_km_llegada integer,
  p_motivo_descuadre_km text default null, p_proximo_km integer default null,
  p_proxima_fecha date default null, p_notas text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_previo public.mantenimientos_vehiculo;
  v_motivo text;
  v_ultima timestamptz;
begin
  perform private.exigir_rol('administrador', 'operador');
  perform private.exigir_clave(p_idempotencia);
  select * into v_previo from public.mantenimientos_vehiculo where idempotencia = p_idempotencia;
  if v_previo.id is not null then
    perform private.exigir_misma_operacion(v_previo.vehiculo_id = p_vehiculo_id and v_previo.km_salida = p_km_salida);
    return v_previo.id;
  end if;

  if not exists (select 1 from public.vehiculos where id = p_vehiculo_id and activo) then
    raise exception 'Seleccione un vehículo activo.' using errcode = '22023';
  end if;
  if p_tipo is null or p_tipo not in ('preventivo', 'correctivo') then
    raise exception 'Indique si el mantenimiento es preventivo o correctivo.' using errcode = '22023';
  end if;
  if p_salida is null or p_regreso is null then
    raise exception 'Indique la salida hacia el taller y el regreso.' using errcode = '22023';
  end if;
  if p_regreso < p_salida then
    raise exception 'El regreso del taller no puede ser anterior a la salida.' using errcode = '22023';
  end if;
  if p_regreso > now() + interval '5 minutes' then
    raise exception 'Registre el mantenimiento cuando el vehículo haya regresado (el regreso no puede ser futuro).' using errcode = '22023';
  end if;
  if p_km_llegada is null or p_km_llegada < 0 or p_km_llegada > 9999999 then
    raise exception 'Indique el kilometraje de regreso.' using errcode = '22023';
  end if;
  if p_km_llegada < p_km_salida then
    raise exception 'El kilometraje de regreso (%) no puede ser menor que el de salida (%).', p_km_llegada, p_km_salida
      using errcode = '22023';
  end if;
  if p_proximo_km is not null and p_proximo_km <= p_km_llegada then
    raise exception 'El kilometraje del próximo mantenimiento debe ser mayor que el de regreso (%).', p_km_llegada
      using errcode = '22023';
  end if;
  if p_proxima_fecha is not null and p_proxima_fecha <= private.fecha_local(p_regreso) then
    raise exception 'La fecha del próximo mantenimiento debe ser posterior al regreso.' using errcode = '22023';
  end if;

  v_motivo := private.validar_km_salida(p_vehiculo_id, p_km_salida, p_motivo_descuadre_km, 'mantenimiento', null);
  if exists (
    select 1 from public.ocupaciones_recurso o
    where o.activa and o.en_curso and o.recurso_tipo = 'vehiculo' and o.recurso_id = p_vehiculo_id
  ) then
    raise exception 'El vehículo está en un servicio en curso: finalícelo antes de registrar el mantenimiento.' using errcode = '22023';
  end if;
  select max(coalesce(r.llegada, r.salida)) into v_ultima from public.recorridos_vehiculo r where r.vehiculo_id = p_vehiculo_id;
  if v_ultima is not null and p_salida < v_ultima then
    raise exception 'La salida hacia el taller no puede ser anterior al último recorrido del vehículo (%).', private.momento(v_ultima)
      using errcode = '22023';
  end if;

  insert into public.mantenimientos_vehiculo (
    vehiculo_id, tipo, descripcion, salida, regreso, km_salida, km_llegada, motivo_descuadre_km,
    proximo_km, proxima_fecha, notas, idempotencia, creado_por
  ) values (
    p_vehiculo_id, p_tipo, private.texto(p_descripcion, 500, 'la descripción', true), p_salida, p_regreso,
    p_km_salida, p_km_llegada, v_motivo, p_proximo_km, p_proxima_fecha,
    private.texto(p_notas, 1000, 'las observaciones', false), p_idempotencia, auth.uid()
  )
  returning id into v_id;

  perform private.registrar_bitacora(
    'mantenimientos_vehiculo', v_id, 'registrar_mantenimiento', v_motivo, null,
    jsonb_build_object('vehiculo_id', p_vehiculo_id, 'tipo', p_tipo, 'km_salida', p_km_salida, 'km_llegada', p_km_llegada)
  );
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------

revoke all on function private.validar_km_salida(uuid, integer, text, text, uuid) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.kilometraje_vehiculo(uuid)',
    'public.iniciar_transporte(uuid, integer, text)',
    'public.finalizar_transporte(uuid, integer, text, numeric)',
    'public.iniciar_traslado(uuid, integer, text)',
    'public.finalizar_traslado(uuid, integer, text, numeric)',
    'public.entregar_alquiler(uuid, integer, public.nivel_combustible, text, text)',
    'public.registrar_mantenimiento(uuid, uuid, text, text, timestamptz, timestamptz, integer, integer, text, integer, date, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
