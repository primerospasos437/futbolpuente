import { createSupabaseRepository } from "./repository-supabase.js";

/** @type {ReturnType<createSupabaseRepository>|null} */
let _repo = null;

/** @supabase/supabase-js exige URL absoluta con http(s). Acepta host sin esquema (p. ej. xxx.supabase.co). */
function normalizeSupabaseUrl(url) {
  const t = String(url ?? "").trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, "")}`;
}

export function getRepository() {
  if (_repo) return _repo;
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en variables de entorno");
  }
  _repo = createSupabaseRepository(url, key.trim());
  console.log("[db] Usando Supabase (service role desde el servidor)");
  return _repo;
}
