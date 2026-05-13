#!/usr/bin/env node
/**
 * En Cloudflare Pages el build debe recibir VITE_SUPABASE_URL apuntando a la nube.
 * Si no, Vite "hornea" 127.0.0.1 en el JS y la app rompe en web/celular.
 *
 * Cloudflare define CF_PAGES durante el build. En tu PC no está, así que no molesta.
 */

const isCfPages = Boolean(
  process.env.CF_PAGES === "1" ||
    process.env.CF_PAGES === "true" ||
    process.env.CLOUDFLARE_PAGES === "1",
);

if (!isCfPages) {
  process.exit(0);
}

const url = String(process.env.VITE_SUPABASE_URL ?? "").trim();
const key = String(process.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

if (!url || !key) {
  console.error(`
[Cloudflare Pages] Faltan variables en el ENTORNO DEL BUILD.
En Pages → Settings → Environment variables (Production), agregá:
  VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
  VITE_SUPABASE_ANON_KEY=(anon public de Supabase)
Luego Retry deployment (o limpiá caché de build).
`);
  process.exit(1);
}

const localRe = /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?/i;
if (localRe.test(url)) {
  console.error(`
[Cloudflare Pages] VITE_SUPABASE_URL apunta a LOCAL (${url}).
Corregila a https://….supabase.co en Environment variables y volvé a desplegar.
`);
  process.exit(1);
}

console.log("[Cloudflare Pages] VITE_SUPABASE_URL OK (nube).");
