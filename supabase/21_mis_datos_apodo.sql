-- Mis datos: apodo en get/set. Correo con PIN: ver 20_mis_datos_set_email_usuarios.sql

create or replace function public.futbol_mis_datos_privados_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_j uuid;
  v_email text;
begin
  v_j := public._futbol_resolve_token(p_token);
  select u.email into v_email from public.usuarios u where u.id = v_j;
  return (
    select jsonb_build_object(
      'email', coalesce(v_email, ''),
      'apodo', coalesce(j.apodo, ''),
      'nombre', coalesce(j.nombre_privado, ''),
      'apellido', coalesce(j.apellido_privado, ''),
      'telefono', coalesce(j.telefono_privado, '')
    )
    from public.jugadores j
    where j.id = v_j
  );
end;
$$;

drop function if exists public.futbol_mis_datos_privados_set(text, text, text, text);
drop function if exists public.futbol_mis_datos_privados_set(text, text, text, text, text);
drop function if exists public.futbol_mis_datos_privados_set(text, text, text, text, text, text);
drop function if exists public.futbol_mis_datos_privados_set(text, text, text, text, text, text, text);

create or replace function public.futbol_mis_datos_privados_set(
  p_token text,
  p_nombre text,
  p_apellido text,
  p_telefono text,
  p_apodo text,
  p_email text default null,
  p_pin_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_j uuid;
  v_new text;
  v_hash_guard text;
  v_apodo text;
begin
  v_j := public._futbol_resolve_token(p_token);

  v_apodo := nullif(trim(p_apodo), '');
  if v_apodo is null then
    raise exception 'El apodo es obligatorio';
  end if;
  if exists (
    select 1 from public.jugadores j
    where lower(trim(j.apodo)) = lower(v_apodo)
      and j.id is distinct from v_j
  ) then
    raise exception 'Ese apodo ya está registrado';
  end if;

  update public.jugadores
  set
    apodo = v_apodo,
    nombre_privado = nullif(trim(p_nombre), ''),
    apellido_privado = nullif(trim(p_apellido), ''),
    telefono_privado = nullif(trim(p_telefono), '')
  where id = v_j;

  if p_email is not null and length(btrim(p_email)) > 0 then
    v_new := lower(btrim(p_email));
    if v_new !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Correo electrónico inválido';
    end if;
    if p_pin_hash is null or length(trim(p_pin_hash)) < 32 then
      raise exception 'Para cambiar el correo ingresá tu PIN.';
    end if;
    select j.pin_hash into v_hash_guard from public.jugadores j where j.id = v_j;
    if lower(trim(coalesce(v_hash_guard, ''))) <> lower(trim(coalesce(p_pin_hash, ''))) then
      raise exception 'PIN incorrecto';
    end if;
    if exists (
      select 1 from public.usuarios u
      where lower(btrim(u.email)) = v_new and u.id is distinct from v_j
    ) then
      raise exception 'Ese correo ya está registrado';
    end if;
    update public.usuarios set email = v_new where id = v_j;
  end if;

  return public.futbol_mis_datos_privados_get(p_token);
end;
$$;

revoke all on function public.futbol_mis_datos_privados_set(text, text, text, text, text, text, text) from public;
grant execute on function public.futbol_mis_datos_privados_set(text, text, text, text, text, text, text) to anon, authenticated;
