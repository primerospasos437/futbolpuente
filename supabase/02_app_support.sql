-- Ejecuta este script en Supabase SQL Editor si creaste solo:
-- usuarios, jugadores, equipos.
-- Agrega columnas/tablas necesarias para la app actual.

create extension if not exists "pgcrypto";

-- Columnas esperadas en jugadores
alter table public.jugadores
  add column if not exists pin_hash text,
  add column if not exists posicion_preferida text,
  add column if not exists perfil_scores jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Compatibilidad si en tu tabla quedó posicion_principal
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jugadores'
      and column_name = 'posicion_principal'
  ) then
    update public.jugadores
    set posicion_preferida = coalesce(posicion_preferida, posicion_principal)
    where posicion_preferida is null;
  end if;
end $$;

-- Garantizar valor para pin_hash
update public.jugadores
set pin_hash = coalesce(pin_hash, '')
where pin_hash is null;

alter table public.jugadores
  alter column pin_hash set not null;

-- Tabla de valoraciones entre jugadores
create table if not exists public.valoraciones (
  de_jugador_id uuid not null references public.jugadores(id) on delete cascade,
  para_jugador_id uuid not null references public.jugadores(id) on delete cascade,
  puntajes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (de_jugador_id, para_jugador_id),
  constraint valoraciones_no_auto check (de_jugador_id <> para_jugador_id)
);

-- Tabla de sesiones por token
create table if not exists public.sesiones (
  token text primary key,
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_sesiones_jugador_id on public.sesiones(jugador_id);
create index if not exists idx_valoraciones_para on public.valoraciones(para_jugador_id);

-- Trigger updated_at en jugadores
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_jugadores_updated_at on public.jugadores;
create trigger trg_jugadores_updated_at
before update on public.jugadores
for each row execute function public.set_updated_at();
