-- Tabla de partidos para tracking de presencias
-- Ejecutar en Supabase Dashboard → SQL Editor

create table if not exists public.partidos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  equipo_claros jsonb not null default '[]'::jsonb,
  equipo_oscuros jsonb not null default '[]'::jsonb,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'jugado', 'cancelado')),
  creado_por uuid references public.jugadores(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.partidos enable row level security;

-- Tabla de presencias por partido
create table if not exists public.presencias (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos(id) on delete cascade,
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  equipo text not null check (equipo in ('claros', 'oscuros')),
  estado text not null default 'convocado' check (estado in ('convocado', 'presente', 'ausente', 'reemplazado')),
  created_at timestamptz not null default now(),
  unique(partido_id, jugador_id)
);

alter table public.presencias enable row level security;

-- RPC: Crear partido (solo admin)
create or replace function public.futbol_crear_partido(
  p_token text,
  p_fecha date,
  p_claros jsonb,
  p_oscuros jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_partido_id uuid;
  v_player jsonb;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);

  insert into partidos (fecha, equipo_claros, equipo_oscuros, creado_por)
  values (p_fecha, p_claros, p_oscuros, v_jugador_id)
  returning id into v_partido_id;

  -- Insertar presencias para claros
  for v_player in select * from jsonb_array_elements(p_claros)
  loop
    insert into presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_player->>'id')::uuid, 'claros', 'convocado')
    on conflict do nothing;
  end loop;

  -- Insertar presencias para oscuros
  for v_player in select * from jsonb_array_elements(p_oscuros)
  loop
    insert into presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_player->>'id')::uuid, 'oscuros', 'convocado')
    on conflict do nothing;
  end loop;

  return jsonb_build_object('id', v_partido_id::text, 'ok', true);
end;
$$;

revoke all on function public.futbol_crear_partido(text, date, jsonb, jsonb) from public;
grant execute on function public.futbol_crear_partido(text, date, jsonb, jsonb) to anon, authenticated;

-- RPC: Marcar estado de presencia (admin reemplaza/marca ausente)
create or replace function public.futbol_marcar_presencia(
  p_token text,
  p_partido_id uuid,
  p_jugador_id uuid,
  p_estado text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);

  update presencias
  set estado = p_estado
  where partido_id = p_partido_id and jugador_id = p_jugador_id;

  if not found then
    raise exception 'Presencia no encontrada';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_marcar_presencia(text, uuid, uuid, text) from public;
grant execute on function public.futbol_marcar_presencia(text, uuid, uuid, text) to anon, authenticated;

-- RPC: Listar partidos con presencias
create or replace function public.futbol_list_partidos(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  return (
    select coalesce(jsonb_agg(row_to_json(p)::jsonb order by p.fecha desc), '[]'::jsonb)
    from (
      select id, fecha, equipo_claros, equipo_oscuros, estado, creado_por, created_at
      from partidos
    ) p
  );
end;
$$;

revoke all on function public.futbol_list_partidos(text) from public;
grant execute on function public.futbol_list_partidos(text) to anon, authenticated;

-- RPC: Listar presencias
create or replace function public.futbol_list_presencias(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  return (
    select coalesce(jsonb_agg(row_to_json(pr)::jsonb), '[]'::jsonb)
    from (
      select partido_id, jugador_id, equipo, estado
      from presencias
    ) pr
  );
end;
$$;

revoke all on function public.futbol_list_presencias(text) from public;
grant execute on function public.futbol_list_presencias(text) to anon, authenticated;
