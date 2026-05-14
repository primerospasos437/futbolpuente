-- Extensión: F5, notificaciones, convocatorias con ventana horaria (ART),
-- partidos con confirmación admin, recuperación de PIN, valoraciones F5.

-- ---------------------------------------------------------------------------
-- Jugador: admin, perfil F5 (1–5)
-- ---------------------------------------------------------------------------
alter table public.jugadores
  add column if not exists es_admin boolean not null default false,
  add column if not exists perfil_f5_scores jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Partidos: confirmación explícita del administrador
-- ---------------------------------------------------------------------------
alter table public.partidos
  add column if not exists confirmado_admin boolean not null default true;

update public.partidos set confirmado_admin = true where confirmado_admin is false;

comment on column public.partidos.confirmado_admin is 'Si false, el armado es borrador: no se notifica a los jugadores.';

-- ---------------------------------------------------------------------------
-- Convocatorias: rol y orden
-- ---------------------------------------------------------------------------
alter table public.convocatorias
  add column if not exists orden_inscripcion int not null default 0,
  add column if not exists rol_convocatoria text not null default 'anotado';

-- ---------------------------------------------------------------------------
-- Notificaciones in-app
-- ---------------------------------------------------------------------------
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  cuerpo text not null default '',
  datos jsonb not null default '{}'::jsonb,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notificaciones_jugador on public.notificaciones (jugador_id, leida, created_at desc);

alter table public.notificaciones enable row level security;

drop policy if exists notificaciones_select_anon on public.notificaciones;
create policy notificaciones_select_anon on public.notificaciones for select to anon using (true);

-- ---------------------------------------------------------------------------
-- Recuperación PIN (código de un solo uso; el envío de mail lo hace Express)
-- ---------------------------------------------------------------------------
create table if not exists public.recuperacion_pin (
  id uuid primary key default gen_random_uuid(),
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  codigo_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_recuperacion_pin_jugador on public.recuperacion_pin (jugador_id, expires_at desc);

-- ---------------------------------------------------------------------------
-- Valoraciones F5 por partido (1–5 estrellas por dimensión)
-- ---------------------------------------------------------------------------
create table if not exists public.valoraciones_f5 (
  de_jugador_id uuid not null references public.jugadores(id) on delete cascade,
  para_jugador_id uuid not null references public.jugadores(id) on delete cascade,
  partido_id uuid not null references public.partidos(id) on delete cascade,
  puntajes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (de_jugador_id, para_jugador_id, partido_id),
  check (de_jugador_id <> para_jugador_id)
);

alter table public.valoraciones_f5 enable row level security;
drop policy if exists valoraciones_f5_select_anon on public.valoraciones_f5;
create policy valoraciones_f5_select_anon on public.valoraciones_f5 for select to anon using (true);

revoke insert, update, delete on public.valoraciones_f5 from anon, authenticated;
grant select on public.valoraciones_f5 to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vista jugadores público (incluye F5 y flag admin)
-- ---------------------------------------------------------------------------
create or replace view public.jugadores_publico
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
  j.es_admin,
  j.created_at,
  j.updated_at
from public.jugadores j;

alter view public.jugadores_publico owner to postgres;
grant select on public.jugadores_publico to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Corregir mensaje de email duplicado en registro
-- ---------------------------------------------------------------------------
create or replace function public.futbol_auth_register(
  p_nombre_completo text,
  p_apodo text,
  p_email text,
  p_pin_hash text,
  p_posicion_preferida text,
  p_posicion_alternativa text,
  p_pie_dominante text,
  p_fecha_nacimiento date,
  p_contacto text,
  p_altura_cm integer,
  p_peso_kg numeric,
  p_perfil_scores jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_token text;
begin
  if exists (
    select 1
    from jugadores j
    where lower(trim(j.apodo)) = lower(trim(p_apodo))
  ) then
    raise exception 'Ese apodo ya está registrado';
  end if;

  if exists (select 1 from usuarios u where lower(u.email) = lower(trim(p_email))) then
    raise exception 'Ese correo ya está registrado';
  end if;

  insert into usuarios (email) values (trim(p_email))
  returning id into v_id;

  insert into jugadores (
    id,
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
    perfil_f5_scores
  ) values (
    v_id,
    trim(p_apodo),
    lower(trim(p_pin_hash)),
    trim(p_nombre_completo),
    trim(p_posicion_preferida),
    trim(p_posicion_alternativa),
    trim(p_pie_dominante),
    p_fecha_nacimiento,
    trim(coalesce(p_contacto, '')),
    p_altura_cm,
    p_peso_kg,
    '',
    coalesce(p_perfil_scores, '{}'::jsonb),
    '{}'::jsonb
  );

  v_token := gen_random_uuid()::text;
  insert into sesiones (token, jugador_id) values (v_token, v_id);

  return jsonb_build_object('token', v_token, 'playerId', v_id::text);
exception
  when unique_violation then
    raise exception 'Ese apodo o correo ya está registrado';
end;
$$;

-- ---------------------------------------------------------------------------
-- Actualizar mi perfil (+ perfil F5 opcional)
-- ---------------------------------------------------------------------------
create or replace function public.futbol_update_mi_perfil(p_token text, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  j record;
  new_nombre text;
  new_pos text;
  new_pos_alt text;
  new_pie text;
  new_fecha date;
  new_contacto text;
  new_alt int;
  new_peso numeric(5,1);
  new_hist text;
  new_prof jsonb;
  new_f5 jsonb;
  dims text[] := array[
    'controlPrimerToque','pase','regate1v1','remateFinalizacion','juegoAereo',
    'posicionamiento','visionJuego','movimientosSinBalon','tomaDecisiones','comprensionTactica',
    'velocidadAceleracion','resistencia','fuerzaPotencia','agilidadCoordinacion',
    'fortalezaMental','actitudDisciplina','espirituEquipo','motivacion'
  ];
  f5dims text[] := array[
    'inteligencia_espacial','transicion_def_of','lectura_juego_coberturas',
    'retencion_bal_pausa','eficacia_pase_apoyo','resolucion_espacios_reducidos',
    'resistencia_intermitente','fuerza_apoyo_core','velocidad_reaccion',
    'colaboracion_colectiva','comunicacion_asertiva','control_emocional'
  ];
  d text;
  v_round int;
begin
  v_id := public.futbol_auth_session_player_id(p_token);
  if v_id is null then
    raise exception 'No autorizado';
  end if;

  select * into j from public.jugadores where id = v_id;

  new_nombre := j.nombre_completo;
  new_pos := j.posicion_preferida;
  new_pos_alt := j.posicion_alternativa;
  new_pie := j.pie_dominante;
  new_fecha := j.fecha_nacimiento;
  new_contacto := j.contacto;
  new_alt := j.altura_cm;
  new_peso := j.peso_kg;
  new_hist := j.historial_lesiones;
  new_prof := j.perfil_scores;
  new_f5 := j.perfil_f5_scores;

  if p_body ? 'nombreCompleto' then
    new_nombre := trim(p_body->>'nombreCompleto');
    if new_nombre = '' then
      raise exception 'nombre inválido';
    end if;
  end if;

  if p_body ? 'posicionPreferida' then
    new_pos := trim(p_body->>'posicionPreferida');
    if new_pos not in ('portero','defensa','medio','delantero') then
      raise exception 'posición inválida';
    end if;
  end if;

  if p_body ? 'posicionAlternativa' then
    new_pos_alt := trim(p_body->>'posicionAlternativa');
    if new_pos_alt not in ('portero','defensa','medio','delantero') then
      new_pos_alt := new_pos;
    end if;
  end if;

  if p_body ? 'pieDominante' then
    new_pie := trim(p_body->>'pieDominante');
    if new_pie not in ('derecho','izquierdo','ambos') then
      new_pie := j.pie_dominante;
    end if;
  end if;

  if p_body ? 'fechaNacimiento' then
    if p_body->'fechaNacimiento' is null
       or jsonb_typeof(p_body->'fechaNacimiento') = 'null'
       or btrim(coalesce(p_body->>'fechaNacimiento', '')) = '' then
      new_fecha := null;
    else
      new_fecha := btrim(p_body->>'fechaNacimiento')::date;
    end if;
  end if;

  if p_body ? 'contacto' then
    new_contacto := left(trim(p_body->>'contacto'), 240);
  end if;

  if p_body ? 'alturaCm' then
    if p_body->'alturaCm' is null or jsonb_typeof(p_body->'alturaCm') = 'null' or (p_body->>'alturaCm' is not null and trim(p_body->>'alturaCm') = '') then
      new_alt := null;
    else
      new_alt := round((p_body->>'alturaCm')::numeric);
      if new_alt < 120 or new_alt > 230 then
        raise exception 'Altura (cm): número entre 120 y 230, o vacío';
      end if;
    end if;
  end if;

  if p_body ? 'pesoKg' then
    if p_body->'pesoKg' is null or jsonb_typeof(p_body->'pesoKg') = 'null' or (p_body->>'pesoKg' is not null and trim(p_body->>'pesoKg') = '') then
      new_peso := null;
    else
      new_peso := round((p_body->>'pesoKg')::numeric * 10) / 10;
      if new_peso < 35 or new_peso > 160 then
        raise exception 'Peso (kg): número entre 35 y 160, o vacío';
      end if;
    end if;
  end if;

  if p_body ? 'historialLesiones' then
    new_hist := left(trim(p_body->>'historialLesiones'), 4000);
  end if;

  if p_body ? 'profile' then
    new_prof := p_body->'profile';
    if new_prof is null or jsonb_typeof(new_prof) <> 'object' then
      raise exception 'Perfil inválido';
    end if;
    foreach d in array dims loop
      if not (new_prof ? d) then
        raise exception 'Falta o es inválido: %', d;
      end if;
      v_round := round((new_prof->>d)::numeric);
      if v_round is null or v_round < 1 or v_round > 10 then
        raise exception '% debe estar entre 1 y 10', d;
      end if;
    end loop;
  end if;

  if p_body ? 'profileF5' then
    new_f5 := p_body->'profileF5';
    if new_f5 is null or jsonb_typeof(new_f5) <> 'object' then
      raise exception 'Perfil F5 inválido';
    end if;
    foreach d in array f5dims loop
      if not (new_f5 ? d) then
        raise exception 'Falta F5: %', d;
      end if;
      v_round := round((new_f5->>d)::numeric);
      if v_round is null or v_round < 1 or v_round > 5 then
        raise exception '% F5 debe estar entre 1 y 5', d;
      end if;
    end loop;
  end if;

  update public.jugadores set
    nombre_completo = new_nombre,
    posicion_preferida = new_pos,
    posicion_alternativa = new_pos_alt,
    pie_dominante = new_pie,
    fecha_nacimiento = new_fecha,
    contacto = new_contacto,
    altura_cm = new_alt,
    peso_kg = new_peso,
    historial_lesiones = new_hist,
    perfil_scores = new_prof,
    perfil_f5_scores = new_f5
  where id = v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Convocatoria con ventana horaria (America/Argentina/Buenos_Aires)
-- DOW: 0=domingo … 2=martes, 4=jueves
-- ---------------------------------------------------------------------------
create or replace function public._futbol_convocatoria_validar_ventana(p_dia text, p_fecha date)
returns void
language plpgsql
stable
as $$
declare
  v_dow int;
  v_now_local timestamp;
  v_open_ts timestamp;
  v_close_ts timestamp;
begin
  v_dow := extract(dow from p_fecha);
  if p_dia = 'martes' and v_dow <> 2 then
    raise exception 'La fecha no es un martes';
  end if;
  if p_dia = 'jueves' and v_dow <> 4 then
    raise exception 'La fecha no es un jueves';
  end if;

  v_now_local := (now() at time zone 'America/Argentina/Buenos_Aires');
  v_open_ts := (p_fecha::timestamp - interval '7 days') + interval '22 hours';
  v_close_ts := p_fecha::timestamp + interval '20 hours';

  if v_now_local < v_open_ts or v_now_local > v_close_ts then
    raise exception 'Fuera del horario de anotación (martes/jueves 22:00 hasta el día de partido 20:00, hora Argentina)';
  end if;
end;
$$;

create or replace function public.futbol_anotarse(p_token text, p_dia text, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_next int;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  if p_dia not in ('martes', 'jueves') then
    raise exception 'Día inválido';
  end if;

  perform public._futbol_convocatoria_validar_ventana(p_dia, p_fecha);

  select coalesce(max(orden_inscripcion), 0) + 1 into v_next
  from convocatorias
  where dia = p_dia and fecha_partido = p_fecha;

  insert into convocatorias (dia, fecha_partido, jugador_id, orden_inscripcion, rol_convocatoria)
  values (p_dia, p_fecha, v_jugador_id, v_next, 'anotado')
  on conflict (dia, fecha_partido, jugador_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.futbol_desanotarse(p_token text, p_dia text, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  if p_dia not in ('martes', 'jueves') then
    raise exception 'Día inválido';
  end if;

  delete from convocatorias
  where dia = p_dia and fecha_partido = p_fecha and jugador_id = v_jugador_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.futbol_list_convocatorias(p_token text)
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
    select coalesce(jsonb_agg(row_to_json(c)::jsonb order by c.dia, c.fecha_partido, c.orden_inscripcion), '[]'::jsonb)
    from (
      select id, dia, fecha_partido, jugador_id, orden_inscripcion, rol_convocatoria, created_at
      from convocatorias
      where fecha_partido >= (current_date - interval '14 days')
      order by fecha_partido, dia, orden_inscripcion
    ) c
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Partido: crear en borrador (sin notificar)
-- ---------------------------------------------------------------------------
create or replace function public.futbol_crear_partido_borrador(
  p_token text,
  p_fecha date,
  p_claros jsonb,
  p_oscuros jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_partido_id uuid;
  v_player jsonb;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  if not coalesce((select es_admin from jugadores where id = v_jugador_id), false) then
    raise exception 'Solo administradores';
  end if;

  insert into partidos (fecha, equipo_claros, equipo_oscuros, creado_por, confirmado_admin)
  values (p_fecha, p_claros, p_oscuros, v_jugador_id, false)
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

revoke all on function public.futbol_crear_partido_borrador(text, date, jsonb, jsonb) from public;
grant execute on function public.futbol_crear_partido_borrador(text, date, jsonb, jsonb) to anon, authenticated;

-- Marca partido confirmado y notifica a convocados
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
begin
  v_admin := public._futbol_resolve_token(p_token);
  if not coalesce((select es_admin from jugadores where id = v_admin), false) then
    raise exception 'Solo administradores';
  end if;

  select * into p from partidos where id = p_partido_id;
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  update partidos set confirmado_admin = true where id = p_partido_id;

  for r in
    select pr.jugador_id, pr.equipo
    from presencias pr
    where pr.partido_id = p_partido_id
    order by pr.equipo, pr.jugador_id
  loop
    insert into notificaciones (jugador_id, tipo, titulo, cuerpo, datos)
    values (
      r.jugador_id,
      'partido_confirmado',
      'Partido confirmado',
      format('Fecha %s. Equipo %s. Revisá la app para ver rivales y colores.', p.fecha, r.equipo),
      jsonb_build_object(
        'partido_id', p_partido_id,
        'fecha', p.fecha,
        'equipo', r.equipo,
        'equipo_claros', p.equipo_claros,
        'equipo_oscuros', p.equipo_oscuros
      )
    );
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_confirmar_partido_admin(text, uuid) from public;
grant execute on function public.futbol_confirmar_partido_admin(text, uuid) to anon, authenticated;

-- Rearmar: vuelve a borrador y borra presencias vinculadas
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
    equipo_oscuros = '[]'::jsonb
  where id = p_partido_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_rearmar_partido_admin(text, uuid) from public;
grant execute on function public.futbol_rearmar_partido_admin(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notificaciones: listar / marcar leída
-- ---------------------------------------------------------------------------
create or replace function public.futbol_list_notificaciones(p_token text, p_limite int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  v_id := public._futbol_resolve_token(p_token);
  return (
    select coalesce(jsonb_agg(row_to_json(n)::jsonb order by n.created_at desc), '[]'::jsonb)
    from (
      select id, tipo, titulo, cuerpo, datos, leida, created_at
      from notificaciones
      where jugador_id = v_id
      order by created_at desc
      limit greatest(1, least(coalesce(p_limite, 50), 200))
    ) n
  );
end;
$$;

revoke all on function public.futbol_list_notificaciones(text, int) from public;
grant execute on function public.futbol_list_notificaciones(text, int) to anon, authenticated;

create or replace function public.futbol_marcar_notificacion_leida(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  v_id := public._futbol_resolve_token(p_token);
  update notificaciones set leida = true where id = p_id and jugador_id = v_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_marcar_notificacion_leida(text, uuid) from public;
grant execute on function public.futbol_marcar_notificacion_leida(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Valoración F5 post-partido
-- ---------------------------------------------------------------------------
create or replace function public.futbol_valorar_f5_partido(
  p_token text,
  p_partido_id uuid,
  p_para_jugador_id uuid,
  p_puntajes jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_de uuid;
  f5dims text[] := array[
    'inteligencia_espacial','transicion_def_of','lectura_juego_coberturas',
    'retencion_bal_pausa','eficacia_pase_apoyo','resolucion_espacios_reducidos',
    'resistencia_intermitente','fuerza_apoyo_core','velocidad_reaccion',
    'colaboracion_colectiva','comunicacion_asertiva','control_emocional'
  ];
  d text;
  v_round int;
begin
  v_de := public.futbol_auth_session_player_id(p_token);
  if v_de is null then raise exception 'No autorizado'; end if;
  if v_de = p_para_jugador_id then raise exception 'No puedes valorarte a ti mismo'; end if;
  if not exists (select 1 from partidos where id = p_partido_id and confirmado_admin = true) then
    raise exception 'Partido no disponible para valoración';
  end if;
  if not exists (select 1 from presencias where partido_id = p_partido_id and jugador_id = v_de) then
    raise exception 'Solo pueden valorar quienes participaron del partido';
  end if;
  if p_puntajes is null or jsonb_typeof(p_puntajes) <> 'object' then
    raise exception 'Puntajes inválidos';
  end if;
  foreach d in array f5dims loop
    if not (p_puntajes ? d) then raise exception 'Falta F5: %', d; end if;
    v_round := round((p_puntajes->>d)::numeric);
    if v_round is null or v_round < 1 or v_round > 5 then
      raise exception '% debe estar entre 1 y 5', d;
    end if;
  end loop;

  insert into valoraciones_f5 (de_jugador_id, para_jugador_id, partido_id, puntajes, updated_at)
  values (v_de, p_para_jugador_id, p_partido_id, p_puntajes, now())
  on conflict (de_jugador_id, para_jugador_id, partido_id)
  do update set puntajes = excluded.puntajes, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.futbol_valorar_f5_partido(text, uuid, uuid, jsonb) from public;
grant execute on function public.futbol_valorar_f5_partido(text, uuid, uuid, jsonb) to anon, authenticated;

revoke all on function public._futbol_convocatoria_validar_ventana(text, date) from public;

revoke all on function public.futbol_anotarse(text, text, date) from public;
grant execute on function public.futbol_anotarse(text, text, date) to anon, authenticated;

revoke all on function public.futbol_desanotarse(text, text, date) from public;
grant execute on function public.futbol_desanotarse(text, text, date) to anon, authenticated;

revoke all on function public.futbol_list_convocatorias(text) from public;
grant execute on function public.futbol_list_convocatorias(text) to anon, authenticated;

revoke all on function public.futbol_auth_register(
  text, text, text, text, text, text, text, date, text, integer, numeric, jsonb
) from public;
grant execute on function public.futbol_auth_register(
  text, text, text, text, text, text, text, date, text, integer, numeric, jsonb
) to anon, authenticated;

-- Lista jugadores con flags y perfil F5 (para armado de equipos / admin)
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
        pie_dominante, perfil_scores, perfil_f5_scores, es_admin, fecha_nacimiento, contacto,
        altura_cm, peso_kg, historial_lesiones, created_at
      from jugadores
      order by apodo
    ) j
  );
end;
$$;

revoke all on function public.futbol_list_jugadores(text) from public;
grant execute on function public.futbol_list_jugadores(text) to anon, authenticated;

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
      select id, fecha, equipo_claros, equipo_oscuros, estado, creado_por, created_at, confirmado_admin
      from partidos
    ) p
  );
end;
$$;

revoke all on function public.futbol_list_partidos(text) from public;
grant execute on function public.futbol_list_partidos(text) to anon, authenticated;

-- Recuperación de PIN (código de un solo uso; el envío del mail lo hace Express con service role)
create or replace function public.futbol_recuperacion_pin_confirmar(
  p_email text,
  p_apodo text,
  p_codigo text,
  p_pin_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador uuid;
  v_hash text;
  v_row record;
begin
  select j.id into v_jugador
  from jugadores j
  join usuarios u on u.id = j.id
  where lower(trim(u.email)) = lower(trim(p_email))
    and lower(trim(j.apodo)) = lower(trim(p_apodo))
  limit 1;

  if v_jugador is null then
    raise exception 'Datos incorrectos o código vencido';
  end if;

  v_hash := lower(encode(digest(trim(p_codigo), 'sha256'), 'hex'));

  select r.* into v_row
  from recuperacion_pin r
  where r.jugador_id = v_jugador
    and r.codigo_hash = v_hash
    and r.expires_at > now()
  order by r.created_at desc
  limit 1;

  if v_row.id is null then
    raise exception 'Datos incorrectos o código vencido';
  end if;

  update jugadores set pin_hash = lower(trim(p_pin_hash)) where id = v_jugador;
  delete from recuperacion_pin where jugador_id = v_jugador;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_recuperacion_pin_confirmar(text, text, text, text) from public;
grant execute on function public.futbol_recuperacion_pin_confirmar(text, text, text, text) to anon, authenticated;
