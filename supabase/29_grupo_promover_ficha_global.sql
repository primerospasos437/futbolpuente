-- =============================================================================
-- 29 · Crear/unirse a grupo: reutilizar ficha global (sin choque de apodo)
-- =============================================================================
-- Error visto: "No se pudo crear tu ficha en el grupo (apodo duplicado)"
-- Causa: al crear el grupo se intentaba INSERT de un 2º jugador con el mismo
-- apodo que la ficha global; un índice UNIQUE legacy sobre apodo lo bloqueaba.
--
-- Solución:
--   1) Limpiar índices UNIQUE viejos de apodo.
--   2) Si el usuario tiene ficha global (grupo_id IS NULL), PROMOVERLA al grupo
--      en lugar de duplicarla.
--   3) Solo copiar ficha cuando ya pertenece a otro grupo.
--   4) Si falla la ficha al crear grupo, borrar el grupo huérfano.
-- =============================================================================

-- Índices legacy / ambiguos
drop index if exists public.jugadores_apodo_lower;
drop index if exists public.jugadores_apodo_por_grupo_lower;
drop index if exists public.jugadores_apodo_global_lower;

-- Unicidad correcta
create unique index if not exists jugadores_apodo_por_grupo_lower
  on public.jugadores (grupo_id, lower(trim(apodo)))
  where grupo_id is not null;

create unique index if not exists jugadores_apodo_global_lower
  on public.jugadores (lower(trim(apodo)))
  where grupo_id is null;

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
  v_global public.jugadores;
  v_new_id uuid;
  v_apodo text;
  v_base text;
  v_suffix int;
begin
  if exists (
    select 1 from public.grupo_miembros m
    where m.grupo_id = p_grupo_id and m.usuario_id = p_usuario_id
  ) then
    raise exception 'Ya pertenecés a este grupo';
  end if;

  -- Preferir ficha global de la cuenta
  select j.* into v_global
  from public.jugadores j
  where j.usuario_id = p_usuario_id
    and j.grupo_id is null
  order by j.id desc
  limit 1;

  if v_global.id is not null then
    v_apodo := trim(coalesce(nullif(trim(coalesce(p_apodo, '')), ''), v_global.apodo));

    if exists (
      select 1 from public.jugadores j
      where j.grupo_id = p_grupo_id
        and lower(trim(j.apodo)) = lower(v_apodo)
        and j.id <> v_global.id
    ) then
      raise exception 'Ese apodo ya está usado en este grupo';
    end if;

    update public.jugadores
    set
      grupo_id = p_grupo_id,
      apodo = v_apodo,
      es_admin = coalesce(p_es_admin, false)
    where id = v_global.id;

    insert into public.grupo_miembros (grupo_id, usuario_id, jugador_id, rol)
    values (
      p_grupo_id,
      p_usuario_id,
      v_global.id,
      case when p_es_admin then 'admin' else 'miembro' end
    );

    return v_global.id;
  end if;

  -- Sin ficha global: clonar desde otra ficha del usuario
  v_src := public._grupo_jugador_plantilla(p_usuario_id);
  v_base := trim(coalesce(nullif(trim(coalesce(p_apodo, '')), ''), v_src.apodo));
  v_apodo := v_base;
  v_suffix := 2;

  while exists (
    select 1 from public.jugadores j
    where j.grupo_id = p_grupo_id
      and lower(trim(j.apodo)) = lower(v_apodo)
  ) loop
    v_apodo := left(v_base, 40) || v_suffix::text;
    v_suffix := v_suffix + 1;
    if v_suffix > 99 then
      raise exception 'Ese apodo ya está usado en este grupo';
    end if;
  end loop;

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

-- grupo_crear: si falla la ficha, siempre limpiar el grupo huérfano
create or replace function public.grupo_crear(
  p_token text,
  p_nombre text,
  p_pin_hash text,
  p_deporte text default 'futbol',
  p_apodo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_grupo_id uuid;
  v_jugador_id uuid;
  v_invite text;
  v_nombre text;
  v_deporte text;
  v_pin text;
begin
  v_usuario_id := public._grupo_usuario_desde_token(p_token);

  v_nombre := trim(coalesce(p_nombre, ''));
  if length(v_nombre) < 3 then
    raise exception 'El nombre del grupo debe tener al menos 3 caracteres';
  end if;

  v_pin := lower(trim(coalesce(p_pin_hash, '')));
  if length(v_pin) < 8 then
    raise exception 'PIN de grupo inválido';
  end if;

  v_deporte := lower(trim(coalesce(nullif(trim(coalesce(p_deporte, '')), ''), 'futbol')));
  if v_deporte not in ('futbol', 'basquet', 'padel', 'tenis', 'hockey', 'otro') then
    raise exception 'Deporte no soportado';
  end if;

  v_invite := public._grupo_nuevo_invite_code();

  begin
    insert into public.grupos (nombre, pin_hash, invite_code, deporte, creado_por_usuario_id)
    values (v_nombre, v_pin, v_invite, v_deporte, v_usuario_id)
    returning id into v_grupo_id;
  exception
    when unique_violation then
      v_invite := public._grupo_nuevo_invite_code();
      begin
        insert into public.grupos (nombre, pin_hash, invite_code, deporte, creado_por_usuario_id)
        values (v_nombre, v_pin, v_invite, v_deporte, v_usuario_id)
        returning id into v_grupo_id;
      exception
        when unique_violation then
          raise exception 'No se pudo crear el grupo por un código de invitación duplicado. Reintentá.';
      end;
  end;

  begin
    v_jugador_id := public._grupo_crear_jugador_en_grupo(
      v_usuario_id, v_grupo_id, true, p_apodo
    );
  exception
    when others then
      delete from public.grupos where id = v_grupo_id;
      raise;
  end;

  perform public._grupo_activar_en_sesion(p_token, v_grupo_id, v_jugador_id);

  return jsonb_build_object(
    'ok', true,
    'grupoId', v_grupo_id::text,
    'nombre', v_nombre,
    'deporte', v_deporte,
    'inviteCode', v_invite,
    'rol', 'admin',
    'jugadorId', v_jugador_id::text,
    'esAdmin', true
  );
end;
$$;

revoke all on function public.grupo_crear(text, text, text, text, text) from public;
grant execute on function public.grupo_crear(text, text, text, text, text) to anon, authenticated;
