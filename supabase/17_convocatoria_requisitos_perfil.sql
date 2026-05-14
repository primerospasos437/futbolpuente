-- Requisitos para anotarse en convocatorias: perfil completo y F5 guardados al menos una vez,
-- y al menos 4 valoraciones de perfil completo a otros jugadores.
-- Los jugadores nuevos arrancan con perfiles vacíos (sin nota hasta guardar).

alter table public.jugadores
  add column if not exists perfil_completo_cargado boolean not null default false,
  add column if not exists perfil_f5_cargado boolean not null default false;

comment on column public.jugadores.perfil_completo_cargado is 'True tras guardar al menos una vez el perfil completo (18 dimensiones 1–10) vía Mis perfiles.';
comment on column public.jugadores.perfil_f5_cargado is 'True tras guardar al menos una vez el perfil F5 (12 dimensiones 1–5) vía Mis perfiles.';

-- Jugadores que ya tenían datos guardados (idempotente).
update public.jugadores j
set perfil_completo_cargado = true
where j.perfil_scores is distinct from '{}'::jsonb;

update public.jugadores j
set perfil_f5_cargado = true
where j.perfil_f5_scores is distinct from '{}'::jsonb;

-- Quienes ya se anotaron alguna vez a convocatoria: no exigirles re-guardar perfiles vacíos por arte de la migración.
update public.jugadores j
set
  perfil_completo_cargado = true,
  perfil_f5_cargado = true
where exists (select 1 from public.convocatorias c where c.jugador_id = j.id);

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
  j.perfil_completo_cargado,
  j.perfil_f5_cargado,
  j.es_admin,
  j.created_at,
  j.updated_at
from public.jugadores j;

alter view public.jugadores_publico owner to postgres;
grant select on public.jugadores_publico to anon, authenticated;

-- Registro: perfiles vacíos; flags en false (salvo default ya true por jugadores viejos no aplica acá).
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
    perfil_f5_scores,
    perfil_completo_cargado,
    perfil_f5_cargado
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
    '{}'::jsonb,
    '{}'::jsonb,
    false,
    false
  );

  v_token := gen_random_uuid()::text;
  insert into sesiones (token, jugador_id) values (v_token, v_id);

  return jsonb_build_object('token', v_token, 'playerId', v_id::text);
exception
  when unique_violation then
    raise exception 'Ese apodo o correo ya está registrado';
end;
$$;

-- Actualizar mi perfil: marcar guardados cuando se envían profile / profileF5.
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
  v_prof_cargado boolean;
  v_f5_cargado boolean;
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
  v_prof_cargado := coalesce(j.perfil_completo_cargado, false);
  v_f5_cargado := coalesce(j.perfil_f5_cargado, false);

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
    v_prof_cargado := true;
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
    v_f5_cargado := true;
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
    perfil_f5_scores = new_f5,
    perfil_completo_cargado = v_prof_cargado,
    perfil_f5_cargado = v_f5_cargado
  where id = v_id;
end;
$$;

-- Anotación: validar perfiles guardados y mínimo 4 valoraciones de perfil completo a otros.
create or replace function public.futbol_anotarse(p_token text, p_dia text, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_next int;
  v_prof_ok boolean;
  v_f5_ok boolean;
  v_val_count int;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  if p_dia not in ('martes', 'jueves') then
    raise exception 'Día inválido';
  end if;

  perform public._futbol_convocatoria_validar_ventana(p_dia, p_fecha);

  select
    coalesce(j.perfil_completo_cargado, false),
    coalesce(j.perfil_f5_cargado, false)
  into v_prof_ok, v_f5_ok
  from public.jugadores j
  where j.id = v_jugador_id;

  if not coalesce(v_prof_ok, false) then
    raise exception 'Para anotarte guardá tu perfil completo en «Mis perfiles» (solapa Perfil completo).';
  end if;
  if not coalesce(v_f5_ok, false) then
    raise exception 'Para anotarte guardá tu perfil F5 en «Mis perfiles» (solapa F5).';
  end if;

  select count(distinct v.para_jugador_id)::int
  into v_val_count
  from public.valoraciones v
  where v.de_jugador_id = v_jugador_id;

  if coalesce(v_val_count, 0) < 4 then
    raise exception 'Para anotarte valorá el perfil completo de al menos 4 compañeros distintos (solapa Jugadores).';
  end if;

  select coalesce(max(orden_inscripcion), 0) + 1 into v_next
  from convocatorias
  where dia = p_dia and fecha_partido = p_fecha;

  insert into convocatorias (dia, fecha_partido, jugador_id, orden_inscripcion, rol_convocatoria)
  values (p_dia, p_fecha, v_jugador_id, v_next, 'anotado')
  on conflict (dia, fecha_partido, jugador_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;
