-- Limpieza excepcional solicitada expresamente por el propietario el 2026-10-31.
-- Ejecutar exclusivamente en DESARROLLO: cgohbizokewvivxmvbij.
-- Vacía operaciones e historial financiero; conserva íntegros los catálogos,
-- perfiles, usuarios Auth, configuración, esquema y permisos.
-- NO reutilizar para producción ni como parte de un despliegue con datos.
-- Una transacción; sin CASCADE. Cualquier fallo restaura datos y triggers.
do $$
declare
  v_operaciones text[] := array[
    'alquileres', 'aplicaciones_cobro', 'asientos', 'bitacora',
    'cargos_adicionales_alquiler', 'cargos_cliente', 'cobros_cliente',
    'contratos_membresia', 'gastos', 'gastos_servicio', 'lineas_asiento',
    'membresia_beneficiarios', 'membresias', 'movimientos_dinero',
    'ocupaciones_recurso', 'pagos_gasto', 'periodos_membresia',
    'reservas_beneficio', 'transferencias', 'transportes', 'traslados_ambulancia'
  ];
  v_catalogos text[] := array[
    'beneficiarios', 'categorias_gasto', 'clientes', 'conductores',
    'cuentas_contables', 'cuentas_dinero', 'perfiles', 'planes',
    'plantillas_contrato', 'proveedores', 'tarifas', 'vehiculos'
  ];
  v_antes jsonb := '{}'::jsonb;
  v_firma text;
  v_filas bigint;
  v_protegidas text[];
  v_estado_triggers jsonb;
  t text;
begin
  -- Evitar cambios concurrentes mientras se vacían operaciones y se verifica
  -- que cada fila de los catálogos permanezca exactamente igual.
  execute (select 'lock table ' || string_agg(format('public.%I',x), ', ' order by x)
    || ' in access exclusive mode' from unnest(v_operaciones || v_catalogos) x);

  if exists(select 1 from pg_class c where c.relnamespace='public'::regnamespace
    and c.relkind in ('r','p') and not c.relname=any(v_operaciones || v_catalogos)) then
    raise exception 'Hay tablas nuevas sin clasificar: revisar antes de limpiar.';
  end if;

  foreach t in array v_catalogos loop
    execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text, ''[]'')) from public.%I x',t) into v_firma;
    v_antes := v_antes || jsonb_build_object(t,v_firma);
  end loop;

  select jsonb_object_agg(g.oid::text,g.tgenabled::text) into v_estado_triggers
  from pg_trigger g where not g.tgisinternal and g.tgrelid in
    (select oid from pg_class where relnamespace='public'::regnamespace);
  select coalesce(array_agg(c.relname::text), '{}') into v_protegidas
  from pg_trigger g join pg_class c on c.oid=g.tgrelid
  where c.relnamespace='public'::regnamespace and c.relname=any(v_operaciones)
    and g.tgname='impedir_truncate' and g.tgenabled='O';

  foreach t in array v_protegidas loop
    execute format('alter table public.%I disable trigger impedir_truncate',t);
  end loop;
  execute (select 'truncate table ' || string_agg(format('public.%I',x), ', ')
    || ' continue identity restrict' from unnest(v_operaciones) x);
  foreach t in array v_protegidas loop
    execute format('alter table public.%I enable trigger impedir_truncate',t);
  end loop;

  foreach t in array v_operaciones loop
    execute format('select count(*) from public.%I',t) into v_filas;
    if v_filas <> 0 then raise exception 'No quedó vacía la tabla %.',t; end if;
  end loop;
  foreach t in array v_catalogos loop
    execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text, ''[]'')) from public.%I x',t) into v_firma;
    if v_firma is distinct from (v_antes ->> t) then
      raise exception 'Cambió el catálogo %: se revierte toda la limpieza.',t;
    end if;
  end loop;
  if v_estado_triggers is distinct from (
    select jsonb_object_agg(g.oid::text,g.tgenabled::text) from pg_trigger g
    where not g.tgisinternal and g.tgrelid in
      (select oid from pg_class where relnamespace='public'::regnamespace)
  ) then raise exception 'Los triggers no conservaron su estado original.'; end if;
end $$;

