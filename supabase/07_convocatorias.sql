-- Inscripciones para partidos semanales (martes y jueves 21hs)
-- Ejecutar en Supabase Dashboard → SQL Editor

create table if not exists public.convocatorias (
  id uuid primary key default gen_random_uuid(),
  dia text not null check (dia in ('martes', 'jueves')),
  fecha_partido date not null,
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(dia, fecha_partido, jugador_id)
);

alter table public.convocatorias enable row level security;

-- RPC: Anotarse a un partido
create or replace function public.futbol_anotarse(p_token text, p_dia text, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);

  insert into convocatorias (dia, fecha_partido, jugador_id)
  values (p_dia, p_fecha, v_jugador_id)
  on conflict (dia, fecha_partido, jugador_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_anotarse(text, text, date) from public;
grant execute on function public.futbol_anotarse(text, text, date) to anon, authenticated;

-- RPC: Desanotarse
create or replace function public.futbol_desanotarse(p_token text, p_dia text, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);

  delete from convocatorias
  where dia = p_dia and fecha_partido = p_fecha and jugador_id = v_jugador_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_desanotarse(text, text, date) from public;
grant execute on function public.futbol_desanotarse(text, text, date) to anon, authenticated;

-- RPC: Listar inscriptos para una fecha/dia
create or replace function public.futbol_list_convocatorias(p_token text)
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
    select coalesce(jsonb_agg(row_to_json(c)::jsonb), '[]'::jsonb)
    from (
      select id, dia, fecha_partido, jugador_id, created_at
      from convocatorias
      where fecha_partido >= current_date - interval '7 days'
      order by created_at
    ) c
  );
end;
$$;

revoke all on function public.futbol_list_convocatorias(text) from public;
grant execute on function public.futbol_list_convocatorias(text) to anon, authenticated;
