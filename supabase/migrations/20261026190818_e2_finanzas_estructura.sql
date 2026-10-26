-- E2 · Núcleo financiero: estructura.
--
-- * Ninguna tabla financiera admite INSERT/UPDATE/DELETE desde la API: solo
--   las funciones de public.registrar_* / reversar_* / anular_* (siguiente
--   migración) escriben, en una transacción que crea el documento, su
--   movimiento de dinero y su asiento.
-- * Saldos siempre derivados: cargos - aplicaciones, cobros - aplicaciones,
--   gastos - pagos y suma de movimientos por cuenta. No hay columnas de saldo.
-- * Los reversos crean un asiento espejo y un contramovimiento; los registros
--   originales solo cambian de estado. Nada se borra.
-- * Cada asiento se comprueba al confirmar la transacción: Debe = Haber y las
--   líneas de Caja y bancos coinciden con los movimientos de dinero.

create type public.estado_cargo as enum ('vigente', 'anulado');
create type public.estado_pago as enum ('confirmado', 'reversado');
create type public.estado_aplicacion as enum ('vigente', 'reversada');
create type public.estado_gasto as enum ('registrado', 'anulado');
create type public.metodo_pago as enum ('efectivo', 'transferencia', 'tarjeta', 'otro');
create type public.tipo_movimiento as enum ('ingreso', 'egreso', 'apertura', 'transferencia');
create type public.tipo_cuenta_contable as enum ('activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto');
create type public.estado_asiento as enum ('confirmado', 'reversado');
create type public.evento_financiero as enum ('registro', 'reverso');
-- Documento que origina un asiento o un movimiento de dinero.
create type public.origen_financiero as enum (
  'cargo', 'cobro', 'aplicacion', 'gasto', 'pago_gasto', 'transferencia', 'apertura'
);
-- Origen comercial de un cargo. E2 solo admite cargos administrativos
-- ('manual'); las etapas E3–E5 añadirán sus orígenes con ALTER TYPE.
create type public.origen_cargo as enum ('manual');

-- ---------------------------------------------------------------------------
-- Plan de cuentas mínimo y categorías de gasto
-- ---------------------------------------------------------------------------

create table public.cuentas_contables (
  id uuid primary key default gen_random_uuid(),
  codigo text not null constraint cuentas_contables_codigo_key unique
    check (codigo ~ '^[0-9]{4}$'),
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  tipo public.tipo_cuenta_contable not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.cuentas_contables is
  'Plan de cuentas mínimo. 1100 Caja y bancos se desglosa por cuenta de dinero en lineas_asiento.cuenta_dinero_id.';

insert into public.cuentas_contables (codigo, nombre, tipo) values
  ('1100', 'Caja y bancos', 'activo'),
  ('1200', 'Cuentas por cobrar', 'activo'),
  ('2100', 'Cuentas por pagar', 'pasivo'),
  ('2200', 'Anticipos de clientes', 'pasivo'),
  ('3100', 'Capital y saldos iniciales', 'patrimonio'),
  ('4100', 'Ingreso por membresías', 'ingreso'),
  ('4200', 'Ingreso ambulancias particulares', 'ingreso'),
  ('4300', 'Ingreso alquileres', 'ingreso'),
  ('4400', 'Ingreso transportes', 'ingreso'),
  ('5100', 'Gasto de combustible', 'gasto'),
  ('5200', 'Gasto de mantenimiento', 'gasto'),
  ('5300', 'Gasto de salarios', 'gasto'),
  ('5400', 'Gasto de servicios', 'gasto'),
  ('5900', 'Otros gastos', 'gasto');

-- Cada categoría lleva su cuenta de gasto (columna técnica para el asiento).
create table public.categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null constraint categorias_gasto_nombre_key unique
    check (length(btrim(nombre)) between 1 and 60),
  cuenta_contable_id uuid not null references public.cuentas_contables (id) on delete restrict,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index categorias_gasto_cuenta_idx on public.categorias_gasto (cuenta_contable_id);

insert into public.categorias_gasto (nombre, cuenta_contable_id)
select v.nombre, c.id
from (values
  ('Combustible', '5100'),
  ('Mantenimiento', '5200'),
  ('Salarios', '5300'),
  ('Servicios', '5400'),
  ('Otros', '5900')
) as v (nombre, codigo)
join public.cuentas_contables c on c.codigo = v.codigo;

-- ---------------------------------------------------------------------------
-- Clientes: cargos, cobros y aplicaciones
-- ---------------------------------------------------------------------------

create table public.cargos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  actividad public.actividad not null
    constraint cargos_cliente_actividad_operativa check (actividad <> 'general'),
  cuenta_ingreso_id uuid not null references public.cuentas_contables (id) on delete restrict,
  origen_tipo public.origen_cargo not null,
  origen_id uuid not null,
  concepto text not null check (length(btrim(concepto)) between 1 and 200),
  fecha date not null,
  vencimiento date,
  monto numeric(14, 2) not null check (monto > 0),
  estado public.estado_cargo not null default 'vigente',
  motivo_anulacion text,
  anulado_en timestamptz,
  anulado_por uuid references public.perfiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  -- Un mismo evento de origen no genera dos cargos (idempotencia).
  constraint cargos_cliente_origen_key unique (origen_tipo, origen_id),
  -- Destino de la FK compuesta de aplicaciones (mismo cliente).
  constraint cargos_cliente_id_cliente_key unique (id, cliente_id),
  constraint cargos_cliente_vencimiento_check check (vencimiento is null or vencimiento >= fecha),
  constraint cargos_cliente_anulacion_check
    check ((estado = 'anulado') = (anulado_en is not null and motivo_anulacion is not null))
);

create table public.cobros_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  cuenta_dinero_id uuid not null references public.cuentas_dinero (id) on delete restrict,
  fecha date not null,
  metodo public.metodo_pago not null,
  referencia text check (referencia is null or length(btrim(referencia)) between 1 and 80),
  monto numeric(14, 2) not null check (monto > 0),
  estado public.estado_pago not null default 'confirmado',
  idempotencia uuid not null constraint cobros_cliente_idempotencia_key unique,
  motivo_reverso text,
  reversado_en timestamptz,
  reversado_por uuid references public.perfiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint cobros_cliente_id_cliente_key unique (id, cliente_id),
  constraint cobros_cliente_reverso_check
    check ((estado = 'reversado') = (reversado_en is not null and motivo_reverso is not null))
);

-- Las FK compuestas garantizan en la base que cobro y cargo son del mismo cliente.
create table public.aplicaciones_cobro (
  id uuid primary key default gen_random_uuid(),
  cobro_id uuid not null,
  cargo_id uuid not null,
  cliente_id uuid not null,
  monto numeric(14, 2) not null check (monto > 0),
  fecha date not null,
  estado public.estado_aplicacion not null default 'vigente',
  -- Clave de la operación que la creó: un reintento no la repite.
  operacion_id uuid not null,
  motivo_reverso text,
  reversado_en timestamptz,
  reversado_por uuid references public.perfiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint aplicaciones_cobro_cobro_fkey foreign key (cobro_id, cliente_id)
    references public.cobros_cliente (id, cliente_id) on delete restrict,
  constraint aplicaciones_cobro_cargo_fkey foreign key (cargo_id, cliente_id)
    references public.cargos_cliente (id, cliente_id) on delete restrict,
  constraint aplicaciones_cobro_operacion_key unique (operacion_id, cobro_id, cargo_id),
  constraint aplicaciones_cobro_reverso_check
    check ((estado = 'reversada') = (reversado_en is not null and motivo_reverso is not null))
);

-- ---------------------------------------------------------------------------
-- Proveedores: gastos y pagos
-- ---------------------------------------------------------------------------

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references public.proveedores (id) on delete restrict,
  categoria_id uuid not null references public.categorias_gasto (id) on delete restrict,
  actividad public.actividad not null,
  fecha date not null,
  vencimiento date,
  concepto text not null check (length(btrim(concepto)) between 1 and 200),
  monto numeric(14, 2) not null check (monto > 0),
  notas text check (notas is null or length(btrim(notas)) between 1 and 1000),
  estado public.estado_gasto not null default 'registrado',
  idempotencia uuid not null constraint gastos_idempotencia_key unique,
  motivo_anulacion text,
  anulado_en timestamptz,
  anulado_por uuid references public.perfiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint gastos_vencimiento_check check (vencimiento is null or vencimiento >= fecha),
  constraint gastos_anulacion_check
    check ((estado = 'anulado') = (anulado_en is not null and motivo_anulacion is not null))
);

create table public.pagos_gasto (
  id uuid primary key default gen_random_uuid(),
  gasto_id uuid not null references public.gastos (id) on delete restrict,
  cuenta_dinero_id uuid not null references public.cuentas_dinero (id) on delete restrict,
  fecha date not null,
  metodo public.metodo_pago not null,
  referencia text check (referencia is null or length(btrim(referencia)) between 1 and 80),
  monto numeric(14, 2) not null check (monto > 0),
  estado public.estado_pago not null default 'confirmado',
  idempotencia uuid not null constraint pagos_gasto_idempotencia_key unique,
  motivo_reverso text,
  reversado_en timestamptz,
  reversado_por uuid references public.perfiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint pagos_gasto_reverso_check
    check ((estado = 'reversado') = (reversado_en is not null and motivo_reverso is not null))
);

-- ---------------------------------------------------------------------------
-- Caja y bancos
-- ---------------------------------------------------------------------------

-- Cabecera técnica: una transferencia genera dos movimientos atómicos.
create table public.transferencias (
  id uuid primary key default gen_random_uuid(),
  cuenta_origen_id uuid not null references public.cuentas_dinero (id) on delete restrict,
  cuenta_destino_id uuid not null references public.cuentas_dinero (id) on delete restrict,
  fecha date not null,
  monto numeric(14, 2) not null check (monto > 0),
  referencia text check (referencia is null or length(btrim(referencia)) between 1 and 120),
  estado public.estado_pago not null default 'confirmado',
  idempotencia uuid not null constraint transferencias_idempotencia_key unique,
  motivo_reverso text,
  reversado_en timestamptz,
  reversado_por uuid references public.perfiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint transferencias_cuentas_distintas check (cuenta_origen_id <> cuenta_destino_id),
  constraint transferencias_reverso_check
    check ((estado = 'reversado') = (reversado_en is not null and motivo_reverso is not null))
);

-- ---------------------------------------------------------------------------
-- Contabilidad automática
-- ---------------------------------------------------------------------------

-- Un asiento por evento: (origen, 'registro') y, si se corrige, (origen, 'reverso').
-- Los saldos contables suman todas las líneas: el reverso compensa al original,
-- que queda marcado 'reversado' solo a efectos informativos.
create table public.asientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  concepto text not null check (length(btrim(concepto)) between 1 and 250),
  actividad public.actividad,
  origen_tipo public.origen_financiero not null,
  origen_id uuid not null,
  evento public.evento_financiero not null,
  estado public.estado_asiento not null default 'confirmado',
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint asientos_origen_evento_key unique (origen_tipo, origen_id, evento)
);

create table public.lineas_asiento (
  id uuid primary key default gen_random_uuid(),
  asiento_id uuid not null references public.asientos (id) on delete restrict,
  cuenta_contable_id uuid not null references public.cuentas_contables (id) on delete restrict,
  -- Desglose de 1100 Caja y bancos por caja o banco concreto.
  cuenta_dinero_id uuid references public.cuentas_dinero (id) on delete restrict,
  debe numeric(14, 2) not null default 0,
  haber numeric(14, 2) not null default 0,
  constraint lineas_asiento_importes_check
    check (debe >= 0 and haber >= 0 and ((debe > 0) <> (haber > 0)))
);

-- Movimientos confirmados de cada caja o banco. El saldo es su suma.
-- Un reverso conserva el tipo del original con el signo contrario.
create table public.movimientos_dinero (
  id uuid primary key default gen_random_uuid(),
  cuenta_dinero_id uuid not null references public.cuentas_dinero (id) on delete restrict,
  fecha date not null,
  tipo public.tipo_movimiento not null,
  monto_con_signo numeric(14, 2) not null check (monto_con_signo <> 0),
  origen_tipo public.origen_financiero not null,
  origen_id uuid not null,
  evento public.evento_financiero not null,
  asiento_id uuid not null references public.asientos (id) on delete restrict,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint movimientos_dinero_evento_cuenta_key
    unique (origen_tipo, origen_id, evento, cuenta_dinero_id)
);

-- ---------------------------------------------------------------------------
-- Índices (FKs, fechas y estados)
-- ---------------------------------------------------------------------------

create index cargos_cliente_cliente_idx on public.cargos_cliente (cliente_id, estado, fecha);
create index cargos_cliente_fecha_idx on public.cargos_cliente (fecha desc);
create index cargos_cliente_vencimiento_idx on public.cargos_cliente (vencimiento) where estado = 'vigente';
create index cargos_cliente_cuenta_idx on public.cargos_cliente (cuenta_ingreso_id);
create index cargos_cliente_creado_por_idx on public.cargos_cliente (creado_por);
create index cargos_cliente_anulado_por_idx on public.cargos_cliente (anulado_por);

create index cobros_cliente_cliente_idx on public.cobros_cliente (cliente_id, estado, fecha);
create index cobros_cliente_fecha_idx on public.cobros_cliente (fecha desc);
create index cobros_cliente_cuenta_idx on public.cobros_cliente (cuenta_dinero_id);
create index cobros_cliente_creado_por_idx on public.cobros_cliente (creado_por);
create index cobros_cliente_reversado_por_idx on public.cobros_cliente (reversado_por);

create index aplicaciones_cobro_cobro_idx on public.aplicaciones_cobro (cobro_id, estado);
create index aplicaciones_cobro_cargo_idx on public.aplicaciones_cobro (cargo_id, estado);
create index aplicaciones_cobro_cliente_idx on public.aplicaciones_cobro (cliente_id);
create index aplicaciones_cobro_cobro_cliente_idx on public.aplicaciones_cobro (cobro_id, cliente_id);
create index aplicaciones_cobro_cargo_cliente_idx on public.aplicaciones_cobro (cargo_id, cliente_id);
create index aplicaciones_cobro_operacion_idx on public.aplicaciones_cobro (operacion_id);
create index aplicaciones_cobro_creado_por_idx on public.aplicaciones_cobro (creado_por);
create index aplicaciones_cobro_reversado_por_idx on public.aplicaciones_cobro (reversado_por);

create index gastos_fecha_idx on public.gastos (fecha desc);
create index gastos_estado_idx on public.gastos (estado, vencimiento);
create index gastos_proveedor_idx on public.gastos (proveedor_id);
create index gastos_categoria_idx on public.gastos (categoria_id);
create index gastos_actividad_idx on public.gastos (actividad, fecha);
create index gastos_creado_por_idx on public.gastos (creado_por);
create index gastos_anulado_por_idx on public.gastos (anulado_por);

create index pagos_gasto_gasto_idx on public.pagos_gasto (gasto_id, estado);
create index pagos_gasto_cuenta_idx on public.pagos_gasto (cuenta_dinero_id);
create index pagos_gasto_fecha_idx on public.pagos_gasto (fecha desc);
create index pagos_gasto_creado_por_idx on public.pagos_gasto (creado_por);
create index pagos_gasto_reversado_por_idx on public.pagos_gasto (reversado_por);

create index transferencias_origen_idx on public.transferencias (cuenta_origen_id);
create index transferencias_destino_idx on public.transferencias (cuenta_destino_id);
create index transferencias_fecha_idx on public.transferencias (fecha desc);
create index transferencias_creado_por_idx on public.transferencias (creado_por);
create index transferencias_reversado_por_idx on public.transferencias (reversado_por);

create index asientos_fecha_idx on public.asientos (fecha desc);
create index asientos_actividad_idx on public.asientos (actividad, fecha);
create index asientos_creado_por_idx on public.asientos (creado_por);
create index lineas_asiento_asiento_idx on public.lineas_asiento (asiento_id);
create index lineas_asiento_cuenta_idx on public.lineas_asiento (cuenta_contable_id);
create index lineas_asiento_cuenta_dinero_idx on public.lineas_asiento (cuenta_dinero_id);

create index movimientos_dinero_cuenta_idx on public.movimientos_dinero (cuenta_dinero_id, fecha);
create index movimientos_dinero_asiento_idx on public.movimientos_dinero (asiento_id);
create index movimientos_dinero_creado_por_idx on public.movimientos_dinero (creado_por);

-- ---------------------------------------------------------------------------
-- Invariantes en la base (protegen también a las funciones de etapas futuras)
-- ---------------------------------------------------------------------------

-- Aplicación: mismo cliente, cobro confirmado, cargo vigente, sin exceder el
-- disponible del cobro ni el pendiente del cargo. Bloquea cobro y cargo (en
-- ese orden) para que dos operaciones simultáneas no usen el mismo saldo.
create function private.validar_aplicacion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cobro public.cobros_cliente;
  v_cargo public.cargos_cliente;
  v_aplicado numeric(14, 2);
begin
  select * into v_cobro from public.cobros_cliente where id = new.cobro_id for update;
  select * into v_cargo from public.cargos_cliente where id = new.cargo_id for update;
  if v_cobro.id is null or v_cargo.id is null then
    raise exception 'Cobro o cargo no encontrado.' using errcode = 'P0002';
  end if;
  if v_cargo.cliente_id <> v_cobro.cliente_id then
    raise exception 'No se puede aplicar el cobro de un cliente al cargo de otro.'
      using errcode = '22023';
  end if;
  if v_cobro.estado <> 'confirmado' then
    raise exception 'El cobro está reversado y no tiene saldo disponible.' using errcode = '22023';
  end if;
  if v_cargo.estado <> 'vigente' then
    raise exception 'El cargo está anulado.' using errcode = '22023';
  end if;

  select coalesce(sum(monto), 0) into v_aplicado
  from public.aplicaciones_cobro where cobro_id = new.cobro_id and estado = 'vigente';
  if v_aplicado + new.monto > v_cobro.monto then
    raise exception 'El importe supera el saldo disponible del cobro (disponible: L %).',
      to_char(v_cobro.monto - v_aplicado, 'FM999,999,999,990.00') using errcode = '22023';
  end if;

  select coalesce(sum(monto), 0) into v_aplicado
  from public.aplicaciones_cobro where cargo_id = new.cargo_id and estado = 'vigente';
  if v_aplicado + new.monto > v_cargo.monto then
    raise exception 'El importe supera el saldo pendiente del cargo (pendiente: L %).',
      to_char(v_cargo.monto - v_aplicado, 'FM999,999,999,990.00') using errcode = '22023';
  end if;

  new.cliente_id := v_cobro.cliente_id;
  new.estado := 'vigente';
  new.created_at := now();
  new.creado_por := auth.uid();
  new.motivo_reverso := null;
  new.reversado_en := null;
  new.reversado_por := null;
  return new;
end;
$$;

create trigger validar_aplicacion
before insert on public.aplicaciones_cobro
for each row execute function private.validar_aplicacion();

-- Pago de gasto: gasto registrado y sin pagar más de lo adeudado.
create function private.validar_pago_gasto()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_gasto public.gastos;
  v_pagado numeric(14, 2);
begin
  select * into v_gasto from public.gastos where id = new.gasto_id for update;
  if v_gasto.id is null then
    raise exception 'Gasto no encontrado.' using errcode = 'P0002';
  end if;
  if v_gasto.estado <> 'registrado' then
    raise exception 'El gasto está anulado.' using errcode = '22023';
  end if;
  select coalesce(sum(monto), 0) into v_pagado
  from public.pagos_gasto where gasto_id = new.gasto_id and estado = 'confirmado';
  if v_pagado + new.monto > v_gasto.monto then
    raise exception 'El pago supera el saldo pendiente del gasto (pendiente: L %).',
      to_char(v_gasto.monto - v_pagado, 'FM999,999,999,990.00') using errcode = '22023';
  end if;
  new.estado := 'confirmado';
  new.created_at := now();
  new.creado_por := auth.uid();
  new.motivo_reverso := null;
  new.reversado_en := null;
  new.reversado_por := null;
  return new;
end;
$$;

create trigger validar_pago_gasto
before insert on public.pagos_gasto
for each row execute function private.validar_pago_gasto();

-- Comprobación al confirmar la transacción (trigger diferido): el asiento
-- tiene al menos dos líneas, Debe = Haber > 0, solo las líneas de 1100 llevan
-- caja/banco y, por cada caja/banco, sus líneas netas igualan sus movimientos.
create function private.verificar_asiento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- asientos no tiene asiento_id: se lee por JSON para usar una sola función.
  v_asiento uuid := coalesce((to_jsonb(new) ->> 'asiento_id')::uuid, new.id);
  v_lineas integer;
  v_debe numeric;
  v_haber numeric;
begin
  select count(*), coalesce(sum(debe), 0), coalesce(sum(haber), 0)
  into v_lineas, v_debe, v_haber
  from public.lineas_asiento where asiento_id = v_asiento;

  if v_lineas < 2 or v_debe <> v_haber or v_debe = 0 then
    raise exception 'Asiento descuadrado o incompleto (Debe %, Haber %).', v_debe, v_haber
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.lineas_asiento l
    join public.cuentas_contables c on c.id = l.cuenta_contable_id
    where l.asiento_id = v_asiento
      and (c.codigo = '1100') <> (l.cuenta_dinero_id is not null)
  ) then
    raise exception 'Las líneas de Caja y bancos deben indicar la caja o el banco.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from (
      select l.cuenta_dinero_id, sum(l.debe - l.haber) as neto
      from public.lineas_asiento l
      where l.asiento_id = v_asiento and l.cuenta_dinero_id is not null
      group by l.cuenta_dinero_id
    ) lineas
    full join (
      select m.cuenta_dinero_id, sum(m.monto_con_signo) as neto
      from public.movimientos_dinero m
      where m.asiento_id = v_asiento
      group by m.cuenta_dinero_id
    ) movimientos using (cuenta_dinero_id)
    where coalesce(lineas.neto, 0) <> coalesce(movimientos.neto, 0)
  ) then
    raise exception 'El asiento no coincide con los movimientos de caja y bancos.'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger verificar_asiento
after insert on public.asientos
deferrable initially deferred
for each row execute function private.verificar_asiento();

create constraint trigger verificar_asiento
after insert on public.lineas_asiento
deferrable initially deferred
for each row execute function private.verificar_asiento();

create constraint trigger verificar_asiento
after insert on public.movimientos_dinero
deferrable initially deferred
for each row execute function private.verificar_asiento();

-- Historial financiero: no se borra (ni siquiera el propietario por descuido).
create function private.impedir_borrado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Los registros financieros no se eliminan; corrija con un reverso o una anulación.'
    using errcode = '42501';
end;
$$;

-- Líneas y movimientos son inmutables.
create function private.impedir_modificacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Los asientos y movimientos confirmados no se modifican; registre un reverso.'
    using errcode = '42501';
end;
$$;

-- Documentos: solo pasan una vez del estado inicial (TG_ARGV[0]) a su estado
-- final y solo cambian las columnas listadas en TG_ARGV[1..].
create function private.proteger_documento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_permitidas text[] := tg_argv[1:];
begin
  if to_jsonb(old) ->> 'estado' <> tg_argv[0] then
    raise exception 'El registro ya fue reversado o anulado; no admite cambios.'
      using errcode = '42501';
  end if;
  if (to_jsonb(new) - v_permitidas) <> (to_jsonb(old) - v_permitidas) then
    raise exception 'Los datos de un registro financiero confirmado no se modifican; use un reverso.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'cuentas_contables', 'categorias_gasto', 'cargos_cliente', 'cobros_cliente',
    'aplicaciones_cobro', 'gastos', 'pagos_gasto', 'transferencias', 'asientos',
    'lineas_asiento', 'movimientos_dinero'
  ] loop
    execute format(
      'create trigger impedir_borrado before delete on public.%I
         for each row execute function private.impedir_borrado()', t);
    execute format(
      'create trigger impedir_truncate before truncate on public.%I
         for each statement execute function private.impedir_borrado()', t);
  end loop;

  foreach t in array array['lineas_asiento', 'movimientos_dinero'] loop
    execute format(
      'create trigger impedir_modificacion before update on public.%I
         for each row execute function private.impedir_modificacion()', t);
  end loop;
end;
$$;

create trigger proteger_documento before update on public.cargos_cliente
for each row execute function private.proteger_documento(
  'vigente', 'estado', 'motivo_anulacion', 'anulado_en', 'anulado_por');
create trigger proteger_documento before update on public.gastos
for each row execute function private.proteger_documento(
  'registrado', 'estado', 'motivo_anulacion', 'anulado_en', 'anulado_por');
create trigger proteger_documento before update on public.aplicaciones_cobro
for each row execute function private.proteger_documento(
  'vigente', 'estado', 'motivo_reverso', 'reversado_en', 'reversado_por');
create trigger proteger_documento before update on public.cobros_cliente
for each row execute function private.proteger_documento(
  'confirmado', 'estado', 'motivo_reverso', 'reversado_en', 'reversado_por');
create trigger proteger_documento before update on public.pagos_gasto
for each row execute function private.proteger_documento(
  'confirmado', 'estado', 'motivo_reverso', 'reversado_en', 'reversado_por');
create trigger proteger_documento before update on public.transferencias
for each row execute function private.proteger_documento(
  'confirmado', 'estado', 'motivo_reverso', 'reversado_en', 'reversado_por');
create trigger proteger_documento before update on public.asientos
for each row execute function private.proteger_documento('confirmado', 'estado');

revoke all on function private.validar_aplicacion() from public, anon, authenticated;
revoke all on function private.validar_pago_gasto() from public, anon, authenticated;
revoke all on function private.verificar_asiento() from public, anon, authenticated;
revoke all on function private.impedir_borrado() from public, anon, authenticated;
revoke all on function private.impedir_modificacion() from public, anon, authenticated;
revoke all on function private.proteger_documento() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Saldos derivados (vistas con los permisos de quien consulta)
-- ---------------------------------------------------------------------------

create view public.saldos_cargos with (security_invoker = true) as
select
  c.id, c.cliente_id, cl.nombre as cliente_nombre, c.actividad, c.cuenta_ingreso_id,
  c.origen_tipo, c.origen_id, c.concepto, c.fecha, c.vencimiento, c.monto, c.estado,
  c.motivo_anulacion, c.anulado_en, c.created_at,
  coalesce(a.aplicado, 0)::numeric(14, 2) as aplicado,
  (case when c.estado = 'vigente' then c.monto - coalesce(a.aplicado, 0) else 0 end)::numeric(14, 2)
    as pendiente
from public.cargos_cliente c
join public.clientes cl on cl.id = c.cliente_id
left join lateral (
  select sum(ap.monto) as aplicado
  from public.aplicaciones_cobro ap
  where ap.cargo_id = c.id and ap.estado = 'vigente'
) a on true;

create view public.saldos_cobros with (security_invoker = true) as
select
  c.id, c.cliente_id, cl.nombre as cliente_nombre, c.cuenta_dinero_id,
  cd.nombre as cuenta_nombre, c.fecha, c.metodo, c.referencia, c.monto, c.estado,
  c.motivo_reverso, c.reversado_en, c.created_at,
  coalesce(a.aplicado, 0)::numeric(14, 2) as aplicado,
  (case when c.estado = 'confirmado' then c.monto - coalesce(a.aplicado, 0) else 0 end)::numeric(14, 2)
    as disponible
from public.cobros_cliente c
join public.clientes cl on cl.id = c.cliente_id
join public.cuentas_dinero cd on cd.id = c.cuenta_dinero_id
left join lateral (
  select sum(ap.monto) as aplicado
  from public.aplicaciones_cobro ap
  where ap.cobro_id = c.id and ap.estado = 'vigente'
) a on true;

-- Saldo del cliente = cargos vigentes - aplicaciones; saldo a favor = cobros
-- confirmados no aplicados.
create view public.saldos_clientes with (security_invoker = true) as
select
  cl.id as cliente_id, cl.nombre as cliente_nombre, cl.activo,
  coalesce(cargos.total, 0)::numeric(14, 2) as total_cargos,
  coalesce(cargos.aplicado, 0)::numeric(14, 2) as total_aplicado,
  coalesce(cargos.pendiente, 0)::numeric(14, 2) as pendiente,
  coalesce(cobros.disponible, 0)::numeric(14, 2) as saldo_a_favor,
  cargos.proximo_vencimiento
from public.clientes cl
left join lateral (
  select sum(s.monto) as total, sum(s.aplicado) as aplicado, sum(s.pendiente) as pendiente,
    min(s.vencimiento) filter (where s.pendiente > 0) as proximo_vencimiento
  from public.saldos_cargos s
  where s.cliente_id = cl.id and s.estado = 'vigente'
) cargos on true
left join lateral (
  select sum(s.disponible) as disponible
  from public.saldos_cobros s
  where s.cliente_id = cl.id and s.estado = 'confirmado'
) cobros on true
where exists (select 1 from public.cargos_cliente c where c.cliente_id = cl.id)
   or exists (select 1 from public.cobros_cliente c where c.cliente_id = cl.id);

create view public.saldos_gastos with (security_invoker = true) as
select
  g.id, g.proveedor_id, p.nombre as proveedor_nombre, g.categoria_id,
  cg.nombre as categoria_nombre, g.actividad, g.fecha, g.vencimiento, g.concepto, g.monto,
  g.notas, g.estado, g.motivo_anulacion, g.anulado_en, g.created_at,
  coalesce(pg.pagado, 0)::numeric(14, 2) as pagado,
  (case when g.estado = 'registrado' then g.monto - coalesce(pg.pagado, 0) else 0 end)::numeric(14, 2)
    as pendiente
from public.gastos g
join public.categorias_gasto cg on cg.id = g.categoria_id
left join public.proveedores p on p.id = g.proveedor_id
left join lateral (
  select sum(x.monto) as pagado
  from public.pagos_gasto x
  where x.gasto_id = g.id and x.estado = 'confirmado'
) pg on true;

-- Solo administrador y finanzas consultan saldos de caja y bancos.
create view public.saldos_cuentas_dinero with (security_invoker = true) as
select
  cd.id, cd.nombre, cd.tipo, cd.banco, cd.numero_cuenta, cd.activo,
  coalesce(m.saldo, 0)::numeric(14, 2) as saldo,
  m.ultimo_movimiento
from public.cuentas_dinero cd
left join lateral (
  select sum(x.monto_con_signo) as saldo, max(x.fecha) as ultimo_movimiento
  from public.movimientos_dinero x
  where x.cuenta_dinero_id = cd.id
) m on true
where (select private.tiene_rol('administrador', 'finanzas'));

-- ---------------------------------------------------------------------------
-- Privilegios y RLS: solo lectura para usuarios activos según su rol
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'cuentas_contables', 'categorias_gasto', 'cargos_cliente', 'cobros_cliente',
    'aplicaciones_cobro', 'gastos', 'pagos_gasto', 'transferencias', 'asientos',
    'lineas_asiento', 'movimientos_dinero'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;

  -- Cobranza: los tres roles (el operador registra cobros).
  foreach t in array array['categorias_gasto', 'cargos_cliente', 'cobros_cliente', 'aplicaciones_cobro'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select private.es_usuario_activo()))', t || '_select', t);
  end loop;

  -- Tesorería, gastos y contabilidad: administrador y finanzas.
  foreach t in array array[
    'cuentas_contables', 'gastos', 'pagos_gasto', 'transferencias', 'asientos',
    'lineas_asiento', 'movimientos_dinero'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select private.tiene_rol(''administrador'', ''finanzas'')))', t || '_select', t);
  end loop;

  foreach t in array array[
    'saldos_cargos', 'saldos_cobros', 'saldos_clientes', 'saldos_gastos', 'saldos_cuentas_dinero'
  ] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end;
$$;
