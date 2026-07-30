/**
 * Avatares ilustrados (estilo "foto de jugador") asignados de forma
 * determinística a partir de un seed (id o apodo), usando un pool local
 * de retratos realistas tipo videojuego de fútbol. No son fotos reales
 * de los usuarios: cada jugador siempre obtiene el mismo retrato.
 */
const AVATAR_COUNT = 8;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function personAvatarUrl(seed: string): string {
  const s = seed || "jugador";
  const idx = (hashSeed(s) % AVATAR_COUNT) + 1;
  return `/avatars/avatar-${String(idx).padStart(2, "0")}.webp`;
}
