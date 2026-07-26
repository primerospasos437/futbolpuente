-- =============================================================================
-- 27 · Registro sin grupo automático + modalidad preferida (F5 / F11)
-- =============================================================================
-- 1) Nuevos usuarios NO entran al grupo legado «Fútbol Puente Club».
-- 2) jugadores.grupo_id vuelve a ser nullable (ficha global de cuenta).
-- 3) Columna modalidad_preferida: f5 | f11 | ambas.
-- Ejecutar en Supabase SQL Editor después de 24–26.
-- =============================================================================

-- Ficha global: puede existir sin pertenecer a un grupo
alter table public.jugadores
  alter column grupo_id drop not null;

alter table public.jugadores
  add column if not exists modalidad_preferida text not null default 'ambas';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'jugadores_modalidad_preferida_check'
      and conrelid = 'public.jugadores'::regclass
  ) then
    alter table public.jugadores
      add constraint jugadores_modalidad_preferida_check
      check (modalidad_preferida in ('f5', 'f11', 'ambas'));
  end if;
end $$;

comment on column public.jugadores.modalidad_preferida is
  'Modalidad preferida del jugador: f5 (Fútbol 5), f11 (Fútbol 11) o ambas.';

-- Apodo único: por grupo, y global entre fichas sin grupo
drop index if exists public.jugadores_apodo_por_grupo_lower;
create unique index if not exists jugadores_apodo_por_grupo_lower
  on public.jugadores (grupo_id, lower(trim(apodo)))
  where grupo_id is not null;

create unique index if not exists jugadores_apodo_global_lower
  on public.jugadores (lower(trim(apodo)))
  where grupo_id is null;

-- Vista pública con modalidad
drop view if exists public.jugadores_publico cascade;
create view public.jugadores_publico
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
  j.grupo_id,
  j.modalidad_preferida
from public.jugadores j;

alter view public.jugadores_publico owner to postgres;
grant select on public.jugadores_publico to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registro: cuenta + ficha global (sin grupo_miembros ni grupo legado)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'futbol_auth_register'
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;

create function public.futbol_auth_register(
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
  p_perfil_scores jsonb,
  p_cuenta_id uuid default null,
  p_modalidad_preferida text default 'ambas'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_token text;
  v_modalidad text;
begin
  v_modalidad := lower(trim(coalesce(nullif(trim(coalesce(p_modalidad_preferida, '')), ''), 'ambas')));
  if v_modalidad not in ('f5', 'f11', 'ambas') then
    v_modalidad := 'ambas';
  end if;

  if exists (
    select 1 from jugadores j
    where j.grupo_id is null
      and lower(trim(j.apodo)) = lower(trim(p_apodo))
  ) then
    raise exception 'Ese apodo ya está registrado';
  end if;

  if exists (select 1 from usuarios u where lower(u.email) = lower(trim(p_email))) then
    raise exception 'Ese correo ya está registrado';
  end if;

  if p_cuenta_id is not null then
    if exists (select 1 from usuarios u where u.id = p_cuenta_id) then
      raise exception 'Ese correo ya está registrado';
    end if;
    if exists (select 1 from jugadores j where j.id = p_cuenta_id) then
      raise exception 'Ese apodo ya está registrado';
    end if;
    v_id := p_cuenta_id;
    insert into usuarios (id, email) values (v_id, trim(p_email));
  else
    insert into usuarios (email) values (trim(p_email))
    returning id into v_id;
  end if;

  if v_id is null then
    raise exception 'No se pudo crear la cuenta (identificador vacío). Reintentá o contactá al administrador.';
  end if;

  insert into jugadores (
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
    v_id,
    v_id,
    null, -- sin grupo: el wizard pide crear o unirse
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
    false,
    v_modalidad,
    false
  );

  v_token := gen_random_uuid()::text;
  insert into sesiones (token, jugador_id, grupo_id) values (v_token, v_id, null);

  return jsonb_build_object(
    'token', v_token,
    'playerId', v_id::text,
    'grupoId', null
  );
exception
  when unique_violation then
    raise exception 'Ese apodo o correo ya está registrado';
end;
$$;

revoke all on function public.futbol_auth_register(
  text, text, text, text, text, text, text, date, text, integer, numeric, jsonb, uuid, text
) from public;
grant execute on function public.futbol_auth_register(
  text, text, text, text, text, text, text, date, text, integer, numeric, jsonb, uuid, text
) to anon, authenticated;

-- Login: preferir ficha global (sin grupo); si no hay, cualquier ficha con ese apodo+PIN
create or replace function public.futbol_auth_login(p_apodo text, p_pin_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_grupo_id uuid;
  v_usuario_id uuid;
  v_token text;
  v_global_id uuid;
begin
  -- 1) Ficha global (cuenta sin grupo activo)
  select j.id, j.grupo_id, j.usuario_id
  into v_id, v_grupo_id, v_usuario_id
  from jugadores j
  where lower(trim(j.apodo)) = lower(trim(p_apodo))
    and j.pin_hash = lower(trim(p_pin_hash))
    and j.grupo_id is null
  order by j.id desc
  limit 1;

  -- 2) Si no hay global, cualquier ficha con esas credenciales
  if v_id is null then
    select j.id, j.grupo_id, j.usuario_id
    into v_id, v_grupo_id, v_usuario_id
    from jugadores j
    where lower(trim(j.apodo)) = lower(trim(p_apodo))
      and j.pin_hash = lower(trim(p_pin_hash))
    order by j.id desc
    limit 1;
  end if;

  if v_id is null then
    raise exception 'Credenciales incorrectas';
  end if;

  -- 3) Si entró por ficha de grupo pero existe ficha global del mismo usuario, usar la global
  --    (así el wizard de grupos aparece al login).
  if v_grupo_id is not null then
    select jg.id into v_global_id
    from jugadores jg
    where jg.usuario_id = v_usuario_id
      and jg.grupo_id is null
    order by jg.id desc
    limit 1;

    if v_global_id is not null then
      v_id := v_global_id;
      v_grupo_id := null;
    end if;
  end if;

  v_token := gen_random_uuid()::text;
  insert into sesiones (token, jugador_id, grupo_id) values (v_token, v_id, v_grupo_id);

  return jsonb_build_object(
    'token', v_token,
    'playerId', v_id::text,
    'grupoId', case when v_grupo_id is null then null else v_grupo_id::text end
  );
end;
$$;

revoke all on function public.futbol_auth_login(text, text) from public;
grant execute on function public.futbol_auth_login(text, text) to anon, authenticated;

-- Plantilla: preferir ficha global al crear/unirse a un grupo
create or replace function public._grupo_jugador_plantilla(p_usuario_id uuid)
returns public.jugadores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.jugadores;
begin
  select j.* into v_row
  from public.jugadores j
  where j.usuario_id = p_usuario_id
    and j.grupo_id is null
  order by j.id desc
  limit 1;

  if v_row.id is null then
    select j.* into v_row
    from public.jugadores j
    where j.usuario_id = p_usuario_id
    order by j.id desc
    limit 1;
  end if;

  if v_row.id is null then
    raise exception 'Tu cuenta aún no tiene ficha de jugador. Completá el registro primero.';
  end if;

  return v_row;
end;
$$;

-- Al crear jugador en grupo, copiar modalidad
create or replace function public._grupo_crear_jugador_en_grupo(
  p_usuario_id uuid,
  p_grupo_id uuid,
  p_es_admin boolean,
  p_apodo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.jugadores;
  v_new_id uuid;
  v_apodo text;
begin
  if exists (
    select 1 from public.grupo_miembros m
    where m.grupo_id = p_grupo_id and m.usuario_id = p_usuario_id
  ) then
    raise exception 'Ya pertenecés a este grupo';
  end if;

  v_src := public._grupo_jugador_plantilla(p_usuario_id);
  v_apodo := trim(coalesce(nullif(trim(coalesce(p_apodo, '')), ''), v_src.apodo));

  if exists (
    select 1 from public.jugadores j
    where j.grupo_id = p_grupo_id
      and lower(trim(j.apodo)) = lower(v_apodo)
  ) then
    raise exception 'Ese apodo ya está usado en este grupo';
  end if;

  v_new_id := gen_random_uuid();

  insert into public.jugadores (
    id,
    usuario_id,
    grupo_id,
    apodo,
    pin_hash,
    nombre_completo,
    posicion_preferida,
    posicion_alternativa,
    posicion_principal,
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
    v_new_id,
    p_usuario_id,
    p_grupo_id,
    v_apodo,
    v_src.pin_hash,
    v_src.nombre_completo,
    v_src.posicion_preferida,
    coalesce(v_src.posicion_alternativa, v_src.posicion_preferida, 'medio'),
    coalesce(v_src.posicion_principal, v_src.posicion_preferida, 'medio'),
    coalesce(v_src.pie_dominante, 'derecho'),
    v_src.fecha_nacimiento,
    coalesce(v_src.contacto, ''),
    v_src.altura_cm,
    v_src.peso_kg,
    coalesce(v_src.historial_lesiones, ''),
    coalesce(v_src.perfil_scores, '{}'::jsonb),
    coalesce(v_src.perfil_f5_scores, '{}'::jsonb),
    coalesce(v_src.perfil_completo_cargado, false),
    coalesce(v_src.perfil_f5_cargado, false),
    coalesce(v_src.modalidad_preferida, 'ambas'),
    coalesce(p_es_admin, false)
  );

  insert into public.grupo_miembros (grupo_id, usuario_id, jugador_id, rol)
  values (
    p_grupo_id,
    p_usuario_id,
    v_new_id,
    case when p_es_admin then 'admin' else 'miembro' end
  );

  return v_new_id;
end;
$$;

-- Actualizar perfil: aceptar modalidadPreferida
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
      -- App usa 1–5; aceptamos 1–10 por compat
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
