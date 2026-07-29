-- =============================================================================
-- seed_prueba2_10_jugadores.sql
-- =============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Crea 10 jugadores de prueba en el grupo "prueba2" (todos PIN 1234).
-- Apodos: diego, lucas, mateo, tobi, nacho, fede, rami, seba, pablo, andres
-- Perfiles F11/F5 marcados como cargados (sirve para armar equipos).
--
-- Idempotente: si ya existen (email @seed.prueba2.local), los borra y recrea.
-- =============================================================================

do $$
declare
  v_grupo_id uuid;
  v_pin text := '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'; -- sha256('1234')
  r record;
  v_usuario_id uuid;
  v_jugador_id uuid;
  v_scores jsonb;
  v_f5 jsonb;
  v_i int := 0;
  v_pos text;
  v_alt text;
begin
  select g.id into v_grupo_id
  from public.grupos g
  where lower(trim(g.nombre)) = 'prueba2'
  order by g.created_at desc
  limit 1;

  if v_grupo_id is null then
    raise exception 'No encontré el grupo «prueba2». Creá el grupo antes o revisá el nombre.';
  end if;

  -- Limpiar seeds previos de esta suite
  delete from public.grupo_miembros m
  using public.usuarios u
  where m.usuario_id = u.id
    and u.email like '%@seed.prueba2.local';

  delete from public.jugadores j
  using public.usuarios u
  where j.usuario_id = u.id
    and u.email like '%@seed.prueba2.local';

  delete from public.usuarios u
  where u.email like '%@seed.prueba2.local';

  for r in
    select * from (values
      ('diego',  'Diego López',     'delantero', 'medio'),
      ('lucas',  'Lucas Fernández', 'medio',     'defensa'),
      ('mateo',  'Mateo Ruiz',      'defensa',   'medio'),
      ('tobi',   'Tobías Méndez',   'portero',   'defensa'),
      ('nacho',  'Ignacio Pérez',   'medio',     'delantero'),
      ('fede',   'Federico Sosa',   'delantero', 'medio'),
      ('rami',   'Ramiro Acosta',   'defensa',   'medio'),
      ('seba',   'Sebastián Díaz',  'medio',     'defensa'),
      ('pablo',  'Pablo Gómez',     'delantero', 'medio'),
      ('andres', 'Andrés Silva',    'defensa',   'portero')
    ) as t(apodo, nombre, pos, alt)
  loop
    v_i := v_i + 1;
    v_pos := r.pos;
    v_alt := r.alt;

    -- Scores F11 (1–5) y F5 (1–5) variados para balanceo
    v_scores := jsonb_build_object(
      'controlPrimerToque', 2 + (v_i % 4),
      'pase', 2 + ((v_i + 1) % 4),
      'regate1v1', 2 + ((v_i + 2) % 4),
      'remateFinalizacion', 2 + ((v_i + 3) % 4),
      'juegoAereo', 2 + (v_i % 4),
      'posicionamiento', 2 + ((v_i + 1) % 4),
      'visionJuego', 2 + ((v_i + 2) % 4),
      'movimientosSinBalon', 2 + ((v_i + 3) % 4),
      'tomaDecisiones', 2 + (v_i % 4),
      'comprensionTactica', 2 + ((v_i + 1) % 4),
      'velocidadAceleracion', 2 + ((v_i + 2) % 4),
      'resistencia', 2 + ((v_i + 3) % 4),
      'fuerzaPotencia', 2 + (v_i % 4),
      'agilidadCoordinacion', 2 + ((v_i + 1) % 4),
      'fortalezaMental', 2 + ((v_i + 2) % 4),
      'actitudDisciplina', 3 + (v_i % 3),
      'espirituEquipo', 3 + ((v_i + 1) % 3),
      'motivacion', 3 + ((v_i + 2) % 3)
    );

    v_f5 := jsonb_build_object(
      'pulmon', 2 + (v_i % 4),
      'pegada', 2 + ((v_i + 1) % 4),
      'pase', 2 + ((v_i + 2) % 4),
      'quite', 2 + ((v_i + 3) % 4),
      'compromiso', 3 + (v_i % 3)
    );

    v_usuario_id := gen_random_uuid();
    v_jugador_id := gen_random_uuid();

    insert into public.usuarios (id, email)
    values (v_usuario_id, r.apodo || '@seed.prueba2.local');

    insert into public.jugadores (
      id,
      usuario_id,
      grupo_id,
      apodo,
      pin_hash,
      nombre_completo,
      posicion_preferida,
      posicion_alternativa,
      pie_dominante,
      fecha_nacimiento,
      contacto,
      altura_cm,
      peso_kg,
      historial_lesiones,
      perfil_scores,
      perfil_f5_scores,
      perfil_completo_cargado,
      perfil_f5_cargado,
      modalidad_preferida,
      es_admin
    ) values (
      v_jugador_id,
      v_usuario_id,
      v_grupo_id,
      r.apodo,
      v_pin,
      r.nombre,
      v_pos,
      v_alt,
      case when v_i % 3 = 0 then 'izquierdo' when v_i % 3 = 1 then 'derecho' else 'ambos' end,
      date '1995-01-01' + (v_i * 120),
      r.apodo || '@seed.prueba2.local',
      170 + v_i,
      70 + v_i,
      '',
      v_scores,
      v_f5,
      true,
      true,
      'ambas',
      false
    );

    -- Compat si existe posicion_principal
    begin
      execute 'update public.jugadores set posicion_principal = $1 where id = $2'
        using v_pos, v_jugador_id;
    exception
      when undefined_column then
        null;
    end;

    insert into public.grupo_miembros (grupo_id, usuario_id, jugador_id, rol)
    values (v_grupo_id, v_usuario_id, v_jugador_id, 'miembro');
  end loop;

  raise notice 'OK: 10 jugadores seed en prueba2 (grupo %). PIN de todos: 1234', v_grupo_id;
end $$;

-- Verificación
select
  j.apodo,
  j.nombre_completo,
  j.posicion_preferida,
  j.es_admin,
  j.perfil_completo_cargado,
  j.perfil_f5_cargado,
  g.nombre as grupo
from public.jugadores j
join public.grupos g on g.id = j.grupo_id
where g.nombre ilike 'prueba2'
  and j.apodo in ('diego','lucas','mateo','tobi','nacho','fede','rami','seba','pablo','andres')
order by j.apodo;
