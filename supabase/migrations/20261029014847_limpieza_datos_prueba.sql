-- Limpieza total de los datos de prueba: deja el sistema como recién instalado.
-- Conserva los usuarios reales y sus perfiles, el plan de cuentas, las
-- categorías de gasto de fábrica y las plantillas de contrato que no hizo un
-- usuario de prueba. Borra todo lo demás, incluidos catálogos y bitácora.
--
-- TRUNCATE no dispara los triggers impedir_borrado (son por fila), pero sí
-- impedir_truncate: se desactiva solo durante el vaciado y se reactiva después.
-- Si algo falla, toda la migración se revierte con los triggers intactos.
-- Va sin CASCADE: si una tabla conservada dependiera de una vaciada, falla en
-- lugar de borrar de más. En una base nueva creada desde las migraciones no
-- borra nada.

do $$
declare
  v_tablas text[] := array[
    -- Finanzas
    'lineas_asiento', 'asientos', 'movimientos_dinero', 'aplicaciones_cobro',
    'cobros_cliente', 'cargos_cliente', 'pagos_gasto', 'gastos',
    'transferencias', 'cuentas_dinero', 'proveedores',
    -- Membresías
    'contratos_membresia', 'reservas_beneficio', 'periodos_membresia',
    'membresia_beneficiarios', 'membresias', 'beneficiarios', 'planes',
    -- Ambulancias, alquileres y transportes
    'ocupaciones_recurso', 'traslados_ambulancia', 'cargos_adicionales_alquiler',
    'alquileres', 'transportes', 'tarifas', 'vehiculos', 'conductores',
    -- Comunes
    'clientes', 'bitacora'
  ];
  v_protegidas text[];
  t text;
begin
  select coalesce(array_agg(c.relname::text), '{}') into v_protegidas
  from pg_trigger g
  join pg_class c on c.oid = g.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and g.tgname = 'impedir_truncate' and c.relname = any(v_tablas);

  foreach t in array v_protegidas loop
    execute format('alter table public.%I disable trigger impedir_truncate', t);
  end loop;

  execute (select 'truncate table ' || string_agg(format('public.%I', x), ', ') from unnest(v_tablas) x);

  foreach t in array v_protegidas loop
    execute format('alter table public.%I enable trigger impedir_truncate', t);
  end loop;
end $$;

-- Plantillas de contrato creadas por usuarios de prueba.
alter table public.plantillas_contrato disable trigger impedir_borrado;
delete from public.plantillas_contrato p
using auth.users u
where u.id = p.creado_por and u.email like 'prueba.%@example.com';
alter table public.plantillas_contrato enable trigger impedir_borrado;

-- Usuarios ficticios de prueba. Primero se sueltan las referencias entre
-- perfiles (proteger_perfil deja actualizado_por = auth.uid(), nulo aquí).
update public.perfiles p
set actualizado_por = null
from auth.users u
where u.id = p.actualizado_por and u.email like 'prueba.%@example.com';

delete from public.perfiles p
using auth.users u
where u.id = p.id and u.email like 'prueba.%@example.com';

delete from auth.users where email like 'prueba.%@example.com';
