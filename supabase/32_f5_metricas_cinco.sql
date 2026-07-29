-- Alinea F5 en DB con la app: 5 métricas (pulmón, pegada, pase, quite, compromiso).
-- Antes las RPCs pedían 12 keys viejas (inteligencia_espacial, …) y fallaba «Falta F5: …».

comment on column public.jugadores.perfil_f5_cargado is
  'True tras guardar al menos una vez el perfil F5 (5 métricas 1–5) vía Mis perfiles.';

create or replace function public.futbol_valorar_f5_perfil(
  p_token text,
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
  f5dims text[] := array['pulmon','pegada','pase','quite','compromiso'];
  d text;
  v_round int;
begin
  v_de := public.futbol_auth_session_player_id(p_token);
  if v_de is null then raise exception 'No autorizado'; end if;
  if v_de = p_para_jugador_id then raise exception 'No puedes valorarte a ti mismo'; end if;
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

  insert into valoraciones_f5_perfil (de_jugador_id, para_jugador_id, puntajes, updated_at)
  values (v_de, p_para_jugador_id, p_puntajes, now())
  on conflict (de_jugador_id, para_jugador_id)
  do update set puntajes = excluded.puntajes, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.futbol_valorar_f5_perfil(text, uuid, jsonb) from public;
grant execute on function public.futbol_valorar_f5_perfil(text, uuid, jsonb) to anon, authenticated;

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
  f5dims text[] := array['pulmon','pegada','pase','quite','compromiso'];
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

-- Mis perfiles / update: mismas 5 keys F5
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
  new_modalidad text;
  v_prof_cargado boolean;
  v_f5_cargado boolean;
  dims text[] := array[
    'controlPrimerToque','pase','regate1v1','remateFinalizacion','juegoAereo',
    'posicionamiento','visionJuego','movimientosSinBalon','tomaDecisiones','comprensionTactica',
    'velocidadAceleracion','resistencia','fuerzaPotencia','agilidadCoordinacion',
    'fortalezaMental','actitudDisciplina','espirituEquipo','motivacion'
  ];
  f5dims text[] := array['pulmon','pegada','pase','quite','compromiso'];
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
  new_modalidad := coalesce(j.modalidad_preferida, 'ambas');
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

  if p_body ? 'modalidadPreferida' then
    new_modalidad := lower(trim(p_body->>'modalidadPreferida'));
    if new_modalidad not in ('f5', 'f11', 'ambas') then
      raise exception 'Modalidad inválida (f5, f11 o ambas)';
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
    perfil_f5_cargado = v_f5_cargado,
    modalidad_preferida = new_modalidad
  where id = v_id;
end;
$$;

revoke all on function public.futbol_update_mi_perfil(text, jsonb) from public;
grant execute on function public.futbol_update_mi_perfil(text, jsonb) to anon, authenticated;
