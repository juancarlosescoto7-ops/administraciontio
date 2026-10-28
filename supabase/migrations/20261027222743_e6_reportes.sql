-- E6 · Reportes financieros.
--
-- Solo consultas: no hay tablas nuevas ni se modifica el núcleo de E2. Todo
-- se calcula del libro contable y de los movimientos confirmados:
--   * Ingresos reconocidos: líneas de cuentas de ingreso (4x00), haber − debe,
--     por la fecha del asiento. Un reverso (anulación de cargo) resta en su
--     propia fecha. Los cobros y anticipos no tocan cuentas de ingreso.
--   * Gastos reconocidos: líneas de cuentas de gasto (5x00), debe − haber, por
--     la fecha del asiento. Los pagos no tocan cuentas de gasto.
--   * Actividad: la del asiento (ambulancias —incluye membresías—,
--     alquileres, transportes, general). Los gastos generales no se reparten.
--   * Efectivo: movimientos de caja y bancos por tipo (cobros, pagos,
--     transferencias y saldos iniciales). Las transferencias no son ingreso ni
--     gasto.
--   * Saldos actuales (por cobrar, por pagar, anticipos, dinero): vistas de E2,
--     que coinciden con las cuentas 1200, 2100, 2200 y 1100 del libro.
-- Funciones SECURITY DEFINER con search_path vacío, solo para administrador y
-- finanzas (el operador no consulta resultados ni tesorería). Fechas en días
-- (date), ambos extremos incluidos.

create function private.exigir_rango(p_desde date, p_hasta date)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_desde is null or p_hasta is null then
    raise exception 'Indique el período (desde y hasta).' using errcode = '22023';
  end if;
  if p_hasta < p_desde then
    raise exception 'La fecha final no puede ser anterior a la inicial.' using errcode = '22023';
  end if;
  if p_hasta - p_desde > 3660 then
    raise exception 'El período no puede superar diez años.' using errcode = '22023';
  end if;
end;
$$;

-- Líneas de resultado (ingresos y gastos) del período, con signo positivo
-- cuando suman al ingreso o al gasto.
create function private.lineas_resultado(p_desde date, p_hasta date)
returns table (
  asiento_id uuid, fecha date, actividad public.actividad, evento public.evento_financiero,
  origen_tipo public.origen_financiero, origen_id uuid, concepto text,
  tipo public.tipo_cuenta_contable, cuenta_codigo text, cuenta_nombre text, importe numeric
)
language sql
stable
set search_path = ''
as $$
  select x.id, x.fecha, x.actividad, x.evento, x.origen_tipo, x.origen_id, x.concepto,
    c.tipo, c.codigo, c.nombre,
    case when c.tipo = 'ingreso' then l.haber - l.debe else l.debe - l.haber end
  from public.asientos x
  join public.lineas_asiento l on l.asiento_id = x.id
  join public.cuentas_contables c on c.id = l.cuenta_contable_id
  where c.tipo in ('ingreso', 'gasto') and x.fecha between p_desde and p_hasta
$$;

-- ---------------------------------------------------------------------------
-- Resumen general
-- ---------------------------------------------------------------------------

create function public.reporte_resumen(p_desde date, p_hasta date)
returns table (
  ingresos numeric,
  gastos numeric,
  resultado numeric,
  cobros_periodo numeric,
  pagos_periodo numeric,
  por_cobrar numeric,
  por_cobrar_vencido numeric,
  por_pagar numeric,
  por_pagar_vencido numeric,
  anticipos numeric,
  dinero_disponible numeric,
  fecha_corte date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_hoy date := private.hoy();
begin
  perform private.exigir_rol('administrador', 'finanzas');
  perform private.exigir_rango(p_desde, p_hasta);
  return query
  with res as (
    select
      coalesce(sum(r.importe) filter (where r.tipo = 'ingreso'), 0)::numeric(14, 2) as ingresos,
      coalesce(sum(r.importe) filter (where r.tipo = 'gasto'), 0)::numeric(14, 2) as gastos
    from private.lineas_resultado(p_desde, p_hasta) r
  ), efe as (
    select
      coalesce(sum(m.monto_con_signo) filter (where m.tipo = 'ingreso'), 0)::numeric(14, 2) as cobros,
      coalesce(-sum(m.monto_con_signo) filter (where m.tipo = 'egreso'), 0)::numeric(14, 2) as pagos
    from public.movimientos_dinero m
    where m.fecha between p_desde and p_hasta
  )
  select
    res.ingresos, res.gastos, (res.ingresos - res.gastos)::numeric(14, 2),
    efe.cobros, efe.pagos,
    coalesce((select sum(s.pendiente) from public.saldos_cargos s where s.estado = 'vigente'), 0)::numeric(14, 2),
    coalesce((select sum(s.pendiente) from public.saldos_cargos s
      where s.estado = 'vigente' and s.pendiente > 0 and s.vencimiento < v_hoy), 0)::numeric(14, 2),
    coalesce((select sum(s.pendiente) from public.saldos_gastos s where s.estado = 'registrado'), 0)::numeric(14, 2),
    coalesce((select sum(s.pendiente) from public.saldos_gastos s
      where s.estado = 'registrado' and s.pendiente > 0 and s.vencimiento < v_hoy), 0)::numeric(14, 2),
    coalesce((select sum(s.disponible) from public.saldos_cobros s where s.estado = 'confirmado'), 0)::numeric(14, 2),
    coalesce((select sum(m.monto_con_signo) from public.movimientos_dinero m), 0)::numeric(14, 2),
    v_hoy
  from res, efe;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resultados por actividad (siempre las cuatro filas)
-- ---------------------------------------------------------------------------

create function public.reporte_resultados_actividad(p_desde date, p_hasta date)
returns table (actividad public.actividad, ingresos numeric, gastos numeric, resultado numeric)
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
  select a.actividad,
    coalesce(sum(r.importe) filter (where r.tipo = 'ingreso'), 0)::numeric(14, 2),
    coalesce(sum(r.importe) filter (where r.tipo = 'gasto'), 0)::numeric(14, 2),
    (coalesce(sum(r.importe) filter (where r.tipo = 'ingreso'), 0)
      - coalesce(sum(r.importe) filter (where r.tipo = 'gasto'), 0))::numeric(14, 2)
  from unnest(enum_range(null::public.actividad)) as a(actividad)
  left join private.lineas_resultado(p_desde, p_hasta) r on r.actividad = a.actividad
  group by a.actividad
  order by array_position(enum_range(null::public.actividad), a.actividad);
end;
$$;

-- ---------------------------------------------------------------------------
-- Detalle de ingresos y de gastos del período
-- ---------------------------------------------------------------------------

-- Cada línea de ingreso del período; un reverso aparece con importe negativo.
create function public.reporte_ingresos(p_desde date, p_hasta date, p_actividad public.actividad default null)
returns table (
  asiento_id uuid, fecha date, actividad public.actividad, evento public.evento_financiero,
  cargo_id uuid, concepto text, cliente_id uuid, cliente_nombre text, cuenta_codigo text, cuenta_nombre text,
  importe numeric
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
  select r.asiento_id, r.fecha, r.actividad, r.evento, cg.id, coalesce(cg.concepto, r.concepto), cl.id, cl.nombre,
    r.cuenta_codigo, r.cuenta_nombre, r.importe::numeric(14, 2)
  from private.lineas_resultado(p_desde, p_hasta) r
  left join public.cargos_cliente cg on r.origen_tipo = 'cargo' and cg.id = r.origen_id
  left join public.clientes cl on cl.id = cg.cliente_id
  where r.tipo = 'ingreso' and (p_actividad is null or r.actividad = p_actividad)
  order by r.fecha, r.evento, coalesce(cg.concepto, r.concepto);
end;
$$;

-- Cada línea de gasto del período (el gasto se reconoce una vez; los pagos no
-- aparecen). Una anulación aparece con importe negativo en su fecha.
create function public.reporte_gastos(p_desde date, p_hasta date, p_actividad public.actividad default null)
returns table (
  asiento_id uuid, fecha date, actividad public.actividad, evento public.evento_financiero,
  gasto_id uuid, concepto text, categoria text, proveedor text, cuenta_codigo text,
  importe numeric, estado public.estado_gasto, pagado numeric, pendiente numeric, vencimiento date
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
  select r.asiento_id, r.fecha, r.actividad, r.evento, g.id, coalesce(g.concepto, r.concepto),
    g.categoria_nombre, g.proveedor_nombre, r.cuenta_codigo, r.importe::numeric(14, 2),
    g.estado, g.pagado, g.pendiente, g.vencimiento
  from private.lineas_resultado(p_desde, p_hasta) r
  left join public.saldos_gastos g on r.origen_tipo = 'gasto' and g.id = r.origen_id
  where r.tipo = 'gasto' and (p_actividad is null or r.actividad = p_actividad)
  order by r.fecha, r.evento, coalesce(g.concepto, r.concepto);
end;
$$;

-- Totales de gastos del período por categoría y por actividad.
create function public.reporte_gastos_agrupados(p_desde date, p_hasta date)
returns table (agrupacion text, clave text, nombre text, importe numeric)
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
  select 'categoria'::text, coalesce(cg.id::text, r.cuenta_codigo), coalesce(cg.nombre, r.cuenta_nombre),
    sum(r.importe)::numeric(14, 2)
  from private.lineas_resultado(p_desde, p_hasta) r
  left join public.gastos g on r.origen_tipo = 'gasto' and g.id = r.origen_id
  left join public.categorias_gasto cg on cg.id = g.categoria_id
  where r.tipo = 'gasto'
  group by coalesce(cg.id::text, r.cuenta_codigo), coalesce(cg.nombre, r.cuenta_nombre)
  union all
  select 'actividad'::text, r.actividad::text, r.actividad::text, sum(r.importe)::numeric(14, 2)
  from private.lineas_resultado(p_desde, p_hasta) r
  where r.tipo = 'gasto'
  group by r.actividad
  order by 1, 2;
end;
$$;

-- ---------------------------------------------------------------------------
-- Caja y bancos
-- ---------------------------------------------------------------------------

-- Por cuenta: saldo al cierre del día anterior al período, movimientos del
-- período por tipo, saldo al cierre del último día y saldo actual. Una cuenta
-- en negativo se muestra tal cual.
create function public.reporte_caja(p_desde date, p_hasta date)
returns table (
  cuenta_dinero_id uuid, nombre text, tipo public.tipo_cuenta_dinero, activo boolean,
  saldo_inicial numeric, cobros numeric, pagos numeric, transferencias numeric, aperturas numeric,
  saldo_final numeric, saldo_actual numeric
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
  select cd.id, cd.nombre, cd.tipo, cd.activo,
    coalesce(sum(m.monto_con_signo) filter (where m.fecha < p_desde), 0)::numeric(14, 2),
    coalesce(sum(m.monto_con_signo) filter (where m.fecha between p_desde and p_hasta and m.tipo = 'ingreso'), 0)::numeric(14, 2),
    coalesce(sum(m.monto_con_signo) filter (where m.fecha between p_desde and p_hasta and m.tipo = 'egreso'), 0)::numeric(14, 2),
    coalesce(sum(m.monto_con_signo) filter (where m.fecha between p_desde and p_hasta and m.tipo = 'transferencia'), 0)::numeric(14, 2),
    coalesce(sum(m.monto_con_signo) filter (where m.fecha between p_desde and p_hasta and m.tipo = 'apertura'), 0)::numeric(14, 2),
    coalesce(sum(m.monto_con_signo) filter (where m.fecha <= p_hasta), 0)::numeric(14, 2),
    coalesce(sum(m.monto_con_signo), 0)::numeric(14, 2)
  from public.cuentas_dinero cd
  left join public.movimientos_dinero m on m.cuenta_dinero_id = cd.id
  group by cd.id
  order by cd.activo desc, cd.tipo, cd.nombre;
end;
$$;

-- Movimientos de una cuenta en el período, con el saldo después de cada uno.
create function public.reporte_movimientos(p_cuenta_dinero_id uuid, p_desde date, p_hasta date)
returns table (
  movimiento_id uuid, fecha date, tipo public.tipo_movimiento, evento public.evento_financiero,
  concepto text, importe numeric, saldo numeric
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
  select m.id, m.fecha, m.tipo, m.evento, x.concepto, m.monto_con_signo,
    (coalesce((select sum(a.monto_con_signo) from public.movimientos_dinero a
       where a.cuenta_dinero_id = p_cuenta_dinero_id and a.fecha < p_desde), 0)
     + sum(m.monto_con_signo) over (order by m.fecha, m.created_at, m.id))::numeric(14, 2)
  from public.movimientos_dinero m
  join public.asientos x on x.id = m.asiento_id
  where m.cuenta_dinero_id = p_cuenta_dinero_id and m.fecha between p_desde and p_hasta
  order by m.fecha, m.created_at, m.id;
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
      'reporte_resumen', 'reporte_resultados_actividad', 'reporte_ingresos', 'reporte_gastos',
      'reporte_gastos_agrupados', 'reporte_caja', 'reporte_movimientos'
    ])
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = any (array['exigir_rango', 'lineas_resultado'])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
