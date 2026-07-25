-- Resultado de partido (solo admin carga). Fase 1 de Fútbol Stats.

alter table public.partidos
  add column if not exists goles_claros integer;

alter table public.partidos
  add column if not exists goles_oscuros integer;

alter table public.partidos
  add column if not exists mvp_jugador_id uuid references public.jugadores(id) on delete set null;

alter table public.partidos
  add column if not exists comentario_partido text;

alter table public.partidos
  add column if not exists resultado_cargado_at timestamptz;

alter table public.partidos
  add column if not exists resultado_cargado_por uuid references public.jugadores(id) on delete set null;

comment on column public.partidos.goles_claros is 'Goles del equipo Claros; null = resultado aún no cargado.';
comment on column public.partidos.goles_oscuros is 'Goles del equipo Oscuros; null = resultado aún no cargado.';
comment on column public.partidos.mvp_jugador_id is 'MVP del partido (opcional), elegido por el admin.';
comment on column public.partidos.comentario_partido is 'Comentario / basura amistosa del partido (admin).';

-- ---------------------------------------------------------------------------
-- Admin: cargar o actualizar resultado
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

  update partidos set
    goles_claros = p_goles_claros,
    goles_oscuros = p_goles_oscuros,
    mvp_jugador_id = v_mvp,
    comentario_partido = nullif(trim(coalesce(p_comentario, '')), ''),
    resultado_cargado_at = now(),
    resultado_cargado_por = v_admin,
    estado = 'finalizado'
  where id = p_partido_id;

  return jsonb_build_object('ok', true, 'partido_id', p_partido_id);
end;
$$;

revoke all on function public.futbol_cargar_resultado_partido_admin(text, uuid, integer, integer, uuid, text) from public;
grant execute on function public.futbol_cargar_resultado_partido_admin(text, uuid, integer, integer, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Listar partidos (incluye resultado)
-- ---------------------------------------------------------------------------
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
      select
        id, fecha, equipo_claros, equipo_oscuros, estado, creado_por, created_at,
        confirmado_admin, suplentes, hora_partido, texto_equipamiento,
        goles_claros, goles_oscuros, mvp_jugador_id, comentario_partido,
        resultado_cargado_at
      from partidos
    ) p
  );
end;
$$;

revoke all on function public.futbol_list_partidos(text) from public;
grant execute on function public.futbol_list_partidos(text) to anon, authenticated;
