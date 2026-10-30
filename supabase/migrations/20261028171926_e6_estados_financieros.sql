-- Estados financieros gerenciales y comprobaciones (2026-10-28, a pedido del
-- propietario). Solo consultas: sin tablas nuevas ni cambios en E2–E6.
--
-- Todo sale del libro (asientos y lineas_asiento), por la fecha del asiento:
--   * estado_resultados: ingresos y gastos por cuenta y actividad en un período.
--   * situacion_financiera: saldos de activo, pasivo y patrimonio al cierre de
--     una fecha, más el resultado acumulado (ingresos − gastos hasta la fecha).
--   * comprobaciones_financieras: activo = pasivo + patrimonio, debe = haber,
--     asientos cuadrados y, a la fecha de hoy, cada cuenta del libro contra los
--     saldos operativos (caja y bancos, por cobrar, por pagar, anticipos).
--   * balanza_comprobacion: por cuenta, saldo inicial, debe, haber y saldo final.
-- Saldos con su naturaleza: activo y gasto, debe − haber; pasivo, patrimonio e
-- ingreso, haber − debe. Informes gerenciales, no estados certificados.
-- SECURITY DEFINER con search_path vacío; solo administrador y finanzas.

create function private.naturaleza(p_tipo public.tipo_cuenta_contable, p_debe numeric, p_haber numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when p_tipo in ('activo', 'gasto') then p_debe - p_haber else p_haber - p_debe end
$$;

create function private.exigir_fecha_corte(p_fecha date)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_fecha is null or p_fecha < date '2000-01-01' then
    raise exception 'Indique una fecha de corte válida.' using errcode = '22023';
  end if;
end;
$$;

-- Saldo de cada cuenta del libro con asientos hasta p_fecha (incluida).
create function private.saldos_al(p_fecha date)
returns table (cuenta_id uuid, codigo text, nombre text, tipo public.tipo_cuenta_contable, debe numeric, haber numeric, saldo numeric)
language sql
stable
set search_path = ''
as $$
  select c.id, c.codigo, c.nombre, c.tipo,
    coalesce(sum(l.debe), 0), coalesce(sum(l.haber), 0),
    private.naturaleza(c.tipo, coalesce(sum(l.debe), 0), coalesce(sum(l.haber), 0))
  from public.cuentas_contables c
  left join (
    public.lineas_asiento l join public.asientos x on x.id = l.asiento_id and x.fecha <= p_fecha
  ) on l.cuenta_contable_id = c.id
  group by c.id
$$;

-- ---------------------------------------------------------------------------
-- Estado de resultados (rendimiento financiero)
-- ---------------------------------------------------------------------------

create function public.estado_resultados(p_desde date, p_hasta date)
returns table (
  cuenta_codigo text, cuenta_nombre text, tipo public.tipo_cuenta_contable,
  ambulancias numeric, alquileres numeric, transportes numeric, general numeric, total numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.exigir_rol('administrador', 'finanzas');
  perform private.exigir_rango(p_desde, p_hasta);
  return query
  select c.codigo, c.nombre, c.tipo,
    coalesce(sum(r.importe) filter (where r.actividad = 'ambulancias'), 0)::numeric(14, 2),
    coalesce(sum(r.importe) filter (where r.actividad = 'alquileres'), 0)::numeric(14, 2),
    coalesce(sum(r.importe) filter (where r.actividad = 'transportes'), 0)::numeric(14, 2),
    coalesce(sum(r.importe) filter (where r.actividad = 'general'), 0)::numeric(14, 2),
    coalesce(sum(r.importe), 0)::numeric(14, 2)
  from public.cuentas_contables c
  left join private.lineas_resultado(p_desde, p_hasta) r on r.cuenta_codigo = c.codigo
  where c.tipo in ('ingreso', 'gasto')
  group by c.codigo, c.nombre, c.tipo
  order by c.codigo;
end;
$$;

-- ---------------------------------------------------------------------------
-- Estado de situación financiera
-- ---------------------------------------------------------------------------

-- Activo, pasivo y patrimonio al cierre de p_fecha. La fila sin código es el
-- resultado acumulado (ingresos − gastos hasta la fecha), parte del patrimonio.
create function public.situacion_financiera(p_fecha date)
returns table (cuenta_codigo text, cuenta_nombre text, tipo public.tipo_cuenta_contable, saldo numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.exigir_rol('administrador', 'finanzas');
  perform private.exigir_fecha_corte(p_fecha);
  return query
  select s.codigo, s.nombre, s.tipo, s.saldo::numeric(14, 2)
  from private.saldos_al(p_fecha) s
  where s.tipo in ('activo', 'pasivo', 'patrimonio')
  union all
  select null::text, 'Resultado acumulado (ingresos − gastos)', 'patrimonio'::public.tipo_cuenta_contable,
    (coalesce(sum(s.saldo) filter (where s.tipo = 'ingreso'), 0)
      - coalesce(sum(s.saldo) filter (where s.tipo = 'gasto'), 0))::numeric(14, 2)
  from private.saldos_al(p_fecha) s
  order by 3, 1 nulls last;
end;
$$;

-- ---------------------------------------------------------------------------
-- Comprobaciones
-- ---------------------------------------------------------------------------

create function public.comprobaciones_financieras(p_fecha date)
returns table (orden integer, control text, esperado numeric, obtenido numeric, diferencia numeric, cuadra boolean, nota text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_actual boolean := p_fecha >= private.hoy();
  v_activo numeric;
  v_pasivo numeric;
  v_patrimonio numeric;
  v_resultado numeric;
  v_debe numeric;
  v_haber numeric;
  v_descuadrados bigint;
  v_1100 numeric;
  v_1200 numeric;
  v_2100 numeric;
  v_2200 numeric;
  v_nota_hoy text := 'Solo se compara con los saldos de hoy: elija un período que termine hoy o después.';
begin
  perform private.exigir_rol('administrador', 'finanzas');
  perform private.exigir_fecha_corte(p_fecha);

  select
    coalesce(sum(saldo) filter (where tipo = 'activo'), 0),
    coalesce(sum(saldo) filter (where tipo = 'pasivo'), 0),
    coalesce(sum(saldo) filter (where tipo = 'patrimonio'), 0),
    coalesce(sum(saldo) filter (where tipo = 'ingreso'), 0) - coalesce(sum(saldo) filter (where tipo = 'gasto'), 0),
    coalesce(sum(debe), 0), coalesce(sum(haber), 0),
    coalesce(sum(saldo) filter (where codigo = '1100'), 0),
    coalesce(sum(saldo) filter (where codigo = '1200'), 0),
    coalesce(sum(saldo) filter (where codigo = '2100'), 0),
    coalesce(sum(saldo) filter (where codigo = '2200'), 0)
  into v_activo, v_pasivo, v_patrimonio, v_resultado, v_debe, v_haber, v_1100, v_1200, v_2100, v_2200
  from private.saldos_al(p_fecha);

  select count(*) into v_descuadrados
  from (
    select x.id
    from public.asientos x left join public.lineas_asiento l on l.asiento_id = x.id
    where x.fecha <= p_fecha
    group by x.id
    having count(l.id) < 2 or coalesce(sum(l.debe), 0) <> coalesce(sum(l.haber), 0)
  ) d;

  return query
  select 1, 'Activo = pasivo + patrimonio (incluido el resultado acumulado)',
    v_activo::numeric(14, 2), (v_pasivo + v_patrimonio + v_resultado)::numeric(14, 2),
    (v_activo - v_pasivo - v_patrimonio - v_resultado)::numeric(14, 2),
    v_activo = v_pasivo + v_patrimonio + v_resultado, null::text
  union all
  select 2, 'Total debe = total haber en el libro', v_debe::numeric(14, 2), v_haber::numeric(14, 2),
    (v_debe - v_haber)::numeric(14, 2), v_debe = v_haber, null
  union all
  select 3, 'Asientos descuadrados (debe ≠ haber o menos de dos líneas)', 0::numeric, v_descuadrados::numeric,
    v_descuadrados::numeric, v_descuadrados = 0, 'Cantidad de asientos, no lempiras.'
  union all
  -- Caja y bancos se puede comparar a cualquier fecha: los movimientos tienen fecha.
  select 4, 'Caja y bancos (1100) = suma de movimientos de las cuentas',
    v_1100::numeric(14, 2),
    coalesce((select sum(m.monto_con_signo) from public.movimientos_dinero m where m.fecha <= p_fecha), 0)::numeric(14, 2),
    (v_1100 - coalesce((select sum(m.monto_con_signo) from public.movimientos_dinero m where m.fecha <= p_fecha), 0))::numeric(14, 2),
    v_1100 = coalesce((select sum(m.monto_con_signo) from public.movimientos_dinero m where m.fecha <= p_fecha), 0), null
  union all
  select 5, 'Cuentas por cobrar (1200) = pendiente de los cargos vigentes', v_1200::numeric(14, 2),
    case when v_actual then coalesce((select sum(s.pendiente) from public.saldos_cargos s where s.estado = 'vigente'), 0) end::numeric(14, 2),
    case when v_actual then v_1200 - coalesce((select sum(s.pendiente) from public.saldos_cargos s where s.estado = 'vigente'), 0) end::numeric(14, 2),
    case when v_actual then v_1200 = coalesce((select sum(s.pendiente) from public.saldos_cargos s where s.estado = 'vigente'), 0) end,
    case when v_actual then null else v_nota_hoy end
  union all
  select 6, 'Cuentas por pagar (2100) = pendiente de los gastos registrados', v_2100::numeric(14, 2),
    case when v_actual then coalesce((select sum(s.pendiente) from public.saldos_gastos s where s.estado = 'registrado'), 0) end::numeric(14, 2),
    case when v_actual then v_2100 - coalesce((select sum(s.pendiente) from public.saldos_gastos s where s.estado = 'registrado'), 0) end::numeric(14, 2),
    case when v_actual then v_2100 = coalesce((select sum(s.pendiente) from public.saldos_gastos s where s.estado = 'registrado'), 0) end,
    case when v_actual then null else v_nota_hoy end
  union all
  select 7, 'Anticipos de clientes (2200) = cobros sin aplicar', v_2200::numeric(14, 2),
    case when v_actual then coalesce((select sum(s.disponible) from public.saldos_cobros s where s.estado = 'confirmado'), 0) end::numeric(14, 2),
    case when v_actual then v_2200 - coalesce((select sum(s.disponible) from public.saldos_cobros s where s.estado = 'confirmado'), 0) end::numeric(14, 2),
    case when v_actual then v_2200 = coalesce((select sum(s.disponible) from public.saldos_cobros s where s.estado = 'confirmado'), 0) end,
    case when v_actual then null else v_nota_hoy end
  order by 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Balanza de comprobación
-- ---------------------------------------------------------------------------

create function public.balanza_comprobacion(p_desde date, p_hasta date)
returns table (
  cuenta_codigo text, cuenta_nombre text, tipo public.tipo_cuenta_contable,
  saldo_inicial numeric, debe numeric, haber numeric, saldo_final numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.exigir_rol('administrador', 'finanzas');
  perform private.exigir_rango(p_desde, p_hasta);
  return query
  select a.codigo, a.nombre, a.tipo,
    a.saldo::numeric(14, 2),
    (f.debe - a.debe)::numeric(14, 2),
    (f.haber - a.haber)::numeric(14, 2),
    f.saldo::numeric(14, 2)
  from private.saldos_al(p_desde - 1) a
  join private.saldos_al(p_hasta) f on f.cuenta_id = a.cuenta_id
  order by a.codigo;
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
      'estado_resultados', 'situacion_financiera', 'comprobaciones_financieras', 'balanza_comprobacion'
    ])
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = any (array['naturaleza', 'exigir_fecha_corte', 'saldos_al'])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
