-- Encuesta: voto de dificultad percibida (parejo / disparejo) para stats y armado futuro.

create table if not exists public.partido_encuesta_dificultad (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos(id) on delete cascade,
  votante_id uuid not null references public.jugadores(id) on delete cascade,
  dificultad text not null check (dificultad in ('parejo', 'disparejo')),
  grupo_id uuid references public.grupos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (partido_id, votante_id)
);

create index if not exists idx_partido_encuesta_dificultad_partido
  on public.partido_encuesta_dificultad (partido_id);

alter table public.partido_encuesta_dificultad enable row level security;

comment on table public.partido_encuesta_dificultad is
  'Percepción del votante: si el partido fue parejo o disparejo (para armado futuro).';

-- Detalle de encuesta: incluye miDificultad
create or replace function public.futbol_encuesta_partido(p_token text, p_partido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_grupo_id uuid;
  p record;
  v_participo boolean;
  v_ya_voto boolean;
  v_dificultad text;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);

  select * into p from public.partidos where id = p_partido_id;
  if not found then
    raise exception 'Partido no encontrado';
  end if;
  if coalesce(p.grupo_id, v_grupo_id) is distinct from v_grupo_id then
    raise exception 'Partido de otro grupo';
  end if;
  if p.goles_claros is null or p.goles_oscuros is null then
    raise exception 'El partido todavía no tiene resultado cargado';
  end if;

  select exists (
    select 1 from public.presencias pr
    where pr.partido_id = p_partido_id
      and pr.jugador_id = v_jugador_id
      and pr.estado in ('convocado', 'presente')
  ) into v_participo;

  if not v_participo then
    raise exception 'Solo pueden votar quienes jugaron el partido';
  end if;

  v_ya_voto := public._partido_votante_ya_voto(p_partido_id, v_jugador_id);

  select d.dificultad into v_dificultad
  from public.partido_encuesta_dificultad d
  where d.partido_id = p_partido_id and d.votante_id = v_jugador_id;

  return jsonb_build_object(
    'partidoId', p.id,
    'fecha', p.fecha,
    'hora', p.hora_partido,
    'golesClaros', p.goles_claros,
    'golesOscuros', p.goles_oscuros,
    'yaVoto', v_ya_voto,
    'miDificultad', v_dificultad,
    'candidatos', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', j.id,
            'apodo', j.apodo,
            'equipo', pr.equipo
          )
          order by j.apodo
        )
        from public.presencias pr
        join public.jugadores j on j.id = pr.jugador_id
        where pr.partido_id = p_partido_id
          and pr.estado in ('convocado', 'presente')
      ),
      '[]'::jsonb
    ),
    'misVotos', case
      when not v_ya_voto then '{}'::jsonb
      else coalesce(
        (
          select jsonb_object_agg(v.categoria, v.votado_jugador_id)
          from public.partido_votos v
          where v.partido_id = p_partido_id and v.votante_id = v_jugador_id
        ),
        '{}'::jsonb
      )
    end
  );
end;
$$;

revoke all on function public.futbol_encuesta_partido(text, uuid) from public;
grant execute on function public.futbol_encuesta_partido(text, uuid) to anon, authenticated;

-- Votar trofeos + dificultad (firma ampliada)
drop function if exists public.futbol_encuesta_votar(text, uuid, jsonb);

create or replace function public.futbol_encuesta_votar(
  p_token text,
  p_partido_id uuid,
  p_votos jsonb,
  p_dificultad text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_grupo_id uuid;
  p record;
  v_cats text[] := array['messi', 'cuti', 'julian', 'dibu'];
  v_cat text;
  v_votado uuid;
  v_raw text;
  v_dif text;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);

  select * into p from public.partidos where id = p_partido_id;
  if not found then
    raise exception 'Partido no encontrado';
  end if;
  if coalesce(p.grupo_id, v_grupo_id) is distinct from v_grupo_id then
    raise exception 'Partido de otro grupo';
  end if;
  if p.goles_claros is null or p.goles_oscuros is null then
    raise exception 'El partido todavía no tiene resultado';
  end if;

  if not exists (
    select 1 from public.presencias pr
    where pr.partido_id = p_partido_id
      and pr.jugador_id = v_jugador_id
      and pr.estado in ('convocado', 'presente')
  ) then
    raise exception 'Solo pueden votar quienes jugaron el partido';
  end if;

  if public._partido_votante_ya_voto(p_partido_id, v_jugador_id) then
    raise exception 'Ya votaste en este partido';
  end if;

  v_dif := lower(trim(coalesce(p_dificultad, '')));
  if v_dif not in ('parejo', 'disparejo') then
    raise exception 'Indicá si el partido fue parejo o disparejo';
  end if;

  if p_votos is null or jsonb_typeof(p_votos) <> 'object' then
    raise exception 'Faltan los votos';
  end if;

  foreach v_cat in array v_cats loop
    v_raw := p_votos ->> v_cat;
    if v_raw is null or trim(v_raw) = '' then
      raise exception 'Falta elegir al % del partido', v_cat;
    end if;
    begin
      v_votado := v_raw::uuid;
    exception when others then
      raise exception 'Jugador inválido para %', v_cat;
    end;

    if not exists (
      select 1 from public.presencias pr
      where pr.partido_id = p_partido_id
        and pr.jugador_id = v_votado
        and pr.estado in ('convocado', 'presente')
    ) then
      raise exception 'El elegido para % no jugó ese partido', v_cat;
    end if;

    insert into public.partido_votos (partido_id, votante_id, categoria, votado_jugador_id, grupo_id)
    values (p_partido_id, v_jugador_id, v_cat, v_votado, coalesce(p.grupo_id, v_grupo_id));
  end loop;

  insert into public.partido_encuesta_dificultad (partido_id, votante_id, dificultad, grupo_id)
  values (p_partido_id, v_jugador_id, v_dif, coalesce(p.grupo_id, v_grupo_id));

  return jsonb_build_object('ok', true, 'dificultad', v_dif);
end;
$$;

revoke all on function public.futbol_encuesta_votar(text, uuid, jsonb, text) from public;
grant execute on function public.futbol_encuesta_votar(text, uuid, jsonb, text) to anon, authenticated;

-- Resumen de dificultad percibida por partido (para armado / stats futuros)
create or replace function public.futbol_encuesta_dificultad_resumen(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id uuid;
begin
  perform public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'partidoId', x.partido_id,
          'fecha', p.fecha,
          'parejo', x.parejo,
          'disparejo', x.disparejo,
          'totalVotos', x.parejo + x.disparejo,
          'mayoria', case
            when x.parejo > x.disparejo then 'parejo'
            when x.disparejo > x.parejo then 'disparejo'
            else 'empate'
          end
        )
        order by p.fecha desc
      )
      from (
        select
          d.partido_id,
          count(*) filter (where d.dificultad = 'parejo')::int as parejo,
          count(*) filter (where d.dificultad = 'disparejo')::int as disparejo
        from public.partido_encuesta_dificultad d
        where coalesce(d.grupo_id, v_grupo_id) = v_grupo_id
        group by d.partido_id
      ) x
      join public.partidos p on p.id = x.partido_id
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.futbol_encuesta_dificultad_resumen(text) from public;
grant execute on function public.futbol_encuesta_dificultad_resumen(text) to anon, authenticated;
