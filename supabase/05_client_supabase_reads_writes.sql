-- Cliente frontend (anon key): lecturas vía vista + PostgREST; escrituras vía RPC SECURITY DEFINER.
-- Ejecutá en Supabase → SQL Editor después de schema.sql, 02_app_support.sql y 04_rpc_futbol_auth.sql.

-- ---------------------------------------------------------------------------
-- Vista: columnas públicas (sin pin_hash ni historial_lesiones).
-- security_invoker = false: evalúa con permisos del owner (postgres), sin políticas RLS sobre la base.
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
  j.created_at,
  j.updated_at
from public.jugadores j;

alter view public.jugadores_publico owner to postgres;
grant select on public.jugadores_publico to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Token → jugador_id (para lógica en el cliente y RPCs).
-- ---------------------------------------------------------------------------
create or replace function public.futbol_auth_session_player_id(p_token text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select s.jugador_id
  from public.sesiones s
  where s.token = nullif(trim(p_token), '')
  limit 1;
$$;

revoke all on function public.futbol_auth_session_player_id(text) from public;
grant execute on function public.futbol_auth_session_player_id(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Historial de lesiones: solo el titular del token.
-- ---------------------------------------------------------------------------
create or replace function public.futbol_mi_historial_lesiones(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v text;
begin
  v_id := public.futbol_auth_session_player_id(p_token);
  if v_id is null then
    raise exception 'No autorizado';
  end if;
  select coalesce(j.historial_lesiones, '') into v from public.jugadores j where j.id = v_id;
  return coalesce(v, '');
end;
$$;

revoke all on function public.futbol_mi_historial_lesiones(text) from public;
grant execute on function public.futbol_mi_historial_lesiones(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Valoraciones: solo lectura pública anon (sin INSERT/UPDATE directo).
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.valoraciones from anon, authenticated;
grant select on public.valoraciones to anon, authenticated;

alter table public.valoraciones enable row level security;

drop policy if exists valoraciones_select_anon on public.valoraciones;
create policy valoraciones_select_anon on public.valoraciones
  for select to anon using (true);

drop policy if exists valoraciones_select_authenticated on public.valoraciones;
create policy valoraciones_select_authenticated on public.valoraciones
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Upsert valoración (valida token y que no sea auto-valoración).
-- ---------------------------------------------------------------------------
create or replace function public.futbol_valorar_jugador(
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
  dims text[] := array[
    'controlPrimerToque','pase','regate1v1','remateFinalizacion','juegoAereo',
    'posicionamiento','visionJuego','movimientosSinBalon','tomaDecisiones','comprensionTactica',
    'velocidadAceleracion','resistencia','fuerzaPotencia','agilidadCoordinacion',
    'fortalezaMental','actitudDisciplina','espirituEquipo','motivacion'
  ];
  d text;
  v_round int;
begin
  v_de := public.futbol_auth_session_player_id(p_token);
  if v_de is null then
    raise exception 'No autorizado';
  end if;
  if v_de = p_para_jugador_id then
    raise exception 'No puedes valorarte a ti mismo';
  end if;
  if not exists (select 1 from public.jugadores j where j.id = p_para_jugador_id) then
    raise exception 'Jugador no encontrado';
  end if;
  if p_puntajes is null or jsonb_typeof(p_puntajes) <> 'object' then
    raise exception 'Puntajes inválidos';
  end if;
  foreach d in array dims loop
    if not (p_puntajes ? d) then
      raise exception 'Falta o es inválido: %', d;
    end if;
    v_round := round((p_puntajes->>d)::numeric);
    if v_round is null or v_round < 1 or v_round > 10 then
      raise exception '% debe estar entre 1 y 10', d;
    end if;
  end loop;

  insert into public.valoraciones (de_jugador_id, para_jugador_id, puntajes, updated_at)
  values (v_de, p_para_jugador_id, p_puntajes, now())
  on conflict (de_jugador_id, para_jugador_id)
  do update set puntajes = excluded.puntajes, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.futbol_valorar_jugador(text, uuid, jsonb) from public;
grant execute on function public.futbol_valorar_jugador(text, uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Actualizar mi perfil (misma idea que PATCH /api/me/profile).
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
  dims text[] := array[
    'controlPrimerToque','pase','regate1v1','remateFinalizacion','juegoAereo',
    'posicionamiento','visionJuego','movimientosSinBalon','tomaDecisiones','comprensionTactica',
    'velocidadAceleracion','resistencia','fuerzaPotencia','agilidadCoordinacion',
    'fortalezaMental','actitudDisciplina','espirituEquipo','motivacion'
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
    perfil_scores = new_prof
  where id = v_id;
end;
$$;

revoke all on function public.futbol_update_mi_perfil(text, jsonb) from public;
grant execute on function public.futbol_update_mi_perfil(text, jsonb) to anon, authenticated;

-- Sin acceso directo a tablas con secretos / sesiones: solo vista + RPCs.
revoke all on table public.jugadores from anon, authenticated;
revoke all on table public.sesiones from anon, authenticated;
revoke all on table public.usuarios from anon, authenticated;
