-- Datos privados del jugador (nombre/apellido/teléfono), cambio de PIN, y preferencias
-- «no compartir equipo» (máx. 2 compañeros). Las aristas se usan en el balanceo de equipos.

alter table public.jugadores
  add column if not exists nombre_privado text,
  add column if not exists apellido_privado text,
  add column if not exists telefono_privado text;

create table if not exists public.jugador_evita_equipo (
  jugador_id uuid not null references public.jugadores (id) on delete cascade,
  evita_jugador_id uuid not null references public.jugadores (id) on delete cascade,
  primary key (jugador_id, evita_jugador_id),
  constraint jugador_evita_equipo_distinto check (jugador_id <> evita_jugador_id)
);

create index if not exists idx_jugador_evita_equipo_evita on public.jugador_evita_equipo (evita_jugador_id);

alter table public.jugador_evita_equipo enable row level security;

-- Solo el servicio / RPC security definer escribe; no exponemos políticas directas a PostgREST.
revoke all on public.jugador_evita_equipo from anon, authenticated;
grant select, insert, delete, update on public.jugador_evita_equipo to postgres;

-- ---------------------------------------------------------------------------
-- Mis datos privados (lectura)
-- ---------------------------------------------------------------------------
create or replace function public.futbol_mis_datos_privados_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_j uuid;
  v_email text;
begin
  v_j := public._futbol_resolve_token(p_token);
  select u.email into v_email from usuarios u where u.id = v_j;
  return (
    select jsonb_build_object(
      'email', coalesce(v_email, ''),
      'nombre', coalesce(j.nombre_privado, ''),
      'apellido', coalesce(j.apellido_privado, ''),
      'telefono', coalesce(j.telefono_privado, '')
    )
    from jugadores j where j.id = v_j
  );
end;
$$;

revoke all on function public.futbol_mis_datos_privados_get(text) from public;
grant execute on function public.futbol_mis_datos_privados_get(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mis datos privados (guardar nombre, apellido, teléfono)
-- ---------------------------------------------------------------------------
create or replace function public.futbol_mis_datos_privados_set(
  p_token text,
  p_nombre text,
  p_apellido text,
  p_telefono text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_j uuid;
begin
  v_j := public._futbol_resolve_token(p_token);
  update jugadores
  set
    nombre_privado = nullif(trim(p_nombre), ''),
    apellido_privado = nullif(trim(p_apellido), ''),
    telefono_privado = nullif(trim(p_telefono), '')
  where id = v_j;
  return public.futbol_mis_datos_privados_get(p_token);
end;
$$;

revoke all on function public.futbol_mis_datos_privados_set(text, text, text, text) from public;
grant execute on function public.futbol_mis_datos_privados_set(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cambiar PIN conociendo el PIN actual (hash SHA-256 hex, igual que login)
-- ---------------------------------------------------------------------------
create or replace function public.futbol_cambiar_pin(
  p_token text,
  p_pin_actual_hash text,
  p_pin_nuevo_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_j uuid;
  v_hash text;
begin
  v_j := public._futbol_resolve_token(p_token);
  if length(trim(coalesce(p_pin_nuevo_hash, ''))) < 32 then
    raise exception 'PIN inválido';
  end if;
  select pin_hash into v_hash from jugadores where id = v_j;
  if lower(trim(v_hash)) <> lower(trim(coalesce(p_pin_actual_hash, ''))) then
    raise exception 'PIN actual incorrecto';
  end if;
  update jugadores set pin_hash = lower(trim(p_pin_nuevo_hash)) where id = v_j;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_cambiar_pin(text, text, text) from public;
grant execute on function public.futbol_cambiar_pin(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Compañeros con los que preferís no compartir equipo (solo tu fila)
-- ---------------------------------------------------------------------------
create or replace function public.futbol_evita_companeros_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_j uuid;
begin
  v_j := public._futbol_resolve_token(p_token);
  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('id', e.evita_jugador_id, 'apodo', j.apodo)
        order by j.apodo
      ),
      '[]'::jsonb
    )
    from jugador_evita_equipo e
    join jugadores j on j.id = e.evita_jugador_id
    where e.jugador_id = v_j
  );
end;
$$;

revoke all on function public.futbol_evita_companeros_get(text) from public;
grant execute on function public.futbol_evita_companeros_get(text) to anon, authenticated;

create or replace function public.futbol_evita_companeros_set(p_token text, p_evita_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_j uuid;
  v_ids uuid[];
  v_n int;
  v_x uuid;
begin
  v_j := public._futbol_resolve_token(p_token);
  v_ids := array(
    select distinct x
    from unnest(coalesce(p_evita_ids, array[]::uuid[])) as x
    where x is not null and x <> v_j
  );
  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n > 2 then
    raise exception 'Máximo dos jugadores';
  end if;
  foreach v_x in array v_ids
  loop
    if not exists (select 1 from jugadores where id = v_x) then
      raise exception 'Jugador no válido';
    end if;
  end loop;
  delete from jugador_evita_equipo where jugador_id = v_j;
  insert into jugador_evita_equipo (jugador_id, evita_jugador_id)
  select v_j, x from unnest(v_ids) as x;
  return public.futbol_evita_companeros_get(p_token);
end;
$$;

revoke all on function public.futbol_evita_companeros_set(text, uuid[]) from public;
grant execute on function public.futbol_evita_companeros_set(text, uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aristas no dirigidas para balanceo (cualquier sesión válida; sin dirección)
-- ---------------------------------------------------------------------------
create or replace function public.futbol_evita_equipo_aristas_balanceo(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._futbol_resolve_token(p_token);
  return (
    select coalesce(jsonb_agg(p.obj order by (p.obj->>'a'), (p.obj->>'b')), '[]'::jsonb)
    from (
      select distinct jsonb_build_object(
        'a', least(e.jugador_id, e.evita_jugador_id),
        'b', greatest(e.jugador_id, e.evita_jugador_id)
      ) as obj
      from jugador_evita_equipo e
    ) p
  );
end;
$$;

revoke all on function public.futbol_evita_equipo_aristas_balanceo(text) from public;
grant execute on function public.futbol_evita_equipo_aristas_balanceo(text) to anon, authenticated;
