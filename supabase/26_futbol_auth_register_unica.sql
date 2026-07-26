-- =============================================================================
-- 26 · Una sola firma de futbol_auth_register (sin sobrecarga PostgREST)
-- =============================================================================
-- Error típico:
--   Could not choose the best candidate function between: public.futbol_auth_register(...)
-- Causa: coexisten la firma de 12 args (sin p_cuenta_id) y la de 13 (con uuid).
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- =============================================================================

-- Firmas históricas conocidas
drop function if exists public.futbol_auth_register(
  text, text, text, text, text, text, text, text, text, integer, numeric, jsonb
);
drop function if exists public.futbol_auth_register(
  text, text, text, text, text, text, text, date, text, integer, numeric, jsonb
);
drop function if exists public.futbol_auth_register(
  text, text, text, text, text, text, text, date, text, integer, numeric, jsonb, uuid
);

-- Por si quedó alguna otra sobrecarga con el mismo nombre
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'futbol_auth_register'
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;

-- Única versión válida (compatible con el cliente: incluye p_cuenta_id + grupo legado)
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
  p_cuenta_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_token text;
  v_grupo_id uuid;
begin
  select g.id into v_grupo_id
  from public.grupos g
  where g.deporte = 'futbol'
    and lower(trim(g.nombre)) = 'fútbol puente club'
  limit 1;

  if v_grupo_id is null then
    raise exception 'No hay grupo legado. Ejecutá primero el backfill de 24_grupos_amigos.sql.';
  end if;

  if exists (
    select 1
    from jugadores j
    where j.grupo_id = v_grupo_id
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
    perfil_f5_cargado
  ) values (
    v_id,
    v_id,
    v_grupo_id,
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

  insert into public.grupo_miembros (grupo_id, usuario_id, jugador_id, rol)
  values (v_grupo_id, v_id, v_id, 'miembro')
  on conflict (grupo_id, usuario_id) do nothing;

  v_token := gen_random_uuid()::text;
  insert into sesiones (token, jugador_id, grupo_id) values (v_token, v_id, v_grupo_id);

  return jsonb_build_object(
    'token', v_token,
    'playerId', v_id::text,
    'grupoId', v_grupo_id::text
  );
exception
  when unique_violation then
    raise exception 'Ese apodo o correo ya está registrado';
end;
$$;

revoke all on function public.futbol_auth_register(
  text, text, text, text, text, text, text, date, text, integer, numeric, jsonb, uuid
) from public;
grant execute on function public.futbol_auth_register(
  text, text, text, text, text, text, text, date, text, integer, numeric, jsonb, uuid
) to anon, authenticated;
