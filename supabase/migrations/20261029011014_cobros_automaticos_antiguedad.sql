-- Ajuste autorizado: cada cobro nuevo cubre los cargos pendientes del cliente
-- por fecha ascendente (desempate: created_at, id), hasta agotar el importe.
-- No busca coincidencias de montos. El excedente sigue siendo saldo a favor.
-- No redistribuye cobros históricos ni consume anticipos previos.
-- Se reutiliza private.aplicar: mismos permisos, contabilidad, reversos e
-- invariantes de E2; una transacción, un ingreso en caja y sin duplicados.

create or replace function public.registrar_cobro(
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
  v_cargo record;
  v_restante numeric(14, 2);
  v_parte numeric(14, 2);
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

  -- La firma anterior se conserva para reintentos de cobros históricos.
  -- Un cobro nuevo no permite imponer una distribución manual.
  if coalesce(p_aplicaciones, '[]'::jsonb) <> '[]'::jsonb then
    raise exception 'Los cobros se aplican automáticamente del cargo más antiguo al más reciente. Recargue el formulario.'
      using errcode = '22023';
  end if;

  -- Bloquear primero y consultar saldos DESPUÉS: al esperar otro cobro,
  -- la siguiente consulta debe ver las aplicaciones que este haya confirmado.
  -- Orden fijo de bloqueos, independiente del orden comercial de aplicación.
  perform 1 from public.cargos_cliente
  where cliente_id = p_cliente_id and estado = 'vigente'
  order by id for update;

  v_restante := p_monto;
  for v_cargo in
    select c.id, c.monto - coalesce((
      select sum(a.monto) from public.aplicaciones_cobro a
      where a.cargo_id = c.id and a.estado = 'vigente'
    ), 0) as pendiente
    from public.cargos_cliente c
    where c.cliente_id = p_cliente_id and c.estado = 'vigente'
    order by c.fecha, c.created_at, c.id
  loop
    exit when v_restante = 0;
    continue when v_cargo.pendiente <= 0;
    v_parte := least(v_restante, v_cargo.pendiente);
    perform private.aplicar(v_id, v_cargo.id, v_parte, p_fecha, p_idempotencia);
    v_restante := v_restante - v_parte;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.registrar_cobro(uuid, uuid, uuid, date, public.metodo_pago, text, numeric, jsonb) from public, anon;
grant execute on function public.registrar_cobro(uuid, uuid, uuid, date, public.metodo_pago, text, numeric, jsonb) to authenticated;

-- Entrada de la UI nueva: si falta esta migración, falla sin registrar dinero
-- con la implementación manual anterior. La lógica vive en registrar_cobro.
create function public.registrar_cobro_automatico(
  p_idempotencia uuid,
  p_cliente_id uuid,
  p_cuenta_dinero_id uuid,
  p_fecha date,
  p_metodo public.metodo_pago,
  p_referencia text,
  p_monto numeric
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select public.registrar_cobro(
    p_idempotencia, p_cliente_id, p_cuenta_dinero_id, p_fecha,
    p_metodo, p_referencia, p_monto
  );
$$;

revoke all on function public.registrar_cobro_automatico(uuid, uuid, uuid, date, public.metodo_pago, text, numeric) from public, anon;
grant execute on function public.registrar_cobro_automatico(uuid, uuid, uuid, date, public.metodo_pago, text, numeric) to authenticated;
