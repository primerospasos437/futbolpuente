-- =============================================================================
-- 28 · Crear grupo: nombres repetibles + códigos de invitación más robustos
-- =============================================================================
-- Problema: índice único (deporte, nombre) hacía fallar "Ya existe un grupo..."
-- aunque el PIN/código fueran distintos.
--
-- Cambio:
--   - Se permite el mismo nombre en varios grupos (se distinguen por PIN / invite).
--   - invite_code sigue siendo único; se regenera con más entropía si hay choque.
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

drop index if exists public.grupos_nombre_deporte_lower;

-- Índice no único para búsquedas por nombre (unirse por nombre+PIN)
create index if not exists grupos_nombre_deporte_lower_idx
  on public.grupos (deporte, lower(trim(nombre)));

create or replace function public._grupo_nuevo_invite_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_tries int := 0;
begin
  loop
    -- 10 chars hex-ish + evita ambigüedad visual
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (
      select 1 from public.grupos g where upper(trim(g.invite_code)) = v_code
    );
    v_tries := v_tries + 1;
    if v_tries > 30 then
      raise exception 'No se pudo generar un código de invitación único. Reintentá.';
    end if;
  end loop;
  return v_code;
end;
$$;

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

  -- Nombre puede repetirse; el acceso se diferencia por PIN / código de invitación.
  v_invite := public._grupo_nuevo_invite_code();

  begin
    insert into public.grupos (nombre, pin_hash, invite_code, deporte, creado_por_usuario_id)
    values (v_nombre, v_pin, v_invite, v_deporte, v_usuario_id)
    returning id into v_grupo_id;
  exception
    when unique_violation then
      -- Solo debería ser invite_code (muy raro); regenerar una vez
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
    when unique_violation then
      raise exception 'No se pudo crear tu ficha en el grupo (apodo duplicado). Probá otro apodo.';
    when others then
      -- Si falló la ficha, limpiar el grupo vacío para no dejar basura
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

-- Unirse por nombre: si hay varios con el mismo nombre, el PIN decide cuál
create or replace function public.grupo_unirse(
  p_token text,
  p_pin_hash text default null,
  p_nombre text default null,
  p_invite_code text default null,
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
  v_grupo public.grupos;
  v_jugador_id uuid;
  v_pin text;
  v_deporte text;
  v_nombre text;
  v_invite text;
  v_matches int;
begin
  v_usuario_id := public._grupo_usuario_desde_token(p_token);

  v_nombre := nullif(trim(coalesce(p_nombre, '')), '');
  v_invite := nullif(upper(trim(coalesce(p_invite_code, ''))), '');
  v_pin := nullif(lower(trim(coalesce(p_pin_hash, ''))), '');
  v_deporte := lower(trim(coalesce(nullif(trim(coalesce(p_deporte, '')), ''), 'futbol')));

  if v_invite is not null then
    select g.* into v_grupo
    from public.grupos g
    where upper(trim(g.invite_code)) = v_invite
    limit 1;

    if v_grupo.id is null then
      raise exception 'Código de invitación inválido';
    end if;

    if v_pin is not null and v_pin <> lower(trim(v_grupo.pin_hash)) then
      raise exception 'PIN de grupo incorrecto';
    end if;
  elsif v_nombre is not null then
    if v_pin is null then
      raise exception 'Para unirte por nombre necesitás el PIN del grupo';
    end if;

    select count(*)::int into v_matches
    from public.grupos g
    where g.deporte = v_deporte
      and lower(trim(g.nombre)) = lower(v_nombre);

    if v_matches = 0 then
      raise exception 'No encontramos un grupo con ese nombre';
    end if;

    select g.* into v_grupo
    from public.grupos g
    where g.deporte = v_deporte
      and lower(trim(g.nombre)) = lower(v_nombre)
      and lower(trim(g.pin_hash)) = v_pin
    order by g.id desc
    limit 1;

    if v_grupo.id is null then
      if v_matches > 1 then
        raise exception 'Hay varios grupos con ese nombre. Revisá el PIN o usá el código de invitación.';
      end if;
      raise exception 'PIN de grupo incorrecto';
    end if;
  else
    raise exception 'Indicá el nombre del grupo (y PIN) o un código de invitación';
  end if;

  v_jugador_id := public._grupo_crear_jugador_en_grupo(
    v_usuario_id, v_grupo.id, false, p_apodo
  );

  perform public._grupo_activar_en_sesion(p_token, v_grupo.id, v_jugador_id);

  return jsonb_build_object(
    'ok', true,
    'grupoId', v_grupo.id::text,
    'nombre', v_grupo.nombre,
    'deporte', v_grupo.deporte,
    'inviteCode', null,
    'rol', 'miembro',
    'jugadorId', v_jugador_id::text,
    'esAdmin', false
  );
end;
$$;

revoke all on function public.grupo_unirse(text, text, text, text, text, text) from public;
grant execute on function public.grupo_unirse(text, text, text, text, text, text) to anon, authenticated;
