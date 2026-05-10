# AGENTS.md

## Cursor Cloud specific instructions

### Overview

**Fútbol Grupo** is a Spanish-language amateur football (soccer) group management web app. It has:
- **Frontend**: React 18 + TypeScript + Vite (port 5173 in dev)
- **Backend**: Node.js + Express (port 3001)
- **Database**: Supabase (hosted PostgreSQL) — no local DB fallback is currently wired in

### Required Environment Variables

The app requires four Supabase secrets (set via Cursor Secrets):

| Variable | Used By | Purpose |
|---|---|---|
| `SUPABASE_URL` | Backend | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Service role key (bypasses RLS) |
| `VITE_SUPABASE_URL` | Frontend (compile-time) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend (compile-time) | Supabase anon/public key |

Create a `.env` file in the workspace root with these variables before starting the backend. The frontend reads `VITE_*` vars at build/dev time via Vite's `import.meta.env`.

### Running the App

```bash
# Both frontend + backend concurrently:
npm run dev

# Frontend only:
npm run dev:client

# Backend only:
npm run dev:server
```

### Key Gotchas

- **No lockfile**: The project has no `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`. Use `npm install` to install dependencies.
- **No ESLint config**: Use `npx tsc --noEmit` for type-checking/lint.
- **No test framework**: There are no automated test scripts configured.
- **Backend fails without Supabase**: The Express server calls `validateSchema()` on startup which queries actual Supabase tables. It will crash immediately without valid credentials.
- **Frontend auth also needs Supabase**: The React app calls Supabase RPC functions directly for registration/login. Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, auth pages will throw a runtime error.
- **JSON fallback exists but is disconnected**: `server/repository-json.js` has a complete local JSON persistence layer, but `server/repository.js` currently only uses the Supabase implementation.
- **Vite proxies `/api` to backend**: The Vite dev server at port 5173 proxies all `/api/*` requests to `http://127.0.0.1:3001`.
