-- RPCs para acceso a datos desde el frontend (sin backend Express).
-- Ejecutar en Supabase Dashboard → SQL Editor después de 04_rpc_futbol_auth.sql.

-- Validación interna de token (reutiliza lógica de sesiones)
create or replace function public._futbol_resolve_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  select jugador_id into v_jugador_id
  from sesiones
  where token = p_token;
  if v_jugador_id is null then
    raise exception 'No autorizado';
  end if;
  return v_jugador_id;
end;
$$;

-- Lista todos los jugadores (datos públicos)
create or replace function public.futbol_list_jugadores(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  return (
    select coalesce(jsonb_agg(row_to_json(j)::jsonb), '[]'::jsonb)
    from (
      select
        id, apodo, nombre_completo, posicion_preferida, posicion_alternativa,
        pie_dominante, perfil_scores, fecha_nacimiento, contacto,
        altura_cm, peso_kg, historial_lesiones, created_at
      from jugadores
      order by apodo
    ) j
  );
end;
$$;

revoke all on function public.futbol_list_jugadores(text) from public;
grant execute on function public.futbol_list_jugadores(text) to anon, authenticated;

-- Lista todas las valoraciones
create or replace function public.futbol_list_valoraciones(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  return (
    select coalesce(jsonb_agg(row_to_json(v)::jsonb), '[]'::jsonb)
    from (
      select de_jugador_id, para_jugador_id, puntajes, updated_at
      from valoraciones
    ) v
  );
end;
$$;

revoke all on function public.futbol_list_valoraciones(text) from public;
grant execute on function public.futbol_list_valoraciones(text) to anon, authenticated;

-- Actualizar perfil propio
create or replace function public.futbol_update_profile(p_token text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);

  update jugadores set
    nombre_completo = coalesce(p_data->>'nombre_completo', nombre_completo),
    posicion_preferida = coalesce(p_data->>'posicion_preferida', posicion_preferida),
    posicion_alternativa = coalesce(p_data->>'posicion_alternativa', posicion_alternativa),
    pie_dominante = coalesce(p_data->>'pie_dominante', pie_dominante),
    fecha_nacimiento = CASE
      WHEN p_data ? 'fecha_nacimiento' THEN
        CASE WHEN p_data->>'fecha_nacimiento' = '' OR p_data->>'fecha_nacimiento' IS NULL THEN NULL
        ELSE (p_data->>'fecha_nacimiento')::date END
      ELSE fecha_nacimiento END,
    contacto = coalesce(p_data->>'contacto', contacto),
    altura_cm = CASE WHEN p_data ? 'altura_cm' THEN (p_data->>'altura_cm')::integer ELSE altura_cm END,
    peso_kg = CASE WHEN p_data ? 'peso_kg' THEN (p_data->>'peso_kg')::numeric ELSE peso_kg END,
    historial_lesiones = coalesce(p_data->>'historial_lesiones', historial_lesiones),
    perfil_scores = CASE WHEN p_data ? 'perfil_scores' THEN (p_data->'perfil_scores') ELSE perfil_scores END
  where id = v_jugador_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_update_profile(text, jsonb) from public;
grant execute on function public.futbol_update_profile(text, jsonb) to anon, authenticated;

-- Guardar/actualizar valoración de un compañero
create or replace function public.futbol_upsert_rating(p_token text, p_target_id uuid, p_scores jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);

  if v_jugador_id = p_target_id then
    raise exception 'No puedes valorarte a ti mismo';
  end if;

  if not exists (select 1 from jugadores where id = p_target_id) then
    raise exception 'Jugador no encontrado';
  end if;

  insert into valoraciones (de_jugador_id, para_jugador_id, puntajes, updated_at)
  values (v_jugador_id, p_target_id, p_scores, now())
  on conflict (de_jugador_id, para_jugador_id)
  do update set puntajes = p_scores, updated_at = now();

  return jsonb_build_object('saved', true);
end;
$$;

revoke all on function public.futbol_upsert_rating(text, uuid, jsonb) from public;
grant execute on function public.futbol_upsert_rating(text, uuid, jsonb) to anon, authenticated;
