-- Columna `usuario_id` (migraciones tipo AGENTS): misma cuenta que `jugadores.id` / `usuarios.id`.
-- Si existe NOT NULL y el RPC no la rellenaba, el registro fallaba.
-- Idempotente: seguro correr en cualquier orden respecto a 11.

alter table public.jugadores add column if not exists usuario_id uuid references public.usuarios(id);

update public.jugadores j
set usuario_id = j.id
where j.usuario_id is null;

comment on column public.jugadores.usuario_id is 'Cuenta asociada; debe coincidir con id del jugador y usuarios.id.';
