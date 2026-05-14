-- Seguimiento: valoraciones F5 entre jugadores (perfil), roles convocatoria, bajas con ascenso, helper roles.

-- ---------------------------------------------------------------------------
-- Valoraciones F5 «de perfil» (1–5 por dimensión, sin partido; como valoraciones 1–10)
-- ---------------------------------------------------------------------------
create table if not exists public.valoraciones_f5_perfil (
  de_jugador_id uuid not null references public.jugadores(id) on delete cascade,
  para_jugador_id uuid not null references public.jugadores(id) on delete cascade,
  puntajes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (de_jugador_id, para_jugador_id),
  check (de_jugador_id <> para_jugador_id)
);

alter table public.valoraciones_f5_perfil enable row level security;
drop policy if exists valoraciones_f5_perfil_select_anon on public.valoraciones_f5_perfil;
create policy valoraciones_f5_perfil_select_anon on public.valoraciones_f5_perfil for select to anon using (true);

revoke insert, update, delete on public.valoraciones_f5_perfil from anon, authenticated;
grant select on public.valoraciones_f5_perfil to anon, authenticated;

create or replace function public.futbol_valorar_f5_perfil(
  p_token text,
  p_para_jugador_id uuid,
  p_puntajes jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_de uuid;
  f5dims text[] := array[
    'inteligencia_espacial','transicion_def_of','lectura_juego_coberturas',
    'retencion_bal_pausa','eficacia_pase_apoyo','resolucion_espacios_reducidos',
    'resistencia_intermitente','fuerza_apoyo_core','velocidad_reaccion',
    'colaboracion_colectiva','comunicacion_asertiva','control_emocional'
  ];
  d text;
  v_round int;
begin
  v_de := public.futbol_auth_session_player_id(p_token);
  if v_de is null then raise exception 'No autorizado'; end if;
  if v_de = p_para_jugador_id then raise exception 'No puedes valorarte a ti mismo'; end if;
  if not exists (select 1 from public.jugadores j where j.id = p_para_jugador_id) then
    raise exception 'Jugador no encontrado';
  end if;
  if p_puntajes is null or jsonb_typeof(p_puntajes) <> 'object' then
    raise exception 'Puntajes inválidos';
  end if;
  foreach d in array f5dims loop
    if not (p_puntajes ? d) then raise exception 'Falta F5: %', d; end if;
    v_round := round((p_puntajes->>d)::numeric);
    if v_round is null or v_round < 1 or v_round > 5 then
      raise exception '% debe estar entre 1 y 5', d;
    end if;
  end loop;

  insert into public.valoraciones_f5_perfil (de_jugador_id, para_jugador_id, puntajes, updated_at)
  values (v_de, p_para_jugador_id, p_puntajes, now())
  on conflict (de_jugador_id, para_jugador_id)
  do update set puntajes = excluded.puntajes, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.futbol_valorar_f5_perfil(text, uuid, jsonb) from public;
grant execute on function public.futbol_valorar_f5_perfil(text, uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aplica titular / suplente_N según orden en JSON del partido (5 titulares por equipo)
-- ---------------------------------------------------------------------------
create or replace function public._futbol_aplicar_roles_convocatoria(p_partido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha date;
  v_cl jsonb;
  v_os jsonb;
  v_slot record;
  r text;
  n int;
begin
  select fecha, equipo_claros, equipo_oscuros into v_fecha, v_cl, v_os
  from public.partidos where id = p_partido_id;
  if not found then return; end if;

  update public.convocatorias
  set rol_convocatoria = 'sin_cupo'
  where fecha_partido = v_fecha;

  n := 0;
  for v_slot in
    select (t.elem->>'id')::uuid as jid, t.ord::int as ord
    from jsonb_array_elements(coalesce(v_cl, '[]'::jsonb)) with ordinality as t(elem, ord)
    order by t.ord
  loop
    n := n + 1;
    if n <= 5 then r := 'titular'; else r := 'suplente_' || (n - 5)::text; end if;
    update public.convocatorias
    set rol_convocatoria = r
    where fecha_partido = v_fecha and jugador_id = v_slot.jid;
  end loop;

  n := 0;
  for v_slot in
    select (t.elem->>'id')::uuid as jid, t.ord::int as ord
    from jsonb_array_elements(coalesce(v_os, '[]'::jsonb)) with ordinality as t(elem, ord)
    order by t.ord
  loop
    n := n + 1;
    if n <= 5 then r := 'titular'; else r := 'suplente_' || (n - 5)::text; end if;
    update public.convocatorias
    set rol_convocatoria = r
    where fecha_partido = v_fecha and jugador_id = v_slot.jid;
  end loop;
end;
$$;

revoke all on function public._futbol_aplicar_roles_convocatoria(uuid) from public;

-- ---------------------------------------------------------------------------
-- Crear borrador: al final asignar roles en convocatorias
-- ---------------------------------------------------------------------------
create or replace function public.futbol_crear_partido_borrador(
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
  if not coalesce((select es_admin from jugadores where id = v_jugador_id), false) then
    raise exception 'Solo administradores';
  end if;

  insert into partidos (fecha, equipo_claros, equipo_oscuros, creado_por, confirmado_admin)
  values (p_fecha, p_claros, p_oscuros, v_jugador_id, false)
  returning id into v_partido_id;

  for v_player in select * from jsonb_array_elements(p_claros)
  loop
    insert into presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_player->>'id')::uuid, 'claros', 'convocado')
    on conflict (partido_id, jugador_id) do nothing;
  end loop;

  for v_player in select * from jsonb_array_elements(p_oscuros)
  loop
    insert into presencias (partido_id, jugador_id, equipo, estado)
    values (v_partido_id, (v_player->>'id')::uuid, 'oscuros', 'convocado')
    on conflict (partido_id, jugador_id) do nothing;
  end loop;

  perform public._futbol_aplicar_roles_convocatoria(v_partido_id);

  return jsonb_build_object('id', v_partido_id::text, 'ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rearmar: reset convocatoria roles a anotado para esa fecha
-- ---------------------------------------------------------------------------
create or replace function public.futbol_rearmar_partido_admin(p_token text, p_partido_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_fecha date;
begin
  v_admin := public._futbol_resolve_token(p_token);
  if not coalesce((select es_admin from jugadores where id = v_admin), false) then
    raise exception 'Solo administradores';
  end if;

  select fecha into v_fecha from partidos where id = p_partido_id;
  delete from presencias where partido_id = p_partido_id;
  update partidos set
    confirmado_admin = false,
    equipo_claros = '[]'::jsonb,
    equipo_oscuros = '[]'::jsonb
  where id = p_partido_id;

  if v_fecha is not null then
    update public.convocatorias
    set rol_convocatoria = 'anotado'
    where fecha_partido = v_fecha;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Desanotarse: reordenar, avisar, ascenso en borrador si hay cupo
-- ---------------------------------------------------------------------------
create or replace function public.futbol_desanotarse(p_token text, p_dia text, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_apodo text;
  v_partido_id uuid;
  v_equipo text;
  v_new uuid;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  if p_dia not in ('martes', 'jueves') then
    raise exception 'Día inválido';
  end if;

  select j.apodo into v_apodo from public.jugadores j where j.id = v_jugador_id;

  select pr.partido_id, pr.equipo into v_partido_id, v_equipo
  from public.presencias pr
  join public.partidos pa on pa.id = pr.partido_id
  where pr.jugador_id = v_jugador_id
    and pa.fecha = p_fecha
    and pa.confirmado_admin = false
  order by pa.created_at desc
  limit 1;

  delete from public.convocatorias
  where dia = p_dia and fecha_partido = p_fecha and jugador_id = v_jugador_id;

  with ranked as (
    select c.id, row_number() over (order by c.orden_inscripcion, c.created_at) as rn
    from public.convocatorias c
    where c.dia = p_dia and c.fecha_partido = p_fecha
  )
  update public.convocatorias c
  set orden_inscripcion = ranked.rn
  from ranked
  where c.id = ranked.id;

  insert into public.notificaciones (jugador_id, tipo, titulo, cuerpo, datos)
  select c.jugador_id,
         'convocatoria_baja',
         'Convocatoria',
         coalesce(trim(v_apodo), 'Un jugador') || ' se dio de baja del ' || to_char(p_fecha, 'DD/MM/YYYY') || '.',
         jsonb_build_object('dia', p_dia, 'fecha_partido', p_fecha)
  from public.convocatorias c
  where c.dia = p_dia and c.fecha_partido = p_fecha;

  if v_partido_id is not null then
    delete from public.presencias where partido_id = v_partido_id and jugador_id = v_jugador_id;

    select c.jugador_id into v_new
    from public.convocatorias c
    where c.fecha_partido = p_fecha
      and not exists (
        select 1 from public.presencias pr
        where pr.partido_id = v_partido_id and pr.jugador_id = c.jugador_id
      )
    order by c.orden_inscripcion, c.created_at
    limit 1;

    if v_new is not null then
      insert into public.presencias (partido_id, jugador_id, equipo, estado)
      values (v_partido_id, v_new, coalesce(v_equipo, 'claros'), 'convocado')
      on conflict (partido_id, jugador_id) do update set equipo = excluded.equipo, estado = excluded.estado;

      insert into public.notificaciones (jugador_id, tipo, titulo, cuerpo, datos)
      values (
        v_new,
        'convocatoria_ascenso',
        'Entraste al equipo (borrador)',
        'Subiste al partido del ' || to_char(p_fecha, 'DD/MM/YYYY') || ' por una baja. Equipo ' || coalesce(v_equipo, '') || '.',
        jsonb_build_object('partido_id', v_partido_id, 'fecha', p_fecha)
      );
    end if;

    perform public._futbol_aplicar_roles_convocatoria(v_partido_id);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_crear_partido_borrador(text, date, jsonb, jsonb) from public;
grant execute on function public.futbol_crear_partido_borrador(text, date, jsonb, jsonb) to anon, authenticated;

revoke all on function public.futbol_rearmar_partido_admin(text, uuid) from public;
grant execute on function public.futbol_rearmar_partido_admin(text, uuid) to anon, authenticated;

revoke all on function public.futbol_desanotarse(text, text, date) from public;
grant execute on function public.futbol_desanotarse(text, text, date) to anon, authenticated;
