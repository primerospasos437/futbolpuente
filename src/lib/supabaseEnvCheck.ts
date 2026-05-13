/**
 * Variables Vite (quedan “horneadas” en el JS al hacer `npm run build`).
 * En Cloudflare Pages tenés que definir VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
 * y volver a desplegar; no alcanza con subir un .env a Git.
 */

export function isLocalSupabaseUrl(urlRaw: string): boolean {
  const s = String(urlRaw ?? "").trim();
  if (!s) return false;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const h = u.hostname.toLowerCase();
    return h === "127.0.0.1" || h === "localhost" || h === "::1";
  } catch {
    return false;
  }
}

export const MSG_CF_FALTAN_VARS =
  "Al sitio le faltan las variables de Supabase. En Cloudflare Pages → Settings → Environment variables, agregá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el mismo entorno que usa el deploy (Production y Preview, o «All environments»). Guardá y redeploy.";

export const MSG_CF_URL_LOCAL =
  "Esta página está compilada para Supabase en tu máquina (127.0.0.1). En internet no puede conectar: volvé a generar el sitio con la URL y la clave anónima del proyecto Supabase en la nube (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Cloudflare Pages → Environment variables → Production), guardá, y en Deployments hacé «Retry deployment» o «Clear build cache» y volvé a compilar.";

export function prodSupabaseEnvBrokenMessage(): string | null {
  if (!import.meta.env.PROD) return null;
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !key) return MSG_CF_FALTAN_VARS;
  if (isLocalSupabaseUrl(url)) return MSG_CF_URL_LOCAL;
  return null;
}

/** En producción, evita crear un cliente apuntando a localhost o sin variables. */
export function assertProdSupabaseEnv(): void {
  const msg = prodSupabaseEnvBrokenMessage();
  if (msg) throw new Error(msg);
}
