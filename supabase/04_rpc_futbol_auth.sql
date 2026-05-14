-- RPCs para registro / login / validación de sesión desde el frontend (anon key).
-- Ejecutá este script en Supabase → SQL Editor si usás RLS sin políticas públicas en tablas.
-- Requiere extensión pgcrypto (ya en schema.sql).
--
-- Migración: si tenías la sobrecarga antigua con `p_fecha_nacimiento text`, este DROP evita funciones duplicadas.
-- Si `jugadores.fecha_nacimiento` sigue siendo TEXT, cambiala a DATE antes (ver comentario en schema.sql).

create extension if not exists "pgcrypto";

do $$
declare
  fn text;
begin
  for fn in
    select format(
      'public.futbol_auth_register(%s)',
      pg_catalog.pg_get_function_identity_arguments(p.oid)
    )
    from pg_catalog.pg_proc p
    inner join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'futbol_auth_register'
      and n.nspname = 'public'
  loop
    execute 'drop function if exists ' || fn || ' cascade';
  end loop;
end $$;

-- Registro: crea usuario + jugador + sesión; mismo hash PIN que el backend (SHA-256 hex en texto).
-- `p_fecha_nacimiento` es tipo date: PostgREST envía JSON null o string ISO YYYY-MM-DD (no cadena vacía).
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
    usuario_id,
    apodo,
    pin_hash,
    nombre_completo,
    posicion_preferida,
    posicion_principal,
    posicion_alternativa,
    pie_dominante,
    fecha_nacimiento,
    contacto,
    altura_cm,
    peso_kg,
    historial_lesiones,
    perfil_scores
  ) values (
    v_id,
    v_id,
    trim(p_apodo),
    lower(trim(p_pin_hash)),
    trim(p_nombre_completo),
    trim(p_posicion_preferida),
    trim(p_posicion_preferida),
    trim(p_posicion_alternativa),
    trim(p_pie_dominante),
    p_fecha_nacimiento,
    trim(coalesce(p_contacto, '')),
    p_altura_cm,
    p_peso_kg,
    '',
    coalesce(p_perfil_scores, '{}'::jsonb)
  );

  v_token := gen_random_uuid()::text;
  insert into sesiones (token, jugador_id) values (v_token, v_id);

  return jsonb_build_object('token', v_token, 'playerId', v_id::text);
exception
  when unique_violation then
    raise exception 'Ese apodo ya está registrado';
end;
$$;

revoke all on function public.futbol_auth_register(
  text, text, text, text, text, text, text, date, text, integer, numeric, jsonb
) from public;

grant execute on function public.futbol_auth_register(
  text, text, text, text, text, text, text, date, text, integer, numeric, jsonb
) to anon, authenticated;


create or replace function public.futbol_auth_login(
  p_apodo text,
  p_pin_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_hash text;
  v_token text;
begin
  select j.id, j.pin_hash
  into v_id, v_hash
  from jugadores j
  where lower(trim(j.apodo)) = lower(trim(p_apodo))
  limit 1;

  if v_id is null or lower(trim(v_hash)) is distinct from lower(trim(p_pin_hash)) then
    raise exception 'Credenciales incorrectas';
  end if;

  v_token := gen_random_uuid()::text;
  insert into sesiones (token, jugador_id) values (v_token, v_id);

  return jsonb_build_object('token', v_token, 'playerId', v_id::text);
end;
$$;

revoke all on function public.futbol_auth_login(text, text) from public;
grant execute on function public.futbol_auth_login(text, text) to anon, authenticated;


create or replace function public.futbol_auth_validate_token(p_token text) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from sesiones s where s.token = p_token) then
    raise exception 'No autorizado';
  end if;
  return jsonb_build_object('valid', true);
end;
$$;

revoke all on function public.futbol_auth_validate_token(text) from public;
grant execute on function public.futbol_auth_validate_token(text) to anon, authenticated;
