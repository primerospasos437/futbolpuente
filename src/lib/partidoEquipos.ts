import type { PartidoRow, PresenciaRow } from "../types";

/** Jugador en listado público de partido (solo nombre visible). */
export type PartidoJugadorNombre = {
  id: string;
  apodo: string;
};

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    || /^[0-9a-f]{32}$/i.test(value);
}

/** Apodo usable en UI: no vacío, no el propio id, no un UUID crudo. */
export function isUsableApodo(apodo: string, id?: string): boolean {
  const a = apodo.trim();
  if (!a || a === "Ex-jugador") return false;
  if (id && a === id) return false;
  if (isUuidLike(a)) return false;
  return true;
}

/**
 * Parsea el JSON de equipo guardado en el partido. Si se pasa `apodoById`,
 * prioriza el apodo actual del jugador; si el JSON no tenía un apodo real
 * (dato viejo con solo el id) y el jugador ya no está en el mapa, usa
 * "Ex-jugador" en vez de exponer el UUID crudo en la UI.
 */
export function parseEquipoNombres(
  raw: unknown,
  apodoById?: Map<string, string>,
): PartidoJugadorNombre[] {
  if (!Array.isArray(raw)) return [];
  const out: PartidoJugadorNombre[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    const storedApodo = String(o.apodo ?? o.nombre ?? "").trim();
    if (!storedApodo && !id) continue;
    const finalId = id || storedApodo;
    const live = id ? apodoById?.get(id) : undefined;
    const apodo =
      (live && isUsableApodo(live, id) ? live : null) ??
      (isUsableApodo(storedApodo, id) ? storedApodo : null) ??
      "Ex-jugador";
    out.push({ id: finalId, apodo });
  }
  return out;
}

/**
 * Recolecta id → apodo desde el JSON histórico de todos los partidos.
 * Sirve para resolver nombres de jugadores que ya no están en el roster actual
 * pero sí aparecen en Duplas / Enfrentamientos / Stats.
 */
export function collectApodosFromPartidos(partidos: { equipo_claros?: unknown; equipo_oscuros?: unknown }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of partidos) {
    for (const raw of [p.equipo_claros, p.equipo_oscuros]) {
      if (!Array.isArray(raw)) continue;
      for (const item of raw) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const id = String(o.id ?? "").trim();
        const stored = String(o.apodo ?? o.nombre ?? "").trim();
        if (!id || !isUsableApodo(stored, id)) continue;
        if (!m.has(id)) m.set(id, stored);
      }
    }
  }
  return m;
}

/** Partido confirmado por admin con al menos un jugador en algún equipo. */
export function partidoTieneEquiposPublicados(p: PartidoRow): boolean {
  if (p.confirmado_admin !== true) return false;
  const claros = parseEquipoNombres(p.equipo_claros);
  const oscuros = parseEquipoNombres(p.equipo_oscuros);
  return claros.length > 0 || oscuros.length > 0;
}

export function miEquipoEnPartido(
  partidoId: string,
  jugadorId: string | null,
  presencias: PresenciaRow[],
): "claros" | "oscuros" | null {
  if (!jugadorId) return null;
  const pr = presencias.find(
    (p) => p.partido_id === partidoId && p.jugador_id === jugadorId && p.estado === "convocado",
  );
  return pr?.equipo ?? null;
}
