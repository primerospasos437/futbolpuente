-- 1) Al darse de baja: reordenar convocatoria, recalcular titular / suplente N y notificar cambios de rol.
-- 2) Tras martes o jueves 22:30 (hora Argentina): notificar a convocados del partido confirmado para valorar F5.
-- Ejecutar después de supabase/09_extended_features.sql (y 10 si aplica).

-- ---------------------------------------------------------------------------
-- Helper: texto de rol según posición densa (1 = primer titular).
-- ---------------------------------------------------------------------------
create or replace function public._futbol_rol_convocatoria_desde_posicion(p_pos int, p_titulares int default 11)
returns text
language sql
immutable
as $$
  select case
    when p_pos is null or p_pos < 1 then 'anotado'
    when p_pos <= p_titulares then 'titular'
    else 'suplente ' || (p_pos - p_titulares)::text
  end;
$$;

revoke all on function public._futbol_rol_convocatoria_desde_posicion(int, int) from public;

-- ---------------------------------------------------------------------------
-- Desanotarse con promoción de suplentes y notificaciones
-- ---------------------------------------------------------------------------
create or replace function public.futbol_desanotarse(p_token text, p_dia text, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_snap jsonb;
  v_leave_pos int;
  tit_cap int := 11;
  el record;
  v_j uuid;
  v_og int;
  v_old_dense int;
  v_new_dense int;
  v_old_rol text;
  v_new_rol text;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  if p_dia not in ('martes', 'jueves') then
    raise exception 'Día inválido';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'jugador_id', t.jugador_id,
        'orden_inscripcion', t.orden_inscripcion,
        'old_global', t.old_global
      )
      order by t.orden_inscripcion
    ),
    '[]'::jsonb
  )
  into v_snap
  from (
    select
      c.jugador_id,
      c.orden_inscripcion,
      row_number() over (order by c.orden_inscripcion) as old_global
    from convocatorias c
    where c.dia = p_dia and c.fecha_partido = p_fecha
  ) t;

  select (e.elem->>'old_global')::int
  into v_leave_pos
  from jsonb_array_elements(v_snap) as e(elem)
  where (e.elem->>'jugador_id')::uuid = v_jugador_id;

  if v_leave_pos is null then
    delete from convocatorias
    where dia = p_dia and fecha_partido = p_fecha and jugador_id = v_jugador_id;
    return jsonb_build_object('ok', true);
  end if;

  delete from convocatorias
  where dia = p_dia and fecha_partido = p_fecha and jugador_id = v_jugador_id;

  with o as (
    select
      c.id,
      row_number() over (order by c.orden_inscripcion) as nd
    from convocatorias c
    where c.dia = p_dia and c.fecha_partido = p_fecha
  )
  update convocatorias c
  set orden_inscripcion = o.nd
  from o
  where c.id = o.id;

  for el in
    select x.elem from jsonb_array_elements(v_snap) as x(elem)
  loop
    v_j := (el.elem->>'jugador_id')::uuid;
    if v_j = v_jugador_id then
      continue;
    end if;

    v_og := (el.elem->>'old_global')::int;
    if v_og < v_leave_pos then
      v_old_dense := v_og;
    elsif v_og > v_leave_pos then
      v_old_dense := v_og - 1;
    else
      continue;
    end if;

    select c.orden_inscripcion
    into v_new_dense
    from convocatorias c
    where c.dia = p_dia and c.fecha_partido = p_fecha and c.jugador_id = v_j;

    if v_new_dense is null then
      continue;
    end if;

    v_old_rol := public._futbol_rol_convocatoria_desde_posicion(v_old_dense, tit_cap);
    v_new_rol := public._futbol_rol_convocatoria_desde_posicion(v_new_dense, tit_cap);

    update convocatorias c
    set rol_convocatoria = v_new_rol
    where c.dia = p_dia and c.fecha_partido = p_fecha and c.jugador_id = v_j;

    if v_old_rol is distinct from v_new_rol then
      insert into notificaciones (jugador_id, tipo, titulo, cuerpo, datos)
      values (
        v_j,
        'convocatoria_rol_actualizado',
        'Actualización de convocatoria',
        format('Tu nuevo estado para el %s (%s): %s.', p_fecha, p_dia, v_new_rol),
        jsonb_build_object(
          'dia', p_dia,
          'fecha_partido', p_fecha,
          'rol_anterior', v_old_rol,
          'rol_nuevo', v_new_rol
        )
      );
    end if;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_desanotarse(text, text, date) from public;
grant execute on function public.futbol_desanotarse(text, text, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Crear notificaciones F5 post-partido (martes/jueves desde las 22:30 ART)
-- Idempotente por jugador + partido. Pensado para llamarse al abrir la app.
-- ---------------------------------------------------------------------------
create or replace function public.futbol_dispatch_f5_valoracion_pendientes(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  p record;
  pr record;
  v_art timestamp;
  v_local date;
  v_minutes int;
  eligible boolean;
begin
  v_id := public._futbol_resolve_token(p_token);
  if v_id is null then
    raise exception 'No autorizado';
  end if;

  for p in
    select pt.id, pt.fecha, pt.estado, pt.confirmado_admin
    from partidos pt
    where coalesce(pt.confirmado_admin, false) = true
      and coalesce(pt.estado, 'pendiente') <> 'cancelado'
  loop
    v_art := (now() at time zone 'America/Argentina/Buenos_Aires');
    v_local := v_art::date;
    v_minutes := extract(hour from v_art)::int * 60 + extract(minute from v_art)::int;
    eligible := (v_local > p.fecha) or (v_local = p.fecha and v_minutes >= 22 * 60 + 30);

    if not eligible then
      continue;
    end if;

    for pr in
      select pres.jugador_id
      from presencias pres
      where pres.partido_id = p.id
    loop
      if exists (
        select 1
        from notificaciones n
        where n.jugador_id = pr.jugador_id
          and n.tipo = 'f5_valorar_partido'
          and (n.datos->>'partido_id') = p.id::text
      ) then
        continue;
      end if;

      insert into notificaciones (jugador_id, tipo, titulo, cuerpo, datos)
      values (
        pr.jugador_id,
        'f5_valorar_partido',
        'Valorá el F5 de la noche',
        format('Partido del %s: podés dejar tu valoración F5 a tus compañeros.', p.fecha),
        jsonb_build_object('partido_id', p.id, 'fecha', p.fecha)
      );
    end loop;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.futbol_dispatch_f5_valoracion_pendientes(text) from public;
grant execute on function public.futbol_dispatch_f5_valoracion_pendientes(text) to anon, authenticated;
