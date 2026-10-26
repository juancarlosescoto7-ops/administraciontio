-- E4 · Ambulancias: estructura.
--
-- * traslados_ambulancia: estado operativo (solicitado → programado →
--   en_curso → completado, o cancelado) separado de la condición de cobertura
--   (solo cubiertos) y del estado financiero (derivado del cargo de E2 en la
--   vista saldos_traslados).
-- * reservas_beneficio: reserva y consumo de cupos de membresía. Cada reserva
--   se cuenta en el período (membresía + inicio del período) de la fecha del
--   servicio. Para un período todavía no generado, la reserva es provisional
--   (periodo_id nulo) y nunca genera la mensualidad por adelantado.
-- * ocupaciones_recurso: tabla técnica de horarios ocupados por vehículos y
--   conductores, compartida con los módulos de E5. Una restricción de
--   exclusión impide dos ocupaciones planificadas que se solapen para el
--   mismo recurso; las funciones bloquean además el recurso para evitar
--   carreras y comprueban los servicios en curso.
-- * Escritura solo mediante las funciones de la siguiente migración. Nada se
--   borra: los traslados se cancelan, las reservas se liberan y las
--   ocupaciones se desactivan.

-- Igualdad de uuid y text en índices GiST (restricción de exclusión).
create extension if not exists btree_gist with schema extensions;

create type public.tipo_traslado as enum ('cubierto', 'particular');
create type public.estado_traslado as enum ('solicitado', 'programado', 'en_curso', 'completado', 'cancelado');
create type public.condicion_cobertura as enum ('valida', 'pendiente_validacion', 'no_valida');
create type public.estado_reserva as enum ('reservada', 'consumida', 'liberada');
-- Documento que ocupa un recurso. E5 añadirá alquileres y transportes.
create type public.origen_ocupacion as enum ('traslado');

create table public.traslados_ambulancia (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  tipo public.tipo_traslado not null,
  membresia_id uuid references public.membresias (id) on delete restrict,
  beneficiario_id uuid references public.beneficiarios (id) on delete restrict,
  -- Paciente sin ficha de beneficiario (servicios particulares).
  pasajero text check (pasajero is null or length(btrim(pasajero)) between 1 and 200),
  -- Período de la reserva vigente (nulo si es provisional o no hay reserva).
  periodo_id uuid references public.periodos_membresia (id) on delete restrict,
  condicion_cobertura public.condicion_cobertura,
  motivo_cobertura text,
  estado public.estado_traslado not null default 'solicitado',
  inicio_previsto timestamptz not null,
  minutos_estimados integer not null default 90 check (minutos_estimados between 1 and 1440),
  inicio_real timestamptz,
  fin_real timestamptz,
  origen text not null check (length(btrim(origen)) between 1 and 300),
  destino text check (destino is null or length(btrim(destino)) between 1 and 300),
  motivo text check (motivo is null or length(btrim(motivo)) between 1 and 500),
  vehiculo_id uuid references public.vehiculos (id) on delete restrict,
  conductor_id uuid references public.conductores (id) on delete restrict,
  tarifa_id uuid references public.tarifas (id) on delete restrict,
  precio_pactado numeric(14, 2) check (precio_pactado is null or precio_pactado > 0),
  cargo_id uuid constraint traslados_ambulancia_cargo_key unique references public.cargos_cliente (id) on delete restrict,
  notas text check (notas is null or length(btrim(notas)) between 1 and 1000),
  notas_finales text check (notas_finales is null or length(btrim(notas_finales)) between 1 and 1000),
  motivo_cancelacion text,
  cancelado_en timestamptz,
  cancelado_por uuid references public.perfiles (id) on delete restrict,
  idempotencia uuid not null constraint traslados_ambulancia_idempotencia_key unique,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  actualizado_por uuid references public.perfiles (id) on delete restrict,
  -- Cubierto: con membresía, beneficiario y condición; particular: sin ellas.
  constraint traslados_ambulancia_cubierto_check check (
    (tipo = 'cubierto') = (membresia_id is not null)
    and (tipo <> 'cubierto' or (beneficiario_id is not null and condicion_cobertura is not null))
    and (tipo <> 'particular' or (condicion_cobertura is null and periodo_id is null))
  ),
  -- Solo un particular completado tiene cargo (el ingreso de un cubierto es la mensualidad).
  constraint traslados_ambulancia_cargo_check check (
    (cargo_id is not null) = (tipo = 'particular' and estado = 'completado')
    and (cargo_id is null or precio_pactado is not null)
  ),
  constraint traslados_ambulancia_ejecucion_check check (
    (estado in ('en_curso', 'completado')) = (inicio_real is not null)
    and (estado = 'completado') = (fin_real is not null)
    and (fin_real is null or fin_real >= inicio_real)
    and (estado not in ('en_curso', 'completado') or (vehiculo_id is not null and conductor_id is not null and destino is not null))
    and (tipo <> 'cubierto' or estado not in ('en_curso', 'completado') or periodo_id is not null)
  ),
  constraint traslados_ambulancia_cancelacion_check
    check ((estado = 'cancelado') = (cancelado_en is not null and motivo_cancelacion is not null))
);

create table public.reservas_beneficio (
  id uuid primary key default gen_random_uuid(),
  traslado_id uuid not null references public.traslados_ambulancia (id) on delete restrict,
  membresia_id uuid not null references public.membresias (id) on delete restrict,
  beneficiario_id uuid not null references public.beneficiarios (id) on delete restrict,
  -- Período en el que cuenta: inicio del período de la fecha del servicio.
  periodo_inicio date not null,
  -- Nulo mientras el período no se haya generado (reserva provisional).
  periodo_id uuid references public.periodos_membresia (id) on delete restrict,
  fecha_servicio date not null,
  estado public.estado_reserva not null default 'reservada',
  consumida_en timestamptz,
  motivo_liberacion text,
  liberada_en timestamptz,
  liberada_por uuid references public.perfiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint reservas_beneficio_liberacion_check
    check ((estado = 'liberada') = (liberada_en is not null and motivo_liberacion is not null)),
  constraint reservas_beneficio_consumo_check
    check ((consumida_en is not null) = (estado = 'consumida' or (estado = 'liberada' and consumida_en is not null))
      and (estado <> 'consumida' or periodo_id is not null))
);

-- Un traslado tiene como mucho una reserva vigente (reservada o consumida).
create unique index reservas_beneficio_vigente_key
  on public.reservas_beneficio (traslado_id) where estado <> 'liberada';

create table public.ocupaciones_recurso (
  id uuid primary key default gen_random_uuid(),
  recurso_tipo text not null check (recurso_tipo in ('vehiculo', 'conductor')),
  recurso_id uuid not null,
  origen_tipo public.origen_ocupacion not null,
  origen_id uuid not null,
  intervalo tstzrange not null
    check (not isempty(intervalo) and not lower_inf(intervalo) and not upper_inf(intervalo)),
  -- En curso: ocupa el recurso al menos hasta que termine (aunque se prolongue).
  en_curso boolean not null default false,
  activa boolean not null default true,
  liberada_en timestamptz,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint ocupaciones_recurso_liberacion_check check (activa = (liberada_en is null)),
  -- Dos horarios planificados del mismo recurso no se solapan. Los servicios
  -- en curso se controlan en las funciones: pueden prolongarse.
  constraint ocupaciones_recurso_sin_solape exclude using gist (
    recurso_tipo extensions.gist_text_ops with =,
    recurso_id extensions.gist_uuid_ops with =,
    intervalo with &&
  ) where (activa and not en_curso)
);

-- Una ocupación vigente por documento y tipo de recurso.
create unique index ocupaciones_recurso_vigente_key
  on public.ocupaciones_recurso (origen_tipo, origen_id, recurso_tipo) where activa;

-- ---------------------------------------------------------------------------
-- Índices (FKs, estados y fechas)
-- ---------------------------------------------------------------------------

create index traslados_ambulancia_inicio_idx on public.traslados_ambulancia (inicio_previsto);
create index traslados_ambulancia_estado_idx on public.traslados_ambulancia (estado, inicio_previsto);
create index traslados_ambulancia_cliente_idx on public.traslados_ambulancia (cliente_id);
create index traslados_ambulancia_membresia_idx on public.traslados_ambulancia (membresia_id, estado);
create index traslados_ambulancia_beneficiario_idx on public.traslados_ambulancia (beneficiario_id);
create index traslados_ambulancia_periodo_idx on public.traslados_ambulancia (periodo_id);
create index traslados_ambulancia_vehiculo_idx on public.traslados_ambulancia (vehiculo_id);
create index traslados_ambulancia_conductor_idx on public.traslados_ambulancia (conductor_id);
create index traslados_ambulancia_tarifa_idx on public.traslados_ambulancia (tarifa_id);
create index traslados_ambulancia_creado_por_idx on public.traslados_ambulancia (creado_por);
create index traslados_ambulancia_actualizado_por_idx on public.traslados_ambulancia (actualizado_por);
create index traslados_ambulancia_cancelado_por_idx on public.traslados_ambulancia (cancelado_por);

create index reservas_beneficio_periodo_idx on public.reservas_beneficio (membresia_id, periodo_inicio) where estado <> 'liberada';
create index reservas_beneficio_traslado_idx on public.reservas_beneficio (traslado_id);
create index reservas_beneficio_beneficiario_idx on public.reservas_beneficio (beneficiario_id);
create index reservas_beneficio_periodo_id_idx on public.reservas_beneficio (periodo_id);
create index reservas_beneficio_creado_por_idx on public.reservas_beneficio (creado_por);
create index reservas_beneficio_liberada_por_idx on public.reservas_beneficio (liberada_por);

create index ocupaciones_recurso_recurso_idx on public.ocupaciones_recurso (recurso_tipo, recurso_id) where activa;
create index ocupaciones_recurso_origen_idx on public.ocupaciones_recurso (origen_tipo, origen_id);
create index ocupaciones_recurso_creado_por_idx on public.ocupaciones_recurso (creado_por);

-- ---------------------------------------------------------------------------
-- Integridad del historial (también frente al propietario)
-- ---------------------------------------------------------------------------

-- Traslados: solo transiciones coherentes; completados y cancelados no cambian.
create function private.proteger_traslado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado in ('completado', 'cancelado') then
    raise exception 'El traslado está % y no admite cambios.', old.estado using errcode = '42501';
  end if;
  if new.estado <> old.estado and old.estado::text || '>' || new.estado::text not in (
    'solicitado>programado', 'solicitado>en_curso', 'solicitado>cancelado',
    'programado>en_curso', 'programado>cancelado', 'en_curso>completado'
  ) then
    raise exception 'Cambio de estado no permitido: de % a %.', old.estado, new.estado using errcode = '42501';
  end if;
  if new.id <> old.id or new.cliente_id <> old.cliente_id or new.idempotencia <> old.idempotencia
     or new.created_at <> old.created_at or new.creado_por is distinct from old.creado_por
     or (old.inicio_real is not null and new.inicio_real is distinct from old.inicio_real) then
    raise exception 'Los datos de origen del traslado no se modifican.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proteger_traslado before update on public.traslados_ambulancia
for each row execute function private.proteger_traslado();

-- Reservas: reservada → consumida | liberada; consumida → liberada (corrección).
create function private.proteger_reserva()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.estado = 'liberada'
     or (old.estado = 'consumida' and new.estado not in ('consumida', 'liberada'))
     or (old.estado = 'consumida' and new.estado = 'consumida' and to_jsonb(new) <> to_jsonb(old)) then
    raise exception 'La reserva ya fue liberada o consumida; no admite ese cambio.' using errcode = '42501';
  end if;
  if (new.traslado_id, new.membresia_id, new.beneficiario_id, new.periodo_inicio, new.created_at)
     is distinct from (old.traslado_id, old.membresia_id, old.beneficiario_id, old.periodo_inicio, old.created_at)
     or new.creado_por is distinct from old.creado_por
     or (old.periodo_id is not null and new.periodo_id is distinct from old.periodo_id) then
    raise exception 'Los datos de una reserva no se modifican; se libera y se crea otra.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proteger_reserva before update on public.reservas_beneficio
for each row execute function private.proteger_reserva();

-- Ocupaciones: solo se desactivan.
create function private.proteger_ocupacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not old.activa or new.activa or (to_jsonb(new) - 'activa' - 'liberada_en') <> (to_jsonb(old) - 'activa' - 'liberada_en') then
    raise exception 'Las ocupaciones de recursos no se modifican; se liberan y se registra otra.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proteger_ocupacion before update on public.ocupaciones_recurso
for each row execute function private.proteger_ocupacion();

do $$
declare
  t text;
begin
  foreach t in array array['traslados_ambulancia', 'reservas_beneficio', 'ocupaciones_recurso'] loop
    execute format(
      'create trigger impedir_borrado before delete on public.%I
         for each row execute function private.impedir_borrado()', t);
    execute format(
      'create trigger impedir_truncate before truncate on public.%I
         for each statement execute function private.impedir_borrado()', t);
  end loop;
end;
$$;

revoke all on function private.proteger_traslado() from public, anon, authenticated;
revoke all on function private.proteger_reserva() from public, anon, authenticated;
revoke all on function private.proteger_ocupacion() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vista de consulta: estado operativo, cobertura y estado financiero
-- ---------------------------------------------------------------------------

create view public.saldos_traslados with (security_invoker = true) as
select
  t.id, t.cliente_id, cl.nombre as cliente_nombre, t.tipo, t.membresia_id, t.beneficiario_id,
  b.nombre as beneficiario_nombre, t.pasajero, coalesce(b.nombre, t.pasajero) as paciente,
  t.estado, t.condicion_cobertura, t.motivo_cobertura, t.periodo_id, t.inicio_previsto, t.minutos_estimados,
  t.inicio_previsto + make_interval(mins => t.minutos_estimados) as fin_previsto,
  t.inicio_real, t.fin_real, t.origen, t.destino, t.motivo, t.vehiculo_id, v.codigo as vehiculo_codigo,
  t.conductor_id, co.nombre as conductor_nombre, t.tarifa_id, t.precio_pactado, t.cargo_id, t.notas,
  t.notas_finales, t.motivo_cancelacion, t.cancelado_en, t.created_at, t.updated_at,
  r.id as reserva_id, r.estado as reserva_estado, r.periodo_inicio as reserva_periodo_inicio,
  c.monto as cargo_monto, coalesce(c.aplicado, 0)::numeric(14, 2) as aplicado,
  coalesce(c.pendiente, 0)::numeric(14, 2) as pendiente, c.estado as cargo_estado,
  case
    when t.tipo = 'cubierto' then 'no_aplica'
    when t.cargo_id is null then 'sin_cargo'
    when c.estado = 'anulado' then 'anulado'
    when c.pendiente = 0 then 'pagado'
    when c.aplicado > 0 then 'parcial'
    else 'pendiente'
  end as estado_financiero
from public.traslados_ambulancia t
join public.clientes cl on cl.id = t.cliente_id
left join public.beneficiarios b on b.id = t.beneficiario_id
left join public.vehiculos v on v.id = t.vehiculo_id
left join public.conductores co on co.id = t.conductor_id
left join lateral (
  select x.id, x.estado, x.periodo_inicio
  from public.reservas_beneficio x
  where x.traslado_id = t.id
  order by (x.estado <> 'liberada') desc, x.created_at desc
  limit 1
) r on true
left join public.saldos_cargos c on c.id = t.cargo_id;

-- ---------------------------------------------------------------------------
-- Privilegios y RLS: lectura para los tres roles activos, sin escritura directa
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['traslados_ambulancia', 'reservas_beneficio', 'ocupaciones_recurso'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select private.es_usuario_activo()))', t || '_select', t);
  end loop;

  revoke all on public.saldos_traslados from anon, authenticated;
  grant select on public.saldos_traslados to authenticated;
end;
$$;
