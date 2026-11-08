-- Peticiones de cambio al sistema: qué se necesita y en qué estado está.
-- Cualquier usuario interno activo las registra y les cambia el estado.
create table public.peticiones (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null check (length(btrim(descripcion)) between 1 and 2000),
  pantalla text check (length(pantalla) <= 200),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','en_proceso','resuelta','descartada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creado_por uuid references public.perfiles(id),
  actualizado_por uuid references public.perfiles(id)
);
create index peticiones_estado_idx on public.peticiones(estado, created_at desc);
create index peticiones_creado_por_idx on public.peticiones(creado_por);
create index peticiones_actualizado_por_idx on public.peticiones(actualizado_por);
create trigger sellar_auditoria before insert or update on public.peticiones
for each row execute function private.sellar_auditoria();
alter table public.peticiones enable row level security;
revoke all on public.peticiones from anon, authenticated;
-- Lo escrito no se edita ni se borra desde la web: solo cambia el estado.
grant select, insert (descripcion, pantalla) on public.peticiones to authenticated;
grant update (estado) on public.peticiones to authenticated;
create policy peticiones_select on public.peticiones for select to authenticated
using ((select private.es_usuario_activo()));
create policy peticiones_insert on public.peticiones for insert to authenticated
with check ((select private.es_usuario_activo()));
create policy peticiones_update on public.peticiones for update to authenticated
using ((select private.es_usuario_activo()))
with check ((select private.es_usuario_activo()));
