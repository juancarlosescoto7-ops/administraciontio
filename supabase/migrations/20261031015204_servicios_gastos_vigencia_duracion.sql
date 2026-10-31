-- Gastos por servicio y duraciones. Solo desarrollo.
alter table public.transportes drop constraint transportes_minutos_estimados_check;
alter table public.transportes add constraint transportes_minutos_estimados_check check(minutos_estimados > 0);
alter table public.traslados_ambulancia drop constraint traslados_ambulancia_minutos_estimados_check;
alter table public.traslados_ambulancia add constraint traslados_ambulancia_minutos_estimados_check check(minutos_estimados > 0);
create or replace function private.validar_horario(p_inicio timestamptz, p_minutos integer)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_inicio is null or p_inicio < timestamptz '2000-01-01' then
    raise exception 'Indique la fecha y hora del servicio.' using errcode = '22023';
  end if;
  if p_minutos is null or p_minutos < 1 then
    raise exception 'La duración estimada debe estar al menos 1 minuto.' using errcode = '22023';
  end if;
end;
$$;

-- Una relación por gasto, con claves foráneas reales; no duplica importes.
create table public.gastos_servicio (
  gasto_id uuid primary key references public.gastos(id) on delete restrict,
  membresia_id uuid references public.membresias(id) on delete restrict,
  alquiler_id uuid references public.alquileres(id) on delete restrict,
  transporte_id uuid references public.transportes(id) on delete restrict,
  traslado_id uuid references public.traslados_ambulancia(id) on delete restrict,
  created_at timestamptz not null default now(),
  check(num_nonnulls(membresia_id,alquiler_id,transporte_id,traslado_id)=1)
);
create index gastos_servicio_membresia_idx on public.gastos_servicio(membresia_id);
create index gastos_servicio_alquiler_idx on public.gastos_servicio(alquiler_id);
create index gastos_servicio_transporte_idx on public.gastos_servicio(transporte_id);
create index gastos_servicio_traslado_idx on public.gastos_servicio(traslado_id);
alter table public.gastos_servicio enable row level security;
revoke all on public.gastos_servicio from anon,authenticated;
grant select on public.gastos_servicio to authenticated;
create policy gastos_servicio_select on public.gastos_servicio for select to authenticated
using ((select private.tiene_rol('administrador','finanzas')));

create function public.registrar_gasto_servicio(
  p_idempotencia uuid,p_proveedor_id uuid,p_categoria_id uuid,p_actividad public.actividad,
  p_fecha date,p_vencimiento date,p_concepto text,p_monto numeric,p_notas text,
  p_pago jsonb default null,p_tipo text default null,p_servicio_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_actividad public.actividad; v_rel public.gastos_servicio;
begin
  perform private.exigir_rol('administrador','finanzas');
  perform private.exigir_clave(p_idempotencia);
  perform pg_advisory_xact_lock(hashtextextended('gasto_servicio:'||p_idempotencia::text,0));
  if (p_tipo is null) <> (p_servicio_id is null) then
    raise exception 'Indique el tipo y el servicio del gasto.' using errcode='22023';
  end if;
  if p_tipo is not null then
    case p_tipo
      when 'membresia' then select 'ambulancias'::public.actividad into v_actividad from public.membresias where id=p_servicio_id;
      when 'alquiler' then select 'alquileres'::public.actividad into v_actividad from public.alquileres where id=p_servicio_id;
      when 'transporte' then select 'transportes'::public.actividad into v_actividad from public.transportes where id=p_servicio_id;
      when 'traslado' then select 'ambulancias'::public.actividad into v_actividad from public.traslados_ambulancia where id=p_servicio_id;
      else raise exception 'Tipo de servicio no válido.' using errcode='22023';
    end case;
    if v_actividad is null then raise exception 'Servicio no encontrado.' using errcode='22023'; end if;
    if p_actividad is distinct from v_actividad then raise exception 'La actividad no corresponde al servicio.' using errcode='22023'; end if;
  end if;
  select id into v_id from public.gastos where idempotencia=p_idempotencia;
  if v_id is not null then
    select * into v_rel from public.gastos_servicio where gasto_id=v_id;
    perform private.exigir_misma_operacion(
      (v_rel.membresia_id is not distinct from case when p_tipo='membresia' then p_servicio_id end) and
      (v_rel.alquiler_id is not distinct from case when p_tipo='alquiler' then p_servicio_id end) and
      (v_rel.transporte_id is not distinct from case when p_tipo='transporte' then p_servicio_id end) and
      (v_rel.traslado_id is not distinct from case when p_tipo='traslado' then p_servicio_id end));
  end if;
  v_id := public.registrar_gasto(p_idempotencia,p_proveedor_id,p_categoria_id,p_actividad,p_fecha,p_vencimiento,p_concepto,p_monto,p_notas,p_pago);
  if p_tipo is not null then
    insert into public.gastos_servicio(gasto_id,membresia_id,alquiler_id,transporte_id,traslado_id)
    values(v_id,case when p_tipo='membresia' then p_servicio_id end,case when p_tipo='alquiler' then p_servicio_id end,
      case when p_tipo='transporte' then p_servicio_id end,case when p_tipo='traslado' then p_servicio_id end)
    on conflict(gasto_id) do nothing;
  end if;
  return v_id;
end; $$;
revoke all on function public.registrar_gasto_servicio(uuid,uuid,uuid,public.actividad,date,date,text,numeric,text,jsonb,text,uuid) from public,anon;
grant execute on function public.registrar_gasto_servicio(uuid,uuid,uuid,public.actividad,date,date,text,numeric,text,jsonb,text,uuid) to authenticated;



