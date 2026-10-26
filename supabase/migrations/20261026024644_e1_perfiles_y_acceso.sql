-- E1 · Perfiles internos, roles y control de acceso.
--
-- * Cada usuario de Supabase Auth recibe un perfil INACTIVO (rol operador) al
--   crearse; no tiene acceso a datos hasta que un administrador lo active.
-- * El rol vive en public.perfiles (nunca en user_metadata) y solo cambia
--   mediante public.actualizar_perfil, que exige administrador activo, impide
--   cambiar el propio rol/estado y deja registro en public.bitacora.
-- * El primer administrador se habilita con
--   private.bootstrap_primer_administrador, ejecutable solo por el propietario
--   de la base de datos (SQL Editor / MCP) y solo mientras no exista ningún
--   administrador activo.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.rol_usuario as enum ('administrador', 'operador', 'finanzas');

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete restrict,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  correo text,
  rol public.rol_usuario not null default 'operador',
  activo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  actualizado_por uuid references public.perfiles (id) on delete restrict
);

comment on table public.perfiles is
  'Perfil interno vinculado a auth.users. Rol y estado solo cambian con public.actualizar_perfil.';

create index perfiles_rol_activo_idx on public.perfiles (rol, activo);
create index perfiles_actualizado_por_idx on public.perfiles (actualizado_por);

-- Registro de eventos administrativos importantes (quién, cuándo, motivo).
create table public.bitacora (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.perfiles (id) on delete restrict,
  entidad text not null,
  registro_id uuid not null,
  accion text not null,
  motivo text,
  antes jsonb,
  despues jsonb,
  fecha timestamptz not null default now()
);

create index bitacora_entidad_registro_idx on public.bitacora (entidad, registro_id, fecha desc);
create index bitacora_actor_idx on public.bitacora (actor_id);
create index bitacora_fecha_idx on public.bitacora (fecha desc);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares de autorización (esquema private: no expuesto por la API)
-- ---------------------------------------------------------------------------

-- Rol del usuario autenticado, solo si su perfil está activo.
-- SECURITY DEFINER para poder usarla en políticas de perfiles sin recursión.
create function private.rol_activo()
returns public.rol_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select p.rol
  from public.perfiles p
  where p.id = auth.uid() and p.activo
$$;

create function private.tiene_rol(variadic roles public.rol_usuario[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.rol_activo() = any (roles), false)
$$;

create function private.es_usuario_activo()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.rol_activo() is not null
$$;

revoke all on function private.rol_activo() from public, anon;
revoke all on function private.tiene_rol(public.rol_usuario[]) from public, anon;
revoke all on function private.es_usuario_activo() from public, anon;
grant execute on function private.rol_activo() to authenticated;
grant execute on function private.tiene_rol(public.rol_usuario[]) to authenticated;
grant execute on function private.es_usuario_activo() to authenticated;

-- ---------------------------------------------------------------------------
-- Perfiles: alta automática, sincronización de correo y protección
-- ---------------------------------------------------------------------------

-- Nunca se toman nombre ni rol de raw_user_meta_data (editable por el usuario).
create function private.crear_perfil_de_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre, correo)
  values (
    new.id,
    coalesce(nullif(left(split_part(coalesce(new.email, ''), '@', 1), 120), ''), 'Usuario'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger crear_perfil_de_usuario
after insert on auth.users
for each row execute function private.crear_perfil_de_usuario();

create function private.sincronizar_correo_de_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.perfiles set correo = new.email where id = new.id;
  return new;
end;
$$;

create trigger sincronizar_correo_de_usuario
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function private.sincronizar_correo_de_usuario();

-- Defensa adicional: nadie cambia su propio rol ni su estado, aunque llegue
-- a tener permiso de UPDATE. auth.uid() es nulo solo para el propietario de la
-- base (SQL Editor / MCP), que sí puede hacerlo.
create function private.proteger_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.id = auth.uid()
     and (new.rol is distinct from old.rol or new.activo is distinct from old.activo) then
    raise exception 'No puede cambiar su propio rol ni su estado.'
      using errcode = '42501';
  end if;
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

create trigger proteger_perfil
before update on public.perfiles
for each row execute function private.proteger_perfil();

-- Perfiles para los usuarios de Auth existentes antes de esta migración
-- (quedan inactivos; no se modifica ningún dato existente).
insert into public.perfiles (id, nombre, correo)
select
  u.id,
  coalesce(nullif(left(split_part(coalesce(u.email, ''), '@', 1), 120), ''), 'Usuario'),
  u.email
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Mecanismo seguro de cambio de perfil (único camino desde la aplicación)
-- ---------------------------------------------------------------------------

create function public.actualizar_perfil(
  p_id uuid,
  p_nombre text,
  p_rol public.rol_usuario,
  p_activo boolean,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_antes public.perfiles;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_cambia_acceso boolean;
begin
  if v_actor is null or not private.tiene_rol('administrador') then
    raise exception 'Solo un administrador activo puede modificar perfiles.'
      using errcode = '42501';
  end if;

  select * into v_antes from public.perfiles where id = p_id for update;
  if not found then
    raise exception 'Perfil no encontrado.' using errcode = 'P0002';
  end if;

  v_cambia_acceso := p_rol is distinct from v_antes.rol
    or p_activo is distinct from v_antes.activo;

  if v_cambia_acceso and p_id = v_actor then
    raise exception 'No puede cambiar su propio rol ni su estado.'
      using errcode = '42501';
  end if;
  if v_cambia_acceso and v_motivo is null then
    raise exception 'Indique el motivo del cambio de rol o estado.'
      using errcode = '22023';
  end if;

  update public.perfiles
  set nombre = btrim(p_nombre), rol = p_rol, activo = p_activo
  where id = p_id;

  if v_cambia_acceso or btrim(p_nombre) is distinct from v_antes.nombre then
    insert into public.bitacora (actor_id, entidad, registro_id, accion, motivo, antes, despues)
    values (
      v_actor,
      'perfiles',
      p_id,
      'actualizar_perfil',
      v_motivo,
      jsonb_build_object('nombre', v_antes.nombre, 'rol', v_antes.rol, 'activo', v_antes.activo),
      jsonb_build_object('nombre', btrim(p_nombre), 'rol', p_rol, 'activo', p_activo)
    );
  end if;
end;
$$;

revoke all on function public.actualizar_perfil(uuid, text, public.rol_usuario, boolean, text)
  from public, anon;
grant execute on function public.actualizar_perfil(uuid, text, public.rol_usuario, boolean, text)
  to authenticated;

-- Bootstrap del primer administrador. Solo para el propietario de la base:
--   select private.bootstrap_primer_administrador('correo@dominio', 'Nombre');
-- Falla si ya existe un administrador activo o si el correo no existe en Auth.
create function private.bootstrap_primer_administrador(p_correo text, p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.perfiles where rol = 'administrador' and activo) then
    raise exception 'Ya existe un administrador activo; gestione los usuarios desde la aplicación.';
  end if;

  select u.id into v_id
  from auth.users u
  where lower(u.email) = lower(btrim(p_correo));
  if v_id is null then
    raise exception 'No existe un usuario de Supabase Auth con ese correo.';
  end if;

  insert into public.perfiles (id, nombre, correo, rol, activo)
  select v_id, btrim(p_nombre), u.email, 'administrador', true
  from auth.users u where u.id = v_id
  on conflict (id) do update
    set nombre = excluded.nombre, rol = 'administrador', activo = true;

  insert into public.bitacora (actor_id, entidad, registro_id, accion, motivo, despues)
  values (
    null,
    'perfiles',
    v_id,
    'bootstrap_primer_administrador',
    'Habilitación del primer administrador (procedimiento documentado)',
    jsonb_build_object('nombre', btrim(p_nombre), 'rol', 'administrador', 'activo', true)
  );

  return v_id;
end;
$$;

revoke all on function private.bootstrap_primer_administrador(text, text)
  from public, anon, authenticated;
revoke all on function private.crear_perfil_de_usuario() from public, anon, authenticated;
revoke all on function private.sincronizar_correo_de_usuario() from public, anon, authenticated;
revoke all on function private.proteger_perfil() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios y RLS
-- ---------------------------------------------------------------------------

alter table public.perfiles enable row level security;
alter table public.bitacora enable row level security;

revoke all on public.perfiles from anon, authenticated;
revoke all on public.bitacora from anon, authenticated;

-- Sin INSERT/UPDATE/DELETE directos: el alta es por trigger y los cambios por
-- public.actualizar_perfil.
grant select on public.perfiles to authenticated;
grant select on public.bitacora to authenticated;

-- Cada usuario ve su propio perfil (aunque esté inactivo, para saber su estado);
-- el administrador activo ve todos.
create policy perfiles_select on public.perfiles
for select to authenticated
using (id = (select auth.uid()) or (select private.tiene_rol('administrador')));

create policy bitacora_select on public.bitacora
for select to authenticated
using ((select private.tiene_rol('administrador')));
