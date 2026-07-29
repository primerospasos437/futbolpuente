-- Anotarse: el mínimo de valoraciones cuenta perfil completo O F5 (compañeros distintos).
-- Antes solo miraba «valoraciones» (F11); si alguien valoraba F5 no desbloqueaba la lista.

comment on column public.grupos.min_valoraciones_perfil is
  'Mínimo de compañeros distintos valorados (perfil completo y/o F5) para poder anotarse.';

create or replace function public.futbol_anotarse(p_token text, p_dia text, p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jugador_id uuid;
  v_grupo_id uuid;
  g public.grupos;
  v_next int;
  v_prof_ok boolean;
  v_f5_ok boolean;
  v_val_count int;
  v_inscritos int;
  v_rol text := 'anotado';
  v_dia text;
  v_min_val int;
begin
  v_jugador_id := public._futbol_resolve_token(p_token);
  v_grupo_id := public._grupo_id_desde_token(p_token);
  g := public._grupo_config_row(v_grupo_id);

  if not coalesce(g.configurado, false) then
    raise exception 'El administrador todavía no configuró los días de partido del grupo.';
  end if;

  v_dia := lower(trim(coalesce(p_dia, '')));
  if v_dia = '' then
    v_dia := public._dia_semana_es(p_fecha);
  end if;
  if v_dia = 'miércoles' then v_dia := 'miercoles'; end if;
  if v_dia = 'sábado' then v_dia := 'sabado'; end if;

  if v_dia not in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo','extra') then
    raise exception 'Día inválido';
  end if;

  if g.fechas_extra is not null and p_fecha = any (g.fechas_extra)
     and not (v_dia = any (coalesce(g.dias_partido, array[]::text[]))) then
    v_dia := 'extra';
  end if;

  perform public._futbol_convocatoria_validar_ventana(v_dia, p_fecha, v_grupo_id);

  select
    coalesce(j.perfil_completo_cargado, false),
    coalesce(j.perfil_f5_cargado, false)
  into v_prof_ok, v_f5_ok
  from public.jugadores j
  where j.id = v_jugador_id;

  if coalesce(g.exige_perfil_completo, true) and not coalesce(v_prof_ok, false) then
    raise exception 'Para anotarte guardá tu perfil completo en «Mis perfiles».';
  end if;
  if coalesce(g.exige_perfil_f5, true) and not coalesce(v_f5_ok, false) then
    raise exception 'Para anotarte guardá tu perfil F5 en «Mis perfiles».';
  end if;

  v_min_val := greatest(coalesce(g.min_valoraciones_perfil, 4), 0);
  if v_min_val > 0 then
    select count(*)::int
    into v_val_count
    from (
      select v.para_jugador_id as para_id
      from public.valoraciones v
      where v.de_jugador_id = v_jugador_id
      union
      select f.para_jugador_id as para_id
      from public.valoraciones_f5_perfil f
      where f.de_jugador_id = v_jugador_id
    ) x;

    if coalesce(v_val_count, 0) < v_min_val then
      raise exception
        'Para anotarte valorá (perfil completo o F5) al menos % compañeros distintos.',
        v_min_val;
    end if;
  end if;

  select count(*)::int into v_inscritos
  from public.convocatorias c
  where c.dia = v_dia
    and c.fecha_partido = p_fecha
    and coalesce(c.grupo_id, v_grupo_id) = v_grupo_id;

  if v_inscritos >= coalesce(g.cupo_maximo, 14) + coalesce(g.cupo_lista_espera, 0) then
    raise exception 'Lista completa (cupo + espera).';
  end if;
  if v_inscritos >= coalesce(g.cupo_maximo, 14) then
    v_rol := 'lista_espera';
  end if;

  select coalesce(max(orden_inscripcion), 0) + 1 into v_next
  from public.convocatorias
  where dia = v_dia and fecha_partido = p_fecha
    and coalesce(grupo_id, v_grupo_id) = v_grupo_id;

  insert into public.convocatorias (dia, fecha_partido, jugador_id, orden_inscripcion, rol_convocatoria, grupo_id)
  values (v_dia, p_fecha, v_jugador_id, v_next, v_rol, v_grupo_id)
  on conflict (grupo_id, dia, fecha_partido, jugador_id) do nothing;

  return jsonb_build_object('ok', true, 'rol', v_rol);
end;
$$;

revoke all on function public.futbol_anotarse(text, text, date) from public;
grant execute on function public.futbol_anotarse(text, text, date) to anon, authenticated;
