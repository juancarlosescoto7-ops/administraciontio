-- Permisos por usuario y cuenta de desarrollador (solicitado el 2026-11-07).
--
-- * perfiles.es_desarrollador: solo lo cambia el propietario de la base
--   (SQL Editor / MCP). El desarrollador administra los permisos de los demás.
-- * perfiles.permisos_denegados: módulos y funciones que el desarrollador
--   apagó para ese usuario. Restringen DENTRO de lo que el rol ya permite;
--   la aplicación los aplica en páginas, menú y acciones del servidor. La RLS
--   y las funciones siguen protegiendo por rol (decisión del propietario).
-- * public.guardar_permisos_usuario: único camino para cambiarlos; exige
--   desarrollador activo y deja registro en la bitácora.
-- * public.actualizar_perfil: un administrador que no es desarrollador ya no
--   puede cambiar rol, estado ni nombre de una cuenta de desarrollador.
-- * private.crear_usuario_interno: alta de cuentas por el propietario de la
--   base, con correo o con nombre de usuario (se guarda como
--   <usuario>@usuarios.erp.invalid). La contraseña se pasa al llamar a la
--   función y nunca se guarda en el repositorio.

alter table public.perfiles
  add column es_desarrollador boolean not null default false,
  add column permisos_denegados text[] not null default '{}',
  add constraint perfiles_permisos_denegados_limite
    check (cardinality(permisos_denegados) <= 200),
  add constraint perfiles_desarrollador_sin_restricciones
    check (not es_desarrollador or cardinality(permisos_denegados) = 0);

comment on column public.perfiles.es_desarrollador is
  'Cuenta de desarrollador: administra permisos por usuario. Solo la cambia el propietario de la base.';
comment on column public.perfiles.permisos_denegados is
  'Módulos y funciones apagados para el usuario. Solo cambia con public.guardar_permisos_usuario.';

-- ---------------------------------------------------------------------------
-- Auxiliar de autorización
-- ---------------------------------------------------------------------------

create function private.es_desarrollador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.es_desarrollador from public.perfiles p where p.id = auth.uid() and p.activo),
    false
  )
$$;

revoke all on function private.es_desarrollador() from public, anon;
grant execute on function private.es_desarrollador() to authenticated;

-- ---------------------------------------------------------------------------
-- Protección del perfil: nadie con sesión cambia la marca de desarrollador.
-- ---------------------------------------------------------------------------

create or replace function private.proteger_perfil()
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
  if auth.uid() is not null and new.es_desarrollador is distinct from old.es_desarrollador then
    raise exception 'La cuenta de desarrollador solo se asigna desde la base de datos.'
      using errcode = '42501';
  end if;
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- actualizar_perfil: igual que antes, más la protección del desarrollador.
-- ---------------------------------------------------------------------------

create or replace function public.actualizar_perfil(
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

  if v_antes.es_desarrollador and p_id <> v_actor and not private.es_desarrollador() then
    raise exception 'Solo el desarrollador puede modificar la cuenta de desarrollador.'
      using errcode = '42501';
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

-- ---------------------------------------------------------------------------
-- Guardar los permisos de un usuario (solo desarrollador activo)
-- ---------------------------------------------------------------------------

create function public.guardar_permisos_usuario(
  p_id uuid,
  p_denegados text[],
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
  v_denegados text[];
begin
  if v_actor is null or not private.es_desarrollador() then
    raise exception 'Solo el desarrollador puede cambiar los permisos de los usuarios.'
      using errcode = '42501';
  end if;
  if v_motivo is not null and length(v_motivo) > 300 then
    raise exception 'El motivo admite como máximo 300 caracteres.' using errcode = '22023';
  end if;

  select * into v_antes from public.perfiles where id = p_id for update;
  if not found then
    raise exception 'Perfil no encontrado.' using errcode = 'P0002';
  end if;
  if v_antes.es_desarrollador then
    raise exception 'La cuenta de desarrollador siempre tiene todos los permisos.'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct btrim(c) order by btrim(c)), '{}')
  into v_denegados
  from unnest(coalesce(p_denegados, '{}')) as c
  where btrim(c) <> '';

  if cardinality(v_denegados) > 200 then
    raise exception 'Demasiados permisos en la lista.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_denegados) c where c !~ '^[a-z][a-zA-Z0-9_.:]{0,63}$') then
    raise exception 'Clave de permiso no válida.' using errcode = '22023';
  end if;

  if v_denegados = v_antes.permisos_denegados then
    return;
  end if;

  update public.perfiles set permisos_denegados = v_denegados where id = p_id;

  insert into public.bitacora (actor_id, entidad, registro_id, accion, motivo, antes, despues)
  values (
    v_actor,
    'perfiles',
    p_id,
    'guardar_permisos_usuario',
    v_motivo,
    jsonb_build_object('permisos_denegados', to_jsonb(v_antes.permisos_denegados)),
    jsonb_build_object('permisos_denegados', to_jsonb(v_denegados))
  );
end;
$$;

revoke all on function public.guardar_permisos_usuario(uuid, text[], text) from public, anon;
grant execute on function public.guardar_permisos_usuario(uuid, text[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- Alta de cuentas internas. Solo para el propietario de la base:
--   select private.crear_usuario_interno('cantarranas', '<contraseña>',
--     'Administración Cantarranas', 'administrador', false);
-- Un valor sin «@» es un nombre de usuario y se guarda como
-- <usuario>@usuarios.erp.invalid (dominio reservado: nunca recibe correo).
-- ---------------------------------------------------------------------------

create function private.crear_usuario_interno(
  p_acceso text,
  p_contrasena text,
  p_nombre text,
  p_rol public.rol_usuario default 'administrador',
  p_desarrollador boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acceso text := lower(btrim(coalesce(p_acceso, '')));
  v_correo text;
  v_id uuid := gen_random_uuid();
begin
  if position('@' in v_acceso) > 0 then
    if v_acceso !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Correo no válido.';
    end if;
    v_correo := v_acceso;
  else
    if v_acceso !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
      raise exception 'Usuario no válido: 3 a 30 letras, números, punto, guion o guion bajo.';
    end if;
    v_correo := v_acceso || '@usuarios.erp.invalid';
  end if;
  if length(coalesce(p_contrasena, '')) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres.';
  end if;
  if length(btrim(coalesce(p_nombre, ''))) not between 1 and 120 then
    raise exception 'Nombre no válido.';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_correo) then
    raise exception 'Ya existe una cuenta con ese usuario o correo.';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_correo,
    extensions.crypt(p_contrasena, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_correo, 'email_verified', true, 'phone_verified', false),
    'email', null, now(), now()
  );

  -- El trigger crear_perfil_de_usuario dejó el perfil inactivo; se habilita aquí.
  update public.perfiles
  set nombre = btrim(p_nombre), rol = p_rol, activo = true, es_desarrollador = p_desarrollador
  where id = v_id;

  insert into public.bitacora (actor_id, entidad, registro_id, accion, motivo, despues)
  values (
    null, 'perfiles', v_id, 'crear_usuario_interno',
    'Alta de cuenta interna por el propietario de la base (procedimiento documentado)',
    jsonb_build_object('nombre', btrim(p_nombre), 'rol', p_rol, 'activo', true,
                       'es_desarrollador', p_desarrollador)
  );

  return v_id;
end;
$$;

revoke all on function private.crear_usuario_interno(text, text, text, public.rol_usuario, boolean)
  from public, anon, authenticated;
