-- Valoraciones F5 de perfil (entre jugadores, sin partido). Complementa valoraciones_f5 post-partido.
-- Ejecutar después de supabase/09_extended_features.sql

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

  insert into valoraciones_f5_perfil (de_jugador_id, para_jugador_id, puntajes, updated_at)
  values (v_de, p_para_jugador_id, p_puntajes, now())
  on conflict (de_jugador_id, para_jugador_id)
  do update set puntajes = excluded.puntajes, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.futbol_valorar_f5_perfil(text, uuid, jsonb) from public;
grant execute on function public.futbol_valorar_f5_perfil(text, uuid, jsonb) to anon, authenticated;
