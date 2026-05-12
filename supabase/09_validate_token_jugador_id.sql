-- Parche opcional: si ya tenías desplegado `04_rpc_futbol_auth.sql` sin `jugadorId`,
-- ejecutá solo este archivo en Supabase → SQL Editor.
-- El cliente usa `jugadorId` para sincronizar `futbol_grupo_player_id` y mostrar bien «a quién valorar».

create or replace function public.futbol_auth_validate_token(p_token text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  select s.jugador_id into v_jugador_id
  from sesiones s
  where s.token = p_token
  limit 1;
  if v_jugador_id is null then
    raise exception 'No autorizado';
  end if;
  return jsonb_build_object('valid', true, 'jugadorId', v_jugador_id::text);
end;
$$;
