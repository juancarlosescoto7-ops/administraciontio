-- Alta integrada de membresías y contrato de membresía (cambio de alcance
-- aprobado por el propietario el 2026-10-28).
--
-- 1. registrar_membresia_completa: en UNA transacción crea, si hace falta, el
--    cliente titular y los beneficiarios nuevos (y al titular como
--    beneficiario) y registra la membresía con la función existente
--    registrar_membresia, que no se modifica. Si algo falla no queda nada a
--    medias; la clave de idempotencia de la membresía evita duplicados.
-- 2. agregar_beneficiario_nuevo_membresia: crea un beneficiario y lo vincula a
--    una membresía en una sola operación.
-- 3. Contrato: plantillas versionadas (texto con variables {{nombre}}) que solo
--    edita el administrador, y un contrato por membresía con el texto ya
--    completado, congelado al registrarla. Cambiar la plantilla no altera los
--    contratos existentes. Sin archivos: la aplicación lo muestra para
--    imprimir o guardar como PDF desde el navegador.

-- ---------------------------------------------------------------------------
-- Tablas del contrato
-- ---------------------------------------------------------------------------

create table public.plantillas_contrato (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version >= 1),
  contenido text not null check (length(btrim(contenido)) between 1 and 50000),
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id)
);
comment on table public.plantillas_contrato is
  'Versiones de la plantilla del contrato de membresía; la vigente es la de mayor versión. Inmutables.';

create table public.contratos_membresia (
  id uuid primary key default gen_random_uuid(),
  membresia_id uuid not null unique references public.membresias (id),
  plantilla_version integer not null references public.plantillas_contrato (version),
  contenido text not null,
  datos jsonb not null,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id)
);
comment on table public.contratos_membresia is
  'Contrato de cada membresía con el texto completado al registrarla. Inmutable.';

create index contratos_membresia_plantilla_idx on public.contratos_membresia (plantilla_version);
create index contratos_membresia_creado_por_idx on public.contratos_membresia (creado_por);
create index plantillas_contrato_creado_por_idx on public.plantillas_contrato (creado_por);

alter table public.plantillas_contrato enable row level security;
alter table public.contratos_membresia enable row level security;

-- Solo lectura desde la API; se escribe únicamente con las funciones.
create policy plantillas_contrato_select on public.plantillas_contrato
  for select to authenticated using ((select private.es_usuario_activo()));
create policy contratos_membresia_select on public.contratos_membresia
  for select to authenticated using ((select private.es_usuario_activo()));

revoke all on public.plantillas_contrato, public.contratos_membresia from anon;
revoke insert, update, delete, truncate on public.plantillas_contrato, public.contratos_membresia from authenticated;

create trigger impedir_borrado before delete on public.plantillas_contrato
  for each row execute function private.impedir_borrado();
create trigger impedir_modificacion before update on public.plantillas_contrato
  for each row execute function private.impedir_modificacion();
create trigger impedir_truncate before truncate on public.plantillas_contrato
  for each statement execute function private.impedir_borrado();
create trigger impedir_borrado before delete on public.contratos_membresia
  for each row execute function private.impedir_borrado();
create trigger impedir_modificacion before update on public.contratos_membresia
  for each row execute function private.impedir_modificacion();
create trigger impedir_truncate before truncate on public.contratos_membresia
  for each statement execute function private.impedir_borrado();

-- ---------------------------------------------------------------------------
-- Variables y renderizado
-- ---------------------------------------------------------------------------

-- Variables admitidas en la plantilla (la interfaz muestra la misma lista).
create function private.variables_contrato()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'fecha_contrato', 'cliente_nombre', 'cliente_identificacion', 'cliente_telefono', 'cliente_correo',
    'cliente_direccion', 'plan', 'precio_mensual', 'traslados_por_mes', 'modalidad_cupo', 'dias_gracia',
    'fecha_inicio', 'dia_de_pago', 'beneficiarios', 'numero_beneficiarios'
  ]
$$;

-- Rechaza variables desconocidas (p. ej., una errata como {{cliente_nonbre}}).
create function private.validar_plantilla(p_contenido text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_desconocida text;
begin
  if p_contenido is null or length(btrim(p_contenido)) = 0 then
    raise exception 'Escriba el texto del contrato.' using errcode = '22023';
  end if;
  if length(p_contenido) > 50000 then
    raise exception 'El contrato no puede superar 50,000 caracteres.' using errcode = '22023';
  end if;
  select btrim(m[1]) into v_desconocida
  from regexp_matches(p_contenido, '\{\{([^{}]*)\}\}', 'g') as m
  where btrim(m[1]) <> all (private.variables_contrato())
  limit 1;
  if v_desconocida is not null then
    raise exception 'Variable desconocida en el contrato: {{%}}.', v_desconocida using errcode = '22023';
  end if;
end;
$$;

create function private.renderizar_contrato(p_contenido text, p_datos jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_texto text := regexp_replace(p_contenido, '\{\{\s*([a-z_]+)\s*\}\}', '{{\1}}', 'g');
  v_par record;
begin
  for v_par in select key, value from jsonb_each_text(p_datos) loop
    v_texto := replace(v_texto, '{{' || v_par.key || '}}', coalesce(v_par.value, ''));
  end loop;
  return v_texto;
end;
$$;

create function private.formato_lempiras(p_valor numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'L ' || to_char(p_valor, 'FM999,999,999,990.00')
$$;

-- Valores de las variables para una membresía (datos del día en que se congela).
create function private.datos_contrato(p_membresia_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'fecha_contrato', to_char(private.hoy(), 'DD/MM/YYYY'),
    'cliente_nombre', c.nombre,
    'cliente_identificacion', coalesce(c.identificacion, '—'),
    'cliente_telefono', coalesce(c.telefono, '—'),
    'cliente_correo', coalesce(c.correo, '—'),
    'cliente_direccion', coalesce(c.direccion, '—'),
    'plan', p.nombre,
    'precio_mensual', private.formato_lempiras(m.precio_pactado),
    'traslados_por_mes', m.cupo_pactado::text,
    'modalidad_cupo', case m.modalidad_cupo
      when 'compartido' then 'compartido entre todos los beneficiarios'
      else 'individual por beneficiario' end,
    'dias_gracia', m.dias_gracia::text,
    'fecha_inicio', to_char(m.fecha_inicio, 'DD/MM/YYYY'),
    'dia_de_pago', m.dia_ancla::text,
    'beneficiarios', coalesce((
      select string_agg(
        format('%s. %s%s', x.n, x.nombre, coalesce(' (identidad ' || x.identificacion || ')', '')),
        E'\n' order by x.n)
      from (
        select row_number() over (order by b.nombre, b.id) n, b.nombre, b.identificacion
        from public.membresia_beneficiarios mb
        join public.beneficiarios b on b.id = mb.beneficiario_id
        where mb.membresia_id = m.id and mb.activo
      ) x
    ), '—'),
    'numero_beneficiarios', (
      select count(*) from public.membresia_beneficiarios mb where mb.membresia_id = m.id and mb.activo
    )::text
  )
  from public.membresias m
  join public.clientes c on c.id = m.cliente_id
  join public.planes p on p.id = m.plan_id
  where m.id = p_membresia_id
$$;

-- Congela el contrato con la plantilla vigente. Si ya existe, lo devuelve.
create function private.congelar_contrato(p_membresia_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_plantilla public.plantillas_contrato;
  v_datos jsonb;
begin
  select id into v_id from public.contratos_membresia where membresia_id = p_membresia_id;
  if v_id is not null then
    return v_id;
  end if;
  select * into v_plantilla from public.plantillas_contrato order by version desc limit 1;
  if v_plantilla.id is null then
    raise exception 'No hay plantilla de contrato.' using errcode = 'P0002';
  end if;
  v_datos := private.datos_contrato(p_membresia_id);
  if v_datos is null then
    raise exception 'Membresía no encontrada.' using errcode = 'P0002';
  end if;
  insert into public.contratos_membresia (membresia_id, plantilla_version, contenido, datos, creado_por)
  values (p_membresia_id, v_plantilla.version, private.renderizar_contrato(v_plantilla.contenido, v_datos), v_datos, auth.uid())
  on conflict (membresia_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.contratos_membresia where membresia_id = p_membresia_id;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Beneficiarios nuevos
-- ---------------------------------------------------------------------------

-- Crea un beneficiario desde un objeto JSON (nombre obligatorio; identidad,
-- fecha de nacimiento, teléfono, tutor y notas opcionales).
create function private.crear_beneficiario(p_datos jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_nacimiento date;
  v_texto text;
begin
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Los datos del beneficiario no tienen un formato válido.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_datos ->> 'nombre', ''))) = 0 then
    raise exception 'Indique el nombre de cada beneficiario nuevo.' using errcode = '22023';
  end if;
  v_texto := nullif(btrim(coalesce(p_datos ->> 'fecha_nacimiento', '')), '');
  if v_texto is not null then
    begin
      v_nacimiento := v_texto::date;
    exception when others then
      raise exception 'La fecha de nacimiento de % no es válida.', p_datos ->> 'nombre' using errcode = '22023';
    end;
    if v_nacimiento > private.hoy() or v_nacimiento < date '1900-01-01' then
      raise exception 'La fecha de nacimiento de % no es válida.', p_datos ->> 'nombre' using errcode = '22023';
    end if;
  end if;
  begin
    insert into public.beneficiarios (nombre, identificacion, fecha_nacimiento, telefono, tutor, notas)
    values (
      btrim(p_datos ->> 'nombre'),
      nullif(btrim(coalesce(p_datos ->> 'identificacion', '')), ''),
      v_nacimiento,
      nullif(btrim(coalesce(p_datos ->> 'telefono', '')), ''),
      nullif(btrim(coalesce(p_datos ->> 'tutor', '')), ''),
      nullif(btrim(coalesce(p_datos ->> 'notas', '')), '')
    )
    returning id into v_id;
  exception when check_violation then
    raise exception 'Revise los datos del beneficiario %: algún campo es demasiado largo.', p_datos ->> 'nombre'
      using errcode = '22023';
  end;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Alta integrada
-- ---------------------------------------------------------------------------

create function public.registrar_membresia_completa(
  p_idempotencia uuid,
  p_cliente_id uuid,
  p_cliente jsonb,
  p_plan_id uuid,
  p_fecha_inicio date,
  p_beneficiarios uuid[] default '{}',
  p_nuevos_beneficiarios jsonb default '[]',
  p_titular_beneficiario boolean default false,
  p_condiciones jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existente public.membresias;
  v_cliente public.clientes;
  v_nuevo boolean := p_cliente is not null;
  v_lista uuid[] := coalesce(p_beneficiarios, '{}');
  v_creados uuid[] := '{}';
  v_titular uuid;
  v_elemento jsonb;
  v_id uuid;
begin
  perform private.exigir_rol('administrador', 'operador');
  perform private.exigir_clave(p_idempotencia);
  -- Dos envíos simultáneos con la misma clave: el segundo espera al primero.
  perform pg_advisory_xact_lock(hashtextextended('membresia:' || p_idempotencia::text, 0));

  select * into v_existente from public.membresias where idempotencia = p_idempotencia;
  if v_existente.id is not null then
    perform private.exigir_misma_operacion(
      v_existente.plan_id = p_plan_id and v_existente.fecha_inicio = p_fecha_inicio
      and (p_cliente_id is null or v_existente.cliente_id = p_cliente_id)
    );
    return v_existente.id;
  end if;

  if (p_cliente_id is null) = (p_cliente is null) then
    raise exception 'Elija un cliente existente o registre uno nuevo.' using errcode = '22023';
  end if;

  -- Titular nuevo.
  if v_nuevo then
    if jsonb_typeof(p_cliente) <> 'object' or length(btrim(coalesce(p_cliente ->> 'nombre', ''))) = 0 then
      raise exception 'Indique el nombre del cliente titular.' using errcode = '22023';
    end if;
    if coalesce(p_cliente ->> 'tipo', 'natural') not in ('natural', 'juridica') then
      raise exception 'Tipo de cliente no válido.' using errcode = '22023';
    end if;
    begin
      insert into public.clientes (tipo, nombre, identificacion, telefono, correo, direccion)
      values (
        coalesce(p_cliente ->> 'tipo', 'natural')::public.tipo_cliente,
        btrim(p_cliente ->> 'nombre'),
        nullif(btrim(coalesce(p_cliente ->> 'identificacion', '')), ''),
        nullif(btrim(coalesce(p_cliente ->> 'telefono', '')), ''),
        nullif(btrim(coalesce(p_cliente ->> 'correo', '')), ''),
        nullif(btrim(coalesce(p_cliente ->> 'direccion', '')), '')
      )
      returning * into v_cliente;
    exception when check_violation then
      raise exception 'Revise los datos del cliente: algún campo es demasiado largo o el correo no es válido.'
        using errcode = '22023';
    end;
  else
    select * into v_cliente from public.clientes where id = p_cliente_id and activo;
    if v_cliente.id is null then
      raise exception 'Cliente no encontrado o inactivo.' using errcode = '22023';
    end if;
  end if;

  -- Beneficiarios nuevos.
  if p_nuevos_beneficiarios is not null and jsonb_typeof(p_nuevos_beneficiarios) <> 'array' then
    raise exception 'Los beneficiarios nuevos no tienen un formato válido.' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_nuevos_beneficiarios, '[]')) > 50 then
    raise exception 'Como máximo 50 beneficiarios nuevos por operación.' using errcode = '22023';
  end if;
  for v_elemento in select value from jsonb_array_elements(coalesce(p_nuevos_beneficiarios, '[]')) loop
    v_creados := v_creados || private.crear_beneficiario(v_elemento);
  end loop;

  -- El titular como beneficiario: se reutiliza su ficha si ya existe con la
  -- misma identidad; si no, se crea con sus datos.
  if coalesce(p_titular_beneficiario, false) then
    if v_cliente.tipo = 'juridica' then
      raise exception 'Una persona jurídica no puede ser beneficiaria: agregue a las personas cubiertas.'
        using errcode = '22023';
    end if;
    if v_cliente.identificacion is not null then
      select id into v_titular from public.beneficiarios
      where activo and lower(btrim(identificacion)) = lower(btrim(v_cliente.identificacion))
      order by created_at limit 1;
    end if;
    if v_titular is null then
      v_titular := private.crear_beneficiario(jsonb_build_object(
        'nombre', v_cliente.nombre, 'identificacion', v_cliente.identificacion, 'telefono', v_cliente.telefono));
      v_creados := v_creados || v_titular;
    end if;
    v_lista := v_lista || v_titular;
  end if;

  v_lista := array(select distinct b from unnest(v_lista || v_creados) b where b is not null);

  v_id := public.registrar_membresia(p_idempotencia, v_cliente.id, p_plan_id, p_fecha_inicio, v_lista, p_condiciones);
  perform private.congelar_contrato(v_id);

  perform private.registrar_bitacora(
    'membresias', v_id, 'registrar_membresia_completa', null, null,
    jsonb_build_object('cliente_nuevo', v_nuevo, 'cliente_id', v_cliente.id,
      'beneficiarios_nuevos', to_jsonb(v_creados), 'titular_beneficiario', coalesce(p_titular_beneficiario, false))
  );
  return v_id;
end;
$$;

create function public.agregar_beneficiario_nuevo_membresia(
  p_idempotencia uuid,
  p_membresia_id uuid,
  p_beneficiario jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previo uuid;
  v_beneficiario uuid;
  v_vinculo uuid;
begin
  perform private.exigir_rol('administrador', 'operador');
  perform private.exigir_clave(p_idempotencia);
  perform pg_advisory_xact_lock(hashtextextended('beneficiario:' || p_idempotencia::text, 0));

  -- Reintento: devuelve el vínculo ya creado con esta clave.
  select registro_id into v_previo from public.bitacora
  where accion = 'agregar_beneficiario_nuevo' and despues ->> 'idempotencia' = p_idempotencia::text
  limit 1;
  if v_previo is not null then
    return v_previo;
  end if;

  if not exists (select 1 from public.membresias where id = p_membresia_id and estado <> 'cancelada') then
    raise exception 'Membresía no encontrada o cancelada.' using errcode = '22023';
  end if;

  v_beneficiario := private.crear_beneficiario(p_beneficiario);
  v_vinculo := public.agregar_beneficiario_membresia(p_membresia_id, v_beneficiario);

  perform private.registrar_bitacora(
    'membresia_beneficiarios', v_vinculo, 'agregar_beneficiario_nuevo', null, null,
    jsonb_build_object('membresia_id', p_membresia_id, 'beneficiario_id', v_beneficiario, 'idempotencia', p_idempotencia)
  );
  return v_vinculo;
end;
$$;

-- ---------------------------------------------------------------------------
-- Contrato: plantilla, generación y vista previa
-- ---------------------------------------------------------------------------

create function public.guardar_plantilla_contrato(p_contenido text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  perform private.exigir_rol('administrador');
  perform private.validar_plantilla(p_contenido);
  perform pg_advisory_xact_lock(hashtextextended('plantillas_contrato', 0));

  select coalesce(max(version), 0) + 1 into v_version from public.plantillas_contrato;
  insert into public.plantillas_contrato (version, contenido, creado_por)
  values (v_version, p_contenido, auth.uid());

  perform private.registrar_bitacora(
    'plantillas_contrato', (select id from public.plantillas_contrato where version = v_version),
    'guardar_plantilla_contrato', null, null, jsonb_build_object('version', v_version)
  );
  return v_version;
end;
$$;

-- Para membresías registradas sin contrato (p. ej., antes de este cambio).
create function public.generar_contrato_membresia(p_membresia_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existia boolean;
  v_id uuid;
begin
  perform private.exigir_rol('administrador', 'operador');
  if not exists (select 1 from public.membresias where id = p_membresia_id) then
    raise exception 'Membresía no encontrada.' using errcode = 'P0002';
  end if;
  v_existia := exists (select 1 from public.contratos_membresia where membresia_id = p_membresia_id);
  v_id := private.congelar_contrato(p_membresia_id);
  if not v_existia then
    perform private.registrar_bitacora('contratos_membresia', v_id, 'generar_contrato', null, null,
      jsonb_build_object('membresia_id', p_membresia_id));
  end if;
  return v_id;
end;
$$;

-- Vista previa de un texto con datos de ejemplo (no guarda nada).
create function public.vista_previa_contrato(p_contenido text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.exigir_rol('administrador');
  perform private.validar_plantilla(p_contenido);
  return private.renderizar_contrato(p_contenido, jsonb_build_object(
    'fecha_contrato', to_char(private.hoy(), 'DD/MM/YYYY'),
    'cliente_nombre', 'María Ejemplo López',
    'cliente_identificacion', '0801-1990-00000',
    'cliente_telefono', '9999-0000',
    'cliente_correo', 'maria@ejemplo.hn',
    'cliente_direccion', 'Colonia Ejemplo, Tegucigalpa',
    'plan', 'Plan Familiar',
    'precio_mensual', private.formato_lempiras(800),
    'traslados_por_mes', '2',
    'modalidad_cupo', 'compartido entre todos los beneficiarios',
    'dias_gracia', '5',
    'fecha_inicio', to_char(private.hoy(), 'DD/MM/YYYY'),
    'dia_de_pago', extract(day from private.hoy())::text,
    'beneficiarios', E'1. José Ejemplo (identidad 0801-2015-00000)\n2. María Ejemplo López (identidad 0801-1990-00000)',
    'numero_beneficiarios', '2'
  ));
end;
$$;

-- Plantilla inicial: borrador para revisar con asesoría legal antes de usarlo.
insert into public.plantillas_contrato (version, contenido) values (1, $plantilla$CONTRATO DE MEMBRESÍA DE SERVICIOS DE AMBULANCIA

[BORRADOR: revise este texto con su asesor legal y reemplace los datos entre corchetes en Configuración › Contrato de membresía.]

En la ciudad de [CIUDAD], a {{fecha_contrato}}, comparecen por una parte [NOMBRE DE LA EMPRESA], en adelante «LA EMPRESA», y por otra {{cliente_nombre}}, con identidad/RTN {{cliente_identificacion}}, teléfono {{cliente_telefono}}, correo {{cliente_correo}} y domicilio en {{cliente_direccion}}, en adelante «EL TITULAR», quienes acuerdan lo siguiente:

PRIMERA. OBJETO. LA EMPRESA presta a los beneficiarios de esta membresía el servicio de traslado en ambulancia según el plan «{{plan}}».

SEGUNDA. BENEFICIARIOS. Quedan cubiertas las siguientes {{numero_beneficiarios}} personas:
{{beneficiarios}}

TERCERA. CUPO. La membresía incluye {{traslados_por_mes}} traslado(s) por mes, con cupo {{modalidad_cupo}}. Los traslados no utilizados no se acumulan de un mes a otro.

CUARTA. PRECIO Y PAGO. EL TITULAR pagará {{precio_mensual}} mensuales. Cada mensualidad vence el día {{dia_de_pago}} de cada mes y puede pagarse sin recargo dentro de los {{dias_gracia}} días de gracia siguientes.

QUINTA. MOROSIDAD. Pasado el plazo de gracia sin pago, la membresía queda suspendida y no cubre traslados hasta que se paguen las mensualidades pendientes.

SEXTA. VIGENCIA. La membresía inicia el {{fecha_inicio}} y se renueva cada mes mientras no sea cancelada.

SÉPTIMA. [OTRAS CONDICIONES ACORDADAS]


_____________________________                _____________________________
EL TITULAR                                   LA EMPRESA
{{cliente_nombre}}                           [NOMBRE DEL REPRESENTANTE]
$plantilla$);

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'registrar_membresia_completa', 'agregar_beneficiario_nuevo_membresia', 'guardar_plantilla_contrato',
      'generar_contrato_membresia', 'vista_previa_contrato'
    ])
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = any (array[
      'variables_contrato', 'validar_plantilla', 'renderizar_contrato', 'formato_lempiras', 'datos_contrato',
      'congelar_contrato', 'crear_beneficiario'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
