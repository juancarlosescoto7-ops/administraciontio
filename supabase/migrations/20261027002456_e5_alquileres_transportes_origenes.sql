-- E5 · Alquileres y transportes: orígenes de ocupación y de cargo.
--
-- Migración propia porque los valores nuevos de un enum no pueden usarse en
-- la misma transacción en la que se añaden. Las ocupaciones de vehículos y
-- conductores de los tres módulos comparten la tabla ocupaciones_recurso de
-- E4 (y su restricción de exclusión); solo se añaden sus orígenes.
alter type public.origen_ocupacion add value if not exists 'alquiler';
alter type public.origen_ocupacion add value if not exists 'transporte';
alter type public.origen_cargo add value if not exists 'alquiler';
alter type public.origen_cargo add value if not exists 'transporte';
