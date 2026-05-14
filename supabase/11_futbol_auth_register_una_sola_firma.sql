-- Quitar ambigüedad de PostgREST: "Could not choose the best candidate function" entre
-- futbol_auth_register(..., p_fecha_nacimiento date, ...) y (... p_fecha_nacimiento text, ...).
-- En bases donde corrieron migraciones antiguas pueden coexistir ambas firmas.

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
    perfil_scores,
    perfil_f5_scores
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
    coalesce(p_perfil_scores, '{}'::jsonb),
    '{}'::jsonb
  );

  v_token := gen_random_uuid()::text;
  insert into sesiones (token, jugador_id) values (v_token, v_id);

  return jsonb_build_object('token', v_token, 'playerId', v_id::text);
exception
  when unique_violation then
    raise exception 'Ese apodo o correo ya está registrado';
end;
$$;

revoke all on function public.futbol_auth_register(
  text, text, text, text, text, text, text, date, text, integer, numeric, jsonb
) from public;
grant execute on function public.futbol_auth_register(
  text, text, text, text, text, text, text, date, text, integer, numeric, jsonb
) to anon, authenticated;
