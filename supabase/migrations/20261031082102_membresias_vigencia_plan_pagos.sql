-- Cambios solicitados 2026-10-30. Solo desarrollo. Sin cambios de datos históricos.
alter table public.membresias add column fecha_fin date;
alter table public.membresias add constraint membresias_fecha_fin_check check (fecha_fin >= fecha_inicio);

create function private.validar_fin_membresia(p_inicio date, p_ancla integer, p_fin date)
returns void language plpgsql set search_path = '' as $$
begin
  if p_fin is null then return; end if;
  if not isfinite(p_fin) or p_fin < p_inicio or
    p_fin <> private.siguiente_renovacion(date_trunc('month', p_fin)::date - 1, p_ancla) - 1
    and p_fin <> private.siguiente_renovacion(p_fin, p_ancla) - 1 then
    raise exception 'La fecha de vencimiento debe coincidir con el último día de un período mensual.' using errcode='22023';
  end if;
end; $$;
create or replace function public.registrar_membresia(
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

  if p_condiciones ->> 'fecha_fin' is not null then
    perform private.exigir_rol('administrador');
    perform private.validar_fin_membresia(p_fecha_inicio, extract(day from p_fecha_inicio)::integer, (p_condiciones ->> 'fecha_fin')::date);
  end if;
  insert into public.membresias (
    cliente_id, plan_id, fecha_inicio, dia_ancla, proxima_renovacion, precio_pactado, cupo_pactado,
    modalidad_cupo, dias_gracia, idempotencia, creado_por, actualizado_por, fecha_fin
  )
  values (
    p_cliente_id, p_plan_id, p_fecha_inicio, extract(day from p_fecha_inicio), p_fecha_inicio, v_precio,
    v_cupo, v_modalidad, v_dias_gracia, p_idempotencia, auth.uid(), auth.uid(), (p_condiciones ->> 'fecha_fin')::date
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
create or replace function private.procesar_membresia(p_membresia_id uuid)
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

  if v_membresia.fecha_fin < v_hoy then
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
      -- Con vencimiento fijo se conserva el anclaje: solo el ciclo vigente,
      -- sin cobrar los ciclos completos suspendidos ni extender el contrato.
      -- La cuota vigente conserva su vencimiento y gracia originales.
      -- Sin vencimiento fijo permanece la reactivación histórica desde hoy.
      update public.membresias
      set estado = 'activa', suspendida_desde = null, dia_ancla = case when fecha_fin is null then extract(day from v_hoy) else dia_ancla end,
        proxima_renovacion = case when fecha_fin is null then v_hoy else private.inicio_periodo_previsto(v_membresia, v_hoy) end, updated_at = now(), actualizado_por = auth.uid()
      where id = v_membresia.id
      returning * into v_membresia;
    end if;
    v_reactivada := true;
  end if;

  while v_membresia.proxima_renovacion <= v_hoy and (v_membresia.fecha_fin is null or v_membresia.proxima_renovacion <= v_membresia.fecha_fin) loop
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
create or replace function public.consultar_cobertura(p_membresia_id uuid, p_beneficiario_id uuid, p_fecha date)
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

  if p_fecha > v_membresia.fecha_fin or private.hoy() > v_membresia.fecha_fin then
    motivo := 'La membresía ha vencido para la fecha solicitada.';
  elsif v_membresia.estado = 'cancelada' then
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
create or replace function private.evaluar_cobertura(
  p_membresia_id uuid, p_beneficiario_id uuid, p_fecha date, p_traslado_id uuid
)
returns table (
  condicion public.condicion_cobertura,
  motivo text,
  periodo_id uuid,
  periodo_inicio date,
  cupo integer,
  disponibles integer
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_membresia public.membresias;
  v_periodo public.periodos_membresia;
  v_modalidad public.modalidad_cupo;
begin
  condicion := 'no_valida';
  select * into v_membresia from public.membresias where id = p_membresia_id;
  if v_membresia.id is null then
    motivo := 'Membresía no encontrada.';
  elsif p_fecha > v_membresia.fecha_fin or private.hoy() > v_membresia.fecha_fin then
    motivo := 'La membresía ha vencido para la fecha solicitada.';
  elsif v_membresia.estado = 'cancelada' then
    motivo := 'La membresía está cancelada.';
  elsif v_membresia.estado = 'suspendida' then
    motivo := 'La membresía está suspendida por morosidad desde el '
      || to_char(v_membresia.suspendida_desde, 'DD/MM/YYYY') || '.';
  elsif p_fecha < v_membresia.fecha_inicio then
    motivo := 'La fecha del servicio es anterior al inicio de la membresía.';
  elsif not exists (
    select 1 from public.membresia_beneficiarios mb
    where mb.membresia_id = p_membresia_id and mb.beneficiario_id = p_beneficiario_id
      and mb.fecha_alta <= p_fecha and (mb.fecha_baja is null or mb.fecha_baja > p_fecha)
  ) then
    motivo := 'El beneficiario no está vinculado a la membresía en la fecha del servicio.';
  elsif private.inicio_morosidad(p_membresia_id, private.hoy()) is not null then
    motivo := 'La membresía tiene cuotas vencidas fuera del plazo de gracia.';
  end if;
  if motivo is not null then
    return next;
    return;
  end if;

  select * into v_periodo
  from public.periodos_membresia p
  where p.membresia_id = p_membresia_id and p.inicio <= p_fecha and p.fin >= p_fecha;
  if v_periodo.id is not null then
    periodo_id := v_periodo.id;
    periodo_inicio := v_periodo.inicio;
    cupo := v_periodo.cupo_asignado;
    v_modalidad := v_periodo.modalidad_cupo;
  else
    periodo_inicio := private.inicio_periodo_previsto(v_membresia, p_fecha);
    if periodo_inicio is null then
      motivo := 'No hay un período de membresía para la fecha del servicio.';
      return next;
      return;
    end if;
    -- Período futuro: condiciones pactadas vigentes (se revalida al generarlo).
    cupo := v_membresia.cupo_pactado;
    v_modalidad := v_membresia.modalidad_cupo;
  end if;

  disponibles := private.calcular_disponibles(
    cupo, v_modalidad,
    private.cupo_usado(p_membresia_id, periodo_inicio, null, p_traslado_id),
    private.cupo_usado(p_membresia_id, periodo_inicio, p_beneficiario_id, p_traslado_id)
  );
  if disponibles <= 0 then
    motivo := 'El cupo de traslados del período está agotado.';
    periodo_id := null;
  elsif periodo_id is null then
    condicion := 'pendiente_validacion';
    motivo := 'El período del ' || to_char(periodo_inicio, 'DD/MM/YYYY')
      || ' aún no se ha generado: reserva provisional, se confirma antes de iniciar.';
  else
    condicion := 'valida';
  end if;
  return next;
end;
$$;

create function public.establecer_vencimiento_membresia(p_membresia_id uuid, p_fecha_fin date, p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
declare v_m public.membresias; v_motivo text;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);
  select * into v_m from public.membresias where id=p_membresia_id for update;
  if v_m.id is null then raise exception 'Membresía no encontrada.' using errcode='P0002'; end if;
  if p_fecha_fin is null then raise exception 'Indique la fecha de vencimiento.' using errcode='22023'; end if;
  perform private.validar_fin_membresia(v_m.fecha_inicio,v_m.dia_ancla,p_fecha_fin);
  if exists(select 1 from public.periodos_membresia where membresia_id=v_m.id and fin>p_fecha_fin) then
    raise exception 'El vencimiento no puede recortar un período ya emitido.' using errcode='22023';
  end if;
  if exists(select 1 from public.traslados_ambulancia where membresia_id=v_m.id and estado <> 'cancelado'
    and (inicio_previsto at time zone 'America/Tegucigalpa')::date > p_fecha_fin) then
    raise exception 'Hay traslados posteriores al vencimiento; revise esos servicios primero.' using errcode='22023';
  end if;
  update public.membresias set fecha_fin=p_fecha_fin, updated_at=now(), actualizado_por=auth.uid() where id=v_m.id;
  perform private.registrar_bitacora('membresias',v_m.id,'establecer_vencimiento',v_motivo,
    jsonb_build_object('fecha_fin',v_m.fecha_fin),jsonb_build_object('fecha_fin',p_fecha_fin));
end; $$;
revoke all on function public.establecer_vencimiento_membresia(uuid,date,text) from public,anon;
grant execute on function public.establecer_vencimiento_membresia(uuid,date,text) to authenticated;
revoke all on function private.validar_fin_membresia(date,integer,date) from public,anon,authenticated;

create or replace view public.saldos_membresias with (security_invoker = true) as
select
  m.id, m.cliente_id, cl.nombre as cliente_nombre, m.plan_id, pl.nombre as plan_nombre,
  m.fecha_inicio, m.dia_ancla, m.proxima_renovacion, m.precio_pactado, m.cupo_pactado,
  m.modalidad_cupo, m.dias_gracia, m.estado, m.suspendida_desde, m.motivo_cancelacion,
  m.cancelada_en, m.created_at,
  coalesce(s.pendiente, 0)::numeric(14, 2) as pendiente,
  coalesce(s.vencido, 0)::numeric(14, 2) as vencido,
  coalesce(s.cuotas_vencidas, 0)::integer as cuotas_vencidas,
  coalesce(b.activos, 0)::integer as beneficiarios_activos, m.fecha_fin
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

create or replace function private.congelar_contrato(p_membresia_id uuid)
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
  values (p_membresia_id, v_plantilla.version, private.renderizar_contrato(v_plantilla.contenido, v_datos) || coalesce((
    select E'\n\nVENCIMIENTO PACTADO: ' || to_char(fecha_fin,'DD/MM/YYYY') ||
      '. Esta fecha limita las renovaciones mensuales: después finalizan la cobertura y las nuevas cuotas; la deuda pendiente se conserva.'
    from public.membresias where id=p_membresia_id and fecha_fin is not null), ''), v_datos, auth.uid())
  on conflict (membresia_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.contratos_membresia where membresia_id = p_membresia_id;
  end if;
  return v_id;
end;
$$;

