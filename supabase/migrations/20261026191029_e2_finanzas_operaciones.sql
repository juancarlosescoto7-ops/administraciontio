-- E2 · Núcleo financiero: operaciones.
--
-- Únicas vías de escritura del núcleo financiero. Cada función pública:
-- * es SECURITY DEFINER con search_path vacío y verifica en su primera línea
--   que auth.uid() tenga perfil activo con un rol autorizado;
-- * valida los datos y registra documento, movimiento de dinero y asiento en
--   la misma transacción (todo o nada);
-- * es idempotente: recibe una clave uuid generada por el formulario y, ante
--   un reintento con la misma clave, devuelve lo ya registrado sin repetirlo.
-- Errores de negocio: 22023 (dato no válido), 42501 (permiso), P0002 (no
-- encontrado). Los mensajes están en español y pueden mostrarse al usuario.
--
-- Plantillas contables (contabilidad gerencial simplificada):
--   cargo           D 1200 CxC              H 4x00 ingreso de la línea
--   cobro           D 1100 caja/banco       H 2200 anticipos de clientes
--   aplicación      D 2200 anticipos        H 1200 CxC
--   gasto           D 5x00 gasto            H 2100 CxP
--   pago de gasto   D 2100 CxP              H 1100 caja/banco
--   transferencia   D 1100 destino          H 1100 origen
--   saldo inicial   D 1100 caja/banco       H 3100 capital y saldos iniciales
-- Un reverso registra el asiento espejo (y los contramovimientos) con fecha de hoy.

-- ---------------------------------------------------------------------------
-- Auxiliares (esquema private, sin acceso desde la API)
-- ---------------------------------------------------------------------------

create function private.hoy()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Tegucigalpa')::date
$$;

create function private.lempiras(p_monto numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'L ' || to_char(p_monto, 'FM999,999,999,990.00')
$$;

create function private.exigir_rol(variadic p_roles public.rol_usuario[])
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.tiene_rol(variadic p_roles) then
    raise exception 'Su rol no permite realizar esta operación.' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function private.exigir_clave(p_idempotencia uuid)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_idempotencia is null then
    raise exception 'Falta la clave de la operación.' using errcode = '22023';
  end if;
end;
$$;

-- Una clave ya usada solo es válida para repetir exactamente la misma operación.
create function private.exigir_misma_operacion(p_coincide boolean)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not coalesce(p_coincide, false) then
    raise exception 'La clave de la operación ya se usó con otros datos.' using errcode = '22023';
  end if;
end;
$$;

create function private.validar_monto(p_monto numeric)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_monto is null or p_monto <= 0 or p_monto <> round(p_monto, 2) or p_monto > 999999999999.99 then
    raise exception 'El importe debe ser mayor que cero y tener como máximo 2 decimales.'
      using errcode = '22023';
  end if;
end;
$$;

create function private.validar_fecha(p_fecha date)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_fecha is null or p_fecha < date '2000-01-01' then
    raise exception 'Indique una fecha válida.' using errcode = '22023';
  end if;
  if p_fecha > private.hoy() then
    raise exception 'La fecha no puede ser posterior a hoy.' using errcode = '22023';
  end if;
end;
$$;

create function private.texto(p_valor text, p_maximo integer, p_campo text, p_requerido boolean)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_texto text := nullif(btrim(coalesce(p_valor, '')), '');
begin
  if v_texto is null and p_requerido then
    raise exception 'Indique %.', p_campo using errcode = '22023';
  end if;
  if length(v_texto) > p_maximo then
    raise exception 'El campo % admite como máximo % caracteres.', p_campo, p_maximo
      using errcode = '22023';
  end if;
  return v_texto;
end;
$$;

create function private.exigir_cuenta_dinero(p_cuenta_dinero_id uuid)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_nombre text;
begin
  select nombre into v_nombre from public.cuentas_dinero where id = p_cuenta_dinero_id and activo;
  if v_nombre is null then
    raise exception 'Seleccione una caja o banco activo.' using errcode = '22023';
  end if;
  return v_nombre;
end;
$$;

-- Línea de cobro de cada cuenta de ingreso del plan mínimo.
create function private.actividad_de_ingreso(p_codigo text)
returns public.actividad
language plpgsql
immutable
set search_path = ''
as $$
begin
  return case p_codigo
    when '4100' then 'ambulancias'::public.actividad
    when '4200' then 'ambulancias'::public.actividad
    when '4300' then 'alquileres'::public.actividad
    when '4400' then 'transportes'::public.actividad
  end;
end;
$$;

create function private.linea(p_cuenta text, p_debe numeric, p_haber numeric, p_cuenta_dinero_id uuid default null)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'cuenta', p_cuenta, 'debe', p_debe, 'haber', p_haber, 'cuenta_dinero_id', p_cuenta_dinero_id
  )
$$;

create function private.registrar_asiento(
  p_fecha date,
  p_concepto text,
  p_actividad public.actividad,
  p_origen_tipo public.origen_financiero,
  p_origen_id uuid,
  p_lineas jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_linea jsonb;
  v_cuenta uuid;
begin
  insert into public.asientos (fecha, concepto, actividad, origen_tipo, origen_id, evento, creado_por)
  values (p_fecha, left(p_concepto, 250), p_actividad, p_origen_tipo, p_origen_id, 'registro', auth.uid())
  returning id into v_id;

  for v_linea in select value from jsonb_array_elements(p_lineas) loop
    select id into v_cuenta
    from public.cuentas_contables where codigo = v_linea ->> 'cuenta' and activo;
    if v_cuenta is null then
      raise exception 'La cuenta contable % no existe.', v_linea ->> 'cuenta';
    end if;
    insert into public.lineas_asiento (asiento_id, cuenta_contable_id, cuenta_dinero_id, debe, haber)
    values (
      v_id, v_cuenta, (v_linea ->> 'cuenta_dinero_id')::uuid,
      (v_linea ->> 'debe')::numeric, (v_linea ->> 'haber')::numeric
    );
  end loop;
  -- El cuadre (Debe = Haber, caja/banco = movimientos) se verifica al confirmar.
  return v_id;
end;
$$;

create function private.registrar_movimiento(
  p_cuenta_dinero_id uuid,
  p_fecha date,
  p_tipo public.tipo_movimiento,
  p_monto_con_signo numeric,
  p_origen_tipo public.origen_financiero,
  p_origen_id uuid,
  p_asiento_id uuid
)
returns void
language sql
set search_path = ''
as $$
  insert into public.movimientos_dinero (
    cuenta_dinero_id, fecha, tipo, monto_con_signo, origen_tipo, origen_id, evento, asiento_id, creado_por
  )
  values (
    p_cuenta_dinero_id, p_fecha, p_tipo, p_monto_con_signo, p_origen_tipo, p_origen_id, 'registro',
    p_asiento_id, auth.uid()
  );
$$;

-- Reverso genérico: marca el asiento original, registra su espejo y los
-- contramovimientos de caja/banco. Bloquea el asiento: no se reversa dos veces.
create function private.reversar_asiento(
  p_origen_tipo public.origen_financiero,
  p_origen_id uuid,
  p_concepto text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_original public.asientos;
  v_id uuid;
begin
  select * into v_original
  from public.asientos
  where origen_tipo = p_origen_tipo and origen_id = p_origen_id and evento = 'registro'
  for update;
  if v_original.id is null or v_original.estado <> 'confirmado' then
    raise exception 'El asiento original no existe o ya fue reversado.' using errcode = '22023';
  end if;

  update public.asientos set estado = 'reversado' where id = v_original.id;

  insert into public.asientos (fecha, concepto, actividad, origen_tipo, origen_id, evento, creado_por)
  values (private.hoy(), left(p_concepto, 250), v_original.actividad, p_origen_tipo, p_origen_id, 'reverso', auth.uid())
  returning id into v_id;

  insert into public.lineas_asiento (asiento_id, cuenta_contable_id, cuenta_dinero_id, debe, haber)
  select v_id, l.cuenta_contable_id, l.cuenta_dinero_id, l.haber, l.debe
  from public.lineas_asiento l
  where l.asiento_id = v_original.id;

  insert into public.movimientos_dinero (
    cuenta_dinero_id, fecha, tipo, monto_con_signo, origen_tipo, origen_id, evento, asiento_id, creado_por
  )
  select m.cuenta_dinero_id, private.hoy(), m.tipo, -m.monto_con_signo, m.origen_tipo, m.origen_id,
    'reverso', v_id, auth.uid()
  from public.movimientos_dinero m
  where m.asiento_id = v_original.id;

  return v_id;
end;
$$;

create function private.registrar_bitacora(
  p_entidad text, p_registro_id uuid, p_accion text, p_motivo text, p_antes jsonb, p_despues jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into public.bitacora (actor_id, entidad, registro_id, accion, motivo, antes, despues)
  values (auth.uid(), p_entidad, p_registro_id, p_accion, p_motivo, p_antes, p_despues);
$$;

-- Aplica parte de un cobro a un cargo. El trigger validar_aplicacion bloquea
-- cobro y cargo y comprueba cliente, estados y saldos.
create function private.aplicar(
  p_cobro_id uuid, p_cargo_id uuid, p_monto numeric, p_fecha date, p_operacion_id uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_cargo public.cargos_cliente;
begin
  perform private.validar_monto(p_monto);
  select * into v_cargo from public.cargos_cliente where id = p_cargo_id;
  if v_cargo.id is null then
    raise exception 'Cargo no encontrado.' using errcode = 'P0002';
  end if;

  insert into public.aplicaciones_cobro (cobro_id, cargo_id, cliente_id, monto, fecha, operacion_id)
  values (
    p_cobro_id, p_cargo_id, v_cargo.cliente_id, p_monto, greatest(p_fecha, v_cargo.fecha), p_operacion_id
  )
  returning id into v_id;

  perform private.registrar_asiento(
    greatest(p_fecha, v_cargo.fecha), 'Aplicación de cobro: ' || v_cargo.concepto, v_cargo.actividad,
    'aplicacion', v_id,
    jsonb_build_array(private.linea('2200', p_monto, 0), private.linea('1200', 0, p_monto))
  );
  return v_id;
end;
$$;

create function private.reversar_aplicacion_interna(p_aplicacion_id uuid, p_motivo text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.aplicaciones_cobro
  set estado = 'reversada', motivo_reverso = p_motivo, reversado_en = now(), reversado_por = auth.uid()
  where id = p_aplicacion_id and estado = 'vigente';
  if not found then
    raise exception 'La aplicación ya fue reversada.' using errcode = '22023';
  end if;
  perform private.reversar_asiento('aplicacion', p_aplicacion_id, 'Reverso de aplicación de cobro');
end;
$$;

create function private.pagar_gasto(
  p_gasto_id uuid,
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
  v_gasto public.gastos;
  v_existente public.pagos_gasto;
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

  -- El bloqueo del gasto serializa los pagos del mismo gasto (y sus reintentos).
  select * into v_gasto from public.gastos where id = p_gasto_id for update;
  if v_gasto.id is null then
    raise exception 'Gasto no encontrado.' using errcode = 'P0002';
  end if;

  select * into v_existente from public.pagos_gasto where idempotencia = p_idempotencia;
  if v_existente.id is not null then
    perform private.exigir_misma_operacion(v_existente.gasto_id = p_gasto_id and v_existente.monto = p_monto);
    return v_existente.id;
  end if;

  insert into public.pagos_gasto (gasto_id, cuenta_dinero_id, fecha, metodo, referencia, monto, idempotencia)
  values (p_gasto_id, p_cuenta_dinero_id, p_fecha, p_metodo, v_referencia, p_monto, p_idempotencia)
  returning id into v_id;

  v_asiento := private.registrar_asiento(
    p_fecha, 'Pago de gasto: ' || v_gasto.concepto, v_gasto.actividad, 'pago_gasto', v_id,
    jsonb_build_array(private.linea('2100', p_monto, 0), private.linea('1100', 0, p_monto, p_cuenta_dinero_id))
  );
  perform private.registrar_movimiento(p_cuenta_dinero_id, p_fecha, 'egreso', -p_monto, 'pago_gasto', v_id, v_asiento);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cargos a clientes
-- ---------------------------------------------------------------------------

-- Cargo administrativo (origen 'manual'): solo administrador. La clave de la
-- operación es el origen_id, así que un reintento no duplica el cargo.
create function public.registrar_cargo(
  p_idempotencia uuid,
  p_cliente_id uuid,
  p_cuenta_ingreso text,
  p_concepto text,
  p_fecha date,
  p_vencimiento date,
  p_monto numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_concepto text;
  v_cuenta public.cuentas_contables;
  v_actividad public.actividad;
  v_existente public.cargos_cliente;
  v_id uuid;
begin
  perform private.exigir_rol('administrador');
  perform private.exigir_clave(p_idempotencia);
  perform private.validar_monto(p_monto);
  perform private.validar_fecha(p_fecha);
  if p_vencimiento < p_fecha then
    raise exception 'El vencimiento no puede ser anterior a la fecha.' using errcode = '22023';
  end if;
  v_concepto := private.texto(p_concepto, 200, 'el concepto', true);

  select * into v_cuenta
  from public.cuentas_contables where codigo = p_cuenta_ingreso and tipo = 'ingreso' and activo;
  v_actividad := private.actividad_de_ingreso(v_cuenta.codigo);
  if v_actividad is null then
    raise exception 'Seleccione una línea de ingreso válida.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id and activo) then
    raise exception 'Cliente no encontrado o inactivo.' using errcode = '22023';
  end if;

  insert into public.cargos_cliente (
    cliente_id, actividad, cuenta_ingreso_id, origen_tipo, origen_id, concepto, fecha, vencimiento,
    monto, creado_por
  )
  values (
    p_cliente_id, v_actividad, v_cuenta.id, 'manual', p_idempotencia, v_concepto, p_fecha, p_vencimiento,
    p_monto, auth.uid()
  )
  on conflict (origen_tipo, origen_id) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_existente
    from public.cargos_cliente where origen_tipo = 'manual' and origen_id = p_idempotencia;
    perform private.exigir_misma_operacion(v_existente.cliente_id = p_cliente_id and v_existente.monto = p_monto);
    return v_existente.id;
  end if;

  perform private.registrar_asiento(
    p_fecha, 'Cargo: ' || v_concepto, v_actividad, 'cargo', v_id,
    jsonb_build_array(private.linea('1200', p_monto, 0), private.linea(v_cuenta.codigo, 0, p_monto))
  );
  return v_id;
end;
$$;

-- Lo ya aplicado al cargo vuelve al saldo a favor del cliente (no mueve dinero).
create function public.anular_cargo(p_cargo_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_cargo public.cargos_cliente;
  v_aplicacion uuid;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);

  select * into v_cargo from public.cargos_cliente where id = p_cargo_id for update;
  if v_cargo.id is null then
    raise exception 'Cargo no encontrado.' using errcode = 'P0002';
  end if;
  if v_cargo.estado <> 'vigente' then
    raise exception 'El cargo ya está anulado.' using errcode = '22023';
  end if;

  for v_aplicacion in
    select id from public.aplicaciones_cobro
    where cargo_id = p_cargo_id and estado = 'vigente'
    order by id
    for update
  loop
    perform private.reversar_aplicacion_interna(v_aplicacion, 'Anulación del cargo: ' || v_motivo);
  end loop;

  update public.cargos_cliente
  set estado = 'anulado', motivo_anulacion = v_motivo, anulado_en = now(), anulado_por = auth.uid()
  where id = p_cargo_id;

  perform private.reversar_asiento('cargo', p_cargo_id, 'Anulación de cargo: ' || v_cargo.concepto);
  perform private.registrar_bitacora(
    'cargos_cliente', p_cargo_id, 'anular_cargo', v_motivo,
    jsonb_build_object('estado', v_cargo.estado, 'monto', v_cargo.monto),
    jsonb_build_object('estado', 'anulado')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Cobros, anticipos y aplicaciones
-- ---------------------------------------------------------------------------

-- Todo cobro entra como anticipo (D caja/banco, H anticipos). Las aplicaciones
-- indicadas ([{"cargo_id": uuid, "monto": 500.00}, ...]) lo trasladan a los
-- cargos del mismo cliente; el sobrante queda como saldo a favor.
create function public.registrar_cobro(
  p_idempotencia uuid,
  p_cliente_id uuid,
  p_cuenta_dinero_id uuid,
  p_fecha date,
  p_metodo public.metodo_pago,
  p_referencia text,
  p_monto numeric,
  p_aplicaciones jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente text;
  v_referencia text;
  v_existente public.cobros_cliente;
  v_id uuid;
  v_asiento uuid;
  v_aplicacion jsonb;
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');
  perform private.exigir_clave(p_idempotencia);
  perform private.validar_monto(p_monto);
  perform private.validar_fecha(p_fecha);
  if p_metodo is null then
    raise exception 'Seleccione el método de pago.' using errcode = '22023';
  end if;
  v_referencia := private.texto(p_referencia, 80, 'la referencia', false);
  perform private.exigir_cuenta_dinero(p_cuenta_dinero_id);
  select nombre into v_cliente from public.clientes where id = p_cliente_id;
  if v_cliente is null then
    raise exception 'Cliente no encontrado.' using errcode = 'P0002';
  end if;

  p_aplicaciones := coalesce(p_aplicaciones, '[]'::jsonb);
  if jsonb_typeof(p_aplicaciones) <> 'array' then
    raise exception 'Las aplicaciones no tienen un formato válido.' using errcode = '22023';
  end if;
  if (select count(*) <> count(distinct value ->> 'cargo_id') from jsonb_array_elements(p_aplicaciones)) then
    raise exception 'Un cargo aparece más de una vez en la aplicación.' using errcode = '22023';
  end if;

  insert into public.cobros_cliente (
    cliente_id, cuenta_dinero_id, fecha, metodo, referencia, monto, idempotencia, creado_por
  )
  values (
    p_cliente_id, p_cuenta_dinero_id, p_fecha, p_metodo, v_referencia, p_monto, p_idempotencia, auth.uid()
  )
  on conflict (idempotencia) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_existente from public.cobros_cliente where idempotencia = p_idempotencia;
    perform private.exigir_misma_operacion(v_existente.cliente_id = p_cliente_id and v_existente.monto = p_monto);
    return v_existente.id;
  end if;

  v_asiento := private.registrar_asiento(
    p_fecha, 'Cobro de ' || v_cliente, null, 'cobro', v_id,
    jsonb_build_array(private.linea('1100', p_monto, 0, p_cuenta_dinero_id), private.linea('2200', 0, p_monto))
  );
  perform private.registrar_movimiento(p_cuenta_dinero_id, p_fecha, 'ingreso', p_monto, 'cobro', v_id, v_asiento);

  -- Cargos bloqueados en orden fijo: dos cobros simultáneos no se interbloquean.
  perform 1
  from public.cargos_cliente
  where id in (select (value ->> 'cargo_id')::uuid from jsonb_array_elements(p_aplicaciones))
  order by id
  for update;

  for v_aplicacion in select value from jsonb_array_elements(p_aplicaciones) loop
    perform private.aplicar(
      v_id, (v_aplicacion ->> 'cargo_id')::uuid, (v_aplicacion ->> 'monto')::numeric, p_fecha, p_idempotencia
    );
  end loop;

  return v_id;
end;
$$;

-- Aplica saldo a favor del cliente a un cargo, tomando los cobros más antiguos
-- primero. No mueve dinero. Devuelve el importe aplicado.
create function public.aplicar_saldo_a_favor(p_idempotencia uuid, p_cargo_id uuid, p_monto numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cargo public.cargos_cliente;
  v_cobro record;
  v_restante numeric(14, 2);
  v_parte numeric(14, 2);
begin
  perform private.exigir_rol('administrador', 'operador', 'finanzas');
  perform private.exigir_clave(p_idempotencia);
  perform private.validar_monto(p_monto);

  select * into v_cargo from public.cargos_cliente where id = p_cargo_id;
  if v_cargo.id is null then
    raise exception 'Cargo no encontrado.' using errcode = 'P0002';
  end if;

  -- Bloquea los cobros del cliente: dos aplicaciones simultáneas no pueden
  -- usar el mismo saldo a favor; la segunda espera y ve lo que usó la primera.
  perform 1
  from public.cobros_cliente
  where cliente_id = v_cargo.cliente_id and estado = 'confirmado'
  order by id
  for update;

  -- Reintento de la misma operación: ya está aplicada.
  if exists (select 1 from public.aplicaciones_cobro where operacion_id = p_idempotencia) then
    perform private.exigir_misma_operacion(
      (select bool_and(cargo_id = p_cargo_id) and sum(monto) = p_monto
       from public.aplicaciones_cobro where operacion_id = p_idempotencia)
    );
    return p_monto;
  end if;

  v_restante := p_monto;
  for v_cobro in
    select c.id,
      c.monto - coalesce((
        select sum(a.monto) from public.aplicaciones_cobro a
        where a.cobro_id = c.id and a.estado = 'vigente'
      ), 0) as disponible
    from public.cobros_cliente c
    where c.cliente_id = v_cargo.cliente_id and c.estado = 'confirmado'
    order by c.fecha, c.created_at, c.id
  loop
    exit when v_restante = 0;
    continue when v_cobro.disponible <= 0;
    v_parte := least(v_restante, v_cobro.disponible);
    perform private.aplicar(v_cobro.id, p_cargo_id, v_parte, private.hoy(), p_idempotencia);
    v_restante := v_restante - v_parte;
  end loop;

  if v_restante > 0 then
    raise exception 'El cliente no tiene saldo a favor suficiente (disponible: %).',
      private.lempiras(p_monto - v_restante) using errcode = '22023';
  end if;
  return p_monto;
end;
$$;

create function public.reversar_aplicacion(p_aplicacion_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_aplicacion public.aplicaciones_cobro;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);

  select * into v_aplicacion from public.aplicaciones_cobro where id = p_aplicacion_id for update;
  if v_aplicacion.id is null then
    raise exception 'Aplicación no encontrada.' using errcode = 'P0002';
  end if;

  perform private.reversar_aplicacion_interna(p_aplicacion_id, v_motivo);
  perform private.registrar_bitacora(
    'aplicaciones_cobro', p_aplicacion_id, 'reversar_aplicacion', v_motivo,
    jsonb_build_object('estado', v_aplicacion.estado, 'monto', v_aplicacion.monto,
      'cobro_id', v_aplicacion.cobro_id, 'cargo_id', v_aplicacion.cargo_id),
    jsonb_build_object('estado', 'reversada')
  );
end;
$$;

-- Devuelve el dinero de la caja/banco: primero reversa sus aplicaciones (los
-- cargos vuelven a quedar pendientes) y después el cobro.
create function public.reversar_cobro(p_cobro_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_cobro public.cobros_cliente;
  v_aplicacion uuid;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);

  select * into v_cobro from public.cobros_cliente where id = p_cobro_id for update;
  if v_cobro.id is null then
    raise exception 'Cobro no encontrado.' using errcode = 'P0002';
  end if;
  if v_cobro.estado <> 'confirmado' then
    raise exception 'El cobro ya fue reversado.' using errcode = '22023';
  end if;

  for v_aplicacion in
    select id from public.aplicaciones_cobro
    where cobro_id = p_cobro_id and estado = 'vigente'
    order by id
    for update
  loop
    perform private.reversar_aplicacion_interna(v_aplicacion, 'Reverso del cobro: ' || v_motivo);
  end loop;

  update public.cobros_cliente
  set estado = 'reversado', motivo_reverso = v_motivo, reversado_en = now(), reversado_por = auth.uid()
  where id = p_cobro_id;

  perform private.reversar_asiento('cobro', p_cobro_id, 'Reverso de cobro');
  perform private.registrar_bitacora(
    'cobros_cliente', p_cobro_id, 'reversar_cobro', v_motivo,
    jsonb_build_object('estado', v_cobro.estado, 'monto', v_cobro.monto),
    jsonb_build_object('estado', 'reversado')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Gastos y pagos a proveedores
-- ---------------------------------------------------------------------------

-- p_pago opcional para pagar en el acto ({"cuenta_dinero_id", "metodo",
-- "referencia", "monto"}). Si el pago falla, tampoco se registra el gasto.
create function public.registrar_gasto(
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
declare
  v_concepto text;
  v_notas text;
  v_cuenta_gasto text;
  v_existente public.gastos;
  v_id uuid;
begin
  perform private.exigir_rol('administrador', 'finanzas');
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

create function public.registrar_pago_gasto(
  p_idempotencia uuid,
  p_gasto_id uuid,
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
  return private.pagar_gasto(
    p_gasto_id, p_cuenta_dinero_id, p_fecha, p_metodo, p_referencia, p_monto, p_idempotencia
  );
end;
$$;

create function public.reversar_pago_gasto(p_pago_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_pago public.pagos_gasto;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);

  select * into v_pago from public.pagos_gasto where id = p_pago_id for update;
  if v_pago.id is null then
    raise exception 'Pago no encontrado.' using errcode = 'P0002';
  end if;
  if v_pago.estado <> 'confirmado' then
    raise exception 'El pago ya fue reversado.' using errcode = '22023';
  end if;

  update public.pagos_gasto
  set estado = 'reversado', motivo_reverso = v_motivo, reversado_en = now(), reversado_por = auth.uid()
  where id = p_pago_id;

  perform private.reversar_asiento('pago_gasto', p_pago_id, 'Reverso de pago de gasto');
  perform private.registrar_bitacora(
    'pagos_gasto', p_pago_id, 'reversar_pago_gasto', v_motivo,
    jsonb_build_object('estado', v_pago.estado, 'monto', v_pago.monto, 'gasto_id', v_pago.gasto_id),
    jsonb_build_object('estado', 'reversado')
  );
end;
$$;

-- Un gasto con pagos confirmados no se anula: primero se reversan los pagos
-- (cada reverso devuelve dinero a su caja/banco y debe decidirse a propósito).
create function public.anular_gasto(p_gasto_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_gasto public.gastos;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);

  select * into v_gasto from public.gastos where id = p_gasto_id for update;
  if v_gasto.id is null then
    raise exception 'Gasto no encontrado.' using errcode = 'P0002';
  end if;
  if v_gasto.estado <> 'registrado' then
    raise exception 'El gasto ya está anulado.' using errcode = '22023';
  end if;
  if exists (select 1 from public.pagos_gasto where gasto_id = p_gasto_id and estado = 'confirmado') then
    raise exception 'El gasto tiene pagos confirmados; reverse primero esos pagos.' using errcode = '22023';
  end if;

  update public.gastos
  set estado = 'anulado', motivo_anulacion = v_motivo, anulado_en = now(), anulado_por = auth.uid()
  where id = p_gasto_id;

  perform private.reversar_asiento('gasto', p_gasto_id, 'Anulación de gasto: ' || v_gasto.concepto);
  perform private.registrar_bitacora(
    'gastos', p_gasto_id, 'anular_gasto', v_motivo,
    jsonb_build_object('estado', v_gasto.estado, 'monto', v_gasto.monto),
    jsonb_build_object('estado', 'anulado')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Caja y bancos
-- ---------------------------------------------------------------------------

create function public.registrar_transferencia(
  p_idempotencia uuid,
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_fecha date,
  p_monto numeric,
  p_referencia text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origen text;
  v_destino text;
  v_referencia text;
  v_existente public.transferencias;
  v_id uuid;
  v_asiento uuid;
begin
  perform private.exigir_rol('administrador', 'finanzas');
  perform private.exigir_clave(p_idempotencia);
  perform private.validar_monto(p_monto);
  perform private.validar_fecha(p_fecha);
  if p_cuenta_origen_id = p_cuenta_destino_id then
    raise exception 'La cuenta de origen y la de destino deben ser distintas.' using errcode = '22023';
  end if;
  v_origen := private.exigir_cuenta_dinero(p_cuenta_origen_id);
  v_destino := private.exigir_cuenta_dinero(p_cuenta_destino_id);
  v_referencia := private.texto(p_referencia, 120, 'la referencia', false);

  insert into public.transferencias (
    cuenta_origen_id, cuenta_destino_id, fecha, monto, referencia, idempotencia, creado_por
  )
  values (
    p_cuenta_origen_id, p_cuenta_destino_id, p_fecha, p_monto, v_referencia, p_idempotencia, auth.uid()
  )
  on conflict (idempotencia) do nothing
  returning id into v_id;

  if v_id is null then
    select * into v_existente from public.transferencias where idempotencia = p_idempotencia;
    perform private.exigir_misma_operacion(
      v_existente.cuenta_origen_id = p_cuenta_origen_id
      and v_existente.cuenta_destino_id = p_cuenta_destino_id
      and v_existente.monto = p_monto
    );
    return v_existente.id;
  end if;

  v_asiento := private.registrar_asiento(
    p_fecha, 'Transferencia de ' || v_origen || ' a ' || v_destino, null, 'transferencia', v_id,
    jsonb_build_array(
      private.linea('1100', p_monto, 0, p_cuenta_destino_id),
      private.linea('1100', 0, p_monto, p_cuenta_origen_id)
    )
  );
  perform private.registrar_movimiento(p_cuenta_origen_id, p_fecha, 'transferencia', -p_monto, 'transferencia', v_id, v_asiento);
  perform private.registrar_movimiento(p_cuenta_destino_id, p_fecha, 'transferencia', p_monto, 'transferencia', v_id, v_asiento);
  return v_id;
end;
$$;

create function public.reversar_transferencia(p_transferencia_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_transferencia public.transferencias;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);

  select * into v_transferencia from public.transferencias where id = p_transferencia_id for update;
  if v_transferencia.id is null then
    raise exception 'Transferencia no encontrada.' using errcode = 'P0002';
  end if;
  if v_transferencia.estado <> 'confirmado' then
    raise exception 'La transferencia ya fue reversada.' using errcode = '22023';
  end if;

  update public.transferencias
  set estado = 'reversado', motivo_reverso = v_motivo, reversado_en = now(), reversado_por = auth.uid()
  where id = p_transferencia_id;

  perform private.reversar_asiento('transferencia', p_transferencia_id, 'Reverso de transferencia');
  perform private.registrar_bitacora(
    'transferencias', p_transferencia_id, 'reversar_transferencia', v_motivo,
    jsonb_build_object('estado', v_transferencia.estado, 'monto', v_transferencia.monto),
    jsonb_build_object('estado', 'reversado')
  );
end;
$$;

-- Saldo inicial de una caja/banco: un movimiento de apertura documentado
-- (D caja/banco, H 3100). Solo uno vigente por cuenta; la clave de la
-- operación identifica la apertura (origen_id).
create function public.registrar_apertura(
  p_idempotencia uuid,
  p_cuenta_dinero_id uuid,
  p_fecha date,
  p_monto numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta text;
  v_asiento uuid;
begin
  perform private.exigir_rol('administrador');
  perform private.exigir_clave(p_idempotencia);
  perform private.validar_monto(p_monto);
  perform private.validar_fecha(p_fecha);
  v_cuenta := private.exigir_cuenta_dinero(p_cuenta_dinero_id);

  -- Serializa las aperturas de la misma cuenta.
  perform 1 from public.cuentas_dinero where id = p_cuenta_dinero_id for update;

  if exists (select 1 from public.asientos where origen_tipo = 'apertura' and origen_id = p_idempotencia) then
    perform private.exigir_misma_operacion((
      select cuenta_dinero_id = p_cuenta_dinero_id and monto_con_signo = p_monto
      from public.movimientos_dinero
      where origen_tipo = 'apertura' and origen_id = p_idempotencia and evento = 'registro'
    ));
    return p_idempotencia;
  end if;

  if exists (
    select 1
    from public.movimientos_dinero m
    where m.cuenta_dinero_id = p_cuenta_dinero_id and m.origen_tipo = 'apertura' and m.evento = 'registro'
      and not exists (
        select 1 from public.movimientos_dinero r
        where r.origen_tipo = 'apertura' and r.origen_id = m.origen_id and r.evento = 'reverso'
      )
  ) then
    raise exception 'La cuenta ya tiene saldo inicial. Para corregirlo, reverse el anterior.'
      using errcode = '22023';
  end if;

  v_asiento := private.registrar_asiento(
    p_fecha, 'Saldo inicial de ' || v_cuenta, null, 'apertura', p_idempotencia,
    jsonb_build_array(private.linea('1100', p_monto, 0, p_cuenta_dinero_id), private.linea('3100', 0, p_monto))
  );
  perform private.registrar_movimiento(p_cuenta_dinero_id, p_fecha, 'apertura', p_monto, 'apertura', p_idempotencia, v_asiento);
  perform private.registrar_bitacora(
    'cuentas_dinero', p_cuenta_dinero_id, 'registrar_apertura', null, null,
    jsonb_build_object('apertura_id', p_idempotencia, 'monto', p_monto, 'fecha', p_fecha)
  );
  return p_idempotencia;
end;
$$;

create function public.reversar_apertura(p_apertura_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text;
  v_movimiento public.movimientos_dinero;
begin
  perform private.exigir_rol('administrador');
  v_motivo := private.texto(p_motivo, 300, 'el motivo', true);

  select * into v_movimiento
  from public.movimientos_dinero
  where origen_tipo = 'apertura' and origen_id = p_apertura_id and evento = 'registro';
  if v_movimiento.id is null then
    raise exception 'Saldo inicial no encontrado.' using errcode = 'P0002';
  end if;

  perform 1 from public.cuentas_dinero where id = v_movimiento.cuenta_dinero_id for update;
  perform private.reversar_asiento('apertura', p_apertura_id, 'Reverso de saldo inicial');
  perform private.registrar_bitacora(
    'cuentas_dinero', v_movimiento.cuenta_dinero_id, 'reversar_apertura', v_motivo,
    jsonb_build_object('apertura_id', p_apertura_id, 'monto', v_movimiento.monto_con_signo),
    jsonb_build_object('apertura_id', p_apertura_id, 'estado', 'reversado')
  );
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
      'registrar_cargo', 'anular_cargo', 'registrar_cobro', 'aplicar_saldo_a_favor',
      'reversar_aplicacion', 'reversar_cobro', 'registrar_gasto', 'registrar_pago_gasto',
      'reversar_pago_gasto', 'anular_gasto', 'registrar_transferencia', 'reversar_transferencia',
      'registrar_apertura', 'reversar_apertura'
    ])
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = any (array[
      'hoy', 'lempiras', 'exigir_rol', 'exigir_clave', 'exigir_misma_operacion', 'validar_monto',
      'validar_fecha', 'texto', 'exigir_cuenta_dinero', 'actividad_de_ingreso', 'linea',
      'registrar_asiento', 'registrar_movimiento', 'reversar_asiento', 'registrar_bitacora',
      'aplicar', 'reversar_aplicacion_interna', 'pagar_gasto'
    ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
