-- Selectores de vehículo: se identifican por marca y modelo, no por la placa.
--
-- * Antes: «001 · HAU7421». Ahora: «HYNDAY STAREX · 001» (el código al final
--   distingue dos vehículos del mismo modelo).
-- * Sin marca ni modelo se conserva el texto anterior (código y placa).
-- * Solo cambia el texto de la columna nombre; firmas, filtros, permisos y
--   detección de conflictos quedan iguales.

create function private.nombre_vehiculo(p_codigo text, p_marca text, p_modelo text, p_placa text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(concat_ws(' ', nullif(trim(p_marca), ''), nullif(trim(p_modelo), '')), '') || ' · ' || p_codigo,
    p_codigo || coalesce(' · ' || p_placa, '')
  );
$$;

revoke all on function private.nombre_vehiculo(text, text, text, text) from public, anon, authenticated;

create or replace function public.recursos_disponibles(p_inicio timestamptz, p_minutos integer, p_traslado_id uuid default null)
returns table(recurso_tipo text, recurso_id uuid, nombre text, disponible boolean, detalle text)
language plpgsql
stable security definer
set search_path = ''
as $$
declare
  v_intervalo tstzrange;
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');
  perform private.validar_horario(p_inicio, p_minutos);
  v_intervalo := private.intervalo_servicio(p_inicio, p_minutos);
  return query
  select 'vehiculo'::text, v.id, private.nombre_vehiculo(v.codigo, v.marca, v.modelo, v.placa), o.id is null, private.describir_ocupacion(o)
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

create or replace function public.disponibilidad_recursos(
  p_actividad public.actividad,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_origen_tipo public.origen_ocupacion default null,
  p_origen_id uuid default null
)
returns table(recurso_tipo text, recurso_id uuid, nombre text, disponible boolean, detalle text)
language plpgsql
stable security definer
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
  select 'vehiculo'::text, v.id, private.nombre_vehiculo(v.codigo, v.marca, v.modelo, v.placa), o.id is null, private.describir_ocupacion(o)
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
