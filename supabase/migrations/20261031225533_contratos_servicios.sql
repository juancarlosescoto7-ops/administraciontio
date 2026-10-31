-- Contratos para todos los servicios (solicitado por el propietario el
-- 2026-10-31, sobre el modelo de su contrato de arrendamiento de vehículo).
--
-- 1. Las plantillas pasan a tener tipo: membresía, alquiler, viaje con
--    conductor (transporte) y traslado en ambulancia. Cada tipo tiene sus
--    propias variables y su plantilla vigente (la de mayor versión). Los
--    contratos de membresía existentes no cambian.
-- 2. contratos_servicio: contrato de un alquiler, viaje o traslado con el
--    texto completado y congelado. Se genera a pedido desde el servicio; si
--    los datos cambian después se puede generar de nuevo y el anterior se
--    conserva (inmutable). Generar no crea cargos, cobros ni depósitos.
-- 3. Plantillas iniciales: membresía (versión nueva) y los tres servicios,
--    con los datos que el sistema ya registra. El administrador las edita en
--    Configuración › Contratos.

-- ---------------------------------------------------------------------------
-- Plantillas por tipo
-- ---------------------------------------------------------------------------

alter table public.plantillas_contrato
  add column tipo text not null default 'membresia'
    check (tipo in ('membresia', 'alquiler', 'transporte', 'traslado'));

-- El número de versión sigue siendo único entre todos los tipos (los contratos
-- de membresía ya lo referencian); (tipo, versión) permite exigir que cada
-- contrato de servicio use una plantilla de su tipo.
alter table public.plantillas_contrato add constraint plantillas_contrato_tipo_version_key unique (tipo, version);

comment on table public.plantillas_contrato is
  'Versiones de las plantillas de contrato por tipo; la vigente de cada tipo es la de mayor versión. Inmutables.';

-- ---------------------------------------------------------------------------
-- Contratos de servicios
-- ---------------------------------------------------------------------------

create table public.contratos_servicio (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('alquiler', 'transporte', 'traslado')),
  alquiler_id uuid references public.alquileres (id),
  transporte_id uuid references public.transportes (id),
  traslado_id uuid references public.traslados_ambulancia (id),
  servicio_id uuid generated always as (coalesce(alquiler_id, transporte_id, traslado_id)) stored,
  plantilla_version integer not null,
  contenido text not null,
  datos jsonb not null,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id),
  foreign key (tipo, plantilla_version) references public.plantillas_contrato (tipo, version),
  check (
    (tipo = 'alquiler' and alquiler_id is not null and transporte_id is null and traslado_id is null)
    or (tipo = 'transporte' and transporte_id is not null and alquiler_id is null and traslado_id is null)
    or (tipo = 'traslado' and traslado_id is not null and alquiler_id is null and transporte_id is null)
  )
);
comment on table public.contratos_servicio is
  'Contratos de alquileres, viajes con conductor y traslados, con el texto completado al generarlos. Inmutables; el vigente es el más reciente.';

create index contratos_servicio_servicio_idx on public.contratos_servicio (tipo, servicio_id, created_at desc);
create index contratos_servicio_alquiler_idx on public.contratos_servicio (alquiler_id);
create index contratos_servicio_transporte_idx on public.contratos_servicio (transporte_id);
create index contratos_servicio_traslado_idx on public.contratos_servicio (traslado_id);
create index contratos_servicio_plantilla_idx on public.contratos_servicio (tipo, plantilla_version);
create index contratos_servicio_creado_por_idx on public.contratos_servicio (creado_por);

alter table public.contratos_servicio enable row level security;

create policy contratos_servicio_select on public.contratos_servicio
  for select to authenticated using ((select private.es_usuario_activo()));

revoke all on public.contratos_servicio from anon;
revoke insert, update, delete, truncate on public.contratos_servicio from authenticated;

create trigger impedir_borrado before delete on public.contratos_servicio
  for each row execute function private.impedir_borrado();
create trigger impedir_modificacion before update on public.contratos_servicio
  for each row execute function private.impedir_modificacion();
create trigger impedir_truncate before truncate on public.contratos_servicio
  for each statement execute function private.impedir_borrado();

-- ---------------------------------------------------------------------------
-- Variables y formato
-- ---------------------------------------------------------------------------

-- Variables admitidas por tipo (la interfaz muestra la misma lista).
create function private.variables_contrato(p_tipo text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'fecha_contrato', 'fecha_contrato_letras', 'cliente_nombre', 'cliente_identificacion', 'cliente_telefono',
    'cliente_correo', 'cliente_direccion'
  ] || case p_tipo
    when 'membresia' then array[
      'plan', 'precio_mensual', 'traslados_por_mes', 'modalidad_cupo', 'dias_gracia', 'fecha_inicio', 'dia_de_pago',
      'vigencia', 'beneficiarios', 'numero_beneficiarios']
    when 'alquiler' then array[
      'vehiculo_codigo', 'vehiculo_placa', 'vehiculo_marca', 'vehiculo_modelo', 'vehiculo_anio',
      'entrega_prevista', 'devolucion_prevista', 'duracion', 'tarifa', 'precio_total', 'observaciones']
    when 'transporte' then array[
      'vehiculo_codigo', 'vehiculo_placa', 'vehiculo_marca', 'vehiculo_modelo', 'vehiculo_anio',
      'conductor_nombre', 'conductor_identificacion', 'inicio_previsto', 'duracion', 'origen', 'destino',
      'tarifa', 'precio_total', 'observaciones']
    when 'traslado' then array[
      'vehiculo_codigo', 'vehiculo_placa', 'vehiculo_marca', 'vehiculo_modelo', 'vehiculo_anio',
      'conductor_nombre', 'conductor_identificacion', 'tipo_traslado', 'paciente', 'plan', 'inicio_previsto',
      'duracion', 'origen', 'destino', 'motivo', 'tarifa', 'precio_total', 'observaciones']
    else array[]::text[]
  end
$$;

create function private.validar_tipo_contrato(p_tipo text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_tipo is null or p_tipo not in ('membresia', 'alquiler', 'transporte', 'traslado') then
    raise exception 'Tipo de contrato no válido.' using errcode = '22023';
  end if;
end;
$$;

-- Rechaza variables desconocidas (p. ej., una errata como {{cliente_nonbre}}).
create function private.validar_plantilla(p_contenido text, p_tipo text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_desconocida text;
begin
  perform private.validar_tipo_contrato(p_tipo);
  if p_contenido is null or length(btrim(p_contenido)) = 0 then
    raise exception 'Escriba el texto del contrato.' using errcode = '22023';
  end if;
  if length(p_contenido) > 50000 then
    raise exception 'El contrato no puede superar 50,000 caracteres.' using errcode = '22023';
  end if;
  select btrim(m[1]) into v_desconocida
  from regexp_matches(p_contenido, '\{\{([^{}]*)\}\}', 'g') as m
  where btrim(m[1]) <> all (private.variables_contrato(p_tipo))
  limit 1;
  if v_desconocida is not null then
    raise exception 'Variable desconocida en el contrato: {{%}}.', v_desconocida using errcode = '22023';
  end if;
end;
$$;

-- «31 días del mes de octubre de 2026», como en el cierre de los contratos.
create function private.fecha_en_letras(p_fecha date)
returns text
language sql
immutable
set search_path = ''
as $$
  select extract(day from p_fecha)::int
    || case when extract(day from p_fecha) = 1 then ' día' else ' días' end
    || ' del mes de '
    || (array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
              'noviembre', 'diciembre'])[extract(month from p_fecha)::int]
    || ' de ' || extract(year from p_fecha)::int
$$;

-- «16/08/2026 a las 12:00 PM» en hora de Honduras.
create function private.momento_contrato(p_momento timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(to_char(p_momento at time zone 'America/Tegucigalpa', 'DD/MM/YYYY "a las" HH12:MI AM'), '—')
$$;

-- «1 día», «2 días y 3 horas», «1 día, 2 horas y 30 minutos» (un día = 24 horas).
create function private.texto_duracion(p_minutos integer)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_partes text[] := '{}';
  v_dias integer;
  v_horas integer;
  v_minutos integer;
begin
  if p_minutos is null or p_minutos <= 0 then
    return '—';
  end if;
  v_dias := p_minutos / 1440;
  v_horas := (p_minutos % 1440) / 60;
  v_minutos := p_minutos % 60;
  if v_dias > 0 then v_partes := v_partes || (v_dias || case when v_dias = 1 then ' día' else ' días' end); end if;
  if v_horas > 0 then v_partes := v_partes || (v_horas || case when v_horas = 1 then ' hora' else ' horas' end); end if;
  if v_minutos > 0 then v_partes := v_partes || (v_minutos || case when v_minutos = 1 then ' minuto' else ' minutos' end); end if;
  if cardinality(v_partes) = 1 then
    return v_partes[1];
  end if;
  return array_to_string(v_partes[1:cardinality(v_partes) - 1], ', ') || ' y ' || v_partes[cardinality(v_partes)];
end;
$$;

-- ---------------------------------------------------------------------------
-- Datos de cada contrato
-- ---------------------------------------------------------------------------

create or replace function private.datos_contrato(p_membresia_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'fecha_contrato', to_char(private.hoy(), 'DD/MM/YYYY'),
    'fecha_contrato_letras', private.fecha_en_letras(private.hoy()),
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
    'vigencia', case when m.fecha_fin is null
      then 'se renueva cada mes mientras no sea cancelada'
      else 'se renueva cada mes hasta su vencimiento pactado el ' || to_char(m.fecha_fin, 'DD/MM/YYYY')
        || '; después finalizan la cobertura y la generación de nuevas cuotas, y la deuda pendiente se conserva' end,
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

-- Valores de las variables de un alquiler, viaje o traslado (datos del día en
-- que se genera). Lo que aún no está asignado se escribe «Por asignar».
create function private.datos_contrato_servicio(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_datos jsonb;
  v_cliente uuid;
  v_vehiculo uuid;
  v_conductor uuid;
  v_tarifa uuid;
  v_por_asignar constant text := 'Por asignar';
begin
  if p_tipo = 'alquiler' then
    select a.cliente_id, a.vehiculo_id, a.tarifa_id, jsonb_build_object(
      'entrega_prevista', private.momento_contrato(a.entrega_prevista),
      'devolucion_prevista', private.momento_contrato(a.devolucion_prevista),
      'duracion', private.texto_duracion((extract(epoch from a.devolucion_prevista - a.entrega_prevista) / 60)::integer),
      'precio_total', coalesce(private.formato_lempiras(a.precio_pactado), 'Por definir'),
      'observaciones', coalesce(nullif(btrim(a.notas), ''), '—'))
    into v_cliente, v_vehiculo, v_tarifa, v_datos
    from public.alquileres a where a.id = p_id;
  elsif p_tipo = 'transporte' then
    select t.cliente_id, t.vehiculo_id, t.conductor_id, t.tarifa_id, jsonb_build_object(
      'inicio_previsto', private.momento_contrato(t.inicio_previsto),
      'duracion', private.texto_duracion(t.minutos_estimados),
      'origen', t.origen,
      'destino', t.destino,
      'precio_total', coalesce(private.formato_lempiras(t.precio_pactado), 'Por definir'),
      'observaciones', coalesce(nullif(btrim(t.notas), ''), '—'))
    into v_cliente, v_vehiculo, v_conductor, v_tarifa, v_datos
    from public.transportes t where t.id = p_id;
  elsif p_tipo = 'traslado' then
    select t.cliente_id, t.vehiculo_id, t.conductor_id, t.tarifa_id, jsonb_build_object(
      'tipo_traslado', case t.tipo when 'cubierto' then 'cubierto por membresía' else 'particular' end,
      'paciente', coalesce(b.nombre, nullif(btrim(t.pasajero), ''), c.nombre),
      'plan', coalesce(p.nombre, '—'),
      'inicio_previsto', private.momento_contrato(t.inicio_previsto),
      'duracion', private.texto_duracion(t.minutos_estimados),
      'origen', t.origen,
      'destino', t.destino,
      'motivo', coalesce(nullif(btrim(t.motivo), ''), '—'),
      'precio_total', case when t.tipo = 'cubierto'
        then 'cubierto por la membresía' || coalesce(' (plan ' || p.nombre || ')', '')
        else coalesce(private.formato_lempiras(t.precio_pactado), 'Por definir') end,
      'observaciones', coalesce(nullif(btrim(t.notas), ''), '—'))
    into v_cliente, v_vehiculo, v_conductor, v_tarifa, v_datos
    from public.traslados_ambulancia t
    join public.clientes c on c.id = t.cliente_id
    left join public.beneficiarios b on b.id = t.beneficiario_id
    left join public.membresias m on m.id = t.membresia_id
    left join public.planes p on p.id = m.plan_id
    where t.id = p_id;
  else
    raise exception 'Tipo de servicio no válido.' using errcode = '22023';
  end if;

  if v_datos is null then
    return null;
  end if;

  v_datos := v_datos || jsonb_build_object(
    'fecha_contrato', to_char(private.hoy(), 'DD/MM/YYYY'),
    'fecha_contrato_letras', private.fecha_en_letras(private.hoy()),
    'tarifa', coalesce((select r.nombre from public.tarifas r where r.id = v_tarifa), 'sin tarifa de referencia')
  ) || (
    select jsonb_build_object(
      'cliente_nombre', c.nombre,
      'cliente_identificacion', coalesce(c.identificacion, '—'),
      'cliente_telefono', coalesce(c.telefono, '—'),
      'cliente_correo', coalesce(c.correo, '—'),
      'cliente_direccion', coalesce(c.direccion, '—'))
    from public.clientes c where c.id = v_cliente
  ) || coalesce((
    select jsonb_build_object(
      'vehiculo_codigo', v.codigo,
      'vehiculo_placa', coalesce(v.placa, '—'),
      'vehiculo_marca', coalesce(v.marca, '—'),
      'vehiculo_modelo', coalesce(v.modelo, '—'),
      'vehiculo_anio', coalesce(v.anio::text, '—'))
    from public.vehiculos v where v.id = v_vehiculo
  ), jsonb_build_object(
    'vehiculo_codigo', v_por_asignar, 'vehiculo_placa', v_por_asignar, 'vehiculo_marca', v_por_asignar,
    'vehiculo_modelo', v_por_asignar, 'vehiculo_anio', v_por_asignar));

  if p_tipo <> 'alquiler' then
    v_datos := v_datos || coalesce((
      select jsonb_build_object('conductor_nombre', d.nombre, 'conductor_identificacion', coalesce(d.identificacion, '—'))
      from public.conductores d where d.id = v_conductor
    ), jsonb_build_object('conductor_nombre', v_por_asignar, 'conductor_identificacion', v_por_asignar));
  end if;
  return v_datos;
end;
$$;

-- Congela el contrato de membresía con la plantilla vigente de su tipo. Si ya
-- existe, lo devuelve. Las plantillas sin {{vigencia}} conservan el párrafo de
-- vencimiento añadido al final.
create or replace function private.congelar_contrato(p_membresia_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_plantilla public.plantillas_contrato;
  v_datos jsonb;
  v_texto text;
begin
  select id into v_id from public.contratos_membresia where membresia_id = p_membresia_id;
  if v_id is not null then
    return v_id;
  end if;
  select * into v_plantilla from public.plantillas_contrato where tipo = 'membresia' order by version desc limit 1;
  if v_plantilla.id is null then
    raise exception 'No hay plantilla de contrato.' using errcode = 'P0002';
  end if;
  v_datos := private.datos_contrato(p_membresia_id);
  if v_datos is null then
    raise exception 'Membresía no encontrada.' using errcode = 'P0002';
  end if;
  v_texto := private.renderizar_contrato(v_plantilla.contenido, v_datos);
  if v_plantilla.contenido !~ '\{\{\s*vigencia\s*\}\}' then
    v_texto := v_texto || coalesce((
      select E'\n\nVENCIMIENTO PACTADO: ' || to_char(fecha_fin, 'DD/MM/YYYY') ||
        '. Esta fecha limita las renovaciones mensuales: después finalizan la cobertura y las nuevas cuotas; la deuda pendiente se conserva.'
      from public.membresias where id = p_membresia_id and fecha_fin is not null), '');
  end if;
  insert into public.contratos_membresia (membresia_id, plantilla_version, contenido, datos, creado_por)
  values (p_membresia_id, v_plantilla.version, v_texto, v_datos, auth.uid())
  on conflict (membresia_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.contratos_membresia where membresia_id = p_membresia_id;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operaciones
-- ---------------------------------------------------------------------------

create function public.guardar_plantilla_contrato(p_contenido text, p_tipo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
  v_id uuid;
begin
  perform private.exigir_rol('administrador');
  perform private.validar_plantilla(p_contenido, p_tipo);
  perform pg_advisory_xact_lock(hashtextextended('plantillas_contrato', 0));

  select coalesce(max(version), 0) + 1 into v_version from public.plantillas_contrato;
  insert into public.plantillas_contrato (tipo, version, contenido, creado_por)
  values (p_tipo, v_version, p_contenido, auth.uid())
  returning id into v_id;

  perform private.registrar_bitacora(
    'plantillas_contrato', v_id, 'guardar_plantilla_contrato', null, null,
    jsonb_build_object('tipo', p_tipo, 'version', v_version)
  );
  return v_version;
end;
$$;

-- Genera el contrato de un servicio con la plantilla vigente de su tipo. Si el
-- texto resultante es igual al del último contrato, devuelve ese (un doble
-- envío no crea copias).
create function public.generar_contrato_servicio(p_tipo text, p_servicio_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
  v_plantilla public.plantillas_contrato;
  v_datos jsonb;
  v_texto text;
  v_ultimo public.contratos_servicio;
  v_id uuid;
begin
  perform private.exigir_rol('administrador', 'operador');
  if p_tipo is null or p_tipo not in ('alquiler', 'transporte', 'traslado') then
    raise exception 'Tipo de servicio no válido.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('contrato:' || p_tipo || ':' || p_servicio_id::text, 0));

  v_estado := case p_tipo
    when 'alquiler' then (select estado::text from public.alquileres where id = p_servicio_id)
    when 'transporte' then (select estado::text from public.transportes where id = p_servicio_id)
    else (select estado::text from public.traslados_ambulancia where id = p_servicio_id)
  end;
  if v_estado is null then
    raise exception 'Servicio no encontrado.' using errcode = 'P0002';
  end if;
  if v_estado = 'cancelado' then
    raise exception 'El servicio está cancelado: no se genera contrato.' using errcode = '22023';
  end if;

  select * into v_plantilla from public.plantillas_contrato where tipo = p_tipo order by version desc limit 1;
  if v_plantilla.id is null then
    raise exception 'No hay plantilla de contrato para este servicio: el administrador debe crearla en Configuración › Contratos.'
      using errcode = 'P0002';
  end if;

  v_datos := private.datos_contrato_servicio(p_tipo, p_servicio_id);
  v_texto := private.renderizar_contrato(v_plantilla.contenido, v_datos);

  select * into v_ultimo from public.contratos_servicio
  where tipo = p_tipo and servicio_id = p_servicio_id
  order by created_at desc limit 1;
  if v_ultimo.id is not null and v_ultimo.contenido = v_texto then
    return v_ultimo.id;
  end if;

  insert into public.contratos_servicio (tipo, alquiler_id, transporte_id, traslado_id, plantilla_version, contenido, datos, creado_por)
  values (
    p_tipo,
    case when p_tipo = 'alquiler' then p_servicio_id end,
    case when p_tipo = 'transporte' then p_servicio_id end,
    case when p_tipo = 'traslado' then p_servicio_id end,
    v_plantilla.version, v_texto, v_datos, auth.uid()
  )
  returning id into v_id;

  perform private.registrar_bitacora('contratos_servicio', v_id, 'generar_contrato_servicio', null, null,
    jsonb_build_object('tipo', p_tipo, 'servicio_id', p_servicio_id, 'plantilla_version', v_plantilla.version,
      'reemplaza', v_ultimo.id));
  return v_id;
end;
$$;

-- Vista previa de un texto con datos de ejemplo (no guarda nada).
create function public.vista_previa_contrato(p_contenido text, p_tipo text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_comunes jsonb := jsonb_build_object(
    'fecha_contrato', to_char(private.hoy(), 'DD/MM/YYYY'),
    'fecha_contrato_letras', private.fecha_en_letras(private.hoy()),
    'cliente_nombre', 'María Ejemplo López',
    'cliente_identificacion', '0801-1990-00000',
    'cliente_telefono', '9999-0000',
    'cliente_correo', 'maria@ejemplo.hn',
    'cliente_direccion', 'Barrio Ejemplo, Talanga, Francisco Morazán'
  );
  v_vehiculo jsonb := jsonb_build_object(
    'vehiculo_codigo', 'V-01', 'vehiculo_placa', 'HAA 0000', 'vehiculo_marca', 'Toyota',
    'vehiculo_modelo', 'Hilux', 'vehiculo_anio', '2020'
  );
  v_conductor jsonb := jsonb_build_object('conductor_nombre', 'Pedro Ejemplo', 'conductor_identificacion', '0824-1985-00000');
  v_inicio text := private.momento_contrato(now() + interval '1 day');
begin
  perform private.exigir_rol('administrador');
  perform private.validar_plantilla(p_contenido, p_tipo);
  return private.renderizar_contrato(p_contenido, v_comunes || case p_tipo
    when 'membresia' then jsonb_build_object(
      'plan', 'Plan Familiar',
      'precio_mensual', private.formato_lempiras(800),
      'traslados_por_mes', '2',
      'modalidad_cupo', 'compartido entre todos los beneficiarios',
      'dias_gracia', '5',
      'fecha_inicio', to_char(private.hoy(), 'DD/MM/YYYY'),
      'dia_de_pago', extract(day from private.hoy())::text,
      'vigencia', 'se renueva cada mes mientras no sea cancelada',
      'beneficiarios', E'1. José Ejemplo (identidad 0801-2015-00000)\n2. María Ejemplo López (identidad 0801-1990-00000)',
      'numero_beneficiarios', '2')
    when 'alquiler' then v_vehiculo || jsonb_build_object(
      'entrega_prevista', v_inicio,
      'devolucion_prevista', private.momento_contrato(now() + interval '2 days'),
      'duracion', '1 día',
      'tarifa', 'Alquiler diario',
      'precio_total', private.formato_lempiras(3000),
      'observaciones', '—')
    when 'transporte' then v_vehiculo || v_conductor || jsonb_build_object(
      'inicio_previsto', v_inicio,
      'duracion', '6 horas',
      'origen', 'Talanga',
      'destino', 'Tegucigalpa',
      'tarifa', 'Viaje con conductor',
      'precio_total', private.formato_lempiras(1500),
      'observaciones', '—')
    else v_vehiculo || v_conductor || jsonb_build_object(
      'tipo_traslado', 'particular',
      'paciente', 'José Ejemplo',
      'plan', '—',
      'inicio_previsto', v_inicio,
      'duracion', '2 horas',
      'origen', 'Talanga',
      'destino', 'Hospital Escuela, Tegucigalpa',
      'motivo', 'Consulta programada',
      'tarifa', 'Traslado particular',
      'precio_total', private.formato_lempiras(1200),
      'observaciones', '—')
  end);
end;
$$;

-- Las firmas anteriores (sin tipo) siguen existiendo y equivalen a membresía.
create or replace function private.variables_contrato()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select private.variables_contrato('membresia')
$$;

create or replace function private.validar_plantilla(p_contenido text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  perform private.validar_plantilla(p_contenido, 'membresia');
end;
$$;

create or replace function public.guardar_plantilla_contrato(p_contenido text)
returns integer
language sql
security definer
set search_path = ''
as $$
  select public.guardar_plantilla_contrato(p_contenido, 'membresia')
$$;

create or replace function public.vista_previa_contrato(p_contenido text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.vista_previa_contrato(p_contenido, 'membresia')
$$;

-- ---------------------------------------------------------------------------
-- Plantillas iniciales (modelo del contrato de arrendamiento de la empresa)
-- ---------------------------------------------------------------------------

insert into public.plantillas_contrato (tipo, version, contenido)
select 'membresia', coalesce(max(version), 0) + 1, $plantilla$SERVICIOS MÚLTIPLES Y TRANSPORTE J.A.R.L. S. DE R.L.
RTN 08249025198349
Talanga, Francisco Morazán, {{fecha_contrato}}

CONTRATO DE MEMBRESÍA DE SERVICIOS DE AMBULANCIA

Celebramos el presente contrato de membresía entre los suscritos, a saber: el señor JORGE ALBERTO RODRÍGUEZ LAGOS, representante de dicha empresa, mayor de edad, vecino de la ciudad de Talanga, Francisco Morazán, con documento de identificación No. 0824-1992-00684, quien en adelante se denominará LA EMPRESA, por una parte; y por la otra, {{cliente_nombre}}, con identidad/RTN No. {{cliente_identificacion}}, con domicilio en {{cliente_direccion}}, teléfono {{cliente_telefono}} y correo {{cliente_correo}}, quien en adelante se denominará EL TITULAR. El presente contrato se rige por las leyes de Honduras y por las siguientes cláusulas:

PRIMERA. OBJETO. LA EMPRESA presta a los beneficiarios de esta membresía el servicio de traslado en ambulancia según el plan «{{plan}}».

SEGUNDA. BENEFICIARIOS. Quedan cubiertas las siguientes {{numero_beneficiarios}} personas:
{{beneficiarios}}

TERCERA. CUPO. La membresía incluye {{traslados_por_mes}} traslado(s) por mes, con cupo {{modalidad_cupo}}. Los traslados no utilizados no se acumulan de un mes a otro.

CUARTA. PRECIO Y PAGO. EL TITULAR pagará {{precio_mensual}} mensuales. Cada mensualidad vence el día {{dia_de_pago}} de cada mes y puede pagarse sin recargo dentro de los {{dias_gracia}} días de gracia siguientes. Se acepta pago en efectivo y por transferencia.

QUINTA. MOROSIDAD. Pasado el plazo de gracia sin pago, la membresía queda suspendida y no cubre traslados hasta que se paguen las mensualidades pendientes.

SEXTA. VIGENCIA. La membresía inicia el {{fecha_inicio}} y {{vigencia}}. Cualquier cambio en el plan o en las condiciones quedará a mutuo acuerdo entre las partes.

SÉPTIMA. NARCOTRÁFICO O LAVADO DE ACTIVOS. Las partes manifiestan de manera expresa que no tienen ni han tenido relación alguna con actividades prohibidas o calificadas por la ley como delictivas. Cualquiera de las partes podrá dar por terminada la relación comercial en cualquier tiempo, sin previo aviso y sin que haya lugar al reconocimiento de ningún tipo de indemnización o pago por dicho concepto, en caso de que cualquiera de las partes llegare a ser: (i) incluida en listas para el control de lavado de activos administradas por cualquier autoridad nacional o extranjera; o (ii) condenada en cualquier tipo de proceso judicial relacionado con la comisión de delitos de narcotráfico, terrorismo, secuestro, lavado de activos o conexos.

OCTAVA. CUMPLIMIENTO DE LA LEY, CORRUPCIÓN Y ANTISOBORNO. LA EMPRESA se obliga a no realizar ninguna acción vinculada con su relación con EL TITULAR que implique una violación de las leyes de Honduras, y EL TITULAR se obliga a no solicitar ninguna acción o servicio que implique una violación de la normativa hondureña vigente.

Firmamos el presente contrato y acuerdo entre las partes de lo antes mencionado, sin protesta alguna, en la ciudad de Talanga, Francisco Morazán, a los {{fecha_contrato_letras}}.



_______________________________
JORGE ALBERTO RODRÍGUEZ LAGOS
REPRESENTANTE, LA EMPRESA



_______________________________
{{cliente_nombre}}
EL TITULAR$plantilla$
from public.plantillas_contrato;

insert into public.plantillas_contrato (tipo, version, contenido)
select 'alquiler', max(version) + 1, $plantilla$SERVICIOS MÚLTIPLES Y TRANSPORTE J.A.R.L. S. DE R.L.
RTN 08249025198349
Talanga, Francisco Morazán, {{fecha_contrato}}

CONTRATO DE ARRENDAMIENTO DE VEHÍCULO AUTOMOTOR

Celebramos el presente contrato de arrendamiento de vehículo entre los suscritos, a saber: el señor JORGE ALBERTO RODRÍGUEZ LAGOS, representante de dicha empresa, mayor de edad, vecino de la ciudad de Talanga, Francisco Morazán, con documento de identificación No. 0824-1992-00684, quien en adelante se denominará EL ARRENDADOR, por una parte; y por la otra, {{cliente_nombre}}, con identidad/RTN No. {{cliente_identificacion}}, con domicilio en {{cliente_direccion}} y teléfono {{cliente_telefono}}, quien en adelante se denominará EL ARRENDATARIO. Se celebra el contrato de arrendamiento de vehículo automotor por {{duracion}}, que se rige por las leyes de Honduras y por las siguientes cláusulas:

PRIMERA. EL ARRENDADOR entrega al ARRENDATARIO en alquiler un vehículo automotor de las siguientes características:
Código interno: {{vehiculo_codigo}}
Placa: {{vehiculo_placa}}
Marca: {{vehiculo_marca}}
Modelo: {{vehiculo_modelo}}
Año: {{vehiculo_anio}}

SEGUNDA. El vehículo se entrega en buen estado de funcionamiento. El vehículo no está asegurado para su uso por el ARRENDATARIO; mientras esté en su poder, el ARRENDATARIO es responsable del vehículo. En la ficha de entrega se anotan el kilometraje, el combustible y los detalles del vehículo.

TERCERA. El valor del arrendamiento del vehículo automotor es de {{precio_total}} por {{duracion}} (tarifa de referencia: {{tarifa}}). Se acepta pago en efectivo y por transferencia. El vehículo se entrega el {{entrega_prevista}} y deberá devolverse a más tardar el {{devolucion_prevista}}. El vehículo se entrega en la oficina ubicada en carretera a Olancho, frente a los Bomberos, en Gran Plaza.
Se deja un depósito de L 3,000.00, que se devuelve al entregar el vehículo; en caso de haber daños, estos se descuentan del depósito.
- Si se pasa del tiempo pactado, hay un recargo de L 300.00 por hora o fracción de hora.
- Si el ARRENDATARIO lo entrega antes de tiempo, no habrá descuento.
- El vehículo se devuelve con el mismo nivel de combustible con que se entregó.
- Se entrega limpio y lavado; si al ARRENDATARIO no le da tiempo de lavarlo, el lavado tiene un costo de L 300.00. En caso de que no vaya limpio, deberá avisarlo al ARRENDADOR.
Se anexan fotos del vehículo y documentos de ambas partes. En caso de que el ARRENDATARIO desee más días, quedará a mutuo acuerdo y se extenderá otro contrato.
Observaciones: {{observaciones}}

CUARTA. DESTINACIÓN. El ARRENDATARIO destinará el vehículo automotor al transporte de personas, de tal manera que no podrá subarrendarlo ni permitir que terceros lo utilicen. De igual manera, el ARRENDATARIO no puede exceder el límite de pasajeros que establece el fabricante del vehículo.

QUINTA. CONDUCCIÓN. El vehículo automotor será conducido por el ARRENDATARIO o por quien éste delegue, con fines de transportar personas dentro del territorio hondureño, con fines de paseo o de negocios.

SEXTA. El ARRENDATARIO se constituye como depositario y, por ende, custodio del vehículo automotor, asumiendo todas las responsabilidades civiles y penales que tal condición implica, hasta que proceda la debida devolución al ARRENDADOR.

SÉPTIMA. DEVOLUCIÓN. Al finalizar el término del contrato, el ARRENDATARIO deberá devolver el vehículo automotor en el mismo estado en que lo recibió, salvo el desgaste natural del vehículo. La devolución deberá realizarse en el lugar acordado por las partes.

OCTAVA. RESPONSABILIDADES DEL ARRENDATARIO. Mientras el vehículo automotor esté en su poder, el ARRENDATARIO será responsable:
1. Por cualquier daño causado al vehículo, o con este sobre propiedad de terceros.
2. Por los daños causados con el vehículo automotor a terceras personas.
3. Por los daños causados con el vehículo automotor sobre bienes o personas transportadas en él.
4. Por todas las infracciones de tránsito cometidas.
5. De mantener en buen estado el vehículo automotor.
6. De darle uso exclusivamente para el fin por el cual fue tomado en arrendamiento.
7. No se puede subarrendar ni hacer viajes con fines de lucro; en caso contrario, se devuelve el vehículo y se debe pagar lo que se haya cobrado por el viaje o subarrendamiento.
En caso de arreglos mecánicos o de lámina y pintura que el ARRENDATARIO quiera hacer sobre el vehículo automotor, deberá informar previamente al ARRENDADOR.

NOVENA. RESPONSABILIDADES DEL ARRENDADOR:
1. Entregar en óptimas condiciones técnicas el vehículo para el uso por el cual ha sido contratado.
2. Garantizar su derecho de dominio sobre el bien mueble objeto del presente contrato.
3. Entregar el permiso de circulación vigente. En caso de que el vehículo no tenga placas por ser de reciente ingreso al país, se entregan la placa en papel y su revisión.

DÉCIMA. NARCOTRÁFICO O LAVADO DE ACTIVOS. Las partes manifiestan de manera expresa que no tienen ni han tenido relación alguna con actividades prohibidas o calificadas por la ley como delictivas. Cualquiera de las partes podrá dar por terminada la relación comercial en cualquier tiempo, sin previo aviso y sin que haya lugar al reconocimiento de ningún tipo de indemnización o pago por dicho concepto, en caso de que cualquiera de las partes llegare a ser: (i) incluida en listas para el control de lavado de activos administradas por cualquier autoridad nacional o extranjera; o (ii) condenada en cualquier tipo de proceso judicial relacionado con la comisión de delitos de narcotráfico, terrorismo, secuestro, lavado de activos o conexos.
Queda totalmente prohibido realizar viajes a las fronteras de Honduras por motivos de trata de personas, conforme al Código Penal de Honduras, sección II, «Trata de personas y formas degradantes de explotación humana», artículo 219.
EL ARRENDADOR manifiesta que el origen del vehículo automotor objeto de este arrendamiento es lícito y no tiene conexión alguna con actividades relacionadas con lavado de activos y financiación del terrorismo.

DÉCIMA PRIMERA. CUMPLIMIENTO DE LA LEY, CORRUPCIÓN Y ANTISOBORNO. EL ARRENDADOR se obliga a no realizar ninguna acción vinculada con su relación con EL ARRENDATARIO que implique una violación de las leyes de Honduras, y EL ARRENDATARIO se obliga a no solicitar ninguna acción o servicio que implique una violación de la normativa hondureña vigente.

Firmamos el contrato de arrendamiento y acuerdo entre las partes de lo antes mencionado, sin protesta alguna, en la ciudad de Talanga, Francisco Morazán, a los {{fecha_contrato_letras}}.



_______________________________
JORGE ALBERTO RODRÍGUEZ LAGOS
REPRESENTANTE, EL ARRENDADOR



_______________________________
{{cliente_nombre}}
EL ARRENDATARIO$plantilla$
from public.plantillas_contrato;

insert into public.plantillas_contrato (tipo, version, contenido)
select 'transporte', max(version) + 1, $plantilla$SERVICIOS MÚLTIPLES Y TRANSPORTE J.A.R.L. S. DE R.L.
RTN 08249025198349
Talanga, Francisco Morazán, {{fecha_contrato}}

CONTRATO DE SERVICIO DE TRANSPORTE CON CONDUCTOR

Celebramos el presente contrato de servicio de transporte entre los suscritos, a saber: el señor JORGE ALBERTO RODRÍGUEZ LAGOS, representante de dicha empresa, mayor de edad, vecino de la ciudad de Talanga, Francisco Morazán, con documento de identificación No. 0824-1992-00684, quien en adelante se denominará LA EMPRESA, por una parte; y por la otra, {{cliente_nombre}}, con identidad/RTN No. {{cliente_identificacion}}, con domicilio en {{cliente_direccion}} y teléfono {{cliente_telefono}}, quien en adelante se denominará EL CONTRATANTE. El presente contrato se rige por las leyes de Honduras y por las siguientes cláusulas:

PRIMERA. OBJETO. LA EMPRESA presta al CONTRATANTE el servicio de transporte de personas con conductor desde {{origen}} hasta {{destino}}. El servicio inicia el {{inicio_previsto}}, con una duración estimada de {{duracion}}.

SEGUNDA. VEHÍCULO Y CONDUCTOR. El servicio se presta con el siguiente vehículo:
Código interno: {{vehiculo_codigo}}
Placa: {{vehiculo_placa}}
Marca: {{vehiculo_marca}}
Modelo: {{vehiculo_modelo}}
Año: {{vehiculo_anio}}
Conductor: {{conductor_nombre}}, identidad No. {{conductor_identificacion}}.
El vehículo será conducido únicamente por el conductor de LA EMPRESA o por quien ésta delegue.

TERCERA. VALOR. El valor del servicio es de {{precio_total}} (tarifa de referencia: {{tarifa}}). Se acepta pago en efectivo y por transferencia. En caso de que EL CONTRATANTE desee ampliar el servicio, quedará a mutuo acuerdo entre las partes.
Observaciones: {{observaciones}}

CUARTA. DESTINACIÓN. El vehículo se destina al transporte de personas dentro del territorio hondureño, con fines de paseo o de negocios. No se puede exceder el límite de pasajeros que establece el fabricante del vehículo.

QUINTA. RESPONSABILIDADES DEL CONTRATANTE. EL CONTRATANTE responde por los daños que él o sus acompañantes causen al vehículo durante el servicio.

SEXTA. RESPONSABILIDADES DE LA EMPRESA:
1. Prestar el servicio con el vehículo en óptimas condiciones técnicas.
2. Garantizar su derecho de dominio sobre el vehículo y contar con el permiso de circulación vigente.

SÉPTIMA. NARCOTRÁFICO O LAVADO DE ACTIVOS. Las partes manifiestan de manera expresa que no tienen ni han tenido relación alguna con actividades prohibidas o calificadas por la ley como delictivas. Cualquiera de las partes podrá dar por terminada la relación comercial en cualquier tiempo, sin previo aviso y sin que haya lugar al reconocimiento de ningún tipo de indemnización o pago por dicho concepto, en caso de que cualquiera de las partes llegare a ser: (i) incluida en listas para el control de lavado de activos administradas por cualquier autoridad nacional o extranjera; o (ii) condenada en cualquier tipo de proceso judicial relacionado con la comisión de delitos de narcotráfico, terrorismo, secuestro, lavado de activos o conexos.
Queda totalmente prohibido realizar viajes a las fronteras de Honduras por motivos de trata de personas, conforme al Código Penal de Honduras, sección II, «Trata de personas y formas degradantes de explotación humana», artículo 219.
LA EMPRESA manifiesta que el origen del vehículo automotor es lícito y no tiene conexión alguna con actividades relacionadas con lavado de activos y financiación del terrorismo.

OCTAVA. CUMPLIMIENTO DE LA LEY, CORRUPCIÓN Y ANTISOBORNO. LA EMPRESA se obliga a no realizar ninguna acción vinculada con su relación con EL CONTRATANTE que implique una violación de las leyes de Honduras, y EL CONTRATANTE se obliga a no solicitar ninguna acción o servicio que implique una violación de la normativa hondureña vigente.

Firmamos el presente contrato y acuerdo entre las partes de lo antes mencionado, sin protesta alguna, en la ciudad de Talanga, Francisco Morazán, a los {{fecha_contrato_letras}}.



_______________________________
JORGE ALBERTO RODRÍGUEZ LAGOS
REPRESENTANTE, LA EMPRESA



_______________________________
{{cliente_nombre}}
EL CONTRATANTE$plantilla$
from public.plantillas_contrato;

insert into public.plantillas_contrato (tipo, version, contenido)
select 'traslado', max(version) + 1, $plantilla$SERVICIOS MÚLTIPLES Y TRANSPORTE J.A.R.L. S. DE R.L.
RTN 08249025198349
Talanga, Francisco Morazán, {{fecha_contrato}}

CONTRATO DE SERVICIO DE TRASLADO EN AMBULANCIA

Celebramos el presente contrato de servicio de traslado entre los suscritos, a saber: el señor JORGE ALBERTO RODRÍGUEZ LAGOS, representante de dicha empresa, mayor de edad, vecino de la ciudad de Talanga, Francisco Morazán, con documento de identificación No. 0824-1992-00684, quien en adelante se denominará LA EMPRESA, por una parte; y por la otra, {{cliente_nombre}}, con identidad/RTN No. {{cliente_identificacion}}, con domicilio en {{cliente_direccion}} y teléfono {{cliente_telefono}}, quien en adelante se denominará EL CONTRATANTE. El presente contrato se rige por las leyes de Honduras y por las siguientes cláusulas:

PRIMERA. OBJETO. LA EMPRESA presta el servicio de traslado en ambulancia, de tipo {{tipo_traslado}}, del paciente {{paciente}}, desde {{origen}} hasta {{destino}}. Motivo: {{motivo}}. El traslado inicia el {{inicio_previsto}}, con una duración estimada de {{duracion}}.

SEGUNDA. UNIDAD Y CONDUCTOR. El traslado se realiza con la siguiente unidad:
Código interno: {{vehiculo_codigo}}
Placa: {{vehiculo_placa}}
Marca: {{vehiculo_marca}}
Modelo: {{vehiculo_modelo}}
Año: {{vehiculo_anio}}
Conductor: {{conductor_nombre}}, identidad No. {{conductor_identificacion}}.

TERCERA. VALOR. El valor del traslado es: {{precio_total}} (tarifa de referencia: {{tarifa}}). Se acepta pago en efectivo y por transferencia.
Observaciones: {{observaciones}}

CUARTA. RESPONSABILIDADES DEL CONTRATANTE. EL CONTRATANTE proporcionará información veraz sobre el paciente, el origen y el destino del traslado, y responde por los daños que él o los acompañantes del paciente causen a la unidad durante el servicio.

QUINTA. RESPONSABILIDADES DE LA EMPRESA:
1. Prestar el servicio con la unidad en óptimas condiciones técnicas.
2. Garantizar su derecho de dominio sobre la unidad y contar con el permiso de circulación vigente.

SEXTA. NARCOTRÁFICO O LAVADO DE ACTIVOS. Las partes manifiestan de manera expresa que no tienen ni han tenido relación alguna con actividades prohibidas o calificadas por la ley como delictivas. Cualquiera de las partes podrá dar por terminada la relación comercial en cualquier tiempo, sin previo aviso y sin que haya lugar al reconocimiento de ningún tipo de indemnización o pago por dicho concepto, en caso de que cualquiera de las partes llegare a ser: (i) incluida en listas para el control de lavado de activos administradas por cualquier autoridad nacional o extranjera; o (ii) condenada en cualquier tipo de proceso judicial relacionado con la comisión de delitos de narcotráfico, terrorismo, secuestro, lavado de activos o conexos.

SÉPTIMA. CUMPLIMIENTO DE LA LEY, CORRUPCIÓN Y ANTISOBORNO. LA EMPRESA se obliga a no realizar ninguna acción vinculada con su relación con EL CONTRATANTE que implique una violación de las leyes de Honduras, y EL CONTRATANTE se obliga a no solicitar ninguna acción o servicio que implique una violación de la normativa hondureña vigente.

Firmamos el presente contrato y acuerdo entre las partes de lo antes mencionado, sin protesta alguna, en la ciudad de Talanga, Francisco Morazán, a los {{fecha_contrato_letras}}.



_______________________________
JORGE ALBERTO RODRÍGUEZ LAGOS
REPRESENTANTE, LA EMPRESA



_______________________________
{{cliente_nombre}}
EL CONTRATANTE$plantilla$
from public.plantillas_contrato;

-- Las plantillas iniciales deben usar solo variables de su tipo.
do $$
declare
  v_plantilla record;
begin
  for v_plantilla in
    select distinct on (tipo) tipo, contenido from public.plantillas_contrato order by tipo, version desc
  loop
    perform private.validar_plantilla(v_plantilla.contenido, v_plantilla.tipo);
  end loop;
end;
$$;

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
      'guardar_plantilla_contrato', 'generar_contrato_servicio', 'vista_previa_contrato'
    ])
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = any (array[
      'variables_contrato', 'validar_tipo_contrato', 'validar_plantilla', 'fecha_en_letras', 'momento_contrato',
      'texto_duracion', 'datos_contrato', 'datos_contrato_servicio', 'congelar_contrato'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
