-- =============================================================================
-- seed_prueba2_encuesta_ayer.sql
-- =============================================================================
-- Partido de AYER finalizado + notificaciones de encuesta Scaloneta.
-- Grupo: prueba2 (requiere seed_prueba2_10_jugadores.sql).
-- Migraciones previas: 38_encuesta_post_partido.sql (+ 39 opcional).
--
-- Qué verás al loguearte como diego / lucas / etc. (PIN 1234):
--   • Campanita 🔔 → «Votación pendiente»
--   • Banner en Inicio → link a la encuesta
--   • /partido/:id/encuesta → Messi / Cuti / Julián / Dibu (+ dificultad)
--
-- Idempotente: borra el seed anterior con el mismo comentario.
-- =============================================================================

do $$
declare
  v_grupo_id uuid;
  v_admin_id uuid;
  v_partido_id uuid;
  v_mvp uuid;
  v_cl jsonb := '[]'::jsonb;
  v_os jsonb := '[]'::jsonb;
  v_pl jsonb;
  v_jid uuid;
  v_fecha date := current_date - 1;
  v_fecha_txt text;
  a text;
begin
  select g.id into v_grupo_id
  from public.grupos g
  where lower(trim(g.nombre)) = 'prueba2'
  order by g.created_at desc
  limit 1;

  if v_grupo_id is null then
    raise exception 'No encontré el grupo «prueba2». Corré primero seed_prueba2_10_jugadores.sql';
  end if;

  select j.id into v_admin_id
  from public.jugadores j
  where j.grupo_id = v_grupo_id
  order by coalesce(j.es_admin, false) desc, j.created_at asc
  limit 1;

  -- Limpiar seed previo (votos, dificultad, notis, presencias, partido)
  delete from public.partido_votos v
  using public.partidos p
  where v.partido_id = p.id
    and p.grupo_id = v_grupo_id
    and coalesce(p.comentario_partido, '') = 'seed_prueba2_encuesta_ayer';

  if to_regclass('public.partido_encuesta_dificultad') is not null then
    delete from public.partido_encuesta_dificultad d
    using public.partidos p
    where d.partido_id = p.id
      and p.grupo_id = v_grupo_id
      and coalesce(p.comentario_partido, '') = 'seed_prueba2_encuesta_ayer';
  end if;

  delete from public.notificaciones n
  using public.partidos p
  where n.tipo = 'encuesta_post_partido'
    and (n.datos->>'partido_id')::uuid = p.id
    and p.grupo_id = v_grupo_id
    and coalesce(p.comentario_partido, '') = 'seed_prueba2_encuesta_ayer';

  delete from public.presencias pr
  using public.partidos p
  where pr.partido_id = p.id
    and p.grupo_id = v_grupo_id
    and coalesce(p.comentario_partido, '') = 'seed_prueba2_encuesta_ayer';

  delete from public.partidos p
  where p.grupo_id = v_grupo_id
    and coalesce(p.comentario_partido, '') = 'seed_prueba2_encuesta_ayer';

  -- Claros 5 · Oscuros 4  (10 titulares seed)
  foreach a in array array['diego', 'lucas', 'mateo', 'nacho', 'fede'] loop
    select j.id into v_jid from public.jugadores j
    where j.grupo_id = v_grupo_id and lower(j.apodo) = a;
    if v_jid is null then raise exception 'Falta jugador % (¿corriste seed_prueba2_10_jugadores?)', a; end if;
    v_cl := v_cl || jsonb_build_array(jsonb_build_object('id', v_jid::text, 'apodo', a));
  end loop;

  foreach a in array array['rami', 'seba', 'pablo', 'andres', 'tobi'] loop
    select j.id into v_jid from public.jugadores j
    where j.grupo_id = v_grupo_id and lower(j.apodo) = a;
    if v_jid is null then raise exception 'Falta jugador %', a; end if;
    v_os := v_os || jsonb_build_array(jsonb_build_object('id', v_jid::text, 'apodo', a));
  end loop;

  select j.id into v_mvp from public.jugadores j
  where j.grupo_id = v_grupo_id and lower(j.apodo) = 'diego';

  insert into public.partidos (
    fecha, equipo_claros, equipo_oscuros, estado, confirmado_admin,
    creado_por, grupo_id, goles_claros, goles_oscuros, mvp_jugador_id,
    comentario_partido, resultado_cargado_at, resultado_cargado_por, hora_partido
  ) values (
    v_fecha, v_cl, v_os, 'finalizado', true,
    v_admin_id, v_grupo_id, 5, 4, v_mvp,
    'seed_prueba2_encuesta_ayer', now(), v_admin_id, '21:30'
  ) returning id into v_partido_id;

  for v_pl in select * from jsonb_array_elements(v_cl) loop
    insert into public.presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_pl->>'id')::uuid, 'claros', 'convocado')
    on conflict do nothing;
  end loop;

  for v_pl in select * from jsonb_array_elements(v_os) loop
    insert into public.presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_pl->>'id')::uuid, 'oscuros', 'convocado')
    on conflict do nothing;
  end loop;

  -- Misma lógica que futbol_cargar_resultado_partido_admin (primera carga)
  v_fecha_txt := to_char(v_fecha, 'DD/MM/YYYY');
  insert into public.notificaciones (jugador_id, tipo, titulo, cuerpo, datos)
  select
    pr.jugador_id,
    'encuesta_post_partido',
    '🏆 Votación pendiente',
    format('Tenés una votación pendiente del partido %s. ¡Elegí al Messi, Cuti, Julián y Dibu!', v_fecha_txt),
    jsonb_build_object(
      'partido_id', v_partido_id,
      'fecha', v_fecha,
      'tipo', 'encuesta_post_partido'
    )
  from public.presencias pr
  where pr.partido_id = v_partido_id
    and pr.estado in ('convocado', 'presente');

  raise notice 'OK: partido encuesta ayer % (id %) · 5-4 · 10 notificaciones. Logueate como diego (PIN 1234) y mirá 🔔 / Inicio.',
    v_fecha, v_partido_id;
end $$;

select
  p.id,
  p.fecha,
  p.estado,
  p.goles_claros,
  p.goles_oscuros,
  (select count(*) from public.presencias pr where pr.partido_id = p.id) as titulares,
  (select count(*) from public.notificaciones n
   where n.tipo = 'encuesta_post_partido'
     and (n.datos->>'partido_id')::uuid = p.id) as notis
from public.partidos p
join public.grupos g on g.id = p.grupo_id
where lower(g.nombre) = 'prueba2'
  and coalesce(p.comentario_partido, '') = 'seed_prueba2_encuesta_ayer';
