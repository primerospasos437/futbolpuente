-- =============================================================================
-- 30 · Configuración del grupo (admin)
-- =============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- Prerrequisito: 24–29 (grupos, scope, convocatorias con requisitos).
--
-- Qué hace:
--   1) Columnas de config en public.grupos
--   2) Amplía días válidos en convocatorias (lunes…domingo + extra)
--   3) Ventana de anotación y reglas leen la config del grupo
--   4) RPCs: grupo_config_get/set, grupo_miembros_listar, grupo_miembro_set_rol
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Columnas de configuración en grupos
-- ---------------------------------------------------------------------------
alter table public.grupos
  add column if not exists dias_partido text[] not null default array['martes','jueves']::text[],
  add column if not exists fechas_extra date[] not null default array[]::date[],
  add column if not exists hora_partido_default text not null default '21:30',
  add column if not exists anotacion_abre_dias_antes int not null default 7,
  add column if not exists anotacion_abre_hora time not null default time '22:00',
  add column if not exists anotacion_cierra_hora time not null default time '20:00',
  add column if not exists modalidad_grupo text not null default 'ambas',
  add column if not exists cupo_maximo int not null default 14,
  add column if not exists cupo_lista_espera int not null default 6,
  add column if not exists exige_perfil_completo boolean not null default true,
  add column if not exists exige_perfil_f5 boolean not null default true,
  add column if not exists min_valoraciones_perfil int not null default 4,
  add column if not exists complejo_habitual text not null default '',
  add column if not exists notas_lista text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'grupos_modalidad_grupo_chk'
  ) then
    alter table public.grupos
      add constraint grupos_modalidad_grupo_chk
      check (modalidad_grupo in ('f5', 'f7', 'f11', 'ambas'));
  end if;
end $$;

comment on column public.grupos.dias_partido is
  'Días habituales de juego (lunes…domingo).';
comment on column public.grupos.fechas_extra is
  'Fechas puntuales adicionales (fuera de la rotación semanal).';
comment on column public.grupos.anotacion_abre_dias_antes is
  'Días antes del partido en que abre la lista (a anotacion_abre_hora).';
comment on column public.grupos.anotacion_cierra_hora is
  'Hora (día del partido) en que cierra la lista (America/Argentina/Buenos_Aires).';
comment on column public.grupos.min_valoraciones_perfil is
  'Mínimo de compañeros valorados (perfil completo). 0 = no exige.';

-- ---------------------------------------------------------------------------
-- 2. Convocatorias: permitir más días
-- ---------------------------------------------------------------------------
alter table public.convocatorias drop constraint if exists convocatorias_dia_check;

alter table public.convocatorias
  add constraint convocatorias_dia_check
  check (dia in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo','extra'));

-- ---------------------------------------------------------------------------
-- 3. Helpers admin / config
-- ---------------------------------------------------------------------------
create or replace function public._grupo_assert_admin_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_grupo_id uuid;
  v_ok boolean;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);

  select exists (
    select 1
    from public.grupo_miembros m
    where m.grupo_id = v_grupo_id
      and m.jugador_id = v_jugador_id
      and m.rol = 'admin'
  ) or exists (
    select 1 from public.jugadores j
    where j.id = v_jugador_id and coalesce(j.es_admin, false)
  )
  into v_ok;

  if not coalesce(v_ok, false) then
    raise exception 'Solo administradores del grupo';
  end if;
  return v_grupo_id;
end;
$$;

create or replace function public._dia_semana_es(p_fecha date)
returns text
language sql
immutable
as $$
  select case extract(dow from p_fecha)::int
    when 0 then 'domingo'
    when 1 then 'lunes'
    when 2 then 'martes'
    when 3 then 'miercoles'
    when 4 then 'jueves'
    when 5 then 'viernes'
    else 'sabado'
  end;
$$;

create or replace function public._grupo_config_row(p_grupo_id uuid)
returns public.grupos
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g public.grupos;
begin
  select * into g from public.grupos where id = p_grupo_id;
  if g.id is null then
    raise exception 'Grupo no encontrado';
  end if;
  return g;
end;
$$;

create or replace function public._grupo_config_to_json(g public.grupos)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'grupoId', g.id,
    'nombre', g.nombre,
    'inviteCode', g.invite_code,
    'deporte', g.deporte,
    'diasPartido', to_jsonb(coalesce(g.dias_partido, array['martes','jueves']::text[])),
    'fechasExtra', to_jsonb(coalesce(g.fechas_extra, array[]::date[])),
    'horaPartidoDefault', coalesce(g.hora_partido_default, '21:30'),
    'anotacionAbreDiasAntes', coalesce(g.anotacion_abre_dias_antes, 7),
    'anotacionAbreHora', to_char(coalesce(g.anotacion_abre_hora, time '22:00'), 'HH24:MI'),
    'anotacionCierraHora', to_char(coalesce(g.anotacion_cierra_hora, time '20:00'), 'HH24:MI'),
    'modalidadGrupo', coalesce(g.modalidad_grupo, 'ambas'),
    'cupoMaximo', coalesce(g.cupo_maximo, 14),
    'cupoListaEspera', coalesce(g.cupo_lista_espera, 6),
    'exigePerfilCompleto', coalesce(g.exige_perfil_completo, true),
    'exigePerfilF5', coalesce(g.exige_perfil_f5, true),
    'minValoracionesPerfil', coalesce(g.min_valoraciones_perfil, 4),
    'complejoHabitual', coalesce(g.complejo_habitual, ''),
    'notasLista', coalesce(g.notas_lista, '')
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Ventana de anotación según config del grupo
-- ---------------------------------------------------------------------------
drop function if exists public._futbol_convocatoria_validar_ventana(text, date);

create or replace function public._futbol_convocatoria_validar_ventana(
  p_dia text,
  p_fecha date,
  p_grupo_id uuid default null
)
returns void
language plpgsql
stable
as $$
declare
  g public.grupos;
  v_dia_fecha text;
  v_now_local timestamp;
  v_open_ts timestamp;
  v_close_ts timestamp;
  v_abre_h int;
  v_abre_m int;
  v_cierra_h int;
  v_cierra_m int;
  v_dias_antes int;
  v_allowed boolean := false;
begin
  v_dia_fecha := public._dia_semana_es(p_fecha);

  if p_dia = 'extra' then
    null;
  elsif p_dia <> v_dia_fecha then
    raise exception 'La fecha no coincide con el día indicado (%)', p_dia;
  end if;

  if p_grupo_id is not null then
    g := public._grupo_config_row(p_grupo_id);

    if p_dia = 'extra' or (g.fechas_extra is not null and p_fecha = any (g.fechas_extra)) then
      v_allowed := true;
    elsif g.dias_partido is not null and v_dia_fecha = any (g.dias_partido) then
      v_allowed := true;
    end if;

    if not v_allowed then
      raise exception 'Ese día no está habilitado en la configuración del grupo';
    end if;

    v_dias_antes := greatest(coalesce(g.anotacion_abre_dias_antes, 7), 0);
    v_abre_h := extract(hour from coalesce(g.anotacion_abre_hora, time '22:00'))::int;
    v_abre_m := extract(minute from coalesce(g.anotacion_abre_hora, time '22:00'))::int;
    v_cierra_h := extract(hour from coalesce(g.anotacion_cierra_hora, time '20:00'))::int;
    v_cierra_m := extract(minute from coalesce(g.anotacion_cierra_hora, time '20:00'))::int;
  else
    -- Compat sin grupo: comportamiento histórico martes/jueves
    if p_dia not in ('martes', 'jueves', 'extra') and p_dia <> v_dia_fecha then
      raise exception 'Día inválido';
    end if;
    v_dias_antes := 7;
    v_abre_h := 22;
    v_abre_m := 0;
    v_cierra_h := 20;
    v_cierra_m := 0;
  end if;

  v_now_local := (now() at time zone 'America/Argentina/Buenos_Aires');
  v_open_ts := (p_fecha::timestamp - make_interval(days => v_dias_antes))
    + make_interval(hours => v_abre_h, mins => v_abre_m);
  v_close_ts := p_fecha::timestamp + make_interval(hours => v_cierra_h, mins => v_cierra_m);

  if v_now_local < v_open_ts or v_now_local > v_close_ts then
    raise exception
      'Fuera del horario de anotación (abre % día(s) antes a las %:%; cierra el día del partido a las %:%, hora Argentina)',
      v_dias_antes,
      lpad(v_abre_h::text, 2, '0'),
      lpad(v_abre_m::text, 2, '0'),
      lpad(v_cierra_h::text, 2, '0'),
      lpad(v_cierra_m::text, 2, '0');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Anotarse / desanotarse según config
-- ---------------------------------------------------------------------------
create or replace function public.futbol_anotarse(p_token text, p_dia text, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_grupo_id uuid;
  g public.grupos;
  v_next int;
  v_prof_ok boolean;
  v_f5_ok boolean;
  v_val_count int;
  v_inscritos int;
  v_rol text := 'anotado';
  v_dia text;
  v_min_val int;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);
  g := public._grupo_config_row(v_grupo_id);

  v_dia := lower(trim(coalesce(p_dia, '')));
  if v_dia = '' then
    v_dia := public._dia_semana_es(p_fecha);
  end if;
  if v_dia = 'miércoles' then v_dia := 'miercoles'; end if;
  if v_dia = 'sábado' then v_dia := 'sabado'; end if;

  if v_dia not in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo','extra') then
    raise exception 'Día inválido';
  end if;

  -- Fecha extra del grupo → marcar como 'extra'
  if g.fechas_extra is not null and p_fecha = any (g.fechas_extra)
     and not (v_dia = any (coalesce(g.dias_partido, array[]::text[]))) then
    v_dia := 'extra';
  end if;

  perform public._futbol_convocatoria_validar_ventana(v_dia, p_fecha, v_grupo_id);

  select
    coalesce(j.perfil_completo_cargado, false),
    coalesce(j.perfil_f5_cargado, false)
  into v_prof_ok, v_f5_ok
  from public.jugadores j
  where j.id = v_jugador_id;

  if coalesce(g.exige_perfil_completo, true) and not coalesce(v_prof_ok, false) then
    raise exception 'Para anotarte guardá tu perfil completo en «Mis perfiles».';
  end if;
  if coalesce(g.exige_perfil_f5, true) and not coalesce(v_f5_ok, false) then
    raise exception 'Para anotarte guardá tu perfil F5 en «Mis perfiles».';
  end if;

  v_min_val := greatest(coalesce(g.min_valoraciones_perfil, 4), 0);
  if v_min_val > 0 then
    select count(distinct v.para_jugador_id)::int
    into v_val_count
    from public.valoraciones v
    where v.de_jugador_id = v_jugador_id;

    if coalesce(v_val_count, 0) < v_min_val then
      raise exception 'Para anotarte valorá el perfil completo de al menos % compañeros distintos.', v_min_val;
    end if;
  end if;

  select count(*)::int into v_inscritos
  from public.convocatorias c
  where c.dia = v_dia
    and c.fecha_partido = p_fecha
    and coalesce(c.grupo_id, v_grupo_id) = v_grupo_id;

  if v_inscritos >= coalesce(g.cupo_maximo, 14) + coalesce(g.cupo_lista_espera, 0) then
    raise exception 'Lista completa (cupo + espera).';
  end if;
  if v_inscritos >= coalesce(g.cupo_maximo, 14) then
    v_rol := 'lista_espera';
  end if;

  select coalesce(max(orden_inscripcion), 0) + 1 into v_next
  from public.convocatorias
  where dia = v_dia and fecha_partido = p_fecha
    and coalesce(grupo_id, v_grupo_id) = v_grupo_id;

  insert into public.convocatorias (dia, fecha_partido, jugador_id, orden_inscripcion, rol_convocatoria, grupo_id)
  values (v_dia, p_fecha, v_jugador_id, v_next, v_rol, v_grupo_id)
  on conflict (dia, fecha_partido, jugador_id) do nothing;

  return jsonb_build_object('ok', true, 'rol', v_rol);
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
  v_grupo_id uuid;
  g public.grupos;
  v_snap jsonb;
  v_leave_pos int;
  tit_cap int := 11;
  el record;
  v_j uuid;
  v_og int;
  v_old_dense int;
  v_new_dense int;
  v_old_rol text;
  v_new_rol text;
  v_dia text;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);
  g := public._grupo_config_row(v_grupo_id);
  tit_cap := greatest(coalesce(g.cupo_maximo, 11), 1);

  v_dia := lower(trim(coalesce(p_dia, '')));
  if v_dia = 'miércoles' then v_dia := 'miercoles'; end if;
  if v_dia = 'sábado' then v_dia := 'sabado'; end if;
  if v_dia not in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo','extra') then
    raise exception 'Día inválido';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'jugador_id', t.jugador_id,
        'orden_inscripcion', t.orden_inscripcion,
        'old_global', t.old_global
      )
      order by t.orden_inscripcion
    ),
    '[]'::jsonb
  )
  into v_snap
  from (
    select
      c.jugador_id,
      c.orden_inscripcion,
      row_number() over (order by c.orden_inscripcion) as old_global
    from convocatorias c
    where c.dia = v_dia and c.fecha_partido = p_fecha
      and coalesce(c.grupo_id, v_grupo_id) = v_grupo_id
  ) t;

  select (e.elem->>'old_global')::int
  into v_leave_pos
  from jsonb_array_elements(v_snap) as e(elem)
  where (e.elem->>'jugador_id')::uuid = v_jugador_id;

  if v_leave_pos is null then
    delete from convocatorias
    where dia = v_dia and fecha_partido = p_fecha and jugador_id = v_jugador_id;
    return jsonb_build_object('ok', true);
  end if;

  delete from convocatorias
  where dia = v_dia and fecha_partido = p_fecha and jugador_id = v_jugador_id;

  with o as (
    select
      c.id,
      row_number() over (order by c.orden_inscripcion) as nd
    from convocatorias c
    where c.dia = v_dia and c.fecha_partido = p_fecha
      and coalesce(c.grupo_id, v_grupo_id) = v_grupo_id
  )
  update convocatorias c
  set orden_inscripcion = o.nd
  from o
  where c.id = o.id;

  for el in
    select x.elem from jsonb_array_elements(v_snap) as x(elem)
  loop
    v_j := (el.elem->>'jugador_id')::uuid;
    if v_j = v_jugador_id then
      continue;
    end if;

    v_og := (el.elem->>'old_global')::int;
    if v_og < v_leave_pos then
      v_old_dense := v_og;
    elsif v_og > v_leave_pos then
      v_old_dense := v_og - 1;
    else
      continue;
    end if;

    select c.orden_inscripcion
    into v_new_dense
    from convocatorias c
    where c.dia = v_dia and c.fecha_partido = p_fecha and c.jugador_id = v_j
      and coalesce(c.grupo_id, v_grupo_id) = v_grupo_id;

    if v_new_dense is null then
      continue;
    end if;

    v_old_rol := public._futbol_rol_convocatoria_desde_posicion(v_old_dense, tit_cap);
    v_new_rol := public._futbol_rol_convocatoria_desde_posicion(v_new_dense, tit_cap);

    update convocatorias c
    set rol_convocatoria = v_new_rol
    where c.dia = v_dia and c.fecha_partido = p_fecha and c.jugador_id = v_j;

    if v_old_rol is distinct from v_new_rol then
      insert into notificaciones (jugador_id, tipo, titulo, cuerpo, datos)
      values (
        v_j,
        'convocatoria_rol_actualizado',
        'Actualización de convocatoria',
        format('Tu nuevo estado para el %s (%s): %s.', p_fecha, v_dia, v_new_rol),
        jsonb_build_object(
          'dia', v_dia,
          'fecha_partido', p_fecha,
          'rol_anterior', v_old_rol,
          'rol_nuevo', v_new_rol
        )
      );
    end if;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPCs de configuración / miembros
-- ---------------------------------------------------------------------------
create or replace function public.grupo_config_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id uuid;
  g public.grupos;
begin
  perform public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);
  g := public._grupo_config_row(v_grupo_id);
  return public._grupo_config_to_json(g);
end;
$$;

create or replace function public.grupo_config_set(p_token text, p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id uuid;
  g public.grupos;
  v_dias text[];
  v_fechas date[];
  v_mod text;
  v_nombre text;
begin
  v_grupo_id := public._grupo_assert_admin_token(p_token);
  g := public._grupo_config_row(v_grupo_id);

  if p_body ? 'nombre' then
    v_nombre := nullif(trim(p_body->>'nombre'), '');
    if v_nombre is null then
      raise exception 'El nombre del grupo no puede quedar vacío';
    end if;
    g.nombre := v_nombre;
  end if;

  if p_body ? 'diasPartido' then
    select coalesce(array_agg(d), array[]::text[]) into v_dias
    from (
      select distinct
        case
          when lower(trim(x)) in ('miércoles', 'miercoles') then 'miercoles'
          when lower(trim(x)) in ('sábado', 'sabado') then 'sabado'
          else lower(trim(x))
        end as d
      from jsonb_array_elements_text(coalesce(p_body->'diasPartido', '[]'::jsonb)) as t(x)
    ) n
    where n.d in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo');
    if cardinality(v_dias) < 1 then
      raise exception 'Elegí al menos un día de partido';
    end if;
    g.dias_partido := v_dias;
  end if;

  if p_body ? 'fechasExtra' then
    select array_agg(x::date) into v_fechas
    from jsonb_array_elements_text(coalesce(p_body->'fechasExtra', '[]'::jsonb)) as t(x)
    where nullif(trim(x), '') is not null;
    g.fechas_extra := coalesce(v_fechas, array[]::date[]);
  end if;

  if p_body ? 'horaPartidoDefault' then
    g.hora_partido_default := coalesce(nullif(trim(p_body->>'horaPartidoDefault'), ''), '21:30');
  end if;
  if p_body ? 'anotacionAbreDiasAntes' then
    g.anotacion_abre_dias_antes := greatest((p_body->>'anotacionAbreDiasAntes')::int, 0);
  end if;
  if p_body ? 'anotacionAbreHora' then
    g.anotacion_abre_hora := (p_body->>'anotacionAbreHora')::time;
  end if;
  if p_body ? 'anotacionCierraHora' then
    g.anotacion_cierra_hora := (p_body->>'anotacionCierraHora')::time;
  end if;

  if p_body ? 'modalidadGrupo' then
    v_mod := lower(trim(p_body->>'modalidadGrupo'));
    if v_mod not in ('f5', 'f7', 'f11', 'ambas') then
      raise exception 'Modalidad inválida';
    end if;
    g.modalidad_grupo := v_mod;
  end if;

  if p_body ? 'cupoMaximo' then
    g.cupo_maximo := greatest((p_body->>'cupoMaximo')::int, 2);
  end if;
  if p_body ? 'cupoListaEspera' then
    g.cupo_lista_espera := greatest((p_body->>'cupoListaEspera')::int, 0);
  end if;
  if p_body ? 'exigePerfilCompleto' then
    g.exige_perfil_completo := coalesce((p_body->>'exigePerfilCompleto')::boolean, true);
  end if;
  if p_body ? 'exigePerfilF5' then
    g.exige_perfil_f5 := coalesce((p_body->>'exigePerfilF5')::boolean, true);
  end if;
  if p_body ? 'minValoracionesPerfil' then
    g.min_valoraciones_perfil := greatest((p_body->>'minValoracionesPerfil')::int, 0);
  end if;
  if p_body ? 'complejoHabitual' then
    g.complejo_habitual := coalesce(p_body->>'complejoHabitual', '');
  end if;
  if p_body ? 'notasLista' then
    g.notas_lista := coalesce(p_body->>'notasLista', '');
  end if;

  update public.grupos set
    nombre = g.nombre,
    dias_partido = g.dias_partido,
    fechas_extra = g.fechas_extra,
    hora_partido_default = g.hora_partido_default,
    anotacion_abre_dias_antes = g.anotacion_abre_dias_antes,
    anotacion_abre_hora = g.anotacion_abre_hora,
    anotacion_cierra_hora = g.anotacion_cierra_hora,
    modalidad_grupo = g.modalidad_grupo,
    cupo_maximo = g.cupo_maximo,
    cupo_lista_espera = g.cupo_lista_espera,
    exige_perfil_completo = g.exige_perfil_completo,
    exige_perfil_f5 = g.exige_perfil_f5,
    min_valoraciones_perfil = g.min_valoraciones_perfil,
    complejo_habitual = g.complejo_habitual,
    notas_lista = g.notas_lista,
    updated_at = now()
  where id = v_grupo_id;

  g := public._grupo_config_row(v_grupo_id);
  return public._grupo_config_to_json(g);
end;
$$;

create or replace function public.grupo_miembros_listar(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id uuid;
begin
  perform public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);

  return (
    select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.apodo), '[]'::jsonb)
    from (
      select
        m.id as "membresiaId",
        m.usuario_id as "usuarioId",
        m.jugador_id as "jugadorId",
        m.rol,
        (m.rol = 'admin') as "esAdmin",
        m.joined_at as "joinedAt",
        j.apodo,
        j.nombre_completo as "nombreCompleto",
        coalesce(j.es_admin, false) as "esAdminFicha"
      from public.grupo_miembros m
      join public.jugadores j on j.id = m.jugador_id
      where m.grupo_id = v_grupo_id
    ) x
  );
end;
$$;

create or replace function public.grupo_miembro_set_rol(
  p_token text,
  p_jugador_id uuid,
  p_rol text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id uuid;
  v_actor uuid;
  v_rol text;
  v_admins int;
begin
  v_actor := public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_assert_admin_token(p_token);
  v_rol := lower(trim(coalesce(p_rol, '')));
  if v_rol not in ('admin', 'miembro') then
    raise exception 'Rol inválido';
  end if;

  if not exists (
    select 1 from public.grupo_miembros
    where grupo_id = v_grupo_id and jugador_id = p_jugador_id
  ) then
    raise exception 'Ese jugador no es miembro del grupo';
  end if;

  if v_rol = 'miembro' then
    select count(*)::int into v_admins
    from public.grupo_miembros
    where grupo_id = v_grupo_id and rol = 'admin';

    if v_admins <= 1 and exists (
      select 1 from public.grupo_miembros
      where grupo_id = v_grupo_id and jugador_id = p_jugador_id and rol = 'admin'
    ) then
      raise exception 'Debe quedar al menos un administrador en el grupo';
    end if;
  end if;

  update public.grupo_miembros
  set rol = v_rol
  where grupo_id = v_grupo_id and jugador_id = p_jugador_id;

  -- Mantener dual-write con ficha del grupo
  update public.jugadores
  set es_admin = (v_rol = 'admin')
  where id = p_jugador_id and grupo_id = v_grupo_id;

  return jsonb_build_object('ok', true, 'jugadorId', p_jugador_id, 'rol', v_rol);
end;
$$;

revoke all on function public.grupo_config_get(text) from public;
grant execute on function public.grupo_config_get(text) to anon, authenticated;

revoke all on function public.grupo_config_set(text, jsonb) from public;
grant execute on function public.grupo_config_set(text, jsonb) to anon, authenticated;

revoke all on function public.grupo_miembros_listar(text) from public;
grant execute on function public.grupo_miembros_listar(text) to anon, authenticated;

revoke all on function public.grupo_miembro_set_rol(text, uuid, text) from public;
grant execute on function public.grupo_miembro_set_rol(text, uuid, text) to anon, authenticated;

revoke all on function public.futbol_anotarse(text, text, date) from public;
grant execute on function public.futbol_anotarse(text, text, date) to anon, authenticated;

revoke all on function public.futbol_desanotarse(text, text, date) from public;
grant execute on function public.futbol_desanotarse(text, text, date) to anon, authenticated;
