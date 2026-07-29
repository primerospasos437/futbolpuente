-- Avisos por grupo en mis_grupos (conteo + preview de no leídas).

create or replace function public.mis_grupos(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
begin
  v_usuario_id := public._grupo_usuario_desde_token(p_token);

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'grupoId', g.id::text,
          'nombre', g.nombre,
          'deporte', g.deporte,
          'rol', m.rol,
          'esAdmin', (m.rol = 'admin'),
          'jugadorId', m.jugador_id::text,
          'joinedAt', m.joined_at,
          'inviteCode', case when m.rol = 'admin' then g.invite_code else null end,
          'unreadCount', (
            select count(*)::int
            from public.notificaciones n
            where n.jugador_id = m.jugador_id
              and coalesce(n.leida, false) = false
          ),
          'unreadPreview', (
            select n.titulo
            from public.notificaciones n
            where n.jugador_id = m.jugador_id
              and coalesce(n.leida, false) = false
            order by n.created_at desc
            limit 1
          )
        )
        order by m.joined_at asc
      )
      from public.grupo_miembros m
      join public.grupos g on g.id = m.grupo_id
      where m.usuario_id = v_usuario_id
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.mis_grupos(text) from public;
grant execute on function public.mis_grupos(text) to anon, authenticated;
