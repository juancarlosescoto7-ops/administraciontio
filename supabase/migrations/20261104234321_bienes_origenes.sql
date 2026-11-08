-- Bienes de la empresa (activos fijos): orígenes contables (2026-11-04).
-- Migración separada: un valor nuevo de un enum no puede usarse en la misma
-- transacción que lo agrega.

alter type public.origen_financiero add value if not exists 'bien';
alter type public.origen_financiero add value if not exists 'pago_bien';
alter type public.origen_financiero add value if not exists 'depreciacion';
alter type public.origen_financiero add value if not exists 'baja_bien';
