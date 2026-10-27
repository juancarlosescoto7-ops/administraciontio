-- E5 · Alquileres y transportes con conductor: estructura.
--
-- * alquileres: reservado → entregado → devuelto, o cancelado (solo
--   reservado). Kilometraje y combustible de entrega y devolución; los cargos
--   adicionales se registran expresamente (cargos_adicionales_alquiler). El
--   cargo de E2 nace al devolver: precio pactado + adicionales, una vez.
-- * transportes: solicitado → programado → en_curso → completado, o
--   cancelado (sin iniciar). El cargo de E2 nace al completar, una vez.
-- * Ocupaciones: vehículos y conductores usan ocupaciones_recurso de E4
--   (origen 'alquiler' / 'transporte'), con su restricción de exclusión.
-- * Escritura solo mediante las funciones de la siguiente migración. Nada se
--   borra.

create type public.estado_alquiler as enum ('reservado', 'entregado', 'devuelto', 'cancelado');
create type public.nivel_combustible as enum ('vacio', 'cuarto', 'medio', 'tres_cuartos', 'lleno');
create type public.estado_transporte as enum ('solicitado', 'programado', 'en_curso', 'completado', 'cancelado');

create table public.alquileres (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  vehiculo_id uuid not null references public.vehiculos (id) on delete restrict,
  entrega_prevista timestamptz not null,
  devolucion_prevista timestamptz not null,
  tarifa_id uuid references public.tarifas (id) on delete restrict,
  precio_pactado numeric(14, 2) not null check (precio_pactado > 0),
  notas text check (notas is null or length(btrim(notas)) between 1 and 1000),
  estado public.estado_alquiler not null default 'reservado',
  entrega_real timestamptz,
  km_salida integer check (km_salida is null or km_salida between 0 and 9999999),
  combustible_salida public.nivel_combustible,
  notas_entrega text check (notas_entrega is null or length(btrim(notas_entrega)) between 1 and 1000),
  devolucion_real timestamptz,
  km_regreso integer check (km_regreso is null or km_regreso between 0 and 9999999),
  combustible_regreso public.nivel_combustible,
  notas_devolucion text check (notas_devolucion is null or length(btrim(notas_devolucion)) between 1 and 1000),
  -- Kilometraje final menor que el inicial: solo con corrección justificada del administrador.
  motivo_correccion_km text,
  cargo_id uuid constraint alquileres_cargo_key unique references public.cargos_cliente (id) on delete restrict,
  motivo_cancelacion text,
  cancelado_en timestamptz,
  cancelado_por uuid references public.perfiles (id) on delete restrict,
  idempotencia uuid not null constraint alquileres_idempotencia_key unique,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  actualizado_por uuid references public.perfiles (id) on delete restrict,
  constraint alquileres_fechas_check check (devolucion_prevista > entrega_prevista),
  constraint alquileres_entrega_check check (
    (estado in ('entregado', 'devuelto')) = (entrega_real is not null and km_salida is not null and combustible_salida is not null)
  ),
  constraint alquileres_devolucion_check check (
    (estado = 'devuelto') = (devolucion_real is not null and km_regreso is not null and combustible_regreso is not null and cargo_id is not null)
    and (devolucion_real is null or devolucion_real >= entrega_real)
    and (km_regreso is null or km_regreso >= km_salida or motivo_correccion_km is not null)
  ),
  constraint alquileres_cancelacion_check
    check ((estado = 'cancelado') = (cancelado_en is not null and motivo_cancelacion is not null))
);

create table public.cargos_adicionales_alquiler (
  id uuid primary key default gen_random_uuid(),
  alquiler_id uuid not null references public.alquileres (id) on delete restrict,
  concepto text not null check (length(btrim(concepto)) between 1 and 200),
  monto numeric(14, 2) not null check (monto > 0),
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict
);

create table public.transportes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  inicio_previsto timestamptz not null,
  minutos_estimados integer not null default 90 check (minutos_estimados between 1 and 1440),
  origen text not null check (length(btrim(origen)) between 1 and 300),
  destino text not null check (length(btrim(destino)) between 1 and 300),
  vehiculo_id uuid references public.vehiculos (id) on delete restrict,
  conductor_id uuid references public.conductores (id) on delete restrict,
  tarifa_id uuid references public.tarifas (id) on delete restrict,
  precio_pactado numeric(14, 2) check (precio_pactado is null or precio_pactado > 0),
  notas text check (notas is null or length(btrim(notas)) between 1 and 1000),
  notas_finales text check (notas_finales is null or length(btrim(notas_finales)) between 1 and 1000),
  estado public.estado_transporte not null default 'solicitado',
  inicio_real timestamptz,
  fin_real timestamptz,
  cargo_id uuid constraint transportes_cargo_key unique references public.cargos_cliente (id) on delete restrict,
  motivo_cancelacion text,
  cancelado_en timestamptz,
  cancelado_por uuid references public.perfiles (id) on delete restrict,
  idempotencia uuid not null constraint transportes_idempotencia_key unique,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  actualizado_por uuid references public.perfiles (id) on delete restrict,
  constraint transportes_ejecucion_check check (
    (estado in ('en_curso', 'completado')) = (inicio_real is not null)
    and (estado = 'completado') = (fin_real is not null and cargo_id is not null)
    and (fin_real is null or fin_real >= inicio_real)
    and (estado not in ('en_curso', 'completado') or (vehiculo_id is not null and conductor_id is not null))
    and (cargo_id is null or precio_pactado is not null)
  ),
  constraint transportes_cancelacion_check
    check ((estado = 'cancelado') = (cancelado_en is not null and motivo_cancelacion is not null))
);

-- ---------------------------------------------------------------------------
-- Índices (FKs, estados y fechas)
-- ---------------------------------------------------------------------------

create index alquileres_entrega_idx on public.alquileres (entrega_prevista);
create index alquileres_estado_idx on public.alquileres (estado, entrega_prevista);
create index alquileres_cliente_idx on public.alquileres (cliente_id);
create index alquileres_vehiculo_idx on public.alquileres (vehiculo_id);
create index alquileres_tarifa_idx on public.alquileres (tarifa_id);
create index alquileres_creado_por_idx on public.alquileres (creado_por);
create index alquileres_actualizado_por_idx on public.alquileres (actualizado_por);
create index alquileres_cancelado_por_idx on public.alquileres (cancelado_por);
create index cargos_adicionales_alquiler_alquiler_idx on public.cargos_adicionales_alquiler (alquiler_id);
create index cargos_adicionales_alquiler_creado_por_idx on public.cargos_adicionales_alquiler (creado_por);

create index transportes_inicio_idx on public.transportes (inicio_previsto);
create index transportes_estado_idx on public.transportes (estado, inicio_previsto);
create index transportes_cliente_idx on public.transportes (cliente_id);
create index transportes_vehiculo_idx on public.transportes (vehiculo_id);
create index transportes_conductor_idx on public.transportes (conductor_id);
create index transportes_tarifa_idx on public.transportes (tarifa_id);
create index transportes_creado_por_idx on public.transportes (creado_por);
create index transportes_actualizado_por_idx on public.transportes (actualizado_por);
create index transportes_cancelado_por_idx on public.transportes (cancelado_por);

-- ---------------------------------------------------------------------------
-- Integridad del historial (también frente al propietario)
-- ---------------------------------------------------------------------------

-- Transiciones permitidas (TG_ARGV): 'origen>destino'. Los registros en un
-- estado final (TG_ARGV[0], separados por coma) no cambian.
create function private.proteger_operacion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_finales text[] := string_to_array(tg_argv[0], ',');
  v_permitidas text[] := tg_argv[1:];
begin
  if old.estado::text = any (v_finales) then
    raise exception 'El registro está % y no admite cambios.', old.estado using errcode = '42501';
  end if;
  if new.estado <> old.estado and not (old.estado::text || '>' || new.estado::text = any (v_permitidas)) then
    raise exception 'Cambio de estado no permitido: de % a %.', old.estado, new.estado using errcode = '42501';
  end if;
  if (to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'cliente_id', to_jsonb(new) ->> 'idempotencia',
      to_jsonb(new) ->> 'created_at', to_jsonb(new) ->> 'creado_por')
     is distinct from
     (to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'cliente_id', to_jsonb(old) ->> 'idempotencia',
      to_jsonb(old) ->> 'created_at', to_jsonb(old) ->> 'creado_por') then
    raise exception 'Los datos de origen del registro no se modifican.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proteger_operacion before update on public.alquileres
for each row execute function private.proteger_operacion(
  'devuelto,cancelado', 'reservado>entregado', 'reservado>cancelado', 'entregado>devuelto');

create trigger proteger_operacion before update on public.transportes
for each row execute function private.proteger_operacion(
  'completado,cancelado', 'solicitado>programado', 'solicitado>en_curso', 'solicitado>cancelado',
  'programado>en_curso', 'programado>cancelado', 'en_curso>completado');

do $$
declare
  t text;
begin
  foreach t in array array['alquileres', 'cargos_adicionales_alquiler', 'transportes'] loop
    execute format(
      'create trigger impedir_borrado before delete on public.%I
         for each row execute function private.impedir_borrado()', t);
    execute format(
      'create trigger impedir_truncate before truncate on public.%I
         for each statement execute function private.impedir_borrado()', t);
  end loop;
end;
$$;

-- Los cargos adicionales registrados no se modifican.
create trigger impedir_modificacion before update on public.cargos_adicionales_alquiler
for each row execute function private.impedir_modificacion();

revoke all on function private.proteger_operacion() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vistas de consulta: estado operativo y financiero por separado
-- ---------------------------------------------------------------------------

create view public.saldos_alquileres with (security_invoker = true) as
select
  a.id, a.cliente_id, cl.nombre as cliente_nombre, a.vehiculo_id, v.codigo as vehiculo_codigo, v.placa as vehiculo_placa,
  a.entrega_prevista, a.devolucion_prevista, a.tarifa_id, a.precio_pactado, a.notas, a.estado,
  a.entrega_real, a.km_salida, a.combustible_salida, a.notas_entrega,
  a.devolucion_real, a.km_regreso, a.combustible_regreso, a.notas_devolucion, a.motivo_correccion_km,
  (a.km_regreso - a.km_salida) as km_recorridos,
  coalesce(ad.total, 0)::numeric(14, 2) as total_adicionales,
  (a.precio_pactado + coalesce(ad.total, 0))::numeric(14, 2) as importe_total,
  a.cargo_id, a.motivo_cancelacion, a.cancelado_en, a.created_at, a.updated_at,
  coalesce(c.aplicado, 0)::numeric(14, 2) as aplicado,
  -- Sin cargo todavía no hay deuda contable (lo pactado se muestra aparte).
  (case when a.cargo_id is null then 0 else c.pendiente end)::numeric(14, 2) as pendiente,
  c.estado as cargo_estado,
  case
    when a.estado = 'cancelado' then 'sin_cargo'
    when a.cargo_id is null then 'sin_cargo'
    when c.estado = 'anulado' then 'anulado'
    when c.pendiente = 0 then 'pagado'
    when c.aplicado > 0 then 'parcial'
    else 'pendiente'
  end as estado_financiero
from public.alquileres a
join public.clientes cl on cl.id = a.cliente_id
join public.vehiculos v on v.id = a.vehiculo_id
left join lateral (
  select sum(x.monto) as total from public.cargos_adicionales_alquiler x where x.alquiler_id = a.id
) ad on true
left join public.saldos_cargos c on c.id = a.cargo_id;

create view public.saldos_transportes with (security_invoker = true) as
select
  t.id, t.cliente_id, cl.nombre as cliente_nombre, t.inicio_previsto, t.minutos_estimados,
  t.inicio_previsto + make_interval(mins => t.minutos_estimados) as fin_previsto,
  t.origen, t.destino, t.vehiculo_id, v.codigo as vehiculo_codigo, t.conductor_id, co.nombre as conductor_nombre,
  t.tarifa_id, t.precio_pactado, t.notas, t.notas_finales, t.estado, t.inicio_real, t.fin_real, t.cargo_id,
  t.motivo_cancelacion, t.cancelado_en, t.created_at, t.updated_at,
  coalesce(c.aplicado, 0)::numeric(14, 2) as aplicado,
  coalesce(c.pendiente, 0)::numeric(14, 2) as pendiente,
  c.estado as cargo_estado,
  case
    when t.cargo_id is null then 'sin_cargo'
    when c.estado = 'anulado' then 'anulado'
    when c.pendiente = 0 then 'pagado'
    when c.aplicado > 0 then 'parcial'
    else 'pendiente'
  end as estado_financiero
from public.transportes t
join public.clientes cl on cl.id = t.cliente_id
left join public.vehiculos v on v.id = t.vehiculo_id
left join public.conductores co on co.id = t.conductor_id
left join public.saldos_cargos c on c.id = t.cargo_id;

-- ---------------------------------------------------------------------------
-- Privilegios y RLS: lectura para los tres roles activos, sin escritura directa
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['alquileres', 'cargos_adicionales_alquiler', 'transportes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select private.es_usuario_activo()))', t || '_select', t);
  end loop;

  foreach t in array array['saldos_alquileres', 'saldos_transportes'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end;
$$;
