-- =============================================================================
-- 31 · Estado "grupo configurado" + admin por membresía
-- =============================================================================
-- Ejecutar en Supabase SQL Editor DESPUÉS de 30_grupo_configuracion.sql
--
-- Problema:
--   1) Próximos partidos mostraba Martes/Jueves y reglas por DEFAULT aunque el
--      admin nunca configuró el grupo.
--   2) La nav de Configuración/Equipos miraba solo jugadores.es_admin y a veces
--      no coincidía con grupo_miembros.rol.
--
-- Qué hace:
--   - grupos.configurado (false hasta el primer guardado de config)
--   - grupo_config_get/set exponen y setean el flag
--   - futbol_anotarse bloquea si no está configurado
--   - futbol_me_chrome: apodo + esAdmin (ficha OR membresía del grupo activo)
-- =============================================================================

alter table public.grupos
  add column if not exists configurado boolean not null default false;

comment on column public.grupos.configurado is
  'True tras el primer guardado de Configuración del grupo. Hasta entonces no se muestran listas de anotación.';

-- ---------------------------------------------------------------------------
-- Config JSON (+ configurado)
-- ---------------------------------------------------------------------------
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
    'configurado', coalesce(g.configurado, false),
    'diasPartido', to_jsonb(coalesce(g.dias_partido, array[]::text[])),
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

  -- Primer guardado (o cualquiera) activa el grupo para listas
  g.configurado := true;

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
    configurado = g.configurado,
    updated_at = now()
  where id = v_grupo_id;

  g := public._grupo_config_row(v_grupo_id);
  return public._grupo_config_to_json(g);
end;
$$;

-- ---------------------------------------------------------------------------
-- Anotarse: exige grupo configurado
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

  if not coalesce(g.configurado, false) then
    raise exception 'El administrador todavía no configuró los días de partido del grupo.';
  end if;

  v_dia := lower(trim(coalesce(p_dia, '')));
  if v_dia = '' then
    v_dia := public._dia_semana_es(p_fecha);
  end if;
  if v_dia = 'miércoles' then v_dia := 'miercoles'; end if;
  if v_dia = 'sábado' then v_dia := 'sabado'; end if;

  if v_dia not in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo','extra') then
    raise exception 'Día inválido';
  end if;

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

revoke all on function public.futbol_anotarse(text, text, date) from public;
grant execute on function public.futbol_anotarse(text, text, date) to anon, authenticated;

revoke all on function public.grupo_config_set(text, jsonb) from public;
grant execute on function public.grupo_config_set(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Chrome: admin = ficha OR membresía (por usuario) OR creador del grupo
-- ---------------------------------------------------------------------------
create or replace function public.futbol_me_chrome(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_grupo_id uuid;
  v_usuario_id uuid;
  v_apodo text;
  v_nombre text;
  v_es_admin boolean := false;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);

  begin
    v_grupo_id := public._grupo_id_desde_token(p_token);
  exception
    when others then
      v_grupo_id := null;
  end;

  select j.apodo, j.nombre_completo, coalesce(j.es_admin, false), j.usuario_id
  into v_apodo, v_nombre, v_es_admin, v_usuario_id
  from public.jugadores j
  where j.id = v_jugador_id;

  if v_jugador_id is null or v_apodo is null then
    raise exception 'Jugador no encontrado';
  end if;

  if v_grupo_id is not null and v_usuario_id is not null then
    select
      coalesce(v_es_admin, false)
      or exists (
        select 1 from public.grupo_miembros m
        where m.grupo_id = v_grupo_id
          and m.usuario_id = v_usuario_id
          and m.rol = 'admin'
      )
      or exists (
        select 1 from public.grupos g
        where g.id = v_grupo_id
          and g.creado_por_usuario_id = v_usuario_id
      )
    into v_es_admin;

    -- Autoreparar: creador / membresía admin → ficha + rol alineados
    if coalesce(v_es_admin, false) then
      update public.jugadores
      set es_admin = true
      where id = v_jugador_id and coalesce(es_admin, false) = false;

      update public.grupo_miembros
      set rol = 'admin'
      where grupo_id = v_grupo_id
        and usuario_id = v_usuario_id
        and rol is distinct from 'admin';
    end if;
  end if;

  return jsonb_build_object(
    'apodo', coalesce(nullif(trim(v_apodo), ''), nullif(trim(v_nombre), ''), 'Jugador'),
    'esAdmin', coalesce(v_es_admin, false)
  );
end;
$$;

revoke all on function public.futbol_me_chrome(text) from public;
grant execute on function public.futbol_me_chrome(text) to anon, authenticated;

-- Reparación one-shot de datos ya creados (creador / rol admin sin es_admin)
update public.grupo_miembros m
set rol = 'admin'
from public.grupos g
where g.id = m.grupo_id
  and g.creado_por_usuario_id is not null
  and g.creado_por_usuario_id = m.usuario_id
  and m.rol is distinct from 'admin';

update public.jugadores j
set es_admin = true
from public.grupo_miembros m
where m.jugador_id = j.id
  and m.rol = 'admin'
  and coalesce(j.es_admin, false) = false;

update public.jugadores j
set es_admin = true
from public.grupos g
where g.id = j.grupo_id
  and g.creado_por_usuario_id is not null
  and g.creado_por_usuario_id = j.usuario_id
  and coalesce(j.es_admin, false) = false;
