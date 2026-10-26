-- E4 · Ambulancias: índice completo de la FK reservas_beneficio.membresia_id
-- (el índice parcial de reservas vigentes no cubre las liberadas).
create index reservas_beneficio_membresia_idx on public.reservas_beneficio (membresia_id);
