-- Columna legacy `posicion_principal` (NOT NULL en algunas bases). El RPC usa `posicion_preferida`;
-- el registro debe rellenar ambas. Esta migración es idempotente.

alter table public.jugadores add column if not exists posicion_principal text default 'medio';

update public.jugadores j
set posicion_principal = coalesce(nullif(trim(j.posicion_principal), ''), j.posicion_preferida, 'medio')
where j.posicion_principal is null or trim(coalesce(j.posicion_principal, '')) = '';

comment on column public.jugadores.posicion_principal is 'Alineado con posicion_preferida (compatibilidad).';
