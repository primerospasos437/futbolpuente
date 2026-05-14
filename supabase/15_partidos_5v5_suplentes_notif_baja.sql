-- Partidos 5 vs 5: suplentes ordenados, detalle hora/equipamiento, notificaciones mejoradas,
-- baja de titular con promoción automática del primer suplente.

alter table public.partidos
  add column if not exists suplentes jsonb not null default '[]'::jsonb;

alter table public.partidos
  add column if not exists hora_partido text not null default '21:30';

alter table public.partidos
  add column if not exists texto_equipamiento text not null default '';

comment on column public.partidos.suplentes is 'JSON array ordenado: [{id, apodo}, ...] suplentes (no están en presencias hasta promoción).';
comment on column public.partidos.texto_equipamiento is 'Texto libre: colores de camiseta, cancha, etc.';

-- ---------------------------------------------------------------------------
-- Crear borrador (extendido; una sola firma con valores por defecto)
-- ---------------------------------------------------------------------------
drop function if exists public.futbol_crear_partido_borrador(text, date, jsonb, jsonb);

create or replace function public.futbol_crear_partido_borrador(
  p_token text,
  p_fecha date,
  p_claros jsonb,
  p_oscuros jsonb,
  p_suplentes jsonb default '[]'::jsonb,
  p_hora_partido text default null,
  p_texto_equipamiento text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_partido_id uuid;
  v_player jsonb;
  v_h text;
  v_t text;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  if not coalesce((select es_admin from jugadores where id = v_jugador_id), false) then
    raise exception 'Solo administradores';
  end if;

  v_h := coalesce(nullif(trim(p_hora_partido), ''), '21:30');
  v_t := coalesce(nullif(trim(p_texto_equipamiento), ''), '');

  insert into partidos (
    fecha, equipo_claros, equipo_oscuros, creado_por, confirmado_admin,
    suplentes, hora_partido, texto_equipamiento
  )
  values (
    p_fecha, p_claros, p_oscuros, v_jugador_id, false,
    coalesce(p_suplentes, '[]'::jsonb), v_h, v_t
  )
  returning id into v_partido_id;

  for v_player in select * from jsonb_array_elements(p_claros)
  loop
    insert into presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_player->>'id')::uuid, 'claros', 'convocado')
    on conflict (partido_id, jugador_id) do nothing;
  end loop;

  for v_player in select * from jsonb_array_elements(p_oscuros)
  loop
    insert into presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_player->>'id')::uuid, 'oscuros', 'convocado')
    on conflict (partido_id, jugador_id) do nothing;
  end loop;

  return jsonb_build_object('id', v_partido_id::text, 'ok', true);
end;
$$;

revoke all on function public.futbol_crear_partido_borrador(text, date, jsonb, jsonb, jsonb, text, text) from public;
grant execute on function public.futbol_crear_partido_borrador(text, date, jsonb, jsonb, jsonb, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Confirmar: titulares + suplentes con rol explícito
-- ---------------------------------------------------------------------------
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
  v_rival text;
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

  for r in
    select pr.jugador_id, pr.equipo
    from presencias pr
    where pr.partido_id = p_partido_id
    order by pr.equipo, pr.jugador_id
  loop
    v_rival := case when r.equipo = 'claros' then 'oscuros' else 'claros' end;
    insert into notificaciones (jugador_id, tipo, titulo, cuerpo, datos)
    values (
      r.jugador_id,
      'partido_confirmado',
      'Partido confirmado — titular',
      format(
        'Partido el %s a las %s (hora Argentina). Sos TITULAR en el equipo %s. Rival: equipo %s. %s',
        p.fecha,
        p.hora_partido,
        r.equipo,
        v_rival,
        nullif(trim(p.texto_equipamiento), '')
      ),
      jsonb_build_object(
        'partido_id', p_partido_id,
        'fecha', p.fecha,
        'hora_partido', p.hora_partido,
        'equipo', r.equipo,
        'rol', 'titular',
        'texto_equipamiento', p.texto_equipamiento,
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
        'Partido el %s a las %s (hora Argentina). Sos SUPLENTE %s. Si un titular se da de baja, podés entrar en este orden. %s',
        p.fecha,
        p.hora_partido,
        n,
        nullif(trim(p.texto_equipamiento), '')
      ),
      jsonb_build_object(
        'partido_id', p_partido_id,
        'fecha', p.fecha,
        'hora_partido', p.hora_partido,
        'rol', 'suplente',
        'orden_suplente', n,
        'texto_equipamiento', p.texto_equipamiento
      )
    );
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_confirmar_partido_admin(text, uuid) from public;
grant execute on function public.futbol_confirmar_partido_admin(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rearmar: limpia también suplentes y metadatos
-- ---------------------------------------------------------------------------
create or replace function public.futbol_rearmar_partido_admin(p_token text, p_partido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
begin
  v_admin := public._futbol_resolve_token(p_token);
  if not coalesce((select es_admin from jugadores where id = v_admin), false) then
    raise exception 'Solo administradores';
  end if;

  delete from presencias where partido_id = p_partido_id;
  update partidos set
    confirmado_admin = false,
    equipo_claros = '[]'::jsonb,
    equipo_oscuros = '[]'::jsonb,
    suplentes = '[]'::jsonb,
    hora_partido = '21:30',
    texto_equipamiento = ''
  where id = p_partido_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_rearmar_partido_admin(text, uuid) from public;
grant execute on function public.futbol_rearmar_partido_admin(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Listar partidos (incluye suplentes y hora)
-- ---------------------------------------------------------------------------
create or replace function public.futbol_list_partidos(p_token text)
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
    select coalesce(jsonb_agg(row_to_json(p)::jsonb order by p.fecha desc), '[]'::jsonb)
    from (
      select
        id, fecha, equipo_claros, equipo_oscuros, estado, creado_por, created_at,
        confirmado_admin, suplentes, hora_partido, texto_equipamiento
      from partidos
    ) p
  );
end;
$$;

revoke all on function public.futbol_list_partidos(text) from public;
grant execute on function public.futbol_list_partidos(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Baja de titular en partido confirmado: promueve primer suplente al mismo equipo
-- ---------------------------------------------------------------------------
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
        'Por una baja en el partido del %s a las %s, pasás a TITULAR en el equipo %s. %s',
        pt.fecha,
        pt.hora_partido,
        v_pr.equipo,
        nullif(trim(pt.texto_equipamiento), '')
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
