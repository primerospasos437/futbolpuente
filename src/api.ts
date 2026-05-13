import { DIMENSION_ORDER } from "./dimensions";
import { getSupabase } from "./lib/supabase";
import { finalScore, normalizeProfile, peerAverageForPlayer, profileAverage } from "./lib/scoring";
import { balanceTwoTeams } from "./lib/teamsBalance";
import type {
  BalanceResponse,
  Pie,
  PlayerDetail,
  PlayerSummary,
  PlayersListPayload,
  Posicion,
  ProfileScores,
  TeamSlot,
} from "./types";

const TOKEN_KEY = "futbol_grupo_token";

const JUGADORES_PUBLICO =
  "id,apodo,nombre_completo,posicion_preferida,posicion_alternativa,pie_dominante,fecha_nacimiento,contacto,altura_cm,peso_kg,perfil_scores,created_at,updated_at";

type JugadorPublicoRow = {
  id: string;
  apodo: string;
  nombre_completo: string;
  posicion_preferida: string;
  posicion_alternativa: string;
  pie_dominante: string;
  fecha_nacimiento: string | null;
  contacto: string | null;
  altura_cm: number | null;
  peso_kg: number | string | null;
  perfil_scores: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
};

type ValoracionRow = {
  de_jugador_id: string;
  para_jugador_id: string;
  puntajes: Record<string, unknown> | null;
  updated_at: string;
};

type PlayerInternal = {
  id: string;
  nombreCompleto: string;
  apodo: string;
  posicionPreferida: Posicion;
  posicionAlternativa: Posicion;
  pieDominante: Pie;
  fechaNacimiento: string;
  contacto: string;
  alturaCm: number | null;
  pesoKg: number | null;
  historialLesiones: string;
  profile: Record<string, unknown>;
  createdAt: string;
};

const ALLOW_POS = new Set<string>(["portero", "defensa", "medio", "delantero"]);
const ALLOW_PIE = new Set<string>(["derecho", "izquierdo", "ambos"]);

function asPosicion(v: string, fallback: Posicion): Posicion {
  return ALLOW_POS.has(v) ? (v as Posicion) : fallback;
}

function asPie(v: string): Pie {
  return ALLOW_PIE.has(v) ? (v as Pie) : "derecho";
}

function fechaFromDb(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  return s.slice(0, 10);
}

function mapPublicRow(r: JugadorPublicoRow): PlayerInternal {
  const posPrincipal = asPosicion(String(r.posicion_preferida ?? "medio"), "medio");
  const posAlt = asPosicion(String(r.posicion_alternativa ?? r.posicion_preferida ?? "medio"), posPrincipal);
  return {
    id: String(r.id),
    nombreCompleto: String(r.nombre_completo ?? "").trim(),
    apodo: String(r.apodo ?? "").trim(),
    posicionPreferida: posPrincipal,
    posicionAlternativa: posAlt,
    pieDominante: asPie(String(r.pie_dominante ?? "derecho")),
    fechaNacimiento: fechaFromDb(r.fecha_nacimiento ?? undefined),
    contacto: String(r.contacto ?? "").trim(),
    alturaCm: r.altura_cm != null ? Number(r.altura_cm) : null,
    pesoKg: r.peso_kg != null && r.peso_kg !== "" ? Number(r.peso_kg) : null,
    historialLesiones: "",
    profile: typeof r.perfil_scores === "object" && r.perfil_scores ? r.perfil_scores : {},
    createdAt: String(r.created_at ?? r.updated_at ?? new Date().toISOString()),
  };
}

function playerPublic(
  p: PlayerInternal,
  ratingsReceived: ValoracionRow[],
  viewerId: string,
  myRatedTargetIds: Set<string>,
): PlayerSummary {
  const profile = normalizeProfile(p.profile);
  const received = ratingsReceived.map((row) => ({ scores: row.puntajes ?? {} }));
  const fs = finalScore(profile, received);
  const peer = peerAverageForPlayer(received);
  const showInjury = viewerId === p.id;
  const isSelf = viewerId === p.id;
  const ratedByMe =
    Boolean(viewerId) && p.id !== viewerId && myRatedTargetIds.has(p.id);

  return {
    id: p.id,
    nombreCompleto: p.nombreCompleto,
    apodo: p.apodo,
    posicionPreferida: p.posicionPreferida,
    posicionAlternativa: p.posicionAlternativa ?? p.posicionPreferida,
    pieDominante: p.pieDominante,
    profile,
    ficha: {
      fechaNacimiento: p.fechaNacimiento ?? "",
      contacto: p.contacto ?? "",
      posicionAlternativa: p.posicionAlternativa ?? p.posicionPreferida,
      alturaCm: p.alturaCm ?? null,
      pesoKg: p.pesoKg ?? null,
      historialLesiones: showInjury ? (p.historialLesiones ?? "") : null,
    },
    profileAverage: profileAverage(profile),
    peerAverage: peer?.overall ?? null,
    peerCount: peer?.count ?? 0,
    finalScore: fs.value,
    finalBreakdown: {
      selfAvg: fs.selfAvg,
      peerAvg: fs.peerAvg,
      peerCount: fs.peerCount,
    },
    createdAt: p.createdAt,
    isSelf,
    ratedByMe,
  };
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function requireToken(): Promise<string> {
  const t = getToken();
  if (!t) throw new Error("No autorizado");
  return t;
}

async function sessionPlayerId(): Promise<string> {
  const token = await requireToken();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("futbol_auth_session_player_id", { p_token: token });
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("No autorizado");
  return String(data);
}

async function fetchMyHistorial(token: string): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("futbol_mi_historial_lesiones", { p_token: token });
  if (error) throw new Error(error.message);
  return String(data ?? "");
}

async function ratingsTo(paraId: string): Promise<ValoracionRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from("valoraciones").select("*").eq("para_jugador_id", paraId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ValoracionRow[];
}

async function findRating(deId: string, paraId: string): Promise<ValoracionRow | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("valoraciones")
    .select("*")
    .eq("de_jugador_id", deId)
    .eq("para_jugador_id", paraId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ValoracionRow | null;
}

/** IDs de jugadores que el viewer ya valoró (valoraciones emitidas por mí). */
async function fetchMyRatedTargetIds(viewerId: string): Promise<Set<string>> {
  const sb = getSupabase();
  const { data, error } = await sb.from("valoraciones").select("para_jugador_id").eq("de_jugador_id", viewerId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r: { para_jugador_id: string }) => String(r.para_jugador_id)));
}

async function fetchJugadorPublico(id: string): Promise<PlayerInternal | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from("jugadores_publico").select(JUGADORES_PUBLICO).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapPublicRow(data as JugadorPublicoRow);
}

export const api = {
  me: async (): Promise<PlayerSummary> => {
    const token = await requireToken();
    const viewerId = await sessionPlayerId();
    const sb = getSupabase();
    const { data, error } = await sb.from("jugadores_publico").select(JUGADORES_PUBLICO).eq("id", viewerId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Jugador no encontrado");
    const row = mapPublicRow(data as JugadorPublicoRow);
    row.historialLesiones = await fetchMyHistorial(token);
    const received = await ratingsTo(viewerId);
    const myRated = await fetchMyRatedTargetIds(viewerId);
    return playerPublic(row, received, viewerId, myRated);
  },

  players: async (): Promise<PlayersListPayload> => {
    const token = await requireToken();
    const viewerId = await sessionPlayerId();
    const historialSelf = await fetchMyHistorial(token);
    const myRated = await fetchMyRatedTargetIds(viewerId);
    const sb = getSupabase();
    const { data, error } = await sb.from("jugadores_publico").select(JUGADORES_PUBLICO).order("apodo", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as JugadorPublicoRow[];
    const jugadores = await Promise.all(
      rows.map(async (r) => {
        const p = mapPublicRow(r);
        if (p.id === viewerId) p.historialLesiones = historialSelf;
        const received = await ratingsTo(p.id);
        return playerPublic(p, received, viewerId, myRated);
      }),
    );
    const otros = jugadores.filter((p) => !p.isSelf);
    const faltanCalificar = otros.filter((p) => !p.ratedByMe);
    const yaCalificados = otros.filter((p) => p.ratedByMe);
    return { jugadores, faltanCalificar, yaCalificados };
  },

  player: async (id: string): Promise<PlayerDetail> => {
    const token = await requireToken();
    const viewerId = await sessionPlayerId();
    const p = await fetchJugadorPublico(id);
    if (!p) throw new Error("No encontrado");
    if (p.id === viewerId) p.historialLesiones = await fetchMyHistorial(token);
    const received = await ratingsTo(p.id);
    const peerDetail = peerAverageForPlayer(received.map((row) => ({ scores: row.puntajes ?? {} })));
    const myRatingRow = await findRating(viewerId, p.id);
    const myRated = await fetchMyRatedTargetIds(viewerId);

    const summary = playerPublic(p, received, viewerId, myRated);
    return {
      ...summary,
      dimensions: DIMENSION_ORDER,
      peerByDimension: peerDetail?.byDim ?? {},
      myRating: myRatingRow
        ? { scores: normalizeProfile(myRatingRow.puntajes ?? {}), updatedAt: myRatingRow.updated_at }
        : null,
    };
  },

  updateMe: async (body: Record<string, unknown>): Promise<PlayerSummary> => {
    const token = await requireToken();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_update_mi_perfil", { p_token: token, p_body: body });
    if (error) throw new Error(error.message);
    return api.me();
  },

  ratePlayer: async (
    id: string,
    scores: ProfileScores,
  ): Promise<{ saved: boolean; target: PlayerSummary }> => {
    const token = await requireToken();
    const viewerId = await sessionPlayerId();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_valorar_jugador", {
      p_token: token,
      p_para_jugador_id: id,
      p_puntajes: scores,
    });
    if (error) throw new Error(error.message);
    const target = await fetchJugadorPublico(id);
    if (!target) throw new Error("Jugador no encontrado");
    if (target.id === viewerId) target.historialLesiones = await fetchMyHistorial(token);
    const received = await ratingsTo(target.id);
    const myRated = await fetchMyRatedTargetIds(viewerId);
    return { saved: true, target: playerPublic(target, received, viewerId, myRated) };
  },

  balanceTeams: async (playerIds?: string[]): Promise<BalanceResponse> => {
    const viewerId = await sessionPlayerId();
    const { jugadores: summaries } = await api.players();
    const selected = playerIds?.length ? summaries.filter((p) => playerIds.includes(p.id)) : [...summaries];
    if (selected.length < 4) throw new Error("Selecciona al menos 4 jugadores para armar dos equipos");

    const withScores: TeamSlot[] = selected.map((p) => ({
      id: p.id,
      apodo: p.apodo,
      posicionPreferida: p.posicionPreferida,
      score: p.finalScore,
    }));

    const { teamA, teamB, diff } = balanceTwoTeams(withScores);
    const sum = (arr: TeamSlot[]) => arr.reduce((s, x) => s + x.score, 0);

    return {
      teamA,
      teamB,
      sumA: sum(teamA),
      sumB: sum(teamB),
      difference: diff,
      pickedBy: viewerId,
      generatedAt: new Date().toISOString(),
    };
  },
};
