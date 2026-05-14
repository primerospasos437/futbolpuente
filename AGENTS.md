# AGENTS.md

## Cursor Cloud specific instructions

### Architecture Overview

**Fútbol Puente Club** — A mobile-first PWA for managing an amateur football group. Written in Spanish.

- **Frontend**: React 18 + TypeScript, Vite dev server (port 5173)
- **Backend**: Express.js (port 3001) — optional legacy API layer
- **Database**: Supabase (PostgreSQL). The frontend calls Supabase RPC functions directly via anon key; the Express backend uses the service role key.

### Running the Dev Environment

1. **Start local Supabase** (requires Docker):
   ```
   supabase start --workdir /workspace
   ```
   This pulls and runs Supabase containers. First run takes several minutes for image pulls.

2. **Run database migrations** (in order):
   ```
   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/schema.sql
   ```
   Then add compatibility columns needed by the RPCs:
   ```
   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
   ALTER TABLE public.jugadores ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES public.usuarios(id);
   ALTER TABLE public.jugadores ADD COLUMN IF NOT EXISTS posicion_principal TEXT DEFAULT 'medio';
   ALTER TABLE public.jugadores ALTER COLUMN fecha_nacimiento DROP NOT NULL;
   ALTER TABLE public.jugadores ALTER COLUMN fecha_nacimiento DROP DEFAULT;
   ALTER TABLE public.jugadores ALTER COLUMN fecha_nacimiento TYPE date USING CASE WHEN fecha_nacimiento = '' OR fecha_nacimiento IS NULL THEN NULL ELSE fecha_nacimiento::date END;
   ALTER TABLE public.jugadores ALTER COLUMN fecha_nacimiento SET DEFAULT NULL;
   "
   ```
   Then run remaining migrations in order:
   ```
   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/02_app_support.sql
   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/04_rpc_futbol_auth.sql
   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/05_rpc_data.sql
   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/05_client_supabase_reads_writes.sql
   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/06_partidos.sql
   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/07_convocatorias.sql
   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/08_foto.sql
   ```

3. **Create `.env`** with local Supabase credentials (get keys from `supabase status --workdir /workspace`):
   ```
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=<publishable key from supabase status>
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_SERVICE_ROLE_KEY=<secret key from supabase status>
   ```

4. **Start dev server**: `npm run dev` — runs Express + Vite concurrently.

### Gotchas

- The `04_rpc_futbol_auth.sql` RPC references columns `usuario_id` and `posicion_principal` that are NOT in the base `schema.sql`. You must add these columns before running the RPC migrations.
- The `fecha_nacimiento` column is `text NOT NULL DEFAULT ''` in `schema.sql` but the RPCs cast it to `date` and insert NULL. The column must be altered to nullable `date` type before running RPCs. Note: if `02_app_support.sql` has already altered the column to `date`, the `ALTER COLUMN ... TYPE date USING ...` compatibility command will error on the `= ''` comparison (empty string is invalid for date). This is safe to ignore since the column is already the correct type.
- The migration `05_client_supabase_reads_writes.sql` defines `futbol_auth_session_player_id` which is required for session validation. Registration will fail without it.
- The gate code to access the app is `fobalpuenteclub` (hardcoded in `src/GateCode.tsx`).
- There is no ESLint configuration — type checking is done via `npx tsc --noEmit`.
- No test framework is configured. Validation is done via TypeScript type checking and manual testing.

### Key Commands

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Type check | `npx tsc --noEmit` |
| Build | `npm run build` |
| Dev server | `npm run dev` |
| Frontend only | `npm run dev:client` |
| Backend only | `npm run dev:server` |
| Supabase status | `supabase status --workdir /workspace` |

### Docker in Cloud Agent VMs

Docker is required for local Supabase. The Cloud Agent VM needs:
- `fuse-overlayfs` storage driver configured in `/etc/docker/daemon.json`
- `iptables-legacy` alternatives set
- Socket permissions: `chmod 666 /var/run/docker.sock`
