-- E5 · Avisos de horario excedido.
--
-- Una operación en curso (o alquiler entregado) que ya superó su horario
-- sigue ocupando el recurso. Los avisos miran además las dos horas
-- siguientes, para advertir de las operaciones posteriores que pueden verse
-- afectadas (no las reprograma). Solo afecta a los avisos: el bloqueo de
-- nuevos inicios con un recurso ocupado no cambia.

-- Intervalo que una ocupación en curso usa para los avisos.
create function private.alcance_aviso(p_ocupacion public.ocupaciones_recurso)
returns tstzrange
language sql
stable
set search_path = ''
as $$
  select case
    when not p_ocupacion.en_curso then p_ocupacion.intervalo
    when now() > upper(p_ocupacion.intervalo) then tstzrange(lower(p_ocupacion.intervalo), now() + interval '2 hours', '[]')
    else p_ocupacion.intervalo
  end
$$;

create or replace function private.avisos_ocupacion(p_origen_tipo public.origen_ocupacion, p_origen_id uuid)
returns setof text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_propia public.ocupaciones_recurso;
  v_otra public.ocupaciones_recurso;
  v_nombre text;
begin
  for v_propia in
    select * from public.ocupaciones_recurso
    where origen_tipo = p_origen_tipo and origen_id = p_origen_id and activa
    order by recurso_tipo desc
  loop
    v_nombre := case v_propia.recurso_tipo when 'vehiculo' then 'El vehículo' else 'El conductor' end;
    if v_propia.en_curso and now() > upper(v_propia.intervalo) then
      return next v_nombre || ' superó el horario previsto (fin previsto ' || private.momento(upper(v_propia.intervalo)) || ').';
    end if;
    for v_otra in
      select o.* from public.ocupaciones_recurso o
      where o.activa and o.recurso_tipo = v_propia.recurso_tipo and o.recurso_id = v_propia.recurso_id
        and not (o.origen_tipo = p_origen_tipo and o.origen_id = p_origen_id)
        and o.en_curso <> v_propia.en_curso
        and private.alcance_aviso(o) && private.alcance_aviso(v_propia)
      order by lower(o.intervalo)
    loop
      return next case
        when v_otra.en_curso then v_nombre || ' sigue ocupado ' || private.describir_ocupacion(v_otra)
          || case when now() > upper(v_otra.intervalo) then ', pasado de su horario previsto.' else '.' end
        else v_nombre || ' tiene otra operación ' || private.describir_ocupacion(v_otra) || ' que puede verse afectada.'
      end;
    end loop;
  end loop;
end;
$$;

revoke all on function private.alcance_aviso(public.ocupaciones_recurso) from public, anon, authenticated;
