-- Ajuste de textos: notificación automática al confirmar (in-app).
-- Titulares: día, hora, equipo Claros/Oscuros, rival; observación opcional al final.
-- Suplentes: solo número de suplente, día, hora y aviso si pasan a titular (sin observación).
-- Promoción suplente→titular: mismo criterio de texto.

create or replace function public.futbol_confirmar_partido_admin(p_token text, p_partido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  r record;
  p record;
  s jsonb;
  n int := 0;
  v_equipo_label text;
  v_rival_label text;
  v_obs_tit text;
begin
  v_admin := public._futbol_resolve_token(p_token);
  if not coalesce((select es_admin from jugadores where id = v_admin), false) then
    raise exception 'Solo administradores';
  end if;

  select * into p from partidos where id = p_partido_id;
  if not found then
    raise exception 'Partido no encontrado';
  end if;
  if coalesce(p.confirmado_admin, false) then
    raise exception 'El partido ya está confirmado';
  end if;

  update partidos set confirmado_admin = true where id = p_partido_id;

  v_obs_tit := case
    when length(trim(coalesce(p.texto_equipamiento, ''))) > 0 then
      ' Observación: ' || trim(p.texto_equipamiento)
    else ''
  end;

  for r in
    select pr.jugador_id, pr.equipo
    from presencias pr
    where pr.partido_id = p_partido_id
    order by pr.equipo, pr.jugador_id
  loop
    v_equipo_label := case r.equipo when 'claros' then 'Claros' else 'Oscuros' end;
    v_rival_label := case r.equipo when 'claros' then 'Oscuros' else 'Claros' end;
    insert into notificaciones (jugador_id, tipo, titulo, cuerpo, datos)
    values (
      r.jugador_id,
      'partido_confirmado',
      'Partido confirmado — titular',
      format(
        'Partido el %s a las %s hs (Argentina). Sos TITULAR del equipo %s. Tu rival es el equipo %s.%s',
        p.fecha,
        p.hora_partido,
        v_equipo_label,
        v_rival_label,
        v_obs_tit
      ),
      jsonb_build_object(
        'partido_id', p_partido_id,
        'fecha', p.fecha,
        'hora_partido', p.hora_partido,
        'equipo', r.equipo,
        'rol', 'titular',
        'observacion', p.texto_equipamiento,
        'equipo_claros', p.equipo_claros,
        'equipo_oscuros', p.equipo_oscuros
      )
    );
  end loop;

  for s in select * from jsonb_array_elements(coalesce(p.suplentes, '[]'::jsonb))
  loop
    n := n + 1;
    insert into notificaciones (jugador_id, tipo, titulo, cuerpo, datos)
    values (
      (s->>'id')::uuid,
      'partido_confirmado',
      'Partido confirmado — suplente',
      format(
        'Sos SUPLENTE %s para el partido del %s a las %s hs (Argentina). Te avisaremos en la app si pasás a titular.',
        n,
        p.fecha,
        p.hora_partido
      ),
      jsonb_build_object(
        'partido_id', p_partido_id,
        'fecha', p.fecha,
        'hora_partido', p.hora_partido,
        'rol', 'suplente',
        'orden_suplente', n
      )
    );
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_confirmar_partido_admin(text, uuid) from public;
grant execute on function public.futbol_confirmar_partido_admin(text, uuid) to anon, authenticated;

create or replace function public.futbol_baja_titular_partido_confirmado(
  p_token text,
  p_partido_id uuid,
  p_jugador_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self uuid;
  v_target uuid;
  v_pr record;
  pt record;
  v_first jsonb;
  v_new_sup jsonb;
  v_prom_id uuid := null;
  v_equipo_label text;
  v_obs text;
begin
  v_self := public._futbol_resolve_token(p_token);
  v_target := coalesce(p_jugador_id, v_self);

  if v_target <> v_self and not coalesce((select es_admin from jugadores where id = v_self), false) then
    raise exception 'Solo podés dar de baja a otro jugador si sos administrador';
  end if;

  select * into pt from partidos where id = p_partido_id;
  if not found then
    raise exception 'Partido no encontrado';
  end if;
  if not coalesce(pt.confirmado_admin, false) then
    raise exception 'El partido aún no está confirmado';
  end if;

  select * into v_pr from presencias where partido_id = p_partido_id and jugador_id = v_target;
  if not found then
    raise exception 'No figuras como titular en este partido';
  end if;

  v_equipo_label := case v_pr.equipo when 'claros' then 'Claros' else 'Oscuros' end;
  v_obs := case
    when length(trim(coalesce(pt.texto_equipamiento, ''))) > 0 then
      ' Observación: ' || trim(pt.texto_equipamiento)
    else ''
  end;

  delete from presencias where partido_id = p_partido_id and jugador_id = v_target;

  if jsonb_array_length(coalesce(pt.suplentes, '[]'::jsonb)) > 0 then
    v_first := pt.suplentes->0;
    v_prom_id := (v_first->>'id')::uuid;

    select coalesce(jsonb_agg(e order by o), '[]'::jsonb)
      into v_new_sup
    from jsonb_array_elements(pt.suplentes) with ordinality as t(e, o)
    where o > 1;

    update partidos set suplentes = v_new_sup where id = p_partido_id;

    insert into presencias (partido_id, jugador_id, equipo, estado)
    values (p_partido_id, v_prom_id, v_pr.equipo, 'convocado');

    insert into notificaciones (jugador_id, tipo, titulo, cuerpo, datos)
    values (
      v_prom_id,
      'partido_promovido_suplente',
      'Pasaste a titular',
      format(
        'Pasás a TITULAR del equipo %s. Partido el %s a las %s hs (Argentina).%s',
        v_equipo_label,
        pt.fecha,
        pt.hora_partido,
        v_obs
      ),
      jsonb_build_object(
        'partido_id', p_partido_id,
        'fecha', pt.fecha,
        'hora_partido', pt.hora_partido,
        'equipo', v_pr.equipo,
        'rol', 'titular'
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'promovido_id', v_prom_id);
end;
$$;

revoke all on function public.futbol_baja_titular_partido_confirmado(text, uuid, uuid) from public;
grant execute on function public.futbol_baja_titular_partido_confirmado(text, uuid, uuid) to anon, authenticated;

comment on column public.partidos.texto_equipamiento is 'Observación opcional; solo se incluye en notificaciones a titulares al confirmar.';
