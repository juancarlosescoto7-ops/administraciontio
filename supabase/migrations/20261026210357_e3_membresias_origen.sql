-- E3 · Membresías: origen de los cargos de mensualidad.
--
-- Migración propia porque un valor nuevo de un enum no puede usarse en la
-- misma transacción en la que se añade. El origen_id del cargo es el id del
-- período (UNIQUE (origen_tipo, origen_id) de E2: un período, un cargo).
alter type public.origen_cargo add value if not exists 'periodo_membresia';
