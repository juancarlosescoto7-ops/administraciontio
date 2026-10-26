-- E3 · Membresías: operaciones.
--
-- Mismo patrón que E2: funciones públicas SECURITY DEFINER con search_path
-- vacío que verifican auth.uid() y el rol en su primera línea, validan los
-- datos y escriben todo en una transacción. Errores de negocio: 22023, 42501
-- y P0002, con mensajes en español.
--
-- Ciclos: el período n empieza el día de anclaje del mes correspondiente o el
-- último día del mes si ese día no existe (31 ene → 28/29 feb → 31 mar). Se
-- calcula siempre desde dia_ancla, nunca desde el último día obtenido.
--
-- Morosidad: una cuota vence el día de inicio de su período; su límite de
-- pago es inicio + días de gracia. Si al día siguiente del límite sigue con
-- saldo, la membresía queda suspendida desde ese día y no genera períodos
-- mientras siga así. Al saldar las cuotas vencidas se reactiva: si ya pasó la
-- renovación que no se generó, empieza un ciclo nuevo desde la fecha de
-- reactivación (nuevo día de anclaje y nueva cuota); los meses suspendidos no
-- se cobran. Si la deuda se salda antes de esa renovación, el ciclo sigue igual.
--
-- No hay cron: «Actualizar mensualidades» (botón y apertura del panel, por
-- POST) y los cobros registrados desde la aplicación ejecutan el proceso,
-- que es idempotente y genera solo hasta hoy.

-- ---------------------------------------------------------------------------
-- Auxiliares (esquema private, sin acceso desde la API)
-- ---------------------------------------------------------------------------

-- Inicio del período siguiente a p_fecha según el día de anclaje.
create function private.siguiente_renovacion(p_fecha date, p_dia_ancla integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select mes + (least(p_dia_ancla, extract(day from mes + interval '1 month' - interval '1 day')::integer) - 1)
  from (select (date_trunc('month', p_fecha::timestamp) + interval '1 month')::date as mes) siguiente
$$;

-- Traslados cubiertos que ocupan cupo en un período (de un beneficiario o, con
-- p_beneficiario_id nulo, de toda la membresía). En E3 todavía no existen
-- traslados: devuelve 0. E4 la reemplazará para contar las reservas válidas y
-- los consumos de traslados reales; nada se marca como consumido aquí.
create function private.cupo_ocupado(p_periodo_id uuid, p_beneficiario_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select 0
$$;

-- Cupo disponible de un período: compartido descuenta los traslados de todos
-- los beneficiarios; individual, solo los del beneficiario. Cada período tiene
-- su propio cupo: lo no usado no pasa al siguiente.
create function private.calcular_disponibles(
  p_cupo integer,
  p_modalidad public.modalidad_cupo,
  p_usados_membresia integer,
  p_usados_beneficiario integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(
    p_cupo - case p_modalidad when 'compartido' then p_usados_membresia else p_usados_beneficiario end,
    0
  )
$$;

-- Día en que empezó la morosidad (límite de pago + 1) si alguna cuota de la
-- membresía tiene saldo y su límite es anterior a p_fecha; nulo si no.
create function private.inicio_morosidad(p_membresia_id uuid, p_fecha date)
returns date
language sql
stable
set search_path = ''
as $$
  select min(p.limite_pago) + 1
  from public.periodos_membresia p
  join public.cargos_cliente c on c.id = p.cargo_id
  where p.membresia_id = p_membresia_id
    and p.limite_pago < p_fecha
    and c.estado = 'vigente'
    and c.monto > coalesce((
      select sum(a.monto) from public.aplicaciones_cobro a
      where a.cargo_id = c.id and a.estado = 'vigente'
    ), 0)
$$;

-- Cargo de un servicio o mensualidad con la plantilla de E2
-- (D 1200 CxC / H ingreso de la línea). Lo usan las funciones de los módulos;
-- UNIQUE (origen_tipo, origen_id) impide un segundo cargo del mismo origen.
create function private.registrar_cargo_servicio(
  p_cliente_id uuid,
  p_origen_tipo public.origen_cargo,
  p_origen_id uuid,
  p_cuenta_ingreso text,
  p_concepto text,
  p_fecha date,
  p_vencimiento date,
  p_monto numeric
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_cuenta public.cuentas_contables;
  v_actividad public.actividad;
  v_id uuid;
begin
  perform private.validar_monto(p_monto);
  select * into v_cuenta
  from public.cuentas_contables where codigo = p_cuenta_ingreso and tipo = 'ingreso' and activo;
  v_actividad := private.actividad_de_ingreso(v_cuenta.codigo);
  if v_actividad is null then
    raise exception 'La cuenta de ingreso % no es válida.', p_cuenta_ingreso;
  end if;

  insert into public.cargos_cliente (
    cliente_id, actividad, cuenta_ingreso_id, origen_tipo, origen_id, concepto, fecha, vencimiento,
    monto, creado_por
  )
  values (
    p_cliente_id, v_actividad, v_cuenta.id, p_origen_tipo, p_origen_id, left(p_concepto, 200), p_fecha,
    p_vencimiento, p_monto, auth.uid()
  )
  returning id into v_id;

  perform private.registrar_asiento(
    p_fecha, 'Cargo: ' || p_concepto, v_actividad, 'cargo', v_id,
    jsonb_build_array(private.linea('1200', p_monto, 0), private.linea(v_cuenta.codigo, 0, p_monto))
  );
  return v_id;
end;
$$;

-- Genera el período que empieza en proxima_renovacion, con las condiciones
-- pactadas vigentes y, si tiene precio, su cargo. El llamador tiene bloqueada
-- la membresía.
create function private.generar_periodo(p_membresia public.membresias)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_inicio date := p_membresia.proxima_renovacion;
  v_fin date := private.siguiente_renovacion(p_membresia.proxima_renovacion, p_membresia.dia_ancla) - 1;
  v_plan text;
  v_cargo uuid;
begin
  if p_membresia.precio_pactado > 0 then
    select nombre into v_plan from public.planes where id = p_membresia.plan_id;
    v_cargo := private.registrar_cargo_servicio(
      p_membresia.cliente_id, 'periodo_membresia', v_id, '4100',
      'Mensualidad ' || v_plan || ' del ' || to_char(v_inicio, 'DD/MM/YYYY') || ' al ' || to_char(v_fin, 'DD/MM/YYYY'),
      v_inicio, v_inicio, p_membresia.precio_pactado
    );
  end if;

  insert into public.periodos_membresia (
    id, membresia_id, inicio, fin, precio, cupo_asignado, modalidad_cupo, dias_gracia, cargo_id, creado_por
  )
  values (
    v_id, p_membresia.id, v_inicio, v_fin, p_membresia.precio_pactado, p_membresia.cupo_pactado,
    p_membresia.modalidad_cupo, p_membresia.dias_gracia, v_cargo, auth.uid()
  );
end;
$$;

-- Pone al día una membresía: reactiva si corresponde, genera los períodos
-- vencidos hasta hoy y suspende por morosidad. Idempotente: bloquea la fila y
-- trabaja sobre su estado actual, así que repetirla (o ejecutarla a la vez)
-- no duplica períodos ni cargos.
create function private.procesar_membresia(p_membresia_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_membresia public.membresias;
  v_hoy date := private.hoy();
  v_generados integer := 0;
  v_suspension date;
  v_reactivada boolean := false;
  v_antes jsonb;
begin
  select * into v_membresia from public.membresias where id = p_membresia_id for update;
  if v_membresia.id is null or v_membresia.estado = 'cancelada' then
    return jsonb_build_object('periodos', 0, 'suspendida', false, 'reactivada', false);
  end if;

  if v_membresia.estado = 'suspendida' then
    if private.inicio_morosidad(v_membresia.id, v_hoy) is not null then
      return jsonb_build_object('periodos', 0, 'suspendida', false, 'reactivada', false);
    end if;
    v_antes := jsonb_build_object(
      'estado', 'suspendida', 'suspendida_desde', v_membresia.suspendida_desde,
      'dia_ancla', v_membresia.dia_ancla, 'proxima_renovacion', v_membresia.proxima_renovacion
    );

    if v_hoy < v_membresia.proxima_renovacion then
      -- No se saltó ninguna renovación: el ciclo continúa igual.
      update public.membresias
      set estado = 'activa', suspendida_desde = null, updated_at = now(), actualizado_por = auth.uid()
      where id = v_membresia.id
      returning * into v_membresia;
    else
      -- Ciclo nuevo desde hoy; los períodos suspendidos no se cobran.
      update public.membresias
      set estado = 'activa', suspendida_desde = null, dia_ancla = extract(day from v_hoy),
        proxima_renovacion = v_hoy, updated_at = now(), actualizado_por = auth.uid()
      where id = v_membresia.id
      returning * into v_membresia;
    end if;
    v_reactivada := true;
  end if;

  while v_membresia.proxima_renovacion <= v_hoy loop
    -- Morosidad que empezó antes de esta renovación: no se genera.
    v_suspension := private.inicio_morosidad(v_membresia.id, v_membresia.proxima_renovacion);
    exit when v_suspension is not null;
    perform private.generar_periodo(v_membresia);
    update public.membresias
    set proxima_renovacion = private.siguiente_renovacion(proxima_renovacion, dia_ancla),
      updated_at = now(), actualizado_por = auth.uid()
    where id = v_membresia.id
    returning * into v_membresia;
    v_generados := v_generados + 1;
  end loop;

  v_suspension := coalesce(v_suspension, private.inicio_morosidad(v_membresia.id, v_hoy));
  if v_suspension is not null then
    update public.membresias
    set estado = 'suspendida', suspendida_desde = v_suspension, updated_at = now(), actualizado_por = auth.uid()
    where id = v_membresia.id;
    perform private.registrar_bitacora(
      'membresias', v_membresia.id, 'suspender_por_morosidad',
      'Cuota vencida fuera del plazo de gracia',
      jsonb_build_object('estado', 'activa'),
      jsonb_build_object('estado', 'suspendida', 'suspendida_desde', v_suspension)
    );
  end if;

  if v_reactivada then
    -- Se registra después de generar: así consta la cuota del nuevo ciclo.
    perform private.registrar_bitacora(
      'membresias', v_membresia.id, 'reactivar_membresia', 'Cuotas vencidas saldadas',
      v_antes,
      jsonb_build_object(
        'estado', 'activa', 'fecha_efectiva', v_hoy, 'dia_ancla', v_membresia.dia_ancla,
        'ciclo_nuevo', (v_antes ->> 'proxima_renovacion')::date <= v_hoy,
        'proxima_renovacion', v_membresia.proxima_renovacion
      )
    );
  end if;

  return jsonb_build_object(
    'periodos', v_generados, 'suspendida', v_suspension is not null, 'reactivada', v_reactivada
  );
end;
$$;

create function private.validar_condiciones(
  p_precio numeric, p_cupo integer, p_modalidad public.modalidad_cupo, p_dias_gracia integer
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_precio is null or p_precio < 0 or p_precio <> round(p_precio, 2) or p_precio > 999999999999.99 then
    raise exception 'El precio mensual debe ser cero o mayor y tener como máximo 2 decimales.' using errcode = '22023';
  end if;
  if p_cupo is null or p_cupo < 0 then
    raise exception 'El cupo de traslados debe ser un entero mayor o igual que cero.' using errcode = '22023';
  end if;
  if p_modalidad is null then
    raise exception 'Seleccione la modalidad del cupo.' using errcode = '22023';
  end if;
  if p_dias_gracia is null or p_dias_gracia < 0 or p_dias_gracia > 3650 then
    raise exception 'Los días de gracia deben estar entre 0 y 3650.' using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Membresías
-- ---------------------------------------------------------------------------

-- Alta: copia las condiciones del plan (o las particulares, solo
-- administrador), vincula a los beneficiarios y, si la fecha de inicio ya
-- llegó, genera la primera mensualidad en la misma transacción.
-- p_condiciones opcional: {"precio", "cupo", "modalidad", "dias_gracia"}.
create function public.registrar_membresia(
  p_idempotencia uuid,
  p_cliente_id uuid,
  p_plan_id uuid,
  p_fecha_inicio date,
  p_beneficiarios uuid[],
  p_condiciones jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existente public.membresias;
  v_plan public.planes;
  v_precio numeric;
  v_cupo integer;
  v_modalidad public.modalidad_cupo;
  v_dias_gracia integer;
  v_particulares boolean;
  v_id uuid;
begin
  perform private.exigir_rol('administrador', 'operador');
  perform private.exigir_clave(p_idempotencia);

  select * into v_existente from public.membresias where idempotencia = p_idempotencia;
  if v_existente.id is not null then
    perform private.exigir_misma_operacion(
      v_existente.cliente_id = p_cliente_id and v_existente.plan_id = p_plan_id
      and v_existente.fecha_inicio = p_fecha_inicio
    );
    return v_existente.id;
  end if;

  if p_fecha_inicio is null or p_fecha_inicio < date '2000-01-01' then
    raise exception 'Indique una fecha de inicio válida.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and activo) then
    raise exception 'Cliente no encontrado o inactivo.' using errcode = '22023';
  end if;
  select * into v_plan from public.planes where id = p_plan_id and activo;
  if v_plan.id is null then
    raise exception 'Seleccione un plan activo.' using errcode = '22023';
  end if;

  if coalesce(cardinality(p_beneficiarios), 0) = 0 then
    raise exception 'Asocie al menos un beneficiario.' using errcode = '22023';
  end if;
  if cardinality(p_beneficiarios) <> (select count(distinct b) from unnest(p_beneficiarios) b) then
    raise exception 'Un beneficiario aparece más de una vez.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_beneficiarios) b
    where b is null or not exists (select 1 from public.beneficiarios x where x.id = b and x.activo)
  ) then
    raise exception 'Algún beneficiario no existe o está inactivo.' using errcode = '22023';
  end if;

  if p_condiciones is not null and jsonb_typeof(p_condiciones) <> 'object' then
    raise exception 'Las condiciones no tienen un formato válido.' using errcode = '22023';
  end if;
  v_precio := coalesce((p_condiciones ->> 'precio')::numeric, v_plan.precio_mensual);
  v_cupo := coalesce((p_condiciones ->> 'cupo')::integer, v_plan.cupo_mensual);
  v_modalidad := coalesce((p_condiciones ->> 'modalidad')::public.modalidad_cupo, v_plan.modalidad_cupo);
  v_dias_gracia := coalesce((p_condiciones ->> 'dias_gracia')::integer, v_plan.dias_gracia);
  perform private.validar_condiciones(v_precio, v_cupo, v_modalidad, v_dias_gracia);
  v_particulares := (v_precio, v_cupo, v_modalidad, v_dias_gracia)
    is distinct from (v_plan.precio_mensual, v_plan.cupo_mensual, v_plan.modalidad_cupo, v_plan.dias_gracia);
  if v_particulares and not private.tiene_rol('administrador') then
    raise exception 'Solo el administrador puede pactar condiciones distintas a las del plan.'
      using errcode = '42501';
  end if;

  insert into public.membresias (
    cliente_id, plan_id, fecha_inicio, dia_ancla, proxima_renovacion, precio_pactado, cupo_pactado,
    modalidad_cupo, dias_gracia, idempotencia, creado_por, actualizado_por
  )
  values (
    p_cliente_id, p_plan_id, p_fecha_inicio, extract(day from p_fecha_inicio), p_fecha_inicio, v_precio,
    v_cupo, v_modalidad, v_dias_gracia, p_idempotencia, auth.uid(), auth.uid()
  )
  on conflict (idempotencia) do nothing
  returning id into v_id;

  if v_id is null then
    -- Reintento simultáneo: el primero ya la registró.
    select * into v_existente from public.membresias where idempotencia = p_idempotencia;
    perform private.exigir_misma_operacion(
      v_existente.cliente_id = p_cliente_id and v_existente.plan_id = p_plan_id
      and v_existente.fecha_inicio = p_fecha_inicio
    );
    return v_existente.id;
  end if;

  insert into public.membresia_beneficiarios (membresia_id, beneficiario_id, fecha_alta, creado_por)
  select v_id, b, p_fecha_inicio, auth.uid() from unnest(p_beneficiarios) b;

  perform private.registrar_bitacora(
    'membresias', v_id, 'registrar_membresia', null, null,
    jsonb_build_object(
      'cliente_id', p_cliente_id, 'plan_id', p_plan_id, 'fecha_inicio', p_fecha_inicio,
      'precio_pactado', v_precio, 'cupo_pactado', v_cupo, 'modalidad_cupo', v_modalidad,
      'dias_gracia', v_dias_gracia, 'condiciones_particulares', v_particulares,
      'beneficiarios', to_jsonb(p_beneficiarios)
    )
  );

  perform private.procesar_membresia(v_id);
  return v_id;
end;
$$;

-- Condiciones para los ciclos futuros (solo administrador). Los períodos ya
-- generados conservan las suyas.
create function public.actualizar_condiciones_membresia(
  p_membresia_id uuid,
  p_precio numeric,
  p_cupo integer,
  p_modalidad public.modalidad_cupo,
  p_dias_gracia integer,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_membresia public.membresias;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);
  perform private.validar_condiciones(p_precio, p_cupo, p_modalidad, p_dias_gracia);

  select * into v_membresia from public.membresias where id = p_membresia_id for update;
  if v_membresia.id is null then
    raise exception 'Membresía no encontrada.' using errcode = 'P0002';
  end if;
  if v_membresia.estado = 'cancelada' then
    raise exception 'La membresía está cancelada.' using errcode = '22023';
  end if;
  if (p_precio, p_cupo, p_modalidad, p_dias_gracia) is not distinct from
     (v_membresia.precio_pactado, v_membresia.cupo_pactado, v_membresia.modalidad_cupo, v_membresia.dias_gracia) then
    raise exception 'Las condiciones indicadas son las vigentes.' using errcode = '22023';
  end if;

  update public.membresias
  set precio_pactado = p_precio, cupo_pactado = p_cupo, modalidad_cupo = p_modalidad,
    dias_gracia = p_dias_gracia, updated_at = now(), actualizado_por = auth.uid()
  where id = p_membresia_id;

  perform private.registrar_bitacora(
    'membresias', p_membresia_id, 'actualizar_condiciones', v_motivo,
    jsonb_build_object(
      'precio_pactado', v_membresia.precio_pactado, 'cupo_pactado', v_membresia.cupo_pactado,
      'modalidad_cupo', v_membresia.modalidad_cupo, 'dias_gracia', v_membresia.dias_gracia
    ),
    jsonb_build_object(
      'precio_pactado', p_precio, 'cupo_pactado', p_cupo, 'modalidad_cupo', p_modalidad,
      'dias_gracia', p_dias_gracia, 'desde', v_membresia.proxima_renovacion
    )
  );
end;
$$;

-- Antes de cancelar se generan los períodos ya iniciados; después no se
-- generan más. Las cuotas pendientes se conservan como deuda.
create function public.cancelar_membresia(p_membresia_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_membresia public.membresias;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);

  select * into v_membresia from public.membresias where id = p_membresia_id for update;
  if v_membresia.id is null then
    raise exception 'Membresía no encontrada.' using errcode = 'P0002';
  end if;
  if v_membresia.estado = 'cancelada' then
    raise exception 'La membresía ya está cancelada.' using errcode = '22023';
  end if;

  perform private.procesar_membresia(p_membresia_id);
  select * into v_membresia from public.membresias where id = p_membresia_id;

  update public.membresias
  set estado = 'cancelada', suspendida_desde = null, motivo_cancelacion = v_motivo, cancelada_en = now(),
    cancelada_por = auth.uid(), updated_at = now(), actualizado_por = auth.uid()
  where id = p_membresia_id;

  perform private.registrar_bitacora(
    'membresias', p_membresia_id, 'cancelar_membresia', v_motivo,
    jsonb_build_object('estado', v_membresia.estado, 'suspendida_desde', v_membresia.suspendida_desde),
    jsonb_build_object('estado', 'cancelada')
  );
end;
$$;

-- Genera las mensualidades pendientes hasta hoy, suspende por morosidad y
-- reactiva las que saldaron su deuda. Sin filtros procesa todas; puede
-- limitarse a una membresía o a las de un cliente. Las cuotas dependen solo
-- de las condiciones pactadas, así que la ejecutan los tres roles.
create function public.actualizar_mensualidades(
  p_membresia_id uuid default null,
  p_cliente_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := private.hoy();
  v_id uuid;
  v_resultado jsonb;
  v_revisadas integer := 0;
  v_periodos integer := 0;
  v_suspendidas integer := 0;
  v_reactivadas integer := 0;
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');

  -- Candidatas sin bloqueo; cada una se bloquea y revisa al procesarla, en
  -- orden fijo para que dos ejecuciones simultáneas no se interbloqueen.
  for v_id in
    select m.id
    from public.membresias m
    where (p_membresia_id is null or m.id = p_membresia_id)
      and (p_cliente_id is null or m.cliente_id = p_cliente_id)
      and (
        m.estado = 'suspendida'
        or (m.estado = 'activa'
            and (m.proxima_renovacion <= v_hoy or private.inicio_morosidad(m.id, v_hoy) is not null))
      )
    order by m.id
  loop
    v_resultado := private.procesar_membresia(v_id);
    v_revisadas := v_revisadas + 1;
    v_periodos := v_periodos + (v_resultado ->> 'periodos')::integer;
    v_suspendidas := v_suspendidas + (v_resultado ->> 'suspendida')::boolean::integer;
    v_reactivadas := v_reactivadas + (v_resultado ->> 'reactivada')::boolean::integer;
  end loop;

  return jsonb_build_object(
    'revisadas', v_revisadas, 'periodos', v_periodos, 'suspendidas', v_suspendidas,
    'reactivadas', v_reactivadas
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Beneficiarios de la membresía
-- ---------------------------------------------------------------------------

create function public.agregar_beneficiario_membresia(p_membresia_id uuid, p_beneficiario_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membresia public.membresias;
  v_id uuid;
begin
  perform private.exigir_rol('administrador', 'operador');

  select * into v_membresia from public.membresias where id = p_membresia_id for update;
  if v_membresia.id is null then
    raise exception 'Membresía no encontrada.' using errcode = 'P0002';
  end if;
  if v_membresia.estado = 'cancelada' then
    raise exception 'La membresía está cancelada.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.beneficiarios where id = p_beneficiario_id and activo) then
    raise exception 'Beneficiario no encontrado o inactivo.' using errcode = '22023';
  end if;

  -- Ya vinculado: repetir la operación no crea otro vínculo.
  select id into v_id
  from public.membresia_beneficiarios
  where membresia_id = p_membresia_id and beneficiario_id = p_beneficiario_id and activo;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.membresia_beneficiarios (membresia_id, beneficiario_id, fecha_alta, creado_por)
  values (p_membresia_id, p_beneficiario_id, greatest(private.hoy(), v_membresia.fecha_inicio), auth.uid())
  returning id into v_id;

  perform private.registrar_bitacora(
    'membresia_beneficiarios', v_id, 'agregar_beneficiario', null, null,
    jsonb_build_object('membresia_id', p_membresia_id, 'beneficiario_id', p_beneficiario_id)
  );
  return v_id;
end;
$$;

create function public.inactivar_beneficiario_membresia(p_vinculo_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_vinculo public.membresia_beneficiarios;
begin
  perform private.exigir_rol('administrador', 'operador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);

  select * into v_vinculo from public.membresia_beneficiarios where id = p_vinculo_id for update;
  if v_vinculo.id is null then
    raise exception 'Vínculo no encontrado.' using errcode = 'P0002';
  end if;
  if not v_vinculo.activo then
    raise exception 'El beneficiario ya fue dado de baja.' using errcode = '22023';
  end if;

  update public.membresia_beneficiarios
  set activo = false, fecha_baja = greatest(private.hoy(), fecha_alta), motivo_baja = v_motivo,
    dado_baja_en = now(), dado_baja_por = auth.uid()
  where id = p_vinculo_id;

  perform private.registrar_bitacora(
    'membresia_beneficiarios', p_vinculo_id, 'inactivar_beneficiario', v_motivo,
    jsonb_build_object('activo', true, 'membresia_id', v_vinculo.membresia_id, 'beneficiario_id', v_vinculo.beneficiario_id),
    jsonb_build_object('activo', false)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Cobertura y cupo (solo consulta; E4 la usará al reservar y consumir)
-- ---------------------------------------------------------------------------

-- ¿Cubre la membresía un traslado del beneficiario en esa fecha? Comprueba
-- estado, vínculo, período generado, morosidad y cupo del período. No
-- reserva ni consume nada.
create function public.consultar_cobertura(p_membresia_id uuid, p_beneficiario_id uuid, p_fecha date)
returns table (
  cubierto boolean,
  motivo text,
  aviso text,
  periodo_id uuid,
  periodo_inicio date,
  periodo_fin date,
  modalidad public.modalidad_cupo,
  cupo integer,
  usados integer,
  disponibles integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_membresia public.membresias;
  v_periodo public.periodos_membresia;
  v_limite date;
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');
  if p_fecha is null then
    raise exception 'Indique la fecha del servicio.' using errcode = '22023';
  end if;
  select * into v_membresia from public.membresias where id = p_membresia_id;
  if v_membresia.id is null then
    raise exception 'Membresía no encontrada.' using errcode = 'P0002';
  end if;

  select * into v_periodo
  from public.periodos_membresia
  where membresia_id = p_membresia_id and inicio <= p_fecha and fin >= p_fecha;

  cubierto := false;
  if v_periodo.id is not null then
    periodo_id := v_periodo.id;
    periodo_inicio := v_periodo.inicio;
    periodo_fin := v_periodo.fin;
    modalidad := v_periodo.modalidad_cupo;
    cupo := v_periodo.cupo_asignado;
    usados := private.cupo_ocupado(
      v_periodo.id, case when v_periodo.modalidad_cupo = 'individual' then p_beneficiario_id end
    );
    disponibles := private.calcular_disponibles(
      v_periodo.cupo_asignado, v_periodo.modalidad_cupo,
      private.cupo_ocupado(v_periodo.id, null), private.cupo_ocupado(v_periodo.id, p_beneficiario_id)
    );
  end if;

  if v_membresia.estado = 'cancelada' then
    motivo := 'La membresía está cancelada.';
  elsif v_membresia.estado = 'suspendida' then
    motivo := 'La membresía está suspendida por morosidad desde el '
      || to_char(v_membresia.suspendida_desde, 'DD/MM/YYYY') || '.';
  elsif not exists (
    select 1 from public.membresia_beneficiarios
    where membresia_id = p_membresia_id and beneficiario_id = p_beneficiario_id
      and fecha_alta <= p_fecha and (fecha_baja is null or fecha_baja > p_fecha)
  ) then
    motivo := 'El beneficiario no está vinculado a la membresía en esa fecha.';
  elsif p_fecha < v_membresia.fecha_inicio then
    motivo := 'La fecha es anterior al inicio de la membresía.';
  elsif v_periodo.id is null then
    motivo := case
      when p_fecha >= v_membresia.proxima_renovacion
        then 'El período de esa fecha todavía no se ha generado: la cobertura queda pendiente de validación.'
      else 'No hay un período vigente para esa fecha.'
    end;
  elsif private.inicio_morosidad(p_membresia_id, private.hoy()) is not null then
    motivo := 'Tiene cuotas vencidas fuera del plazo de gracia.';
  elsif disponibles <= 0 then
    motivo := 'El cupo de traslados del período está agotado.';
  else
    cubierto := true;
    select min(p.limite_pago) into v_limite
    from public.periodos_membresia p
    join public.saldos_cargos c on c.id = p.cargo_id
    where p.membresia_id = p_membresia_id and c.pendiente > 0;
    if v_limite is not null then
      aviso := 'Tiene una cuota pendiente dentro del plazo de gracia (límite de pago: '
        || to_char(v_limite, 'DD/MM/YYYY') || ').';
    end if;
  end if;
  return next;
end;
$$;

-- Historial básico de la membresía y de sus vínculos (bitácora), visible
-- para los tres roles, que consultan membresías.
create function public.historial_membresia(p_membresia_id uuid)
returns table (
  fecha timestamptz,
  entidad text,
  accion text,
  motivo text,
  antes jsonb,
  despues jsonb,
  actor text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');
  return query
  select b.fecha, b.entidad, b.accion, b.motivo, b.antes, b.despues, p.nombre
  from public.bitacora b
  left join public.perfiles p on p.id = b.actor_id
  where (b.entidad = 'membresias' and b.registro_id = p_membresia_id)
     or (b.entidad = 'membresia_beneficiarios' and b.registro_id in (
           select mb.id from public.membresia_beneficiarios mb where mb.membresia_id = p_membresia_id))
  order by b.fecha desc
  limit 100;
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
      'registrar_membresia', 'actualizar_condiciones_membresia', 'cancelar_membresia',
      'actualizar_mensualidades', 'agregar_beneficiario_membresia', 'inactivar_beneficiario_membresia',
      'consultar_cobertura', 'historial_membresia'
    ])
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = any (array[
      'siguiente_renovacion', 'cupo_ocupado', 'calcular_disponibles', 'inicio_morosidad',
      'registrar_cargo_servicio', 'generar_periodo', 'procesar_membresia', 'validar_condiciones'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
