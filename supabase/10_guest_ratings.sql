-- Valoraciones de invitados (sin cuenta) vía link/QR público.
-- Aplicar en Supabase local/prod para sync entre dispositivos.

create table if not exists public.valoraciones_invitado (
  id text primary key,
  jugador_id text not null,
  share_id text not null,
  formato text not null check (formato in ('f5', 'f11')),
  scores jsonb not null,
  autor_nombre text,
  created_at timestamptz not null default now()
);

create index if not exists valoraciones_invitado_jugador_idx
  on public.valoraciones_invitado (jugador_id, created_at desc);

alter table public.valoraciones_invitado enable row level security;

drop policy if exists valoraciones_invitado_insert on public.valoraciones_invitado;
create policy valoraciones_invitado_insert
  on public.valoraciones_invitado for insert
  to anon, authenticated
  with check (true);

drop policy if exists valoraciones_invitado_select on public.valoraciones_invitado;
create policy valoraciones_invitado_select
  on public.valoraciones_invitado for select
  to anon, authenticated
  using (true);
