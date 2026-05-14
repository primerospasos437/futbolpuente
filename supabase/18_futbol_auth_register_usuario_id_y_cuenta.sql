-- Registro: jugadores.usuario_id NOT NULL y opción de crear public.usuarios con el mismo id que auth.users (signUp).
-- El cliente llama primero a supabase.auth.signUp y luego al RPC con p_cuenta_id = user.id.

alter table public.jugadores
  add column if not exists usuario_id uuid references public.usuarios (id) on delete cascade;

update public.jugadores j
set usuario_id = j.id
where j.usuario_id is distinct from j.id;

alter table public.jugadores alter column usuario_id set not null;

comment on column public.jugadores.usuario_id is 'Misma cuenta que public.usuarios(id); alineado con auth.users.id si se usa signUp.';

alter table public.jugadores
  add column if not exists posicion_principal text not null default 'medio';

update public.jugadores j
set posicion_principal = j.posicion_preferida
where j.posicion_principal is distinct from j.posicion_preferida;

-- Evita ambigüedad en PostgREST: una sola firma (último parámetro opcional con default).
drop function if exists public.futbol_auth_register(text, text, text, text, text, text, text, date, text, integer, numeric, jsonb);
drop function if exists public.futbol_auth_register(text, text, text, text, text, text, text, date, text, integer, numeric, jsonb, uuid);

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

  v_token := gen_random_uuid()::text;
  insert into sesiones (token, jugador_id) values (v_token, v_id);

  return jsonb_build_object('token', v_token, 'playerId', v_id::text);
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
