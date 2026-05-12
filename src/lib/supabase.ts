import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function normalizeSupabaseUrl(url: string): string {
  const t = url.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, "")}`;
}

function looksLikeLocalSupabaseUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  return u.includes("127.0.0.1") || u.includes("localhost");
}

/** True si la app corre en el navegador del dispositivo del usuario (no build SSR). */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.location !== "undefined";
}

function isOpenedFromDeviceLocalhost(): boolean {
  if (!isBrowser()) return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

/** Cliente público (anon) para el frontend; no usar la service role aquí. */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = normalizeSupabaseUrl(String(import.meta.env.VITE_SUPABASE_URL ?? ""));
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !key) {
    throw new Error(
      "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Definilas al compilar (por ejemplo en GitHub Actions → Secrets) o en un archivo .env para desarrollo.",
    );
  }
  if (isBrowser() && !isOpenedFromDeviceLocalhost() && looksLikeLocalSupabaseUrl(url)) {
    throw new Error(
      "Esta página está compilada para Supabase en tu máquina (127.0.0.1). En internet no puede conectar: volvé a generar el sitio con la URL y la clave anónima del proyecto Supabase en la nube (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
