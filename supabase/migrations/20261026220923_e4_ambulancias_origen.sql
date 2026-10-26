-- E4 · Ambulancias: origen de los cargos de traslados particulares.
--
-- Migración propia porque un valor nuevo de un enum no puede usarse en la
-- misma transacción en la que se añade. El origen_id del cargo es el id del
-- traslado (UNIQUE (origen_tipo, origen_id) de E2: un traslado, un cargo).
alter type public.origen_cargo add value if not exists 'traslado_ambulancia';
