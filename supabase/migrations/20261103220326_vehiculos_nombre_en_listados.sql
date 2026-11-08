-- Vehículos identificados por marca y modelo también en listados, fichas,
-- panel y buscador (continúa 20261103215924_vehiculos_nombre_en_selectores).
--
-- * vehiculos.nombre: columna generada con private.nombre_vehiculo
--   («HONDA ODYSSEY · 003»; sin marca ni modelo, código y placa). Se recalcula
--   sola al editar código, marca, modelo o placa.
-- * saldos_alquileres, saldos_transportes y saldos_traslados exponen
--   vehiculo_nombre, y resumen_flota expone nombre, al final de sus columnas;
--   el resto de cada vista queda igual.
-- * La columna generada se evalúa al insertar o actualizar como el usuario
--   autenticado: se le concede ejecutar la función (pura, sin acceso a datos).

grant execute on function private.nombre_vehiculo(text, text, text, text) to authenticated;

alter table public.vehiculos
  add column nombre text generated always as (private.nombre_vehiculo(codigo, marca, modelo, placa)) stored;

create or replace view public.saldos_alquileres with (security_invoker = true) as
 SELECT a.id,
    a.cliente_id,
    cl.nombre AS cliente_nombre,
    a.vehiculo_id,
    v.codigo AS vehiculo_codigo,
    v.placa AS vehiculo_placa,
    a.entrega_prevista,
    a.devolucion_prevista,
    a.tarifa_id,
    a.precio_pactado,
    a.notas,
    a.estado,
    a.entrega_real,
    a.km_salida,
    a.combustible_salida,
    a.notas_entrega,
    a.devolucion_real,
    a.km_regreso,
    a.combustible_regreso,
    a.notas_devolucion,
    a.motivo_correccion_km,
    a.km_regreso - a.km_salida AS km_recorridos,
    COALESCE(ad.total, 0::numeric)::numeric(14,2) AS total_adicionales,
    (a.precio_pactado + COALESCE(ad.total, 0::numeric))::numeric(14,2) AS importe_total,
    a.cargo_id,
    a.motivo_cancelacion,
    a.cancelado_en,
    a.created_at,
    a.updated_at,
    COALESCE(c.aplicado, 0::numeric)::numeric(14,2) AS aplicado,
        CASE
            WHEN a.cargo_id IS NULL THEN 0::numeric
            ELSE c.pendiente
        END::numeric(14,2) AS pendiente,
    c.estado AS cargo_estado,
        CASE
            WHEN a.estado = 'cancelado'::public.estado_alquiler THEN 'sin_cargo'::text
            WHEN a.cargo_id IS NULL THEN 'sin_cargo'::text
            WHEN c.estado = 'anulado'::public.estado_cargo THEN 'anulado'::text
            WHEN c.pendiente = 0::numeric THEN 'pagado'::text
            WHEN c.aplicado > 0::numeric THEN 'parcial'::text
            ELSE 'pendiente'::text
        END AS estado_financiero,
    v.nombre AS vehiculo_nombre
   FROM public.alquileres a
     JOIN public.clientes cl ON cl.id = a.cliente_id
     JOIN public.vehiculos v ON v.id = a.vehiculo_id
     LEFT JOIN LATERAL ( SELECT sum(x.monto) AS total
           FROM public.cargos_adicionales_alquiler x
          WHERE x.alquiler_id = a.id) ad ON true
     LEFT JOIN public.saldos_cargos c ON c.id = a.cargo_id;

create or replace view public.saldos_transportes with (security_invoker = true) as
 SELECT t.id,
    t.cliente_id,
    cl.nombre AS cliente_nombre,
    t.inicio_previsto,
    t.minutos_estimados,
    t.inicio_previsto + make_interval(mins => t.minutos_estimados) AS fin_previsto,
    t.origen,
    t.destino,
    t.vehiculo_id,
    v.codigo AS vehiculo_codigo,
    t.conductor_id,
    co.nombre AS conductor_nombre,
    t.tarifa_id,
    t.precio_pactado,
    t.notas,
    t.notas_finales,
    t.estado,
    t.inicio_real,
    t.fin_real,
    t.cargo_id,
    t.motivo_cancelacion,
    t.cancelado_en,
    t.created_at,
    t.updated_at,
    COALESCE(c.aplicado, 0::numeric)::numeric(14,2) AS aplicado,
    COALESCE(c.pendiente, 0::numeric)::numeric(14,2) AS pendiente,
    c.estado AS cargo_estado,
        CASE
            WHEN t.cargo_id IS NULL THEN 'sin_cargo'::text
            WHEN c.estado = 'anulado'::public.estado_cargo THEN 'anulado'::text
            WHEN c.pendiente = 0::numeric THEN 'pagado'::text
            WHEN c.aplicado > 0::numeric THEN 'parcial'::text
            ELSE 'pendiente'::text
        END AS estado_financiero,
    v.nombre AS vehiculo_nombre
   FROM public.transportes t
     JOIN public.clientes cl ON cl.id = t.cliente_id
     LEFT JOIN public.vehiculos v ON v.id = t.vehiculo_id
     LEFT JOIN public.conductores co ON co.id = t.conductor_id
     LEFT JOIN public.saldos_cargos c ON c.id = t.cargo_id;

create or replace view public.saldos_traslados with (security_invoker = true) as
 SELECT t.id,
    t.cliente_id,
    cl.nombre AS cliente_nombre,
    t.tipo,
    t.membresia_id,
    t.beneficiario_id,
    b.nombre AS beneficiario_nombre,
    t.pasajero,
    COALESCE(b.nombre, t.pasajero) AS paciente,
    t.estado,
    t.condicion_cobertura,
    t.motivo_cobertura,
    t.periodo_id,
    t.inicio_previsto,
    t.minutos_estimados,
    t.inicio_previsto + make_interval(mins => t.minutos_estimados) AS fin_previsto,
    t.inicio_real,
    t.fin_real,
    t.origen,
    t.destino,
    t.motivo,
    t.vehiculo_id,
    v.codigo AS vehiculo_codigo,
    t.conductor_id,
    co.nombre AS conductor_nombre,
    t.tarifa_id,
    t.precio_pactado,
    t.cargo_id,
    t.notas,
    t.notas_finales,
    t.motivo_cancelacion,
    t.cancelado_en,
    t.created_at,
    t.updated_at,
    r.id AS reserva_id,
    r.estado AS reserva_estado,
    r.periodo_inicio AS reserva_periodo_inicio,
    c.monto AS cargo_monto,
    COALESCE(c.aplicado, 0::numeric)::numeric(14,2) AS aplicado,
    COALESCE(c.pendiente, 0::numeric)::numeric(14,2) AS pendiente,
    c.estado AS cargo_estado,
        CASE
            WHEN t.tipo = 'cubierto'::public.tipo_traslado THEN 'no_aplica'::text
            WHEN t.cargo_id IS NULL THEN 'sin_cargo'::text
            WHEN c.estado = 'anulado'::public.estado_cargo THEN 'anulado'::text
            WHEN c.pendiente = 0::numeric THEN 'pagado'::text
            WHEN c.aplicado > 0::numeric THEN 'parcial'::text
            ELSE 'pendiente'::text
        END AS estado_financiero,
    v.nombre AS vehiculo_nombre
   FROM public.traslados_ambulancia t
     JOIN public.clientes cl ON cl.id = t.cliente_id
     LEFT JOIN public.beneficiarios b ON b.id = t.beneficiario_id
     LEFT JOIN public.vehiculos v ON v.id = t.vehiculo_id
     LEFT JOIN public.conductores co ON co.id = t.conductor_id
     LEFT JOIN LATERAL ( SELECT x.id,
            x.estado,
            x.periodo_inicio
           FROM public.reservas_beneficio x
          WHERE x.traslado_id = t.id
          ORDER BY (x.estado <> 'liberada'::public.estado_reserva) DESC, x.created_at DESC
         LIMIT 1) r ON true
     LEFT JOIN public.saldos_cargos c ON c.id = t.cargo_id;

create or replace view public.resumen_flota with (security_invoker = true) as
 SELECT v.id AS vehiculo_id,
    v.codigo,
    v.placa,
    v.tipo,
    v.estado,
    v.activo,
    v.marca,
    v.modelo,
    u.km_actual,
    u.ultima_fecha,
    COALESCE(u.en_recorrido, false) AS en_recorrido,
    COALESCE(d.recorridos, 0::bigint)::integer AS recorridos,
    COALESCE(d.descuadres, 0::bigint)::integer AS descuadres,
    mt.regreso AS ultimo_mantenimiento,
    mt.proximo_km,
    mt.proxima_fecha,
    mt.proximo_km - u.km_actual AS km_para_mantenimiento,
    v.nombre
   FROM public.vehiculos v
     LEFT JOIN LATERAL ( SELECT COALESCE(r.km_llegada, r.km_salida) AS km_actual,
            COALESCE(r.llegada, r.salida) AS ultima_fecha,
            r.km_llegada IS NULL AS en_recorrido
           FROM public.recorridos_vehiculo r
          WHERE r.vehiculo_id = v.id
          ORDER BY r.salida DESC, r.km_salida DESC, r.origen_id DESC
         LIMIT 1) u ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS recorridos,
            count(*) FILTER (WHERE r.diferencia <> 0) AS descuadres
           FROM public.recorridos_vehiculo r
          WHERE r.vehiculo_id = v.id) d ON true
     LEFT JOIN LATERAL ( SELECT m.regreso,
            m.proximo_km,
            m.proxima_fecha
           FROM public.mantenimientos_vehiculo m
          WHERE m.vehiculo_id = v.id
          ORDER BY m.salida DESC, m.id DESC
         LIMIT 1) mt ON true;
