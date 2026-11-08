-- Bonos por servicio, vouchers numerados y resultado de cada servicio.
-- Ampliación solicitada el 2026-11-05. No altera gastos ni pagos existentes.

-- 1. Categoría «Bonos» con su propia cuenta de gasto.
insert into public.cuentas_contables (codigo, nombre, tipo) values ('5350', 'Gasto de bonos', 'gasto');
insert into public.categorias_gasto (nombre, cuenta_contable_id)
select 'Bonos', id from public.cuentas_contables where codigo = '5350';

-- 2. Las funciones de gastos se separan en un núcleo privado (sin control de
-- rol) y la función pública de siempre (mismo control de rol y mismo
-- comportamiento). Así el registro de bonos y gastos de un servicio puede
-- reutilizar exactamente la misma lógica con sus propios permisos.

create function private.registrar_gasto_base(
  p_idempotencia uuid,
  p_proveedor_id uuid,
  p_categoria_id uuid,
  p_actividad public.actividad,
  p_fecha date,
  p_vencimiento date,
  p_concepto text,
  p_monto numeric,
  p_notas text,
  p_pago jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_concepto text;
  v_notas text;
  v_cuenta_gasto text;
  v_existente public.gastos;
  v_id uuid;
begin
  perform private.exigir_clave(p_idempotencia);
  perform private.validar_monto(p_monto);
  perform private.validar_fecha(p_fecha);
  if p_vencimiento < p_fecha then
    raise exception 'El vencimiento no puede ser anterior a la fecha.' using errcode = '22023';
  end if;
  if p_actividad is null then
    raise exception 'Seleccione la actividad.' using errcode = '22023';
  end if;
  v_concepto := private.texto(p_concepto, 200, 'el concepto', true);
  v_notas := private.texto(p_notas, 1000, 'las notas', false);

  select c.codigo into v_cuenta_gasto
  from public.categorias_gasto cg
  join public.cuentas_contables c on c.id = cg.cuenta_contable_id
  where cg.id = p_categoria_id and cg.activo;
  if v_cuenta_gasto is null then
    raise exception 'Seleccione una categoría de gasto activa.' using errcode = '22023';
  end if;
  if p_proveedor_id is not null
     and not exists (select 1 from public.proveedores where id = p_proveedor_id and activo) then
    raise exception 'Proveedor no encontrado o inactivo.' using errcode = '22023';
  end if;

  insert into public.gastos (
    proveedor_id, categoria_id, actividad, fecha, vencimiento, concepto, monto, notas, idempotencia,
    creado_por
  )
  values (
    p_proveedor_id, p_categoria_id, p_actividad, p_fecha, p_vencimiento, v_concepto, p_monto, v_notas,
    p_idempotencia, auth.uid()
  )
  on conflict (idempotencia) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_existente from public.gastos where idempotencia = p_idempotencia;
    perform private.exigir_misma_operacion(v_existente.monto = p_monto and v_existente.categoria_id = p_categoria_id);
    return v_existente.id;
  end if;

  perform private.registrar_asiento(
    p_fecha, 'Gasto: ' || v_concepto, p_actividad, 'gasto', v_id,
    jsonb_build_array(private.linea(v_cuenta_gasto, p_monto, 0), private.linea('2100', 0, p_monto))
  );

  if p_pago is not null and jsonb_typeof(p_pago) = 'object' then
    perform private.pagar_gasto(
      v_id,
      (p_pago ->> 'cuenta_dinero_id')::uuid,
      p_fecha,
      (p_pago ->> 'metodo')::public.metodo_pago,
      p_pago ->> 'referencia',
      (p_pago ->> 'monto')::numeric,
      p_idempotencia
    );
  end if;

  return v_id;
end;
$$;

create or replace function public.registrar_gasto(
  p_idempotencia uuid,
  p_proveedor_id uuid,
  p_categoria_id uuid,
  p_actividad public.actividad,
  p_fecha date,
  p_vencimiento date,
  p_concepto text,
  p_monto numeric,
  p_notas text,
  p_pago jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.exigir_rol('administrador', 'finanzas');
  return private.registrar_gasto_base(
    p_idempotencia, p_proveedor_id, p_categoria_id, p_actividad, p_fecha, p_vencimiento, p_concepto, p_monto, p_notas, p_pago
  );
end;
$$;

create function private.registrar_gasto_servicio_base(
  p_idempotencia uuid,p_proveedor_id uuid,p_categoria_id uuid,p_actividad public.actividad,
  p_fecha date,p_vencimiento date,p_concepto text,p_monto numeric,p_notas text,
  p_pago jsonb,p_tipo text,p_servicio_id uuid
) returns uuid language plpgsql set search_path='' as $$
declare v_id uuid; v_actividad public.actividad; v_rel public.gastos_servicio;
begin
  perform private.exigir_clave(p_idempotencia);
  perform pg_advisory_xact_lock(hashtextextended('gasto_servicio:'||p_idempotencia::text,0));
  if (p_tipo is null) <> (p_servicio_id is null) then
    raise exception 'Indique el tipo y el servicio del gasto.' using errcode='22023';
  end if;
  if p_tipo is not null then
    case p_tipo
      when 'membresia' then select 'ambulancias'::public.actividad into v_actividad from public.membresias where id=p_servicio_id;
      when 'alquiler' then select 'alquileres'::public.actividad into v_actividad from public.alquileres where id=p_servicio_id;
      when 'transporte' then select 'transportes'::public.actividad into v_actividad from public.transportes where id=p_servicio_id;
      when 'traslado' then select 'ambulancias'::public.actividad into v_actividad from public.traslados_ambulancia where id=p_servicio_id;
      else raise exception 'Tipo de servicio no válido.' using errcode='22023';
    end case;
    if v_actividad is null then raise exception 'Servicio no encontrado.' using errcode='22023'; end if;
    if p_actividad is distinct from v_actividad then raise exception 'La actividad no corresponde al servicio.' using errcode='22023'; end if;
  end if;
  select id into v_id from public.gastos where idempotencia=p_idempotencia;
  if v_id is not null then
    select * into v_rel from public.gastos_servicio where gasto_id=v_id;
    perform private.exigir_misma_operacion(
      (v_rel.membresia_id is not distinct from case when p_tipo='membresia' then p_servicio_id end) and
      (v_rel.alquiler_id is not distinct from case when p_tipo='alquiler' then p_servicio_id end) and
      (v_rel.transporte_id is not distinct from case when p_tipo='transporte' then p_servicio_id end) and
      (v_rel.traslado_id is not distinct from case when p_tipo='traslado' then p_servicio_id end));
  end if;
  v_id := private.registrar_gasto_base(p_idempotencia,p_proveedor_id,p_categoria_id,p_actividad,p_fecha,p_vencimiento,p_concepto,p_monto,p_notas,p_pago);
  if p_tipo is not null then
    insert into public.gastos_servicio(gasto_id,membresia_id,alquiler_id,transporte_id,traslado_id)
    values(v_id,case when p_tipo='membresia' then p_servicio_id end,case when p_tipo='alquiler' then p_servicio_id end,
      case when p_tipo='transporte' then p_servicio_id end,case when p_tipo='traslado' then p_servicio_id end)
    on conflict(gasto_id) do nothing;
  end if;
  return v_id;
end; $$;

create or replace function public.registrar_gasto_servicio(
  p_idempotencia uuid,p_proveedor_id uuid,p_categoria_id uuid,p_actividad public.actividad,
  p_fecha date,p_vencimiento date,p_concepto text,p_monto numeric,p_notas text,
  p_pago jsonb default null,p_tipo text default null,p_servicio_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform private.exigir_rol('administrador','finanzas');
  return private.registrar_gasto_servicio_base(p_idempotencia,p_proveedor_id,p_categoria_id,p_actividad,
    p_fecha,p_vencimiento,p_concepto,p_monto,p_notas,p_pago,p_tipo,p_servicio_id);
end; $$;

-- El personal (empleado o conductor) puede recibir salario o bono.
create function private.registrar_gasto_personal_base(
  p_idempotencia uuid,p_proveedor_id uuid,p_categoria_id uuid,p_actividad public.actividad,
  p_fecha date,p_vencimiento date,p_concepto text,p_monto numeric,p_notas text,
  p_pago jsonb,p_tipo text,p_servicio_id uuid,
  p_empleado_id uuid,p_conductor_id uuid
) returns uuid language plpgsql set search_path='' as $$
declare v_id uuid; v_rel public.gastos_personal; v_nombre text;
begin
  perform private.exigir_clave(p_idempotencia);
  -- Mismo bloqueo que el registro de gastos relacionados.
  perform pg_advisory_xact_lock(hashtextextended('gasto_servicio:'||p_idempotencia::text,0));
  if num_nonnulls(p_empleado_id,p_conductor_id)>1 or
     (num_nonnulls(p_empleado_id,p_conductor_id)>0 and p_proveedor_id is not null) then
    raise exception 'Seleccione un solo destinatario: empleado, conductor o proveedor.' using errcode='22023';
  end if;
  select id into v_id from public.gastos where idempotencia=p_idempotencia;
  if num_nonnulls(p_empleado_id,p_conductor_id)>0 and not exists (
    select 1 from public.categorias_gasto c join public.cuentas_contables cc on cc.id=c.cuenta_contable_id
    where c.id=p_categoria_id and cc.codigo in ('5300','5350')
  ) then
    raise exception 'Seleccione la categoría Salarios o Bonos para este pago al personal.' using errcode='22023';
  end if;
  if v_id is not null then
    select * into v_rel from public.gastos_personal where gasto_id=v_id;
    perform private.exigir_misma_operacion(
      v_rel.empleado_id is not distinct from p_empleado_id and
      v_rel.conductor_id is not distinct from p_conductor_id);
  else
    if p_empleado_id is not null then
      select nombre into v_nombre from public.empleados where id=p_empleado_id and activo for share;
    elsif p_conductor_id is not null then
      select nombre into v_nombre from public.conductores where id=p_conductor_id and activo for share;
    end if;
    if num_nonnulls(p_empleado_id,p_conductor_id)>0 and v_nombre is null then
      raise exception 'Seleccione un empleado o conductor activo.' using errcode='22023';
    end if;
  end if;
  v_id:=private.registrar_gasto_servicio_base(p_idempotencia,p_proveedor_id,p_categoria_id,p_actividad,
    p_fecha,p_vencimiento,p_concepto,p_monto,p_notas,p_pago,p_tipo,p_servicio_id);
  if v_nombre is not null then
    insert into public.gastos_personal(gasto_id,empleado_id,conductor_id,nombre_destinatario)
    values(v_id,p_empleado_id,p_conductor_id,v_nombre);
  end if;
  return v_id;
end $$;

create or replace function public.registrar_gasto_personal(
  p_idempotencia uuid,p_proveedor_id uuid,p_categoria_id uuid,p_actividad public.actividad,
  p_fecha date,p_vencimiento date,p_concepto text,p_monto numeric,p_notas text,
  p_pago jsonb default null,p_tipo text default null,p_servicio_id uuid default null,
  p_empleado_id uuid default null,p_conductor_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform private.exigir_rol('administrador','finanzas');
  return private.registrar_gasto_personal_base(p_idempotencia,p_proveedor_id,p_categoria_id,p_actividad,
    p_fecha,p_vencimiento,p_concepto,p_monto,p_notas,p_pago,p_tipo,p_servicio_id,p_empleado_id,p_conductor_id);
end $$;

revoke all on function private.registrar_gasto_base(uuid,uuid,uuid,public.actividad,date,date,text,numeric,text,jsonb) from public,anon,authenticated;
revoke all on function private.registrar_gasto_servicio_base(uuid,uuid,uuid,public.actividad,date,date,text,numeric,text,jsonb,text,uuid) from public,anon,authenticated;
revoke all on function private.registrar_gasto_personal_base(uuid,uuid,uuid,public.actividad,date,date,text,numeric,text,jsonb,text,uuid,uuid,uuid) from public,anon,authenticated;

-- 3. Bonos y gastos de un servicio: quien registra el servicio (también el
-- operador) puede registrarlos y pagarlos. Todas las líneas en una sola
-- transacción: o se registran todas o ninguna. La actividad sale del servicio.
create function public.registrar_gastos_de_servicio(p_tipo text, p_servicio_id uuid, p_lineas jsonb)
returns uuid[] language plpgsql security definer set search_path='' as $$
declare
  v_actividad public.actividad;
  v_linea jsonb;
  v_ids uuid[] := '{}';
  v_hoy date := (now() at time zone 'America/Tegucigalpa')::date;
  v_categoria uuid;
  v_n integer := 0;
begin
  perform private.exigir_rol('administrador','operador','finanzas');
  v_actividad := case p_tipo when 'membresia' then 'ambulancias' when 'alquiler' then 'alquileres'
    when 'transporte' then 'transportes' when 'traslado' then 'ambulancias' end::public.actividad;
  if v_actividad is null or p_servicio_id is null then
    raise exception 'Servicio no válido.' using errcode='22023';
  end if;
  if jsonb_typeof(p_lineas) is distinct from 'array' or jsonb_array_length(p_lineas) not between 1 and 20 then
    raise exception 'Indique entre 1 y 20 bonos o gastos.' using errcode='22023';
  end if;
  for v_linea in select x from jsonb_array_elements(p_lineas) x loop
    v_n := v_n + 1;
    if jsonb_typeof(v_linea) <> 'object' then
      raise exception 'Línea % no válida.', v_n using errcode='22023';
    end if;
    v_categoria := (v_linea->>'categoria_id')::uuid;
    if num_nonnulls(v_linea->>'empleado_id', v_linea->>'conductor_id', v_linea->>'proveedor_id') = 0 and exists (
      select 1 from public.categorias_gasto c join public.cuentas_contables cc on cc.id=c.cuenta_contable_id
      where c.id=v_categoria and cc.codigo='5350'
    ) then
      raise exception 'Indique a quién se le da el bono.' using errcode='22023';
    end if;
    v_ids := v_ids || private.registrar_gasto_personal_base(
      (v_linea->>'idempotencia')::uuid,
      (v_linea->>'proveedor_id')::uuid,
      v_categoria,
      v_actividad,
      v_hoy,
      null,
      v_linea->>'concepto',
      (v_linea->>'monto')::numeric,
      null,
      case when jsonb_typeof(v_linea->'pago') = 'object' then v_linea->'pago' end,
      p_tipo,
      p_servicio_id,
      (v_linea->>'empleado_id')::uuid,
      (v_linea->>'conductor_id')::uuid
    );
  end loop;
  return v_ids;
end $$;
revoke all on function public.registrar_gastos_de_servicio(text,uuid,jsonb) from public,anon;
grant execute on function public.registrar_gastos_de_servicio(text,uuid,jsonb) to authenticated;

create function public.registrar_pago_gasto_servicio(
  p_idempotencia uuid, p_gasto_id uuid, p_cuenta_dinero_id uuid, p_fecha date,
  p_metodo public.metodo_pago, p_referencia text, p_monto numeric
) returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform private.exigir_rol('administrador','operador','finanzas');
  if not exists (select 1 from public.gastos_servicio where gasto_id = p_gasto_id) then
    raise exception 'El gasto no pertenece a un servicio.' using errcode='22023';
  end if;
  return private.pagar_gasto(p_gasto_id, p_cuenta_dinero_id, p_fecha, p_metodo, p_referencia, p_monto, p_idempotencia);
end $$;
revoke all on function public.registrar_pago_gasto_servicio(uuid,uuid,uuid,date,public.metodo_pago,text,numeric) from public,anon;
grant execute on function public.registrar_pago_gasto_servicio(uuid,uuid,uuid,date,public.metodo_pago,text,numeric) to authenticated;

-- 4. Voucher: número consecutivo sin saltos para cada pago de gasto. Se
-- asigna en la misma transacción del pago (si el pago falla, no se consume).
create table public.comprobantes_pago (
  numero bigint primary key check (numero > 0),
  pago_gasto_id uuid not null unique references public.pagos_gasto(id),
  created_at timestamptz not null default now()
);

-- Pagos anteriores: numerados en orden de registro.
insert into public.comprobantes_pago (numero, pago_gasto_id, created_at)
select row_number() over (order by created_at, id), id, created_at from public.pagos_gasto;

create function private.numerar_comprobante()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('comprobantes_pago', 0));
  insert into public.comprobantes_pago (numero, pago_gasto_id)
  select coalesce(max(numero), 0) + 1, new.id from public.comprobantes_pago;
  return null;
end $$;
revoke all on function private.numerar_comprobante() from public,anon,authenticated;
create trigger numerar_comprobante after insert on public.pagos_gasto
for each row execute function private.numerar_comprobante();

create trigger impedir_borrado before delete on public.comprobantes_pago
for each row execute function private.impedir_borrado();
create trigger impedir_truncate before truncate on public.comprobantes_pago
for each statement execute function private.impedir_borrado();
create trigger impedir_modificacion before update on public.comprobantes_pago
for each row execute function private.impedir_modificacion();

-- 5. Lectura para el operador: solo los gastos ligados a un servicio, sus
-- pagos, vouchers y destinatario, y el catálogo de empleados para elegirlos.
create function private.es_gasto_de_servicio(p_gasto_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.gastos_servicio where gasto_id = p_gasto_id)
$$;
create function private.es_pago_de_servicio(p_pago_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.pagos_gasto p join public.gastos_servicio s on s.gasto_id = p.gasto_id where p.id = p_pago_id
  )
$$;
revoke all on function private.es_gasto_de_servicio(uuid) from public,anon;
revoke all on function private.es_pago_de_servicio(uuid) from public,anon;
grant execute on function private.es_gasto_de_servicio(uuid) to authenticated;
grant execute on function private.es_pago_de_servicio(uuid) to authenticated;

create policy gastos_select_servicio on public.gastos for select to authenticated
using ((select private.tiene_rol('operador')) and private.es_gasto_de_servicio(id));
create policy pagos_gasto_select_servicio on public.pagos_gasto for select to authenticated
using ((select private.tiene_rol('operador')) and private.es_gasto_de_servicio(gasto_id));
create policy gastos_servicio_select_operador on public.gastos_servicio for select to authenticated
using ((select private.tiene_rol('operador')));
create policy gastos_personal_select_servicio on public.gastos_personal for select to authenticated
using ((select private.tiene_rol('operador')) and private.es_gasto_de_servicio(gasto_id));
create policy empleados_select_operador on public.empleados for select to authenticated
using ((select private.tiene_rol('operador')));

alter table public.comprobantes_pago enable row level security;
revoke all on public.comprobantes_pago from anon,authenticated;
grant select on public.comprobantes_pago to authenticated;
create policy comprobantes_pago_select on public.comprobantes_pago for select to authenticated
using (
  (select private.tiene_rol('administrador','finanzas'))
  or ((select private.tiene_rol('operador')) and private.es_pago_de_servicio(pago_gasto_id))
);

-- 6. Bonos y gastos de cada servicio con su saldo y destinatario (respeta la
-- RLS de quien consulta).
create view public.gastos_de_servicio with (security_invoker = true) as
select s.gasto_id, s.membresia_id, s.alquiler_id, s.transporte_id, s.traslado_id,
  g.fecha, g.concepto, g.categoria_nombre, g.monto, g.pagado, g.pendiente, g.estado, g.created_at,
  coalesce(p.nombre_destinatario, g.proveedor_nombre) as destinatario
from public.gastos_servicio s
join public.saldos_gastos g on g.id = s.gasto_id
left join public.gastos_personal p on p.gasto_id = s.gasto_id;
revoke all on public.gastos_de_servicio from anon,authenticated;
grant select on public.gastos_de_servicio to authenticated;
