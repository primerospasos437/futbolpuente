-- Encuesta post-partido estilo Scaloneta (Messi / Cuti / Julián / Dibu).
-- Se activa al cargar el resultado (partido finalizado).

-- Permitir estado 'finalizado' (ya lo escribe cargar_resultado).
alter table public.partidos drop constraint if exists partidos_estado_check;
alter table public.partidos
  add constraint partidos_estado_check
  check (estado in ('pendiente', 'jugado', 'cancelado', 'finalizado'));

create table if not exists public.partido_votos (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos(id) on delete cascade,
  votante_id uuid not null references public.jugadores(id) on delete cascade,
  categoria text not null
    check (categoria in ('messi', 'cuti', 'julian', 'dibu')),
  votado_jugador_id uuid not null references public.jugadores(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (partido_id, votante_id, categoria)
);

create index if not exists idx_partido_votos_partido on public.partido_votos (partido_id);
create index if not exists idx_partido_votos_votado on public.partido_votos (votado_jugador_id);
create index if not exists idx_partido_votos_grupo on public.partido_votos (grupo_id);

alter table public.partido_votos enable row level security;

comment on table public.partido_votos is
  'Votos humorísticos post-partido: messi (MVP), cuti (defensa), julian (pulmón), dibu (atajada).';

-- Un votante solo puede enviar la encuesta una vez (cualquier categoría cuenta).
create or replace function public._partido_votante_ya_voto(p_partido_id uuid, p_votante_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.partido_votos v
    where v.partido_id = p_partido_id and v.votante_id = p_votante_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Al cargar resultado: notificar a titulares para votar
-- ---------------------------------------------------------------------------
create or replace function public.futbol_cargar_resultado_partido_admin(
  p_token text,
  p_partido_id uuid,
  p_goles_claros integer,
  p_goles_oscuros integer,
  p_mvp_jugador_id uuid default null,
  p_comentario text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  p record;
  v_mvp uuid;
  v_era_nuevo boolean;
  r record;
  v_fecha_txt text;
begin
  v_admin := public._futbol_resolve_token(p_token);
  if not coalesce((select es_admin from jugadores where id = v_admin), false) then
    raise exception 'Solo administradores';
  end if;

  select * into p from partidos where id = p_partido_id;
  if not found then
    raise exception 'Partido no encontrado';
  end if;
  if not coalesce(p.confirmado_admin, false) then
    raise exception 'El partido aún no está confirmado';
  end if;

  if p_goles_claros is null or p_goles_oscuros is null then
    raise exception 'Indicá los goles de Claros y Oscuros';
  end if;
  if p_goles_claros < 0 or p_goles_oscuros < 0 then
    raise exception 'Los goles no pueden ser negativos';
  end if;
  if p_goles_claros > 99 or p_goles_oscuros > 99 then
    raise exception 'Goles fuera de rango';
  end if;

  v_mvp := p_mvp_jugador_id;
  if v_mvp is not null then
    if not exists (
      select 1 from presencias pr
      where pr.partido_id = p_partido_id
        and pr.jugador_id = v_mvp
        and pr.estado in ('convocado', 'presente')
    ) then
      raise exception 'El MVP debe ser un titular del partido';
    end if;
  end if;

  v_era_nuevo := p.goles_claros is null or p.goles_oscuros is null;

  update partidos set
    goles_claros = p_goles_claros,
    goles_oscuros = p_goles_oscuros,
    mvp_jugador_id = v_mvp,
    comentario_partido = nullif(trim(coalesce(p_comentario, '')), ''),
    resultado_cargado_at = now(),
    resultado_cargado_por = v_admin,
    estado = 'finalizado'
  where id = p_partido_id;

  if v_era_nuevo then
    v_fecha_txt := to_char(p.fecha, 'DD/MM/YYYY');
    for r in
      select distinct pr.jugador_id
      from public.presencias pr
      where pr.partido_id = p_partido_id
        and pr.estado in ('convocado', 'presente')
    loop
      insert into public.notificaciones (jugador_id, tipo, titulo, cuerpo, datos)
      values (
        r.jugador_id,
        'encuesta_post_partido',
        '🏆 Votación pendiente',
        format('Tenés una votación pendiente del partido %s. ¡Elegí al Messi, Cuti, Julián y Dibu!', v_fecha_txt),
        jsonb_build_object(
          'partido_id', p_partido_id,
          'fecha', p.fecha,
          'tipo', 'encuesta_post_partido'
        )
      );
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'partido_id', p_partido_id);
end;
$$;

revoke all on function public.futbol_cargar_resultado_partido_admin(text, uuid, integer, integer, uuid, text) from public;
grant execute on function public.futbol_cargar_resultado_partido_admin(text, uuid, integer, integer, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pendientes de votación para el jugador de la sesión
-- ---------------------------------------------------------------------------
create or replace function public.futbol_encuesta_pendientes(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_grupo_id uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'partidoId', p.id,
          'fecha', p.fecha,
          'hora', p.hora_partido,
          'golesClaros', p.goles_claros,
          'golesOscuros', p.goles_oscuros
        )
        order by p.fecha desc
      )
      from public.partidos p
      where p.goles_claros is not null
        and p.goles_oscuros is not null
        and coalesce(p.confirmado_admin, false) = true
        and coalesce(p.grupo_id, v_grupo_id) = v_grupo_id
        and exists (
          select 1 from public.presencias pr
          where pr.partido_id = p.id
            and pr.jugador_id = v_jugador_id
            and pr.estado in ('convocado', 'presente')
        )
        and not public._partido_votante_ya_voto(p.id, v_jugador_id)
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.futbol_encuesta_pendientes(text) from public;
grant execute on function public.futbol_encuesta_pendientes(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Candidatos + estado de voto para un partido
-- ---------------------------------------------------------------------------
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

  return jsonb_build_object(
    'partidoId', p.id,
    'fecha', p.fecha,
    'hora', p.hora_partido,
    'golesClaros', p.goles_claros,
    'golesOscuros', p.goles_oscuros,
    'yaVoto', v_ya_voto,
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

-- ---------------------------------------------------------------------------
-- Guardar votos (una sola vez, las 4 categorías)
-- ---------------------------------------------------------------------------
create or replace function public.futbol_encuesta_votar(
  p_token text,
  p_partido_id uuid,
  p_votos jsonb
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

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_encuesta_votar(text, uuid, jsonb) from public;
grant execute on function public.futbol_encuesta_votar(text, uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trofeos acumulados (stats)
-- ---------------------------------------------------------------------------
create or replace function public.futbol_encuesta_trofeos(p_token text)
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
          'jugadorId', x.votado_jugador_id,
          'apodo', j.apodo,
          'messi', x.messi,
          'cuti', x.cuti,
          'julian', x.julian,
          'dibu', x.dibu,
          'total', x.messi + x.cuti + x.julian + x.dibu
        )
        order by (x.messi + x.cuti + x.julian + x.dibu) desc, j.apodo
      )
      from (
        select
          v.votado_jugador_id,
          count(*) filter (where v.categoria = 'messi')::int as messi,
          count(*) filter (where v.categoria = 'cuti')::int as cuti,
          count(*) filter (where v.categoria = 'julian')::int as julian,
          count(*) filter (where v.categoria = 'dibu')::int as dibu
        from public.partido_votos v
        join public.partidos p on p.id = v.partido_id
        where coalesce(v.grupo_id, p.grupo_id, v_grupo_id) = v_grupo_id
        group by v.votado_jugador_id
      ) x
      join public.jugadores j on j.id = x.votado_jugador_id
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.futbol_encuesta_trofeos(text) from public;
grant execute on function public.futbol_encuesta_trofeos(text) to anon, authenticated;
