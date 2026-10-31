-- Catálogo de personal y destinatario de remuneraciones. No altera gastos anteriores.
create table public.empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 200),
  puesto text check (length(puesto)<=100),
  telefono text check (length(telefono)<=40),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references public.perfiles(id),
  actualizado_por uuid references public.perfiles(id)
);
create index empleados_creado_por_idx on public.empleados(creado_por);
create index empleados_actualizado_por_idx on public.empleados(actualizado_por);
create trigger sellar_auditoria before insert or update on public.empleados
for each row execute function private.sellar_auditoria();
alter table public.empleados enable row level security;
revoke all on public.empleados from anon,authenticated;
grant select,insert,update on public.empleados to authenticated;
create policy empleados_select on public.empleados for select to authenticated
using ((select private.tiene_rol('administrador','finanzas')));
create policy empleados_insert on public.empleados for insert to authenticated
with check ((select private.tiene_rol('administrador','finanzas')));
create policy empleados_update on public.empleados for update to authenticated
using ((select private.tiene_rol('administrador','finanzas')))
with check ((select private.tiene_rol('administrador','finanzas')));

create table public.gastos_personal (
  gasto_id uuid primary key references public.gastos(id),
  empleado_id uuid references public.empleados(id),
  conductor_id uuid references public.conductores(id),
  nombre_destinatario text not null,
  check (num_nonnulls(empleado_id,conductor_id)=1)
);
create index gastos_personal_empleado_idx on public.gastos_personal(empleado_id);
create index gastos_personal_conductor_idx on public.gastos_personal(conductor_id);
alter table public.gastos_personal enable row level security;
revoke all on public.gastos_personal from anon,authenticated;
grant select on public.gastos_personal to authenticated;
create policy gastos_personal_select on public.gastos_personal for select to authenticated
using ((select private.tiene_rol('administrador','finanzas')));

create function public.registrar_gasto_personal(
  p_idempotencia uuid,p_proveedor_id uuid,p_categoria_id uuid,p_actividad public.actividad,
  p_fecha date,p_vencimiento date,p_concepto text,p_monto numeric,p_notas text,
  p_pago jsonb default null,p_tipo text default null,p_servicio_id uuid default null,
  p_empleado_id uuid default null,p_conductor_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_rel public.gastos_personal; v_nombre text;
begin
  perform private.exigir_rol('administrador','finanzas');
  perform private.exigir_clave(p_idempotencia);
  -- Mismo bloqueo que el registro de gastos relacionados.
  perform pg_advisory_xact_lock(hashtextextended('gasto_servicio:'||p_idempotencia::text,0));
  if num_nonnulls(p_empleado_id,p_conductor_id)>1 or
     (num_nonnulls(p_empleado_id,p_conductor_id)>0 and p_proveedor_id is not null) then
    raise exception 'Seleccione un solo destinatario: empleado, conductor o proveedor.' using errcode='22023';
  end if;
  select id into v_id from public.gastos where idempotencia=p_idempotencia;
  if num_nonnulls(p_empleado_id,p_conductor_id)>0 and not exists (
    select 1 from public.categorias_gasto c join public.cuentas_contables cc on cc.id=c.cuenta_contable_id
    where c.id=p_categoria_id and cc.codigo='5300'
  ) then
    raise exception 'Seleccione la categoría Salarios para esta remuneración.' using errcode='22023';
  end if;
  if v_id is not null then
    select * into v_rel from public.gastos_personal where gasto_id=v_id;
    perform private.exigir_misma_operacion(
      v_rel.empleado_id is not distinct from p_empleado_id and
      v_rel.conductor_id is not distinct from p_conductor_id);
  else
    if p_empleado_id is not null then
      select nombre into v_nombre from public.empleados where id=p_empleado_id and activo for share;
    elsif p_conductor_id is not null then
      select nombre into v_nombre from public.conductores where id=p_conductor_id and activo for share;
    end if;
    if num_nonnulls(p_empleado_id,p_conductor_id)>0 and v_nombre is null then
      raise exception 'Seleccione un empleado o conductor activo.' using errcode='22023';
    end if;
  end if;
  v_id:=public.registrar_gasto_servicio(p_idempotencia,p_proveedor_id,p_categoria_id,p_actividad,
    p_fecha,p_vencimiento,p_concepto,p_monto,p_notas,p_pago,p_tipo,p_servicio_id);
  if v_nombre is not null then
    insert into public.gastos_personal(gasto_id,empleado_id,conductor_id,nombre_destinatario)
    values(v_id,p_empleado_id,p_conductor_id,v_nombre);
  end if;
  return v_id;
end $$;
revoke all on function public.registrar_gasto_personal(uuid,uuid,uuid,public.actividad,date,date,text,numeric,text,jsonb,text,uuid,uuid,uuid) from public,anon;
grant execute on function public.registrar_gasto_personal(uuid,uuid,uuid,public.actividad,date,date,text,numeric,text,jsonb,text,uuid,uuid,uuid) to authenticated;
