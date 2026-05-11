-- Agregar columna foto a jugadores
-- Ejecutar en Supabase Dashboard → SQL Editor

alter table public.jugadores
  add column if not exists foto_url text default null;

-- RPC: Actualizar foto de perfil
create or replace function public.futbol_update_foto(p_token text, p_foto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);

  update jugadores set foto_url = p_foto where id = v_jugador_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_update_foto(text, text) from public;
grant execute on function public.futbol_update_foto(text, text) to anon, authenticated;

-- Actualizar futbol_list_jugadores para incluir foto_url
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
        altura_cm, peso_kg, historial_lesiones, created_at, foto_url
      from jugadores
      order by apodo
    ) j
  );
end;
$$;
