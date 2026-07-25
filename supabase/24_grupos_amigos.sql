-- =============================================================================
-- 24 · Multi-grupo (tenancy) · Grupo de Amigos
-- =============================================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
--
-- Qué hace este script (Paso 1):
--   1) Crea tablas `grupos` y `grupo_miembros`
--   2) Agrega `grupo_id` a jugadores / partidos / equipos / convocatorias / sesiones
--   3) Backfill: un "grupo legado" con todos los datos actuales
--   4) RPCs: grupo_crear, grupo_unirse, mis_grupos, grupo_entrar
--   5) Compat: futbol_auth_register / login escriben grupo_id (grupo legado)
--
-- Qué NO hace todavía (Pasos 2+ en la app):
--   - Separar registro global de entrada a un grupo (register aún entra al legado)
--   - Filtrar listados/RPCs existentes por grupo activo en todos los queries
--   - Wizard de landing (cuenta → deporte → crear/unirse/lista)
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 0. PRERREQUISITO: jugador ≠ cuenta (1 usuario → N jugadores / grupos)
-- ---------------------------------------------------------------------------
-- Históricamente jugadores.id = usuarios.id (FK 1:1). Para multi-grupo la ficha
-- deportiva es por membresía: id propio + usuario_id apunta a la cuenta global.

do $$
declare
  v_conname text;
begin
  select c.conname into v_conname
  from pg_constraint c
  join pg_class rel on rel.oid = c.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public'
    and rel.relname = 'jugadores'
    and c.contype = 'f'
    and pg_get_constraintdef(c.oid) ilike '%usuarios%'
    and pg_get_constraintdef(c.oid) ilike '%(id)%'
    and pg_get_constraintdef(c.oid) not ilike '%usuario_id%'
  limit 1;

  if v_conname is not null then
    execute format('alter table public.jugadores drop constraint %I', v_conname);
  end if;
end $$;

comment on column public.jugadores.id is
  'Id de ficha en un grupo (ya no tiene que coincidir con usuarios.id).';
comment on column public.jugadores.usuario_id is
  'Cuenta global (usuarios.id / auth.users). Un usuario puede tener varios jugadores.';

-- ---------------------------------------------------------------------------
-- 1. TABLAS NUEVAS
-- ---------------------------------------------------------------------------

create table if not exists public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  -- Hash del PIN/clave del grupo (mismo formato que jugadores.pin_hash: hex SHA-256 en minúsculas).
  pin_hash text not null,
  -- Código corto de invitación (alternativa al nombre+PIN).
  invite_code text not null,
  -- Deporte del módulo (hoy: 'futbol'; mañana: otros del catálogo PlaySportBridge).
  deporte text not null default 'futbol'
    check (deporte in ('futbol', 'basquet', 'padel', 'tenis', 'hockey', 'otro')),
  creado_por_usuario_id uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists grupos_nombre_deporte_lower
  on public.grupos (deporte, lower(trim(nombre)));

create unique index if not exists grupos_invite_code_upper
  on public.grupos (upper(trim(invite_code)));

comment on table public.grupos is
  'Tenant de Grupo de Amigos: roster, partidos y stats viven bajo un grupo.';
comment on column public.grupos.pin_hash is
  'Clave compartida del grupo (hash). No es el PIN personal del jugador.';
comment on column public.grupos.invite_code is
  'Código de invitación; alcanza para unirse sin saber el nombre exacto.';

create table if not exists public.grupo_miembros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  -- Ficha deportiva de ESTA persona DENTRO de ESTE grupo (1 jugador por membresía).
  jugador_id uuid not null references public.jugadores (id) on delete cascade,
  rol text not null default 'miembro'
    check (rol in ('admin', 'miembro')),
  joined_at timestamptz not null default now(),
  unique (grupo_id, usuario_id),
  unique (jugador_id)
);

create index if not exists idx_grupo_miembros_usuario
  on public.grupo_miembros (usuario_id);

create index if not exists idx_grupo_miembros_grupo
  on public.grupo_miembros (grupo_id, rol);

comment on table public.grupo_miembros is
  'Membresía usuario↔grupo. El rol admin reemplaza el sentido de jugadores.es_admin a nivel tenant.';
comment on column public.grupo_miembros.jugador_id is
  'Jugador scoped al grupo. Un mismo usuario puede tener varios jugadores (uno por grupo).';

alter table public.grupos enable row level security;
alter table public.grupo_miembros enable row level security;

-- Sin políticas anon: acceso vía RPCs security definer (igual que el resto de la app).
revoke all on table public.grupos from anon, authenticated;
revoke all on table public.grupo_miembros from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. SCOPE: columnas grupo_id en tablas existentes
-- ---------------------------------------------------------------------------

alter table public.jugadores
  add column if not exists grupo_id uuid references public.grupos (id) on delete cascade;

alter table public.partidos
  add column if not exists grupo_id uuid references public.grupos (id) on delete cascade;

alter table public.equipos
  add column if not exists grupo_id uuid references public.grupos (id) on delete cascade;

alter table public.convocatorias
  add column if not exists grupo_id uuid references public.grupos (id) on delete cascade;

-- Contexto de sesión: qué grupo/jugador está activo (Bridge Paso 2).
alter table public.sesiones
  add column if not exists grupo_id uuid references public.grupos (id) on delete set null;

create index if not exists idx_jugadores_grupo on public.jugadores (grupo_id);
create index if not exists idx_partidos_grupo on public.partidos (grupo_id);
create index if not exists idx_equipos_grupo on public.equipos (grupo_id);
create index if not exists idx_convocatorias_grupo on public.convocatorias (grupo_id);
create index if not exists idx_sesiones_grupo on public.sesiones (grupo_id);

comment on column public.jugadores.grupo_id is
  'Tenant del jugador. Stats/valoraciones quedan scoped porque apuntan a este jugador.';
comment on column public.partidos.grupo_id is
  'Partidos (y por tanto stats derivadas) pertenecen a un grupo.';
comment on column public.sesiones.grupo_id is
  'Grupo activo de la sesión; el Bridge lo usará al elegir crear/unirse/entrar.';

-- ---------------------------------------------------------------------------
-- 3. BACKFILL: grupo legado + datos actuales
-- ---------------------------------------------------------------------------

do $$
declare
  v_grupo_id uuid;
  v_owner uuid;
  v_invite text;
begin
  -- Si ya hay grupos, no recrear el legado (idempotente en re-runs parciales).
  select id into v_grupo_id
  from public.grupos
  where lower(trim(nombre)) = 'fútbol puente club'
    and deporte = 'futbol'
  limit 1;

  if v_grupo_id is null then
    -- Sin order by created_at: en algunas DBs usuarios/jugadores no tienen esa columna.
    select j.usuario_id into v_owner
    from public.jugadores j
    where coalesce(j.es_admin, false) = true
    order by j.id asc
    limit 1;

    if v_owner is null then
      select j.usuario_id into v_owner
      from public.jugadores j
      order by j.id asc
      limit 1;
    end if;

    if v_owner is null then
      select u.id into v_owner from public.usuarios u order by u.id asc limit 1;
    end if;

    v_invite := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    insert into public.grupos (nombre, pin_hash, invite_code, deporte, creado_por_usuario_id)
    values (
      'Fútbol Puente Club',
      -- Placeholder (rotar desde la app en Paso 2+). Acceso actual = apodo + PIN personal.
      '6f3c8e0b2a1d4f7c9e5b8a0d3c6f1e4b7a9d2c5f8e1b4a7d0c3f6e9b2a5d8c1',
      v_invite,
      'futbol',
      v_owner
    )
    returning id into v_grupo_id;
  end if;

  -- Jugadores existentes → grupo legado
  update public.jugadores j
  set grupo_id = v_grupo_id
  where j.grupo_id is null;

  -- Partidos / equipos / convocatorias / sesiones
  update public.partidos p
  set grupo_id = v_grupo_id
  where p.grupo_id is null;

  update public.equipos e
  set grupo_id = v_grupo_id
  where e.grupo_id is null;

  update public.convocatorias c
  set grupo_id = coalesce(
    (select j.grupo_id from public.jugadores j where j.id = c.jugador_id),
    v_grupo_id
  )
  where c.grupo_id is null;

  update public.sesiones s
  set grupo_id = coalesce(
    (select j.grupo_id from public.jugadores j where j.id = s.jugador_id),
    v_grupo_id
  )
  where s.grupo_id is null;

  -- Membresías: un jugador existente = un miembro del grupo legado
  insert into public.grupo_miembros (grupo_id, usuario_id, jugador_id, rol)
  select
    v_grupo_id,
    j.usuario_id,
    j.id,
    case when coalesce(j.es_admin, false) then 'admin' else 'miembro' end
  from public.jugadores j
  where j.grupo_id = v_grupo_id
    and j.usuario_id is not null
  on conflict (grupo_id, usuario_id) do nothing;
end $$;

-- Tras backfill: exigir grupo en fichas de jugador
alter table public.jugadores
  alter column grupo_id set not null;

-- partidos/equipos/convocatorias: nullable + default desde el jugador creador
-- (los RPCs viejos aún no mandan grupo_id; el Paso 2 los filtrará explícitamente)
create or replace function public._set_grupo_id_desde_jugador()
returns trigger
language plpgsql
as $$
begin
  if new.grupo_id is null and new.creado_por is not null then
    select j.grupo_id into new.grupo_id
    from public.jugadores j
    where j.id = new.creado_por;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_partidos_grupo_default on public.partidos;
create trigger trg_partidos_grupo_default
before insert on public.partidos
for each row execute function public._set_grupo_id_desde_jugador();

create or replace function public._set_grupo_id_equipos()
returns trigger
language plpgsql
as $$
begin
  if new.grupo_id is null and new.creado_por_jugador_id is not null then
    select j.grupo_id into new.grupo_id
    from public.jugadores j
    where j.id = new.creado_por_jugador_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_equipos_grupo_default on public.equipos;
create trigger trg_equipos_grupo_default
before insert on public.equipos
for each row execute function public._set_grupo_id_equipos();

create or replace function public._set_grupo_id_convocatorias()
returns trigger
language plpgsql
as $$
begin
  if new.grupo_id is null and new.jugador_id is not null then
    select j.grupo_id into new.grupo_id
    from public.jugadores j
    where j.id = new.jugador_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_convocatorias_grupo_default on public.convocatorias;
create trigger trg_convocatorias_grupo_default
before insert on public.convocatorias
for each row execute function public._set_grupo_id_convocatorias();

-- Apodo único POR GRUPO (deja de ser global)
drop index if exists public.jugadores_apodo_lower;

create unique index if not exists jugadores_apodo_por_grupo_lower
  on public.jugadores (grupo_id, lower(trim(apodo)));

-- Convocatorias: unicidad scoped al grupo
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'convocatorias_dia_fecha_partido_jugador_id_key'
      and conrelid = 'public.convocatorias'::regclass
  ) then
    alter table public.convocatorias
      drop constraint convocatorias_dia_fecha_partido_jugador_id_key;
  end if;
exception
  when undefined_object then null;
end $$;

create unique index if not exists convocatorias_grupo_dia_fecha_jugador
  on public.convocatorias (grupo_id, dia, fecha_partido, jugador_id);

-- ---------------------------------------------------------------------------
-- 4. HELPERS INTERNOS
-- ---------------------------------------------------------------------------

create or replace function public._grupo_nuevo_invite_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_tries int := 0;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1 from public.grupos g where upper(g.invite_code) = v_code
    );
    v_tries := v_tries + 1;
    if v_tries > 20 then
      raise exception 'No se pudo generar código de invitación';
    end if;
  end loop;
  return v_code;
end;
$$;

create or replace function public._grupo_usuario_desde_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
begin
  if p_token is null or trim(p_token) = '' then
    raise exception 'No autorizado';
  end if;

  select j.usuario_id into v_usuario_id
  from public.sesiones s
  join public.jugadores j on j.id = s.jugador_id
  where s.token = p_token;

  if v_usuario_id is null then
    raise exception 'No autorizado';
  end if;

  return v_usuario_id;
end;
$$;

create or replace function public._grupo_jugador_plantilla(p_usuario_id uuid)
returns public.jugadores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.jugadores;
begin
  -- Cualquier ficha del usuario (no dependemos de created_at/updated_at: varían por DB).
  select j.* into v_row
  from public.jugadores j
  where j.usuario_id = p_usuario_id
  order by j.id desc
  limit 1;

  if v_row.id is null then
    raise exception 'Tu cuenta aún no tiene ficha de jugador. Completá el registro primero.';
  end if;

  return v_row;
end;
$$;

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
  v_new_id uuid;
  v_apodo text;
begin
  if exists (
    select 1 from public.grupo_miembros m
    where m.grupo_id = p_grupo_id and m.usuario_id = p_usuario_id
  ) then
    raise exception 'Ya pertenecés a este grupo';
  end if;

  v_src := public._grupo_jugador_plantilla(p_usuario_id);
  v_apodo := trim(coalesce(nullif(trim(coalesce(p_apodo, '')), ''), v_src.apodo));

  if exists (
    select 1 from public.jugadores j
    where j.grupo_id = p_grupo_id
      and lower(trim(j.apodo)) = lower(v_apodo)
  ) then
    raise exception 'Ese apodo ya está usado en este grupo';
  end if;

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

-- Activa el jugador/grupo en la sesión actual (sin emitir token nuevo).
create or replace function public._grupo_activar_en_sesion(
  p_token text,
  p_grupo_id uuid,
  p_jugador_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sesiones
  set jugador_id = p_jugador_id,
      grupo_id = p_grupo_id
  where token = p_token;

  if not found then
    raise exception 'No autorizado';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPCs PÚBLICAS
-- ---------------------------------------------------------------------------

-- Crear grupo: el usuario autenticado define nombre + PIN y queda como admin.
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

  if exists (
    select 1 from public.grupos g
    where g.deporte = v_deporte
      and lower(trim(g.nombre)) = lower(v_nombre)
  ) then
    raise exception 'Ya existe un grupo con ese nombre para este deporte';
  end if;

  v_invite := public._grupo_nuevo_invite_code();

  insert into public.grupos (nombre, pin_hash, invite_code, deporte, creado_por_usuario_id)
  values (v_nombre, v_pin, v_invite, v_deporte, v_usuario_id)
  returning id into v_grupo_id;

  v_jugador_id := public._grupo_crear_jugador_en_grupo(
    v_usuario_id, v_grupo_id, true, p_apodo
  );

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
exception
  when unique_violation then
    raise exception 'Ya existe un grupo con ese nombre o código';
end;
$$;

revoke all on function public.grupo_crear(text, text, text, text, text) from public;
grant execute on function public.grupo_crear(text, text, text, text, text) to anon, authenticated;

-- Unirse: nombre+PIN del grupo, o código de invitación.
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

    -- Si además mandan PIN, se valida (útil si el código se filtró).
    if v_pin is not null and v_pin <> lower(trim(v_grupo.pin_hash)) then
      raise exception 'PIN de grupo incorrecto';
    end if;
  elsif v_nombre is not null then
    if v_pin is null then
      raise exception 'Para unirte por nombre necesitás el PIN del grupo';
    end if;

    select g.* into v_grupo
    from public.grupos g
    where g.deporte = v_deporte
      and lower(trim(g.nombre)) = lower(v_nombre)
    limit 1;

    if v_grupo.id is null then
      raise exception 'No encontramos un grupo con ese nombre';
    end if;

    if lower(trim(v_grupo.pin_hash)) <> v_pin then
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
    'inviteCode', null, -- solo admins lo ven en mis_grupos
    'rol', 'miembro',
    'jugadorId', v_jugador_id::text,
    'esAdmin', false
  );
end;
$$;

revoke all on function public.grupo_unirse(text, text, text, text, text, text) from public;
grant execute on function public.grupo_unirse(text, text, text, text, text, text) to anon, authenticated;

-- Lista de grupos del usuario autenticado (para entrar directo).
create or replace function public.mis_grupos(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
begin
  v_usuario_id := public._grupo_usuario_desde_token(p_token);

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'grupoId', g.id::text,
          'nombre', g.nombre,
          'deporte', g.deporte,
          'rol', m.rol,
          'esAdmin', (m.rol = 'admin'),
          'jugadorId', m.jugador_id::text,
          'joinedAt', m.joined_at,
          -- invite_code solo visible para admins del grupo
          'inviteCode', case when m.rol = 'admin' then g.invite_code else null end
        )
        order by m.joined_at asc
      )
      from public.grupo_miembros m
      join public.grupos g on g.id = m.grupo_id
      where m.usuario_id = v_usuario_id
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.mis_grupos(text) from public;
grant execute on function public.mis_grupos(text) to anon, authenticated;

-- Entrar a un grupo al que ya pertenecés (activa jugador/grupo en la sesión).
create or replace function public.grupo_entrar(p_token text, p_grupo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_m public.grupo_miembros;
  v_g public.grupos;
begin
  v_usuario_id := public._grupo_usuario_desde_token(p_token);

  select m.* into v_m
  from public.grupo_miembros m
  where m.grupo_id = p_grupo_id
    and m.usuario_id = v_usuario_id;

  if v_m.id is null then
    raise exception 'No pertenecés a ese grupo';
  end if;

  select g.* into v_g from public.grupos g where g.id = p_grupo_id;
  if v_g.id is null then
    raise exception 'Grupo no encontrado';
  end if;

  perform public._grupo_activar_en_sesion(p_token, v_g.id, v_m.jugador_id);

  return jsonb_build_object(
    'ok', true,
    'grupoId', v_g.id::text,
    'nombre', v_g.nombre,
    'deporte', v_g.deporte,
    'rol', v_m.rol,
    'esAdmin', (v_m.rol = 'admin'),
    'jugadorId', v_m.jugador_id::text,
    'inviteCode', case when v_m.rol = 'admin' then v_g.invite_code else null end
  );
end;
$$;

revoke all on function public.grupo_entrar(text, uuid) from public;
grant execute on function public.grupo_entrar(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. COMPAT: registro actual sigue creando jugador en el grupo legado
-- ---------------------------------------------------------------------------
-- Hasta el Paso 2 (cuenta global sin grupo), el registro clásico no puede omitir
-- grupo_id (NOT NULL). Se inserta en "Fútbol Puente Club" + membresía.

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

-- Login: setear grupo_id en la sesión según el jugador encontrado
create or replace function public.futbol_auth_login(p_apodo text, p_pin_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_grupo_id uuid;
  v_token text;
begin
  select j.id, j.grupo_id into v_id, v_grupo_id
  from jugadores j
  where lower(trim(j.apodo)) = lower(trim(p_apodo))
    and j.pin_hash = lower(trim(p_pin_hash))
  order by j.id desc
  limit 1;

  if v_id is null then
    raise exception 'Credenciales incorrectas';
  end if;

  v_token := gen_random_uuid()::text;
  insert into sesiones (token, jugador_id, grupo_id) values (v_token, v_id, v_grupo_id);

  return jsonb_build_object(
    'token', v_token,
    'playerId', v_id::text,
    'grupoId', coalesce(v_grupo_id::text, null)
  );
end;
$$;

revoke all on function public.futbol_auth_login(text, text) from public;
grant execute on function public.futbol_auth_login(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notas para el Paso 2 (sesión Bridge)
-- ---------------------------------------------------------------------------
-- 1. bridgeSession.ts: persistir `grupoId` activo (sessionStorage).
-- 2. Tras login: llamar mis_grupos(token).
--    - Si hay grupos → lista + crear / unirse.
--    - Si no → solo crear / unirse.
-- 3. Al tocar un grupo de la lista → grupo_entrar(token, grupoId).
-- 4. crear/unirse ya activan la sesión (jugador_id + grupo_id).
-- 5. Entrar a Shell solo con: loggedIn + deporte + grupoId.
-- 6. Después: filtrar listados/partidos por sesiones.grupo_id.
-- =============================================================================
