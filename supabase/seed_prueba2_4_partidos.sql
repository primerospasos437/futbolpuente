-- =============================================================================
-- seed_prueba2_4_partidos.sql
-- =============================================================================
-- 4 partidos confirmados con resultado para el grupo «prueba2».
-- Probar en Jugadores: «Últimos: G/P …» y «Jugó mucho con …».
--
-- Ejecutar DESPUÉS de seed_prueba2_10_jugadores.sql
-- Idempotente: borra partidos con comentario seed_prueba2_4p
-- =============================================================================

do $$
declare
  v_grupo_id uuid;
  v_admin_id uuid;
  v_partido_id uuid;
  v_mvp uuid;
  v_cl jsonb;
  v_os jsonb;
  v_pl jsonb;
  v_jid uuid;
  a text;
begin
  select g.id into v_grupo_id
  from public.grupos g
  where lower(trim(g.nombre)) = 'prueba2'
  order by g.created_at desc
  limit 1;

  if v_grupo_id is null then
    raise exception 'No encontré el grupo «prueba2».';
  end if;

  select j.id into v_admin_id
  from public.jugadores j
  where j.grupo_id = v_grupo_id
  order by coalesce(j.es_admin, false) desc, j.created_at asc
  limit 1;

  delete from public.presencias pr
  using public.partidos p
  where pr.partido_id = p.id
    and p.grupo_id = v_grupo_id
    and coalesce(p.comentario_partido, '') = 'seed_prueba2_4p';

  delete from public.partidos p
  where p.grupo_id = v_grupo_id
    and coalesce(p.comentario_partido, '') = 'seed_prueba2_4p';

  -- Helper inline: armar json de equipo desde apodos
  -- Partido 1 (más viejo): Claros 5-3
  v_cl := '[]'::jsonb;
  v_os := '[]'::jsonb;
  foreach a in array array['diego', 'lucas', 'mateo', 'nacho', 'fede'] loop
    select j.id into v_jid from public.jugadores j where j.grupo_id = v_grupo_id and lower(j.apodo) = a;
    if v_jid is null then raise exception 'Falta jugador %', a; end if;
    v_cl := v_cl || jsonb_build_array(jsonb_build_object('id', v_jid::text, 'apodo', a));
  end loop;
  foreach a in array array['rami', 'seba', 'pablo', 'andres', 'tobi'] loop
    select j.id into v_jid from public.jugadores j where j.grupo_id = v_grupo_id and lower(j.apodo) = a;
    if v_jid is null then raise exception 'Falta jugador %', a; end if;
    v_os := v_os || jsonb_build_array(jsonb_build_object('id', v_jid::text, 'apodo', a));
  end loop;
  select j.id into v_mvp from public.jugadores j where j.grupo_id = v_grupo_id and lower(j.apodo) = 'diego';
  insert into public.partidos (
    fecha, equipo_claros, equipo_oscuros, estado, confirmado_admin,
    creado_por, grupo_id, goles_claros, goles_oscuros, mvp_jugador_id,
    comentario_partido, resultado_cargado_at, hora_partido
  ) values (
    current_date - 28, v_cl, v_os, 'jugado', true,
    v_admin_id, v_grupo_id, 5, 3, v_mvp,
    'seed_prueba2_4p', now(), '21:30'
  ) returning id into v_partido_id;
  for v_pl in select * from jsonb_array_elements(v_cl) loop
    insert into public.presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_pl->>'id')::uuid, 'claros', 'convocado') on conflict do nothing;
  end loop;
  for v_pl in select * from jsonb_array_elements(v_os) loop
    insert into public.presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_pl->>'id')::uuid, 'oscuros', 'convocado') on conflict do nothing;
  end loop;

  -- Partido 2: Oscuros 4-2
  v_cl := '[]'::jsonb; v_os := '[]'::jsonb;
  foreach a in array array['diego', 'lucas', 'nacho', 'rami', 'pablo'] loop
    select j.id into v_jid from public.jugadores j where j.grupo_id = v_grupo_id and lower(j.apodo) = a;
    v_cl := v_cl || jsonb_build_array(jsonb_build_object('id', v_jid::text, 'apodo', a));
  end loop;
  foreach a in array array['mateo', 'fede', 'seba', 'andres', 'tobi'] loop
    select j.id into v_jid from public.jugadores j where j.grupo_id = v_grupo_id and lower(j.apodo) = a;
    v_os := v_os || jsonb_build_array(jsonb_build_object('id', v_jid::text, 'apodo', a));
  end loop;
  select j.id into v_mvp from public.jugadores j where j.grupo_id = v_grupo_id and lower(j.apodo) = 'seba';
  insert into public.partidos (
    fecha, equipo_claros, equipo_oscuros, estado, confirmado_admin,
    creado_por, grupo_id, goles_claros, goles_oscuros, mvp_jugador_id,
    comentario_partido, resultado_cargado_at, hora_partido
  ) values (
    current_date - 21, v_cl, v_os, 'jugado', true,
    v_admin_id, v_grupo_id, 2, 4, v_mvp,
    'seed_prueba2_4p', now(), '21:30'
  ) returning id into v_partido_id;
  for v_pl in select * from jsonb_array_elements(v_cl) loop
    insert into public.presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_pl->>'id')::uuid, 'claros', 'convocado') on conflict do nothing;
  end loop;
  for v_pl in select * from jsonb_array_elements(v_os) loop
    insert into public.presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_pl->>'id')::uuid, 'oscuros', 'convocado') on conflict do nothing;
  end loop;

  -- Partido 3: empate 3-3
  v_cl := '[]'::jsonb; v_os := '[]'::jsonb;
  foreach a in array array['diego', 'lucas', 'nacho', 'mateo', 'andres'] loop
    select j.id into v_jid from public.jugadores j where j.grupo_id = v_grupo_id and lower(j.apodo) = a;
    v_cl := v_cl || jsonb_build_array(jsonb_build_object('id', v_jid::text, 'apodo', a));
  end loop;
  foreach a in array array['fede', 'rami', 'seba', 'pablo', 'tobi'] loop
    select j.id into v_jid from public.jugadores j where j.grupo_id = v_grupo_id and lower(j.apodo) = a;
    v_os := v_os || jsonb_build_array(jsonb_build_object('id', v_jid::text, 'apodo', a));
  end loop;
  select j.id into v_mvp from public.jugadores j where j.grupo_id = v_grupo_id and lower(j.apodo) = 'lucas';
  insert into public.partidos (
    fecha, equipo_claros, equipo_oscuros, estado, confirmado_admin,
    creado_por, grupo_id, goles_claros, goles_oscuros, mvp_jugador_id,
    comentario_partido, resultado_cargado_at, hora_partido
  ) values (
    current_date - 14, v_cl, v_os, 'jugado', true,
    v_admin_id, v_grupo_id, 3, 3, v_mvp,
    'seed_prueba2_4p', now(), '21:30'
  ) returning id into v_partido_id;
  for v_pl in select * from jsonb_array_elements(v_cl) loop
    insert into public.presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_pl->>'id')::uuid, 'claros', 'convocado') on conflict do nothing;
  end loop;
  for v_pl in select * from jsonb_array_elements(v_os) loop
    insert into public.presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_pl->>'id')::uuid, 'oscuros', 'convocado') on conflict do nothing;
  end loop;

  -- Partido 4 (más reciente): Claros 6-4 — diego+lucas+nacho juntos otra vez
  v_cl := '[]'::jsonb; v_os := '[]'::jsonb;
  foreach a in array array['diego', 'lucas', 'nacho', 'fede', 'rami'] loop
    select j.id into v_jid from public.jugadores j where j.grupo_id = v_grupo_id and lower(j.apodo) = a;
    v_cl := v_cl || jsonb_build_array(jsonb_build_object('id', v_jid::text, 'apodo', a));
  end loop;
  foreach a in array array['mateo', 'seba', 'pablo', 'andres', 'tobi'] loop
    select j.id into v_jid from public.jugadores j where j.grupo_id = v_grupo_id and lower(j.apodo) = a;
    v_os := v_os || jsonb_build_array(jsonb_build_object('id', v_jid::text, 'apodo', a));
  end loop;
  select j.id into v_mvp from public.jugadores j where j.grupo_id = v_grupo_id and lower(j.apodo) = 'nacho';
  insert into public.partidos (
    fecha, equipo_claros, equipo_oscuros, estado, confirmado_admin,
    creado_por, grupo_id, goles_claros, goles_oscuros, mvp_jugador_id,
    comentario_partido, resultado_cargado_at, hora_partido
  ) values (
    current_date - 7, v_cl, v_os, 'jugado', true,
    v_admin_id, v_grupo_id, 6, 4, v_mvp,
    'seed_prueba2_4p', now(), '21:30'
  ) returning id into v_partido_id;
  for v_pl in select * from jsonb_array_elements(v_cl) loop
    insert into public.presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_pl->>'id')::uuid, 'claros', 'convocado') on conflict do nothing;
  end loop;
  for v_pl in select * from jsonb_array_elements(v_os) loop
    insert into public.presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_pl->>'id')::uuid, 'oscuros', 'convocado') on conflict do nothing;
  end loop;

  raise notice 'OK: 4 partidos seed en prueba2. Recargá la app (Ctrl+F5).';
end $$;

select p.fecha, p.goles_claros, p.goles_oscuros,
       jsonb_array_length(p.equipo_claros) as claros,
       jsonb_array_length(p.equipo_oscuros) as oscuros
from public.partidos p
join public.grupos g on g.id = p.grupo_id
where lower(g.nombre) = 'prueba2'
  and coalesce(p.comentario_partido, '') = 'seed_prueba2_4p'
order by p.fecha;
