import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Recreamos el cliente si cambian URL/clave (p. ej. pasaste de localhost a la nube en `.env`). */
let _cached: { url: string; key: string; client: SupabaseClient } | null = null;

function normalizeSupabaseUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, "")}`;
}

/** Cliente público (anon) para el frontend; no usar la service role aquí. */
export function getSupabase(): SupabaseClient {
  const url = normalizeSupabaseUrl(String(import.meta.env.VITE_SUPABASE_URL ?? ""));
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !key) {
    throw new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY");
  }
  if (_cached && _cached.url === url && _cached.key === key) {
    return _cached.client;
  }

  const looksLocal = /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?/i.test(url);
  if (looksLocal && import.meta.env.PROD) {
    throw new Error(
      "VITE_SUPABASE_URL apunta a localhost (p. ej. :54321). En producción configurá en Cloudflare la URL https://….supabase.co y la anon key del proyecto.",
    );
  }
  if (looksLocal && import.meta.env.DEV) {
    console.warn(
      "[Fútbol Puente] VITE_SUPABASE_URL es local. Si falla el login con ERR_CONNECTION_REFUSED, ejecutá `supabase start` o usá la URL https://….supabase.co en `.env`.",
    );
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  _cached = { url, key, client };
  return client;
}
