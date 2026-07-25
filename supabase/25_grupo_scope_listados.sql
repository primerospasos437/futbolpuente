-- =============================================================================
-- 25 · Scope de listados por grupo activo (sesión)
-- =============================================================================
-- Ejecutar en Supabase SQL Editor DESPUÉS de 24_grupos_amigos.sql
--
-- Filtra jugadores / partidos / valoraciones por el grupo_id de la sesión
-- (o, si falta, el grupo_id del jugador de la sesión).
-- =============================================================================

create or replace function public._grupo_id_desde_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id uuid;
begin
  select coalesce(s.grupo_id, j.grupo_id) into v_grupo_id
  from public.sesiones s
  join public.jugadores j on j.id = s.jugador_id
  where s.token = p_token;

  if v_grupo_id is null then
    raise exception 'No autorizado';
  end if;
  return v_grupo_id;
end;
$$;

-- Vista pública con grupo_id (sin created_at: no todas las DBs lo tienen)
drop view if exists public.jugadores_publico cascade;

create view public.jugadores_publico
with (security_invoker = false) as
select
  j.id,
  j.apodo,
  j.nombre_completo,
  j.posicion_preferida,
  j.posicion_alternativa,
  j.pie_dominante,
  j.fecha_nacimiento,
  j.contacto,
  j.altura_cm,
  j.peso_kg,
  j.perfil_scores,
  j.perfil_f5_scores,
  j.perfil_completo_cargado,
  j.perfil_f5_cargado,
  j.es_admin,
  j.grupo_id
from public.jugadores j;

alter view public.jugadores_publico owner to postgres;
grant select on public.jugadores_publico to anon, authenticated;

-- Listado de jugadores del grupo activo
create or replace function public.futbol_list_jugadores(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_grupo_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);

  return (
    select coalesce(jsonb_agg(row_to_json(j)::jsonb), '[]'::jsonb)
    from (
      select
        id, apodo, nombre_completo, posicion_preferida, posicion_alternativa,
        pie_dominante, perfil_scores, perfil_f5_scores, fecha_nacimiento, contacto,
        altura_cm, peso_kg, es_admin, grupo_id,
        perfil_completo_cargado, perfil_f5_cargado
      from public.jugadores
      where grupo_id = v_grupo_id
      order by apodo
    ) j
  );
end;
$$;

revoke all on function public.futbol_list_jugadores(text) from public;
grant execute on function public.futbol_list_jugadores(text) to anon, authenticated;

-- Partidos del grupo activo (stats se derivan de acá)
create or replace function public.futbol_list_partidos(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_grupo_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);

  return (
    select coalesce(jsonb_agg(row_to_json(p)::jsonb order by p.fecha desc), '[]'::jsonb)
    from (
      select
        id, fecha, equipo_claros, equipo_oscuros, estado, creado_por, created_at,
        confirmado_admin, suplentes, hora_partido, texto_equipamiento,
        goles_claros, goles_oscuros, mvp_jugador_id, comentario_partido,
        resultado_cargado_at, grupo_id
      from public.partidos
      where grupo_id = v_grupo_id
         or (grupo_id is null and creado_por in (
              select id from public.jugadores where grupo_id = v_grupo_id
            ))
    ) p
  );
end;
$$;

revoke all on function public.futbol_list_partidos(text) from public;
grant execute on function public.futbol_list_partidos(text) to anon, authenticated;

-- Valoraciones solo entre jugadores del mismo grupo
create or replace function public.futbol_list_valoraciones(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_grupo_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);

  return (
    select coalesce(jsonb_agg(row_to_json(v)::jsonb), '[]'::jsonb)
    from (
      select de_jugador_id, para_jugador_id, puntajes, updated_at
      from public.valoraciones val
      where exists (
        select 1 from public.jugadores j1
        where j1.id = val.de_jugador_id and j1.grupo_id = v_grupo_id
      )
      and exists (
        select 1 from public.jugadores j2
        where j2.id = val.para_jugador_id and j2.grupo_id = v_grupo_id
      )
    ) v
  );
end;
$$;

revoke all on function public.futbol_list_valoraciones(text) from public;
grant execute on function public.futbol_list_valoraciones(text) to anon, authenticated;

-- Convocatorias del grupo
create or replace function public.futbol_list_convocatorias(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_grupo_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);

  return (
    select coalesce(jsonb_agg(row_to_json(c)::jsonb), '[]'::jsonb)
    from (
      select *
      from public.convocatorias
      where grupo_id = v_grupo_id
         or (grupo_id is null and jugador_id in (
              select id from public.jugadores where grupo_id = v_grupo_id
            ))
      order by fecha_partido desc
    ) c
  );
end;
$$;

revoke all on function public.futbol_list_convocatorias(text) from public;
grant execute on function public.futbol_list_convocatorias(text) to anon, authenticated;
