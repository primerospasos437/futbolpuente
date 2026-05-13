#!/usr/bin/env node
/**
 * En Cloudflare Pages el build debe recibir VITE_SUPABASE_URL apuntando a la nube.
 * Cloudflare define CF_PAGES durante el build. En tu PC no está, así que no corre.
 *
 * Emergencia: variable SKIP_CF_PAGES_SUPABASE_CHECK=1 en Pages para saltear (no recomendado).
 */

function hostnameOf(urlRaw) {
  const s = String(urlRaw ?? "").trim();
  if (!s) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isLocalSupabaseHost(hostname) {
  return (
    hostname === "127.0.0.1" ||
    hostname === "localhost" ||
    hostname === "::1"
  );
}

const isCfPages = Boolean(
  process.env.CF_PAGES === "1" ||
    process.env.CF_PAGES === "true" ||
    process.env.CLOUDFLARE_PAGES === "1",
);

if (!isCfPages) {
  process.exit(0);
}

if (process.env.SKIP_CF_PAGES_SUPABASE_CHECK === "1") {
  console.warn("[Cloudflare Pages] SKIP_CF_PAGES_SUPABASE_CHECK=1 — no se validó Supabase.");
  process.exit(0);
}

const url = String(process.env.VITE_SUPABASE_URL ?? "").trim();
const key = String(process.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
const host = hostnameOf(url);

console.log(`[Cloudflare Pages] Build: VITE_SUPABASE_URL host detectado = "${host || "(vacío o inválido)"}"`);

if (!url || !key) {
  console.error(`
[Cloudflare Pages] Faltan variables en el ENTORNO DEL BUILD (vacías en este paso).
Revisá en Pages → Settings → Environment variables:
  - Que existan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
  - Que estén en el MISMO entorno que usa el deploy (Production vs Preview).
Si solo configuraste "Production" y el build es de una rama (Preview), agregá las mismas variables para Preview o para "All environments".
`);
  process.exit(1);
}

if (isLocalSupabaseHost(host)) {
  console.error(`
[Cloudflare Pages] VITE_SUPABASE_URL apunta a LOCAL (host: ${host}).
Corregila a https://TU-PROYECTO.supabase.co en Environment variables y volvé a desplegar.
`);
  process.exit(1);
}

console.log("[Cloudflare Pages] VITE_SUPABASE_URL OK (host en la nube).");
