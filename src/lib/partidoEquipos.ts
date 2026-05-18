import type { PartidoRow, PresenciaRow } from "../types";

/** Jugador en listado público de partido (solo nombre visible). */
export type PartidoJugadorNombre = {
  id: string;
  apodo: string;
};

export function parseEquipoNombres(raw: unknown): PartidoJugadorNombre[] {
  if (!Array.isArray(raw)) return [];
  const out: PartidoJugadorNombre[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    const apodo = String(o.apodo ?? o.nombre ?? "").trim();
    if (!apodo && !id) continue;
    out.push({ id: id || apodo, apodo: apodo || id });
  }
  return out;
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
