import { getSupabase } from "./lib/supabase";
import { DIMENSION_ORDER } from "./dimensions";
import { balanceTeamsPositional, type TeamBalancePlayer } from "./lib/teamBalance";
import type { BalanceResponse, Dimension, PlayerDetail, PlayerSummary, ProfileScores, Posicion } from "./types";

const TOKEN_KEY = "futbol_grupo_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

function requireToken(): string {
  const t = getToken();
  if (!t) throw new Error("No autorizado");
  return t;
}

function normalizeProfile(p: Record<string, unknown> | null | undefined): ProfileScores {
  const src = p && typeof p === "object" ? p : {};
  const out: Record<string, number> = {};
  for (const k of DIMENSION_ORDER) {
    const v = Number(src[k]);
    out[k] = Number.isFinite(v) ? Math.min(10, Math.max(1, Math.round(v))) : 5;
  }
  return out as ProfileScores;
}

function profileAverage(profile: ProfileScores): number {
  const vals = DIMENSION_ORDER.map((k) => profile[k]);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function peerAverageForPlayer(ratings: { puntajes: Record<string, unknown> }[]): {
  overall: number | null;
  count: number;
  byDim: Partial<Record<Dimension, number>>;
} | null {
  if (!ratings.length) return null;
  const byDim: Partial<Record<Dimension, number>> = {};
  for (const dim of DIMENSION_ORDER) {
    const vals = ratings.map((r) => {
      const n = Number(r.puntajes?.[dim]);
      return Number.isFinite(n) ? Math.min(10, Math.max(1, Math.round(n))) : 5;
    });
    byDim[dim] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const overallDims = DIMENSION_ORDER.map((d) => byDim[d]!).filter((v) => v != null);
  return {
    byDim,
    overall: overallDims.length ? overallDims.reduce((a, b) => a + b, 0) / overallDims.length : null,
    count: ratings.length,
  };
}

function finalScore(selfProfile: ProfileScores, ratings: { puntajes: Record<string, unknown> }[]) {
  const selfAvg = profileAverage(selfProfile);
  const peer = peerAverageForPlayer(ratings);
  if (!peer?.overall) return { value: selfAvg, selfAvg, peerAvg: null, peerCount: 0 };
  const value = 0.35 * selfAvg + 0.65 * peer.overall;
  return { value, selfAvg, peerAvg: peer.overall, peerCount: peer.count };
}

interface JugadorRow {
  id: string;
  apodo: string;
  nombre_completo: string;
  posicion_preferida: string;
  posicion_alternativa: string;
  pie_dominante: string;
  perfil_scores: Record<string, unknown> | null;
  fecha_nacimiento: string | null;
  contacto: string;
  altura_cm: number | null;
  peso_kg: number | null;
  historial_lesiones: string;
  created_at: string;
  foto_url: string | null;
}

interface ValoracionRow {
  de_jugador_id: string;
  para_jugador_id: string;
  puntajes: Record<string, unknown>;
  updated_at: string;
}

function buildPlayerSummary(
  j: JugadorRow,
  allRatings: ValoracionRow[],
  myId: string,
): PlayerSummary {
  const profile = normalizeProfile(j.perfil_scores);
  const received = allRatings.filter((r) => r.para_jugador_id === j.id);
  const fs = finalScore(profile, received);
  const peer = peerAverageForPlayer(received);
  const isSelf = j.id === myId;

  const ratingFromMe = allRatings.find(
    (r) => r.de_jugador_id === myId && r.para_jugador_id === j.id,
  );
  const lastRatedByMeAt = ratingFromMe?.updated_at ?? null;
  let needsMyRating = false;
  if (!isSelf) {
    if (!lastRatedByMeAt) needsMyRating = true;
    else {
      const days = (Date.now() - new Date(lastRatedByMeAt).getTime()) / (1000 * 60 * 60 * 24);
      needsMyRating = days >= 30;
    }
  }

  return {
    id: j.id,
    nombreCompleto: j.nombre_completo,
    apodo: j.apodo,
    posicionPreferida: j.posicion_preferida as PlayerSummary["posicionPreferida"],
    posicionAlternativa: (j.posicion_alternativa ?? j.posicion_preferida) as PlayerSummary["posicionAlternativa"],
    pieDominante: j.pie_dominante as PlayerSummary["pieDominante"],
    profile,
    ficha: {
      fechaNacimiento: j.fecha_nacimiento ?? "",
      contacto: j.contacto ?? "",
      posicionAlternativa: (j.posicion_alternativa ?? j.posicion_preferida) as PlayerSummary["posicionAlternativa"],
      alturaCm: j.altura_cm,
      pesoKg: j.peso_kg != null ? Number(j.peso_kg) : null,
      historialLesiones: isSelf ? (j.historial_lesiones ?? "") : null,
    },
    fotoUrl: j.foto_url ?? null,
    arcoScores: (j as any).perfil_scores?.arcoScores ?? null,
    profileAverage: profileAverage(profile),
    peerAverage: peer?.overall ?? null,
    peerCount: peer?.count ?? 0,
    finalScore: fs.value,
    finalBreakdown: { selfAvg: fs.selfAvg, peerAvg: fs.peerAvg ?? null, peerCount: fs.peerCount },
    createdAt: j.created_at ?? new Date().toISOString(),
    isSelf,
    lastRatedByMeAt,
    needsMyRating,
  };
}

async function loadData(token: string) {
  const sb = getSupabase();
  const [jugRes, valRes] = await Promise.all([
    sb.rpc("futbol_list_jugadores", { p_token: token }),
    sb.rpc("futbol_list_valoraciones", { p_token: token }),
  ]);
  if (jugRes.error) throw new Error(jugRes.error.message);
  if (valRes.error) throw new Error(valRes.error.message);
  const jugadores: JugadorRow[] = Array.isArray(jugRes.data) ? jugRes.data : (jugRes.data ?? []);
  const valoraciones: ValoracionRow[] = Array.isArray(valRes.data) ? valRes.data : (valRes.data ?? []);
  return { jugadores, valoraciones };
}


export const api = {
  async me(): Promise<PlayerSummary> {
    const token = requireToken();
    const sb = getSupabase();
    const { error: valErr } = await sb.rpc("futbol_auth_validate_token", { p_token: token });
    if (valErr) throw new Error("No autorizado");

    const { jugadores, valoraciones } = await loadData(token);
    const myId = getPlayerId();
    const me = jugadores.find((j) => j.id === myId);
    if (!me) throw new Error("Jugador no encontrado. Registrate nuevamente.");
    return buildPlayerSummary(me, valoraciones, myId);
  },

  async players(): Promise<PlayerSummary[]> {
    const token = requireToken();
    const { jugadores, valoraciones } = await loadData(token);
    const myId = getPlayerId();
    return jugadores.map((j) => buildPlayerSummary(j, valoraciones, myId));
  },

  async player(id: string): Promise<PlayerDetail> {
    const token = requireToken();
    const { jugadores, valoraciones } = await loadData(token);
    const myId = getPlayerId();
    const j = jugadores.find((p) => p.id === id);
    if (!j) throw new Error("Jugador no encontrado");
    const summary = buildPlayerSummary(j, valoraciones, myId);
    const received = valoraciones.filter((r) => r.para_jugador_id === id);
    const peer = peerAverageForPlayer(received);
    const myRatingRow = valoraciones.find((r) => r.de_jugador_id === myId && r.para_jugador_id === id);
    return {
      ...summary,
      dimensions: [...DIMENSION_ORDER],
      peerByDimension: peer?.byDim ?? {},
      myRating: myRatingRow
        ? { scores: normalizeProfile(myRatingRow.puntajes), updatedAt: myRatingRow.updated_at }
        : null,
    };
  },

  async updateMe(body: Record<string, unknown>): Promise<PlayerSummary> {
    const token = requireToken();
    const sb = getSupabase();
    const patch: Record<string, unknown> = {};
    if (body.nombreCompleto !== undefined) patch.nombre_completo = body.nombreCompleto;
    if (body.posicionPreferida !== undefined) patch.posicion_preferida = body.posicionPreferida;
    if (body.posicionAlternativa !== undefined) patch.posicion_alternativa = body.posicionAlternativa;
    if (body.pieDominante !== undefined) patch.pie_dominante = body.pieDominante;
    if (body.fechaNacimiento !== undefined) patch.fecha_nacimiento = body.fechaNacimiento || "";
    if (body.contacto !== undefined) patch.contacto = body.contacto;
    if (body.alturaCm !== undefined) patch.altura_cm = body.alturaCm != null ? String(body.alturaCm) : null;
    if (body.pesoKg !== undefined) patch.peso_kg = body.pesoKg != null ? String(body.pesoKg) : null;
    if (body.historialLesiones !== undefined) patch.historial_lesiones = body.historialLesiones;
    if (body.profile !== undefined) {
      const scores = { ...(body.profile as Record<string, unknown>) };
      if (body.arcoScores) scores.arcoScores = body.arcoScores;
      patch.perfil_scores = scores;
    } else if (body.arcoScores) {
      patch.perfil_scores = { arcoScores: body.arcoScores };
    }

    const { error } = await sb.rpc("futbol_update_profile", { p_token: token, p_data: patch });
    if (error) throw new Error(error.message);
    return await api.me();
  },

  async updateFoto(dataUrl: string): Promise<void> {
    const token = requireToken();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_update_foto", { p_token: token, p_foto: dataUrl });
    if (error) throw new Error(error.message);
  },

  async ratePlayer(id: string, scores: ProfileScores): Promise<{ saved: boolean; target: PlayerSummary }> {
    const token = requireToken();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_upsert_rating", {
      p_token: token,
      p_target_id: id,
      p_scores: scores,
    });
    if (error) throw new Error(error.message);
    const target = await api.player(id);
    return { saved: true, target };
  },

  async balanceTeams(playerIds?: string[]): Promise<BalanceResponse> {
    const token = requireToken();
    const { jugadores, valoraciones } = await loadData(token);
    const myId = getPlayerId();
    const selected = playerIds?.length
      ? jugadores.filter((j) => playerIds.includes(j.id))
      : jugadores;

    if (selected.length < 4)
      throw new Error("Selecciona al menos 4 jugadores para armar dos equipos");

    const withVec: TeamBalancePlayer[] = selected.map((j) => {
      const profile = normalizeProfile(j.perfil_scores);
      const received = valoraciones.filter((r) => r.para_jugador_id === j.id);
      const fs = finalScore(profile, received);
      const rawArco = (j.perfil_scores as Record<string, unknown> | null)?.arcoScores;
      let arcoScores: TeamBalancePlayer["arcoScores"] = null;
      if (rawArco && typeof rawArco === "object") {
        const o = rawArco as Record<string, unknown>;
        const v = Number(o.valor);
        const c = Number(o.comunicacion);
        const m = Number(o.manos);
        if ([v, c, m].every((n) => Number.isFinite(n))) {
          arcoScores = {
            valor: Math.min(10, Math.max(1, Math.round(v))),
            comunicacion: Math.min(10, Math.max(1, Math.round(c))),
            manos: Math.min(10, Math.max(1, Math.round(m))),
          };
        }
      }
      return {
        id: j.id,
        apodo: j.apodo,
        posicionPreferida: j.posicion_preferida as Posicion,
        posicionAlternativa: (j.posicion_alternativa ?? j.posicion_preferida) as Posicion,
        score: fs.value,
        profile,
        arcoScores,
      };
    });

    const { teamA, teamB, diff } = balanceTeamsPositional(withVec);
    const toSlot = (p: TeamBalancePlayer) => ({
      id: p.id,
      apodo: p.apodo,
      posicionPreferida: p.posicionPreferida,
      score: p.score,
    });
    const sum = (arr: TeamBalancePlayer[]) => arr.reduce((s, x) => s + x.score, 0);
    return {
      teamA: teamA.map(toSlot),
      teamB: teamB.map(toSlot),
      sumA: sum(teamA),
      sumB: sum(teamB),
      difference: diff,
      pickedBy: myId,
      generatedAt: new Date().toISOString(),
    };
  },
};

function getPlayerId(): string {
  return localStorage.getItem("futbol_grupo_player_id") ?? "";
}

export function setPlayerId(id: string) {
  localStorage.setItem("futbol_grupo_player_id", id);
}

const ADMIN_APODO = "gasty";

export function isAdmin(jugadores: JugadorRow[]): boolean {
  const myId = getPlayerId();
  const me = jugadores.find((j) => j.id === myId);
  return me?.apodo?.toLowerCase() === ADMIN_APODO;
}

export interface PartidoRow {
  id: string;
  fecha: string;
  equipo_claros: { id: string; apodo: string; score: number }[];
  equipo_oscuros: { id: string; apodo: string; score: number }[];
  estado: "pendiente" | "jugado" | "cancelado";
  creado_por: string;
  created_at: string;
}

export interface PresenciaRow {
  partido_id: string;
  jugador_id: string;
  equipo: "claros" | "oscuros";
  estado: "convocado" | "presente" | "ausente" | "reemplazado";
}

export const apiPartidos = {
  async list(): Promise<PartidoRow[]> {
    const token = requireToken();
    const sb = getSupabase();
    const { data, error } = await sb.rpc("futbol_list_partidos", { p_token: token });
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data : (data ?? []);
  },

  async listPresencias(): Promise<PresenciaRow[]> {
    const token = requireToken();
    const sb = getSupabase();
    const { data, error } = await sb.rpc("futbol_list_presencias", { p_token: token });
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data : (data ?? []);
  },

  async crear(fecha: string, claros: { id: string; apodo: string; score: number }[], oscuros: { id: string; apodo: string; score: number }[]): Promise<{ id: string }> {
    const token = requireToken();
    const sb = getSupabase();
    const { data, error } = await sb.rpc("futbol_crear_partido", {
      p_token: token,
      p_fecha: fecha,
      p_claros: claros,
      p_oscuros: oscuros,
    });
    if (error) throw new Error(error.message);
    return data as { id: string };
  },

  async marcarPresencia(partidoId: string, jugadorId: string, estado: string): Promise<void> {
    const token = requireToken();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_marcar_presencia", {
      p_token: token,
      p_partido_id: partidoId,
      p_jugador_id: jugadorId,
      p_estado: estado,
    });
    if (error) throw new Error(error.message);
  },
};

export { isAdmin as checkIsAdmin };
