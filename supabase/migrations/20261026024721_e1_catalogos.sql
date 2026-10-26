-- E1 · Catálogos básicos: clientes, beneficiarios, vehículos, conductores,
-- proveedores, planes, tarifas y cuentas de dinero.
--
-- Permisos (RLS + privilegios; sin DELETE: los registros se inactivan):
--   lectura: cualquier perfil activo (administrador, operador, finanzas)
--   clientes, beneficiarios, vehículos, conductores: administrador, operador
--   proveedores: administrador, operador, finanzas
--   planes, tarifas, cuentas de dinero: solo administrador
-- Los usuarios no autenticados (anon) no tienen ningún privilegio.

create type public.tipo_cliente as enum ('natural', 'juridica');
create type public.tipo_vehiculo as enum ('ambulancia', 'alquiler', 'transporte', 'mixto');
create type public.estado_vehiculo as enum ('operativo', 'mantenimiento', 'fuera_servicio');
create type public.modalidad_cupo as enum ('compartido', 'individual');
create type public.actividad as enum ('ambulancias', 'alquileres', 'transportes', 'general');
create type public.unidad_tarifa as enum ('dia', 'servicio');
create type public.tipo_cuenta_dinero as enum ('caja', 'banco');

-- Sella las columnas técnicas de auditoría; el cliente no puede falsearlas.
create function private.sellar_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.creado_por := auth.uid();
  else
    new.id := old.id;
    new.created_at := old.created_at;
    new.creado_por := old.creado_por;
  end if;
  new.updated_at := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

revoke all on function private.sellar_auditoria() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_cliente not null default 'natural',
  nombre text not null check (length(btrim(nombre)) between 1 and 200),
  identificacion text check (identificacion is null or length(btrim(identificacion)) between 1 and 40),
  telefono text check (telefono is null or length(btrim(telefono)) between 1 and 40),
  correo text check (correo is null or (length(correo) <= 254 and correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  direccion text check (direccion is null or length(btrim(direccion)) between 1 and 300),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  actualizado_por uuid references public.perfiles (id) on delete restrict
);

create table public.beneficiarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 200),
  identificacion text check (identificacion is null or length(btrim(identificacion)) between 1 and 40),
  fecha_nacimiento date check (fecha_nacimiento is null or fecha_nacimiento >= date '1900-01-01'),
  telefono text check (telefono is null or length(btrim(telefono)) between 1 and 40),
  tutor text check (tutor is null or length(btrim(tutor)) between 1 and 200),
  notas text check (notas is null or length(btrim(notas)) between 1 and 1000),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  actualizado_por uuid references public.perfiles (id) on delete restrict
);

-- Código y placa se guardan normalizados en mayúsculas para que UNIQUE sea fiable.
create table public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null
    constraint vehiculos_codigo_formato check (codigo = upper(btrim(codigo)) and length(codigo) between 1 and 30),
  placa text
    constraint vehiculos_placa_formato check (placa is null or (placa = upper(btrim(placa)) and length(placa) between 1 and 20)),
  tipo public.tipo_vehiculo not null,
  marca text check (marca is null or length(btrim(marca)) between 1 and 60),
  modelo text check (modelo is null or length(btrim(modelo)) between 1 and 60),
  anio smallint check (anio is null or anio between 1950 and 2100),
  estado public.estado_vehiculo not null default 'operativo',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  actualizado_por uuid references public.perfiles (id) on delete restrict,
  constraint vehiculos_codigo_key unique (codigo),
  -- UNIQUE admite varios NULL: la placa es única solo si está presente.
  constraint vehiculos_placa_key unique (placa)
);

create table public.conductores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 200),
  identificacion text check (identificacion is null or length(btrim(identificacion)) between 1 and 40),
  telefono text check (telefono is null or length(btrim(telefono)) between 1 and 40),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  actualizado_por uuid references public.perfiles (id) on delete restrict
);

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 200),
  telefono text check (telefono is null or length(btrim(telefono)) between 1 and 40),
  identificacion text check (identificacion is null or length(btrim(identificacion)) between 1 and 40),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  actualizado_por uuid references public.perfiles (id) on delete restrict
);

create table public.planes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  precio_mensual numeric(14, 2) not null check (precio_mensual >= 0),
  cupo_mensual integer not null check (cupo_mensual >= 0),
  modalidad_cupo public.modalidad_cupo not null,
  dias_gracia integer not null check (dias_gracia >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  actualizado_por uuid references public.perfiles (id) on delete restrict
);

-- Las tarifas son de referencia por línea de negocio; 'general' es solo para gastos.
create table public.tarifas (
  id uuid primary key default gen_random_uuid(),
  actividad public.actividad not null
    constraint tarifas_actividad_operativa check (actividad <> 'general'),
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  unidad public.unidad_tarifa not null,
  precio_base numeric(14, 2) not null check (precio_base >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  actualizado_por uuid references public.perfiles (id) on delete restrict
);

-- Moneda única HNL. El saldo nunca se guarda aquí: se derivará de movimientos (E2).
create table public.cuentas_dinero (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  tipo public.tipo_cuenta_dinero not null,
  banco text check (banco is null or length(btrim(banco)) between 1 and 120),
  numero_cuenta text check (numero_cuenta is null or length(btrim(numero_cuenta)) between 1 and 40),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  actualizado_por uuid references public.perfiles (id) on delete restrict
);

-- ---------------------------------------------------------------------------
-- Índices de búsqueda, estado y FKs
-- ---------------------------------------------------------------------------

create index clientes_nombre_idx on public.clientes (lower(nombre));
create index clientes_identificacion_idx on public.clientes (identificacion);
create index clientes_activo_idx on public.clientes (activo);
create index beneficiarios_nombre_idx on public.beneficiarios (lower(nombre));
create index beneficiarios_activo_idx on public.beneficiarios (activo);
create index vehiculos_tipo_estado_idx on public.vehiculos (tipo, estado, activo);
create index conductores_nombre_idx on public.conductores (lower(nombre));
create index conductores_activo_idx on public.conductores (activo);
create index proveedores_nombre_idx on public.proveedores (lower(nombre));
create index proveedores_activo_idx on public.proveedores (activo);
create index planes_activo_idx on public.planes (activo);
create index tarifas_actividad_idx on public.tarifas (actividad, activo);
create index cuentas_dinero_activo_idx on public.cuentas_dinero (tipo, activo);

create index clientes_creado_por_idx on public.clientes (creado_por);
create index clientes_actualizado_por_idx on public.clientes (actualizado_por);
create index beneficiarios_creado_por_idx on public.beneficiarios (creado_por);
create index beneficiarios_actualizado_por_idx on public.beneficiarios (actualizado_por);
create index vehiculos_creado_por_idx on public.vehiculos (creado_por);
create index vehiculos_actualizado_por_idx on public.vehiculos (actualizado_por);
create index conductores_creado_por_idx on public.conductores (creado_por);
create index conductores_actualizado_por_idx on public.conductores (actualizado_por);
create index proveedores_creado_por_idx on public.proveedores (creado_por);
create index proveedores_actualizado_por_idx on public.proveedores (actualizado_por);
create index planes_creado_por_idx on public.planes (creado_por);
create index planes_actualizado_por_idx on public.planes (actualizado_por);
create index tarifas_creado_por_idx on public.tarifas (creado_por);
create index tarifas_actualizado_por_idx on public.tarifas (actualizado_por);
create index cuentas_dinero_creado_por_idx on public.cuentas_dinero (creado_por);
create index cuentas_dinero_actualizado_por_idx on public.cuentas_dinero (actualizado_por);

-- ---------------------------------------------------------------------------
-- Auditoría, privilegios y RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes', 'beneficiarios', 'vehiculos', 'conductores',
    'proveedores', 'planes', 'tarifas', 'cuentas_dinero'
  ] loop
    execute format(
      'create trigger sellar_auditoria before insert or update on public.%I
         for each row execute function private.sellar_auditoria()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select private.es_usuario_activo()))', t || '_select', t);
  end loop;
end;
$$;

-- Catálogos operativos: administrador y operador.
do $$
declare
  t text;
begin
  foreach t in array array['clientes', 'beneficiarios', 'vehiculos', 'conductores'] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check ((select private.tiene_rol(''administrador'', ''operador'')))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using ((select private.tiene_rol(''administrador'', ''operador'')))
         with check ((select private.tiene_rol(''administrador'', ''operador'')))',
      t || '_update', t);
  end loop;
end;
$$;

-- Proveedores: también finanzas (registrará gastos y abonos a proveedores).
create policy proveedores_insert on public.proveedores
for insert to authenticated
with check ((select private.tiene_rol('administrador', 'operador', 'finanzas')));

create policy proveedores_update on public.proveedores
for update to authenticated
using ((select private.tiene_rol('administrador', 'operador', 'finanzas')))
with check ((select private.tiene_rol('administrador', 'operador', 'finanzas')));

-- Configuración comercial y financiera sensible: solo administrador.
do $$
declare
  t text;
begin
  foreach t in array array['planes', 'tarifas', 'cuentas_dinero'] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check ((select private.tiene_rol(''administrador'')))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using ((select private.tiene_rol(''administrador'')))
         with check ((select private.tiene_rol(''administrador'')))',
      t || '_update', t);
  end loop;
end;
$$;
