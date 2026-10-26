-- E3 · Membresías: estructura.
--
-- * La membresía copia las condiciones del plan (precio, cupo, modalidad y
--   días de gracia). Cada período guarda su propia copia: cambiar después las
--   condiciones o el plan no altera los períodos ya generados.
-- * Cada período con precio genera exactamente un cargo de E2
--   (origen 'periodo_membresia', origen_id = id del período). No hay tablas de
--   cobros propias: las cuotas se pagan con cobros, aplicaciones y anticipos de
--   E2, y los saldos se derivan de saldos_cargos.
-- * Escritura solo mediante las funciones de la siguiente migración. Nada se
--   borra: los vínculos con beneficiarios se dan de baja y las membresías se
--   cancelan.

create type public.estado_membresia as enum ('activa', 'suspendida', 'cancelada');

create table public.membresias (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  plan_id uuid not null references public.planes (id) on delete restrict,
  -- Fecha original de afiliación: no cambia aunque la membresía se reactive.
  fecha_inicio date not null check (fecha_inicio >= date '2000-01-01'),
  -- Día del mes en que renueva el ciclo vigente; solo cambia al reactivar.
  dia_ancla smallint not null check (dia_ancla between 1 and 31),
  -- Inicio del siguiente período por generar.
  proxima_renovacion date not null,
  -- Condiciones pactadas para los ciclos futuros.
  precio_pactado numeric(14, 2) not null check (precio_pactado >= 0),
  cupo_pactado integer not null check (cupo_pactado >= 0),
  modalidad_cupo public.modalidad_cupo not null,
  dias_gracia integer not null check (dias_gracia between 0 and 3650),
  estado public.estado_membresia not null default 'activa',
  suspendida_desde date,
  motivo_cancelacion text,
  cancelada_en timestamptz,
  cancelada_por uuid references public.perfiles (id) on delete restrict,
  idempotencia uuid not null constraint membresias_idempotencia_key unique,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  actualizado_por uuid references public.perfiles (id) on delete restrict,
  constraint membresias_renovacion_check check (proxima_renovacion >= fecha_inicio),
  constraint membresias_suspension_check check ((estado = 'suspendida') = (suspendida_desde is not null)),
  constraint membresias_cancelacion_check
    check ((estado = 'cancelada') = (cancelada_en is not null and motivo_cancelacion is not null))
);

-- Historial de altas y bajas: una baja cierra el vínculo y un nuevo alta crea
-- otro. Solo un vínculo activo por membresía y beneficiario.
create table public.membresia_beneficiarios (
  id uuid primary key default gen_random_uuid(),
  membresia_id uuid not null references public.membresias (id) on delete restrict,
  beneficiario_id uuid not null references public.beneficiarios (id) on delete restrict,
  activo boolean not null default true,
  fecha_alta date not null,
  -- Primer día sin cobertura.
  fecha_baja date,
  motivo_baja text,
  dado_baja_en timestamptz,
  dado_baja_por uuid references public.perfiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint membresia_beneficiarios_baja_check
    check (activo = (fecha_baja is null and motivo_baja is null and dado_baja_en is null)),
  constraint membresia_beneficiarios_fechas_check check (fecha_baja is null or fecha_baja >= fecha_alta)
);

create unique index membresia_beneficiarios_activo_key
  on public.membresia_beneficiarios (membresia_id, beneficiario_id) where activo;

create table public.periodos_membresia (
  id uuid primary key default gen_random_uuid(),
  membresia_id uuid not null references public.membresias (id) on delete restrict,
  inicio date not null,
  fin date not null,
  precio numeric(14, 2) not null check (precio >= 0),
  cupo_asignado integer not null check (cupo_asignado >= 0),
  modalidad_cupo public.modalidad_cupo not null,
  dias_gracia integer not null check (dias_gracia between 0 and 3650),
  -- Vencimiento ordinario = inicio; pasado este día la cuota impaga suspende.
  limite_pago date generated always as (inicio + dias_gracia) stored,
  cargo_id uuid references public.cargos_cliente (id) on delete restrict,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint periodos_membresia_inicio_key unique (membresia_id, inicio),
  constraint periodos_membresia_cargo_key unique (cargo_id),
  constraint periodos_membresia_fechas_check check (fin >= inicio),
  -- Un período con precio tiene su cargo; uno sin precio no genera deuda.
  constraint periodos_membresia_cargo_check check ((precio > 0) = (cargo_id is not null))
);

-- ---------------------------------------------------------------------------
-- Índices (FKs, estados y fechas)
-- ---------------------------------------------------------------------------

create index membresias_cliente_idx on public.membresias (cliente_id);
create index membresias_plan_idx on public.membresias (plan_id);
create index membresias_estado_idx on public.membresias (estado, proxima_renovacion);
create index membresias_creado_por_idx on public.membresias (creado_por);
create index membresias_actualizado_por_idx on public.membresias (actualizado_por);
create index membresias_cancelada_por_idx on public.membresias (cancelada_por);

create index membresia_beneficiarios_membresia_idx on public.membresia_beneficiarios (membresia_id, activo);
create index membresia_beneficiarios_beneficiario_idx on public.membresia_beneficiarios (beneficiario_id);
create index membresia_beneficiarios_creado_por_idx on public.membresia_beneficiarios (creado_por);
create index membresia_beneficiarios_dado_baja_por_idx on public.membresia_beneficiarios (dado_baja_por);

create index periodos_membresia_creado_por_idx on public.periodos_membresia (creado_por);

-- ---------------------------------------------------------------------------
-- Historial: no se borra; los períodos son inmutables
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['membresias', 'membresia_beneficiarios', 'periodos_membresia'] loop
    execute format(
      'create trigger impedir_borrado before delete on public.%I
         for each row execute function private.impedir_borrado()', t);
    execute format(
      'create trigger impedir_truncate before truncate on public.%I
         for each statement execute function private.impedir_borrado()', t);
  end loop;
end;
$$;

create trigger impedir_modificacion before update on public.periodos_membresia
for each row execute function private.impedir_modificacion();

-- ---------------------------------------------------------------------------
-- Saldos derivados (vistas con los permisos de quien consulta)
-- ---------------------------------------------------------------------------

-- Cuota vencida: tiene pendiente y ya pasó su límite de pago (inicio + gracia).
create view public.saldos_periodos with (security_invoker = true) as
select
  p.id, p.membresia_id, m.cliente_id, p.inicio, p.fin, p.precio, p.cupo_asignado,
  p.modalidad_cupo, p.dias_gracia, p.limite_pago, p.cargo_id, p.created_at,
  c.estado as cargo_estado,
  coalesce(c.aplicado, 0)::numeric(14, 2) as aplicado,
  coalesce(c.pendiente, 0)::numeric(14, 2) as pendiente,
  (coalesce(c.pendiente, 0) > 0
    and p.limite_pago < (now() at time zone 'America/Tegucigalpa')::date) as vencida
from public.periodos_membresia p
join public.membresias m on m.id = p.membresia_id
left join public.saldos_cargos c on c.id = p.cargo_id;

create view public.saldos_membresias with (security_invoker = true) as
select
  m.id, m.cliente_id, cl.nombre as cliente_nombre, m.plan_id, pl.nombre as plan_nombre,
  m.fecha_inicio, m.dia_ancla, m.proxima_renovacion, m.precio_pactado, m.cupo_pactado,
  m.modalidad_cupo, m.dias_gracia, m.estado, m.suspendida_desde, m.motivo_cancelacion,
  m.cancelada_en, m.created_at,
  coalesce(s.pendiente, 0)::numeric(14, 2) as pendiente,
  coalesce(s.vencido, 0)::numeric(14, 2) as vencido,
  coalesce(s.cuotas_vencidas, 0)::integer as cuotas_vencidas,
  coalesce(b.activos, 0)::integer as beneficiarios_activos
from public.membresias m
join public.clientes cl on cl.id = m.cliente_id
join public.planes pl on pl.id = m.plan_id
left join lateral (
  select sum(sp.pendiente) as pendiente,
    sum(sp.pendiente) filter (where sp.vencida) as vencido,
    count(*) filter (where sp.vencida) as cuotas_vencidas
  from public.saldos_periodos sp
  where sp.membresia_id = m.id
) s on true
left join lateral (
  select count(*) as activos
  from public.membresia_beneficiarios mb
  where mb.membresia_id = m.id and mb.activo
) b on true;

-- ---------------------------------------------------------------------------
-- Privilegios y RLS: lectura para los tres roles activos, sin escritura directa
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['membresias', 'membresia_beneficiarios', 'periodos_membresia'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select private.es_usuario_activo()))', t || '_select', t);
  end loop;

  foreach t in array array['saldos_periodos', 'saldos_membresias'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end;
$$;
