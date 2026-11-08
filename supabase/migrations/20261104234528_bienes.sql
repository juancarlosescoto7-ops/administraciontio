-- Bienes de la empresa (activos fijos) en los estados financieros
-- (2026-11-04, a pedido del propietario; ESPECIFICACION_MAESTRA §16).
--
-- Registro de vehículos, terrenos, edificios, mobiliario, equipo y otros
-- bienes con su contabilidad automática. Como el resto del núcleo de E2:
-- * Solo las funciones public.registrar_bien / registrar_pago_bien /
--   dar_de_baja_bien / editar_bien / anular_bien / reversar_pago_bien /
--   actualizar_depreciaciones escriben (SECURITY DEFINER, rol verificado).
-- * Saldos derivados: valor en libros = costo − depreciación; por pagar =
--   costo − pagos confirmados. No hay columnas de saldo.
-- * Nada se borra: la anulación y el reverso registran el asiento espejo.
--
-- Plantillas contables (contabilidad gerencial simplificada):
--   bien que ya tenía   D 15x0 costo    H 1600 depreciación previa   H 3100 neto
--   compra              D 15x0 costo    H 2110 por pagar por bienes
--   pago de la compra   D 2110          H 1100 caja/banco
--   depreciación        D 5600          H 1600 (un asiento por bien y mes)
--   baja                D 1600 acumulada   D 5700 valor en libros   H 15x0 costo
-- Una compra de contado es una compra pagada completa el mismo día.
--
-- Depreciación lineal mensual: (costo − valor residual) / vida útil en meses,
-- redondeada a centavos; la última cuota ajusta el redondeo. Empieza el mes
-- siguiente a la fecha de registro, se contabiliza el último día de cada mes
-- ya cumplido y termina al llegar al valor residual. Los terrenos no se
-- deprecian. Sin cron: public.actualizar_depreciaciones() es idempotente
-- (UNIQUE bien + mes) y la aplicación la llama al abrir el panel, Bienes y
-- Reportes, como las mensualidades.
--
-- Registran administrador y finanzas; anulaciones y reversos, solo el
-- administrador. El operador no consulta bienes (igual que gastos).

-- ---------------------------------------------------------------------------
-- Plan de cuentas
-- ---------------------------------------------------------------------------

insert into public.cuentas_contables (codigo, nombre, tipo) values
  ('1510', 'Terrenos', 'activo'),
  ('1520', 'Edificios', 'activo'),
  ('1530', 'Vehículos', 'activo'),
  ('1540', 'Mobiliario y enseres', 'activo'),
  ('1550', 'Maquinaria y equipo', 'activo'),
  ('1590', 'Otros bienes', 'activo'),
  -- Cuenta correctora del activo: su saldo (debe − haber) es negativo.
  ('1600', 'Depreciación acumulada de bienes', 'activo'),
  ('2110', 'Cuentas por pagar por bienes', 'pasivo'),
  ('5600', 'Gasto por depreciación', 'gasto'),
  ('5700', 'Pérdida por baja de bienes', 'gasto');

create type public.clase_bien as enum ('terreno', 'edificio', 'vehiculo', 'mobiliario', 'equipo', 'otro');
create type public.origen_bien as enum ('existente', 'compra');
create type public.estado_bien as enum ('activo', 'dado_de_baja', 'anulado');

create function private.cuenta_bien(p_clase public.clase_bien)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_clase
    when 'terreno' then '1510'
    when 'edificio' then '1520'
    when 'vehiculo' then '1530'
    when 'mobiliario' then '1540'
    when 'equipo' then '1550'
    else '1590'
  end
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.bienes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  clase public.clase_bien not null,
  descripcion text check (descripcion is null or length(btrim(descripcion)) between 1 and 1000),
  -- Actividad a la que se carga la depreciación (general no se reparte).
  actividad public.actividad not null,
  vehiculo_id uuid references public.vehiculos (id) on delete restrict,
  origen public.origen_bien not null,
  proveedor_id uuid references public.proveedores (id) on delete restrict,
  fecha_adquisicion date not null,
  -- Fecha del asiento: la compra, o la incorporación a los libros de un bien que ya tenía.
  fecha_registro date not null,
  vencimiento date,
  costo numeric(14, 2) not null check (costo > 0),
  depreciacion_previa numeric(14, 2) not null default 0 check (depreciacion_previa >= 0),
  valor_residual numeric(14, 2) not null default 0 check (valor_residual >= 0),
  vida_util_meses integer check (vida_util_meses between 1 and 1200),
  estado public.estado_bien not null default 'activo',
  idempotencia uuid not null constraint bienes_idempotencia_key unique,
  fecha_baja date,
  motivo_baja text,
  baja_en timestamptz,
  baja_por uuid references public.perfiles (id) on delete restrict,
  motivo_anulacion text,
  anulado_en timestamptz,
  anulado_por uuid references public.perfiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint bienes_fechas_check check (fecha_registro >= fecha_adquisicion),
  constraint bienes_compra_check
    check (origen = 'existente' or (depreciacion_previa = 0 and fecha_registro = fecha_adquisicion)),
  constraint bienes_existente_check check (origen = 'compra' or (proveedor_id is null and vencimiento is null)),
  constraint bienes_vencimiento_check check (vencimiento is null or vencimiento >= fecha_registro),
  constraint bienes_depreciacion_check check (
    case when clase = 'terreno'
      then vida_util_meses is null and depreciacion_previa = 0 and valor_residual = 0
      else vida_util_meses is not null
    end),
  constraint bienes_valores_check check (depreciacion_previa + valor_residual <= costo),
  constraint bienes_vehiculo_check check (vehiculo_id is null or clase = 'vehiculo'),
  constraint bienes_baja_check check (
    (estado = 'dado_de_baja') = (fecha_baja is not null and motivo_baja is not null and baja_en is not null)),
  constraint bienes_baja_fecha_check check (fecha_baja is null or fecha_baja >= fecha_registro),
  constraint bienes_anulacion_check
    check ((estado = 'anulado') = (anulado_en is not null and motivo_anulacion is not null))
);

comment on table public.bienes is
  'Bienes de la empresa (activos fijos). Se escriben solo con public.registrar_bien y las funciones de bienes.';

-- Un vehículo del catálogo se registra como bien una sola vez.
create unique index bienes_vehiculo_key on public.bienes (vehiculo_id) where estado <> 'anulado';

create table public.depreciaciones_bien (
  id uuid primary key default gen_random_uuid(),
  bien_id uuid not null references public.bienes (id) on delete restrict,
  mes date not null check (mes = date_trunc('month', mes)::date),
  monto numeric(14, 2) not null check (monto > 0),
  -- 'reversado' solo al anular el bien (su asiento se reversa).
  estado public.estado_asiento not null default 'confirmado',
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint depreciaciones_bien_mes_key unique (bien_id, mes)
);

create table public.pagos_bien (
  id uuid primary key default gen_random_uuid(),
  bien_id uuid not null references public.bienes (id) on delete restrict,
  cuenta_dinero_id uuid not null references public.cuentas_dinero (id) on delete restrict,
  fecha date not null,
  metodo public.metodo_pago not null,
  referencia text check (referencia is null or length(btrim(referencia)) between 1 and 80),
  monto numeric(14, 2) not null check (monto > 0),
  estado public.estado_pago not null default 'confirmado',
  idempotencia uuid not null constraint pagos_bien_idempotencia_key unique,
  motivo_reverso text,
  reversado_en timestamptz,
  reversado_por uuid references public.perfiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  creado_por uuid references public.perfiles (id) on delete restrict,
  constraint pagos_bien_reverso_check
    check ((estado = 'reversado') = (reversado_en is not null and motivo_reverso is not null))
);

create index bienes_estado_idx on public.bienes (estado, clase);
create index bienes_fecha_idx on public.bienes (fecha_registro desc);
create index bienes_vehiculo_idx on public.bienes (vehiculo_id);
create index bienes_proveedor_idx on public.bienes (proveedor_id);
create index bienes_creado_por_idx on public.bienes (creado_por);
create index bienes_baja_por_idx on public.bienes (baja_por);
create index bienes_anulado_por_idx on public.bienes (anulado_por);
create index depreciaciones_bien_creado_por_idx on public.depreciaciones_bien (creado_por);
create index pagos_bien_bien_idx on public.pagos_bien (bien_id, estado);
create index pagos_bien_cuenta_idx on public.pagos_bien (cuenta_dinero_id);
create index pagos_bien_fecha_idx on public.pagos_bien (fecha desc);
create index pagos_bien_creado_por_idx on public.pagos_bien (creado_por);
create index pagos_bien_reversado_por_idx on public.pagos_bien (reversado_por);

-- ---------------------------------------------------------------------------
-- Invariantes en la base
-- ---------------------------------------------------------------------------

-- Pago de una compra: bien comprado, no anulado y sin pagar más que su costo.
-- SECURITY DEFINER como los demás triggers de integridad (lee todos los pagos).
create function private.validar_pago_bien()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bien public.bienes;
  v_pagado numeric(14, 2);
begin
  select * into v_bien from public.bienes where id = new.bien_id for update;
  if v_bien.id is null then
    raise exception 'Bien no encontrado.' using errcode = 'P0002';
  end if;
  if v_bien.origen <> 'compra' then
    raise exception 'Solo las compras tienen saldo por pagar.' using errcode = '22023';
  end if;
  if v_bien.estado = 'anulado' then
    raise exception 'El bien está anulado.' using errcode = '22023';
  end if;
  select coalesce(sum(monto), 0) into v_pagado
  from public.pagos_bien where bien_id = new.bien_id and estado = 'confirmado';
  if v_pagado + new.monto > v_bien.costo then
    raise exception 'El pago supera el saldo por pagar del bien (pendiente: L %).',
      to_char(v_bien.costo - v_pagado, 'FM999,999,999,990.00') using errcode = '22023';
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

create trigger validar_pago_bien
before insert on public.pagos_bien
for each row execute function private.validar_pago_bien();

do $$
declare
  t text;
begin
  foreach t in array array['bienes', 'depreciaciones_bien', 'pagos_bien'] loop
    execute format(
      'create trigger impedir_borrado before delete on public.%I
         for each row execute function private.impedir_borrado()', t);
    execute format(
      'create trigger impedir_truncate before truncate on public.%I
         for each statement execute function private.impedir_borrado()', t);
  end loop;
end;
$$;

-- Un bien activo admite corregir nombre y descripción y pasar una sola vez a
-- dado de baja o anulado; los importes, fechas y clase no cambian.
create trigger proteger_documento before update on public.bienes
for each row execute function private.proteger_documento(
  'activo', 'estado', 'nombre', 'descripcion', 'fecha_baja', 'motivo_baja', 'baja_en', 'baja_por',
  'motivo_anulacion', 'anulado_en', 'anulado_por');
create trigger proteger_documento before update on public.depreciaciones_bien
for each row execute function private.proteger_documento('confirmado', 'estado');
create trigger proteger_documento before update on public.pagos_bien
for each row execute function private.proteger_documento(
  'confirmado', 'estado', 'motivo_reverso', 'reversado_en', 'reversado_por');

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------

create function private.pagar_bien(
  p_bien_id uuid,
  p_cuenta_dinero_id uuid,
  p_fecha date,
  p_metodo public.metodo_pago,
  p_referencia text,
  p_monto numeric,
  p_idempotencia uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_bien public.bienes;
  v_existente public.pagos_bien;
  v_referencia text;
  v_id uuid;
  v_asiento uuid;
begin
  perform private.exigir_clave(p_idempotencia);
  perform private.validar_monto(p_monto);
  perform private.validar_fecha(p_fecha);
  if p_metodo is null then
    raise exception 'Seleccione el método de pago.' using errcode = '22023';
  end if;
  v_referencia := private.texto(p_referencia, 80, 'la referencia', false);
  perform private.exigir_cuenta_dinero(p_cuenta_dinero_id);

  -- El bloqueo del bien serializa sus pagos (y los reintentos).
  select * into v_bien from public.bienes where id = p_bien_id for update;
  if v_bien.id is null then
    raise exception 'Bien no encontrado.' using errcode = 'P0002';
  end if;

  select * into v_existente from public.pagos_bien where idempotencia = p_idempotencia;
  if v_existente.id is not null then
    perform private.exigir_misma_operacion(v_existente.bien_id = p_bien_id and v_existente.monto = p_monto);
    return v_existente.id;
  end if;

  if p_fecha < v_bien.fecha_registro then
    raise exception 'El pago no puede ser anterior a la compra (%).', to_char(v_bien.fecha_registro, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;

  insert into public.pagos_bien (bien_id, cuenta_dinero_id, fecha, metodo, referencia, monto, idempotencia)
  values (p_bien_id, p_cuenta_dinero_id, p_fecha, p_metodo, v_referencia, p_monto, p_idempotencia)
  returning id into v_id;

  v_asiento := private.registrar_asiento(
    p_fecha, 'Pago de bien: ' || v_bien.nombre, v_bien.actividad, 'pago_bien', v_id,
    jsonb_build_array(private.linea('2110', p_monto, 0), private.linea('1100', 0, p_monto, p_cuenta_dinero_id))
  );
  perform private.registrar_movimiento(p_cuenta_dinero_id, p_fecha, 'egreso', -p_monto, 'pago_bien', v_id, v_asiento);
  return v_id;
end;
$$;

-- Contabiliza las cuotas mensuales pendientes de un bien activo cuyos meses
-- terminan hasta p_hasta. Idempotente: retoma después del último mes
-- registrado. Devuelve cuántas cuotas registró.
create function private.depreciar_bien(p_bien_id uuid, p_hasta date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_bien public.bienes;
  v_cuota numeric(14, 2);
  v_depreciado numeric(14, 2);
  v_ultimo date;
  v_restante numeric(14, 2);
  v_mes date;
  v_fin date;
  v_monto numeric(14, 2);
  v_id uuid;
  v_cuotas integer := 0;
begin
  select * into v_bien from public.bienes where id = p_bien_id for update;
  if v_bien.id is null or v_bien.estado <> 'activo' or v_bien.vida_util_meses is null then
    return 0;
  end if;

  -- Al menos un centavo por mes, para que un importe muy pequeño también termine.
  v_cuota := greatest(round((v_bien.costo - v_bien.valor_residual) / v_bien.vida_util_meses, 2), 0.01);
  select coalesce(sum(monto), 0), max(mes) into v_depreciado, v_ultimo
  from public.depreciaciones_bien where bien_id = p_bien_id and estado = 'confirmado';
  v_restante := v_bien.costo - v_bien.valor_residual - v_bien.depreciacion_previa - v_depreciado;
  v_mes := (coalesce(v_ultimo, date_trunc('month', v_bien.fecha_registro)::date) + interval '1 month')::date;

  loop
    v_fin := (v_mes + interval '1 month' - interval '1 day')::date;
    exit when v_restante <= 0 or v_fin > p_hasta;
    -- La última cuota absorbe el redondeo acumulado (hasta medio centavo por
    -- mes de vida útil) en lugar de dejar un mes extra de centavos.
    v_monto := case
      when v_restante - v_cuota <= ceil(v_bien.vida_util_meses * 0.5) / 100 then v_restante
      else v_cuota
    end;

    insert into public.depreciaciones_bien (bien_id, mes, monto, creado_por)
    values (p_bien_id, v_mes, v_monto, auth.uid())
    returning id into v_id;

    perform private.registrar_asiento(
      v_fin, 'Depreciación de ' || v_bien.nombre || ' (' || to_char(v_mes, 'MM/YYYY') || ')', v_bien.actividad,
      'depreciacion', v_id,
      jsonb_build_array(private.linea('5600', v_monto, 0), private.linea('1600', 0, v_monto))
    );
    v_restante := v_restante - v_monto;
    v_cuotas := v_cuotas + 1;
    v_mes := (v_mes + interval '1 month')::date;
  end loop;
  return v_cuotas;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operaciones
-- ---------------------------------------------------------------------------

-- p_pago (opcional, solo compras): {cuenta_dinero_id, metodo, referencia,
-- monto}; se registra con la fecha de la compra y la misma clave. Una compra
-- de contado lleva el pago completo.
create function public.registrar_bien(
  p_idempotencia uuid,
  p_nombre text,
  p_clase public.clase_bien,
  p_descripcion text,
  p_actividad public.actividad,
  p_vehiculo_id uuid,
  p_origen public.origen_bien,
  p_proveedor_id uuid,
  p_fecha_adquisicion date,
  p_fecha_registro date,
  p_vencimiento date,
  p_costo numeric,
  p_depreciacion_previa numeric,
  p_valor_residual numeric,
  p_vida_util_meses integer,
  p_pago jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
  v_descripcion text;
  v_registro date;
  v_previa numeric := coalesce(p_depreciacion_previa, 0);
  v_residual numeric := coalesce(p_valor_residual, 0);
  v_cuenta text;
  v_existente public.bienes;
  v_id uuid;
  v_lineas jsonb;
begin
  perform private.exigir_rol('administrador', 'finanzas');
  perform private.exigir_clave(p_idempotencia);
  v_nombre := private.texto(p_nombre, 120, 'el nombre del bien', true);
  v_descripcion := private.texto(p_descripcion, 1000, 'la descripción', false);
  if p_clase is null then
    raise exception 'Seleccione la clase de bien.' using errcode = '22023';
  end if;
  if p_actividad is null then
    raise exception 'Seleccione la actividad.' using errcode = '22023';
  end if;
  if p_origen is null then
    raise exception 'Indique cómo entra el bien (ya lo tenía o compra).' using errcode = '22023';
  end if;
  perform private.validar_monto(p_costo);

  if p_origen = 'compra' then
    perform private.validar_fecha(p_fecha_adquisicion);
    v_registro := p_fecha_adquisicion;
    if v_previa <> 0 then
      raise exception 'Una compra no tiene depreciación previa.' using errcode = '22023';
    end if;
    if p_vencimiento < v_registro then
      raise exception 'El vencimiento no puede ser anterior a la compra.' using errcode = '22023';
    end if;
    if p_proveedor_id is not null
       and not exists (select 1 from public.proveedores where id = p_proveedor_id and activo) then
      raise exception 'Proveedor no encontrado o inactivo.' using errcode = '22023';
    end if;
  else
    -- La adquisición original solo informa (un edificio pudo comprarse antes de 2000);
    -- la incorporación es la fecha del asiento.
    if p_fecha_adquisicion is null or p_fecha_adquisicion < date '1900-01-01' or p_fecha_adquisicion > private.hoy() then
      raise exception 'Indique una fecha de adquisición válida, no posterior a hoy.' using errcode = '22023';
    end if;
    v_registro := coalesce(p_fecha_registro, private.hoy());
    perform private.validar_fecha(v_registro);
    if v_registro < p_fecha_adquisicion then
      raise exception 'La fecha de incorporación no puede ser anterior a la adquisición.' using errcode = '22023';
    end if;
    if p_proveedor_id is not null or p_vencimiento is not null or p_pago is not null then
      raise exception 'Un bien que ya tenía la empresa no tiene proveedor, vencimiento ni pago.' using errcode = '22023';
    end if;
  end if;

  if v_previa < 0 or v_previa <> round(v_previa, 2) or v_residual < 0 or v_residual <> round(v_residual, 2) then
    raise exception 'La depreciación previa y el valor residual no pueden ser negativos y llevan hasta 2 decimales.'
      using errcode = '22023';
  end if;
  if p_clase = 'terreno' then
    if p_vida_util_meses is not null or v_previa <> 0 or v_residual <> 0 then
      raise exception 'Los terrenos no se deprecian: deje vacíos la vida útil, el valor residual y la depreciación previa.'
        using errcode = '22023';
    end if;
  elsif p_vida_util_meses is null or p_vida_util_meses not between 1 and 1200 then
    raise exception 'Indique la vida útil en meses (entre 1 y 1200).' using errcode = '22023';
  end if;
  if v_previa + v_residual > p_costo then
    raise exception 'La depreciación previa más el valor residual no pueden superar el costo.' using errcode = '22023';
  end if;

  if p_vehiculo_id is not null then
    if p_clase <> 'vehiculo' then
      raise exception 'Solo un bien de clase vehículo se vincula a un vehículo.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.vehiculos where id = p_vehiculo_id) then
      raise exception 'Vehículo no encontrado.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.bienes
      where vehiculo_id = p_vehiculo_id and estado <> 'anulado' and idempotencia <> p_idempotencia
    ) then
      raise exception 'Ese vehículo ya está registrado como bien.' using errcode = '22023';
    end if;
  end if;

  insert into public.bienes (
    nombre, clase, descripcion, actividad, vehiculo_id, origen, proveedor_id, fecha_adquisicion,
    fecha_registro, vencimiento, costo, depreciacion_previa, valor_residual, vida_util_meses,
    idempotencia, creado_por
  )
  values (
    v_nombre, p_clase, v_descripcion, p_actividad, p_vehiculo_id, p_origen, p_proveedor_id, p_fecha_adquisicion,
    v_registro, p_vencimiento, p_costo, v_previa, v_residual, p_vida_util_meses,
    p_idempotencia, auth.uid()
  )
  on conflict (idempotencia) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_existente from public.bienes where idempotencia = p_idempotencia;
    perform private.exigir_misma_operacion(v_existente.costo = p_costo and v_existente.clase = p_clase);
    return v_existente.id;
  end if;

  v_cuenta := private.cuenta_bien(p_clase);
  if p_origen = 'compra' then
    v_lineas := jsonb_build_array(private.linea(v_cuenta, p_costo, 0), private.linea('2110', 0, p_costo));
  else
    v_lineas := jsonb_build_array(private.linea(v_cuenta, p_costo, 0));
    if v_previa > 0 then
      v_lineas := v_lineas || jsonb_build_array(private.linea('1600', 0, v_previa));
    end if;
    if p_costo - v_previa > 0 then
      v_lineas := v_lineas || jsonb_build_array(private.linea('3100', 0, p_costo - v_previa));
    end if;
  end if;
  perform private.registrar_asiento(
    v_registro, case when p_origen = 'compra' then 'Compra de bien: ' else 'Incorporación de bien: ' end || v_nombre,
    p_actividad, 'bien', v_id, v_lineas
  );

  if p_pago is not null and jsonb_typeof(p_pago) = 'object' then
    perform private.pagar_bien(
      v_id,
      (p_pago ->> 'cuenta_dinero_id')::uuid,
      v_registro,
      (p_pago ->> 'metodo')::public.metodo_pago,
      p_pago ->> 'referencia',
      (p_pago ->> 'monto')::numeric,
      p_idempotencia
    );
  end if;

  -- Un bien registrado con fecha pasada recibe de una vez las cuotas ya cumplidas.
  perform private.depreciar_bien(v_id, private.hoy());
  return v_id;
end;
$$;

create function public.registrar_pago_bien(
  p_idempotencia uuid,
  p_bien_id uuid,
  p_cuenta_dinero_id uuid,
  p_fecha date,
  p_metodo public.metodo_pago,
  p_referencia text,
  p_monto numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.exigir_rol('administrador', 'finanzas');
  return private.pagar_bien(p_bien_id, p_cuenta_dinero_id, p_fecha, p_metodo, p_referencia, p_monto, p_idempotencia);
end;
$$;

create function public.reversar_pago_bien(p_pago_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_pago public.pagos_bien;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);

  select * into v_pago from public.pagos_bien where id = p_pago_id for update;
  if v_pago.id is null then
    raise exception 'Pago no encontrado.' using errcode = 'P0002';
  end if;
  if v_pago.estado <> 'confirmado' then
    raise exception 'El pago ya fue reversado.' using errcode = '22023';
  end if;

  update public.pagos_bien
  set estado = 'reversado', motivo_reverso = v_motivo, reversado_en = now(), reversado_por = auth.uid()
  where id = p_pago_id;

  perform private.reversar_asiento('pago_bien', p_pago_id, 'Reverso de pago de bien');
  perform private.registrar_bitacora(
    'pagos_bien', p_pago_id, 'reversar_pago_bien', v_motivo,
    jsonb_build_object('estado', v_pago.estado, 'monto', v_pago.monto, 'bien_id', v_pago.bien_id),
    jsonb_build_object('estado', 'reversado')
  );
end;
$$;

-- Pone al día la depreciación de todos los bienes activos. Devuelve cuántas
-- cuotas registró (0 si ya estaba al día).
create function public.actualizar_depreciaciones()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bien uuid;
  v_hoy date := private.hoy();
  v_cuotas integer := 0;
begin
  perform private.exigir_rol('administrador', 'finanzas');
  for v_bien in
    select id from public.bienes
    where estado = 'activo' and vida_util_meses is not null
    order by created_at, id
  loop
    v_cuotas := v_cuotas + private.depreciar_bien(v_bien, v_hoy);
  end loop;
  return v_cuotas;
end;
$$;

-- Baja (venta, desecho, pérdida): primero se contabilizan los meses cumplidos
-- hasta la fecha de baja; luego sale el costo y su depreciación acumulada, y
-- el valor en libros restante pasa a 5700 Pérdida por baja de bienes. Lo que
-- se deba por la compra sigue pendiente.
create function public.dar_de_baja_bien(p_bien_id uuid, p_fecha date, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_bien public.bienes;
  v_ultimo date;
  v_acumulada numeric(14, 2);
  v_libros numeric(14, 2);
  v_lineas jsonb := '[]'::jsonb;
begin
  perform private.exigir_rol('administrador', 'finanzas');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);
  perform private.validar_fecha(p_fecha);

  select * into v_bien from public.bienes where id = p_bien_id for update;
  if v_bien.id is null then
    raise exception 'Bien no encontrado.' using errcode = 'P0002';
  end if;
  if v_bien.estado <> 'activo' then
    raise exception 'El bien ya fue dado de baja o anulado.' using errcode = '22023';
  end if;
  if p_fecha < v_bien.fecha_registro then
    raise exception 'La baja no puede ser anterior al registro del bien (%).', to_char(v_bien.fecha_registro, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;
  select max(mes) into v_ultimo from public.depreciaciones_bien where bien_id = p_bien_id and estado = 'confirmado';
  if v_ultimo is not null and (v_ultimo + interval '1 month' - interval '1 day')::date > p_fecha then
    raise exception 'Ya hay depreciación registrada hasta el %: la baja debe ser en esa fecha o después.',
      to_char((v_ultimo + interval '1 month' - interval '1 day')::date, 'DD/MM/YYYY') using errcode = '22023';
  end if;

  perform private.depreciar_bien(p_bien_id, p_fecha);
  select v_bien.depreciacion_previa + coalesce(sum(monto), 0) into v_acumulada
  from public.depreciaciones_bien where bien_id = p_bien_id and estado = 'confirmado';
  v_libros := v_bien.costo - v_acumulada;

  update public.bienes
  set estado = 'dado_de_baja', fecha_baja = p_fecha, motivo_baja = v_motivo, baja_en = now(), baja_por = auth.uid()
  where id = p_bien_id;

  if v_acumulada > 0 then
    v_lineas := v_lineas || jsonb_build_array(private.linea('1600', v_acumulada, 0));
  end if;
  if v_libros > 0 then
    v_lineas := v_lineas || jsonb_build_array(private.linea('5700', v_libros, 0));
  end if;
  v_lineas := v_lineas || jsonb_build_array(private.linea(private.cuenta_bien(v_bien.clase), 0, v_bien.costo));
  perform private.registrar_asiento(
    p_fecha, 'Baja de bien: ' || v_bien.nombre, v_bien.actividad, 'baja_bien', p_bien_id, v_lineas
  );
  perform private.registrar_bitacora(
    'bienes', p_bien_id, 'dar_de_baja_bien', v_motivo,
    jsonb_build_object('estado', v_bien.estado, 'costo', v_bien.costo, 'depreciacion_acumulada', v_acumulada),
    jsonb_build_object('estado', 'dado_de_baja', 'fecha_baja', p_fecha, 'valor_en_libros', v_libros)
  );
end;
$$;

-- Corrige nombre y descripción de un bien activo; los importes no se editan.
create function public.editar_bien(p_bien_id uuid, p_nombre text, p_descripcion text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bien public.bienes;
  v_nombre text;
  v_descripcion text;
begin
  perform private.exigir_rol('administrador', 'finanzas');
  v_nombre := private.texto(p_nombre, 120, 'el nombre del bien', true);
  v_descripcion := private.texto(p_descripcion, 1000, 'la descripción', false);

  select * into v_bien from public.bienes where id = p_bien_id for update;
  if v_bien.id is null then
    raise exception 'Bien no encontrado.' using errcode = 'P0002';
  end if;
  if v_bien.estado <> 'activo' then
    raise exception 'Solo se editan los bienes en uso.' using errcode = '22023';
  end if;
  if v_bien.nombre = v_nombre and v_bien.descripcion is not distinct from v_descripcion then
    return;
  end if;

  update public.bienes set nombre = v_nombre, descripcion = v_descripcion where id = p_bien_id;
  perform private.registrar_bitacora(
    'bienes', p_bien_id, 'editar_bien', null,
    jsonb_build_object('nombre', v_bien.nombre, 'descripcion', v_bien.descripcion),
    jsonb_build_object('nombre', v_nombre, 'descripcion', v_descripcion)
  );
end;
$$;

-- Corrección de un registro equivocado: reversa el asiento del bien y el de
-- cada depreciación. Con pagos confirmados, primero se reversan los pagos
-- (cada reverso devuelve dinero a su caja/banco y debe decidirse a propósito).
create function public.anular_bien(p_bien_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_bien public.bienes;
  v_depreciacion public.depreciaciones_bien;
  v_cuotas integer := 0;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);

  select * into v_bien from public.bienes where id = p_bien_id for update;
  if v_bien.id is null then
    raise exception 'Bien no encontrado.' using errcode = 'P0002';
  end if;
  if v_bien.estado <> 'activo' then
    raise exception 'Solo se anula un bien en uso; uno dado de baja ya no admite cambios.' using errcode = '22023';
  end if;
  if exists (select 1 from public.pagos_bien where bien_id = p_bien_id and estado = 'confirmado') then
    raise exception 'El bien tiene pagos confirmados; reverse primero esos pagos.' using errcode = '22023';
  end if;

  update public.bienes
  set estado = 'anulado', motivo_anulacion = v_motivo, anulado_en = now(), anulado_por = auth.uid()
  where id = p_bien_id;
  perform private.reversar_asiento('bien', p_bien_id, 'Anulación de bien: ' || v_bien.nombre);

  for v_depreciacion in
    select * from public.depreciaciones_bien
    where bien_id = p_bien_id and estado = 'confirmado'
    order by mes
  loop
    update public.depreciaciones_bien set estado = 'reversado' where id = v_depreciacion.id;
    perform private.reversar_asiento(
      'depreciacion', v_depreciacion.id,
      'Anulación de depreciación de ' || v_bien.nombre || ' (' || to_char(v_depreciacion.mes, 'MM/YYYY') || ')'
    );
    v_cuotas := v_cuotas + 1;
  end loop;

  perform private.registrar_bitacora(
    'bienes', p_bien_id, 'anular_bien', v_motivo,
    jsonb_build_object('estado', v_bien.estado, 'costo', v_bien.costo, 'depreciaciones', v_cuotas),
    jsonb_build_object('estado', 'anulado')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Saldos derivados
-- ---------------------------------------------------------------------------

create view public.saldos_bienes with (security_invoker = true) as
select
  b.id, b.nombre, b.clase, b.descripcion, b.actividad, b.vehiculo_id, v.nombre as vehiculo_nombre,
  b.origen, b.proveedor_id, p.nombre as proveedor_nombre, b.fecha_adquisicion, b.fecha_registro,
  b.vencimiento, b.costo, b.depreciacion_previa, b.valor_residual, b.vida_util_meses, b.estado,
  b.fecha_baja, b.motivo_baja, b.motivo_anulacion, b.anulado_en, b.created_at,
  (case when b.vida_util_meses is not null
    then greatest(round((b.costo - b.valor_residual) / b.vida_util_meses, 2), 0.01) end)::numeric(14, 2)
    as cuota_mensual,
  (b.depreciacion_previa + coalesce(d.depreciado, 0))::numeric(14, 2) as depreciacion_acumulada,
  (case when b.estado = 'activo' then b.costo - b.depreciacion_previa - coalesce(d.depreciado, 0) else 0 end)::numeric(14, 2)
    as valor_en_libros,
  d.ultimo_mes,
  coalesce(pg.pagado, 0)::numeric(14, 2) as pagado,
  (case when b.origen = 'compra' and b.estado <> 'anulado' then b.costo - coalesce(pg.pagado, 0) else 0 end)::numeric(14, 2)
    as por_pagar
from public.bienes b
left join public.vehiculos v on v.id = b.vehiculo_id
left join public.proveedores p on p.id = b.proveedor_id
left join lateral (
  select sum(x.monto) as depreciado, max(x.mes) as ultimo_mes
  from public.depreciaciones_bien x
  where x.bien_id = b.id and x.estado = 'confirmado'
) d on true
left join lateral (
  select sum(x.monto) as pagado
  from public.pagos_bien x
  where x.bien_id = b.id and x.estado = 'confirmado'
) pg on true;

-- ---------------------------------------------------------------------------
-- Comprobaciones: se agregan los controles 8–10 (bienes, depreciación y
-- por pagar por bienes); los controles 1–7 no cambian.
-- ---------------------------------------------------------------------------

create or replace function public.comprobaciones_financieras(p_fecha date)
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
  v_bienes numeric;
  v_1600 numeric;
  v_2110 numeric;
  v_costo_bienes numeric;
  v_depreciacion_bienes numeric;
  v_por_pagar_bienes numeric;
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
    coalesce(sum(saldo) filter (where codigo = '2200'), 0),
    coalesce(sum(saldo) filter (where codigo in ('1510', '1520', '1530', '1540', '1550', '1590')), 0),
    -- En positivo: la cuenta correctora tiene saldo deudor negativo.
    -coalesce(sum(saldo) filter (where codigo = '1600'), 0),
    coalesce(sum(saldo) filter (where codigo = '2110'), 0)
  into v_activo, v_pasivo, v_patrimonio, v_resultado, v_debe, v_haber, v_1100, v_1200, v_2100, v_2200,
    v_bienes, v_1600, v_2110
  from private.saldos_al(p_fecha);

  select count(*) into v_descuadrados
  from (
    select x.id
    from public.asientos x left join public.lineas_asiento l on l.asiento_id = x.id
    where x.fecha <= p_fecha
    group by x.id
    having count(l.id) < 2 or coalesce(sum(l.debe), 0) <> coalesce(sum(l.haber), 0)
  ) d;

  select
    coalesce(sum(s.costo) filter (where s.estado = 'activo'), 0),
    coalesce(sum(s.depreciacion_acumulada) filter (where s.estado = 'activo'), 0),
    coalesce(sum(s.por_pagar), 0)
  into v_costo_bienes, v_depreciacion_bienes, v_por_pagar_bienes
  from public.saldos_bienes s;

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
  union all
  select 8, 'Bienes (1510–1590) = costo de los bienes en uso', v_bienes::numeric(14, 2),
    case when v_actual then v_costo_bienes end::numeric(14, 2),
    case when v_actual then v_bienes - v_costo_bienes end::numeric(14, 2),
    case when v_actual then v_bienes = v_costo_bienes end,
    case when v_actual then null else v_nota_hoy end
  union all
  select 9, 'Depreciación acumulada (1600) = previa más cuotas de los bienes en uso', v_1600::numeric(14, 2),
    case when v_actual then v_depreciacion_bienes end::numeric(14, 2),
    case when v_actual then v_1600 - v_depreciacion_bienes end::numeric(14, 2),
    case when v_actual then v_1600 = v_depreciacion_bienes end,
    case when v_actual then null else v_nota_hoy end
  union all
  select 10, 'Por pagar por bienes (2110) = pendiente de las compras', v_2110::numeric(14, 2),
    case when v_actual then v_por_pagar_bienes end::numeric(14, 2),
    case when v_actual then v_2110 - v_por_pagar_bienes end::numeric(14, 2),
    case when v_actual then v_2110 = v_por_pagar_bienes end,
    case when v_actual then null else v_nota_hoy end
  order by 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegios y RLS: lectura para administrador y finanzas
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  f regprocedure;
begin
  foreach t in array array['bienes', 'depreciaciones_bien', 'pagos_bien'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using ((select private.tiene_rol(''administrador'', ''finanzas'')))', t || '_select', t);
  end loop;

  revoke all on public.saldos_bienes from anon, authenticated;
  grant select on public.saldos_bienes to authenticated;

  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'registrar_bien', 'registrar_pago_bien', 'reversar_pago_bien', 'actualizar_depreciaciones',
      'dar_de_baja_bien', 'editar_bien', 'anular_bien'
    ])
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = any (array[
      'cuenta_bien', 'validar_pago_bien', 'pagar_bien', 'depreciar_bien'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
