import { DIMENSION_ORDER } from "./dimensions";
import { getSupabase } from "./lib/supabase";
import { finalScore, normalizeProfile, peerAverageForPlayer, profileAverage } from "./lib/scoring";
import { finalScoreF5, normalizeF5Profile, peerAverageF5 } from "./lib/scoringF5";
import { balanceTwoTeams } from "./lib/teamsBalance";
import type {
  BalanceResponse,
  F5ProfileScores,
  Pie,
  PlayerDetail,
  PlayerSummary,
  PlayersListPayload,
  Posicion,
  ProfileScores,
  TeamSlot,
} from "./types";

const TOKEN_KEY = "futbol_grupo_token";

function rpcJsonArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "string") {
    try {
      const p = JSON.parse(data) as unknown;
      return Array.isArray(p) ? (p as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const JUGADORES_PUBLICO =
  "id,apodo,nombre_completo,posicion_preferida,posicion_alternativa,pie_dominante,fecha_nacimiento,contacto,altura_cm,peso_kg,perfil_scores,perfil_f5_scores,es_admin,created_at,updated_at";

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
  perfil_f5_scores?: Record<string, unknown> | null;
  es_admin?: boolean | null;
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
  f5Profile: Record<string, unknown>;
  esAdmin: boolean;
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
    f5Profile: typeof r.perfil_f5_scores === "object" && r.perfil_f5_scores ? r.perfil_f5_scores : {},
    esAdmin: Boolean(r.es_admin),
    createdAt: String(r.created_at ?? r.updated_at ?? new Date().toISOString()),
  };
}

function playerPublic(
  p: PlayerInternal,
  ratingsReceived: ValoracionRow[],
  viewerId: string,
  myRatedTargetIds: Set<string>,
  f5PeerRatings: { scores: Record<string, unknown> }[] | null,
  myRatedF5PerfilTargetIds: Set<string>,
): PlayerSummary {
  const profile = normalizeProfile(p.profile);
  const f5 = normalizeF5Profile(p.f5Profile);
  const received = ratingsReceived.map((row) => ({ scores: row.puntajes ?? {} }));
  const fs = finalScore(profile, received);
  const peer = peerAverageForPlayer(received);
  const showInjury = viewerId === p.id;
  const isSelf = viewerId === p.id;
  const ratedByMe =
    Boolean(viewerId) && p.id !== viewerId && myRatedTargetIds.has(p.id);
  const ratedF5PerfilByMe =
    Boolean(viewerId) && p.id !== viewerId && myRatedF5PerfilTargetIds.has(p.id);

  let f5FinalScore: number | null = null;
  let f5FinalBreakdown: PlayerSummary["f5FinalBreakdown"] = null;
  if (f5PeerRatings != null) {
    const f5s = finalScoreF5(f5, f5PeerRatings);
    f5FinalScore = f5s.value;
    f5FinalBreakdown = {
      selfAvg: f5s.selfAvg,
      peerAvg: f5s.peerAvg,
      peerCount: f5s.peerCount,
    };
  }

  return {
    id: p.id,
    nombreCompleto: p.nombreCompleto,
    apodo: p.apodo,
    posicionPreferida: p.posicionPreferida,
    posicionAlternativa: p.posicionAlternativa ?? p.posicionPreferida,
    pieDominante: p.pieDominante,
    profile,
    f5Profile: f5,
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
    f5FinalScore,
    f5FinalBreakdown,
    esAdmin: p.esAdmin,
    createdAt: p.createdAt,
    isSelf,
    ratedByMe,
    ratedF5PerfilByMe,
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

async function buildF5PeerRatingsList(paraId: string): Promise<{ scores: Record<string, unknown> }[]> {
  const sb = getSupabase();
  const out: { scores: Record<string, unknown> }[] = [];
  const a = await sb.from("valoraciones_f5_perfil").select("puntajes").eq("para_jugador_id", paraId);
  if (!a.error && a.data) {
    for (const r of a.data as { puntajes: Record<string, unknown> | null }[]) {
      out.push({ scores: r.puntajes ?? {} });
    }
  }
  const b = await sb.from("valoraciones_f5").select("puntajes").eq("para_jugador_id", paraId);
  if (!b.error && b.data) {
    for (const r of b.data as { puntajes: Record<string, unknown> | null }[]) {
      out.push({ scores: r.puntajes ?? {} });
    }
  }
  return out;
}

async function findF5PerfilRating(deId: string, paraId: string): Promise<{ puntajes: Record<string, unknown>; updated_at: string } | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("valoraciones_f5_perfil")
    .select("*")
    .eq("de_jugador_id", deId)
    .eq("para_jugador_id", paraId)
    .maybeSingle();
  if (error) {
    if (error.message.includes("valoraciones_f5_perfil") || error.code === "42P01") return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return data as { puntajes: Record<string, unknown>; updated_at: string };
}

/** IDs de jugadores a los que el viewer ya envió valoración F5 de perfil. */
async function fetchMyRatedF5PerfilTargetIds(viewerId: string): Promise<Set<string>> {
  const sb = getSupabase();
  const { data, error } = await sb.from("valoraciones_f5_perfil").select("para_jugador_id").eq("de_jugador_id", viewerId);
  if (error) {
    if (error.message.includes("valoraciones_f5_perfil") || error.code === "42P01") return new Set();
    throw new Error(error.message);
  }
  return new Set((data ?? []).map((r: { para_jugador_id: string }) => String(r.para_jugador_id)));
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

export type PartidoRow = {
  id: string;
  fecha: string;
  equipo_claros: unknown;
  equipo_oscuros: unknown;
  estado: string;
  creado_por?: string | null;
  created_at?: string;
  confirmado_admin?: boolean;
};

export type PresenciaRow = {
  partido_id: string;
  jugador_id: string;
  equipo: "claros" | "oscuros";
  estado: "convocado" | "presente" | "ausente" | "reemplazado";
};

export type ConvocatoriaRow = {
  id: string;
  dia: "martes" | "jueves";
  fecha_partido: string;
  jugador_id: string;
  orden_inscripcion?: number;
  rol_convocatoria?: string;
  created_at?: string;
};

export type NotificacionRow = {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  datos: Record<string, unknown>;
  leida: boolean;
  created_at: string;
};

export function isAdminFromPlayersList(players: PlayerSummary[]): boolean {
  return players.some((p) => p.isSelf && p.esAdmin);
}

export const apiPartidos = {
  list: async (): Promise<PartidoRow[]> => {
    const token = await requireToken();
    const sb = getSupabase();
    const { data, error } = await sb.rpc("futbol_list_partidos", { p_token: token });
    if (error) throw new Error(error.message);
    return rpcJsonArray<PartidoRow>(data);
  },

  listPresencias: async (): Promise<PresenciaRow[]> => {
    const token = await requireToken();
    const sb = getSupabase();
    const { data, error } = await sb.rpc("futbol_list_presencias", { p_token: token });
    if (error) throw new Error(error.message);
    return rpcJsonArray<PresenciaRow>(data);
  },

  marcarPresencia: async (partidoId: string, jugadorId: string, estado: string): Promise<void> => {
    const token = await requireToken();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_marcar_presencia", {
      p_token: token,
      p_partido_id: partidoId,
      p_jugador_id: jugadorId,
      p_estado: estado,
    });
    if (error) throw new Error(error.message);
  },

  crearBorrador: async (fecha: string, claros: TeamSlot[], oscuros: TeamSlot[]): Promise<{ id: string }> => {
    const token = await requireToken();
    const sb = getSupabase();
    const toJson = (slots: TeamSlot[]) =>
      slots.map((s) => ({ id: s.id, apodo: s.apodo, posicionPreferida: s.posicionPreferida, score: s.score }));
    const { data, error } = await sb.rpc("futbol_crear_partido_borrador", {
      p_token: token,
      p_fecha: fecha,
      p_claros: toJson(claros),
      p_oscuros: toJson(oscuros),
    });
    if (error) throw new Error(error.message);
    const row = data as { id?: string };
    if (!row?.id) throw new Error("Respuesta inválida");
    return { id: row.id };
  },

  confirmar: async (partidoId: string): Promise<void> => {
    const token = await requireToken();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_confirmar_partido_admin", {
      p_token: token,
      p_partido_id: partidoId,
    });
    if (error) throw new Error(error.message);
  },

  rearmar: async (partidoId: string): Promise<void> => {
    const token = await requireToken();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_rearmar_partido_admin", {
      p_token: token,
      p_partido_id: partidoId,
    });
    if (error) throw new Error(error.message);
  },
};

export const apiConvocatorias = {
  list: async (): Promise<ConvocatoriaRow[]> => {
    const token = await requireToken();
    const sb = getSupabase();
    const { data, error } = await sb.rpc("futbol_list_convocatorias", { p_token: token });
    if (error) throw new Error(error.message);
    return rpcJsonArray<ConvocatoriaRow>(data);
  },

  anotarse: async (dia: "martes" | "jueves", fechaPartido: string): Promise<void> => {
    const token = await requireToken();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_anotarse", {
      p_token: token,
      p_dia: dia,
      p_fecha: fechaPartido,
    });
    if (error) throw new Error(error.message);
  },

  desanotarse: async (dia: "martes" | "jueves", fechaPartido: string): Promise<void> => {
    const token = await requireToken();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_desanotarse", {
      p_token: token,
      p_dia: dia,
      p_fecha: fechaPartido,
    });
    if (error) throw new Error(error.message);
  },
};

export const apiNotificaciones = {
  list: async (): Promise<NotificacionRow[]> => {
    const token = await requireToken();
    const sb = getSupabase();
    const { data, error } = await sb.rpc("futbol_list_notificaciones", { p_token: token, p_limite: 80 });
    if (error) {
      if (error.message.includes("futbol_list_notificaciones")) return [];
      throw new Error(error.message);
    }
    return rpcJsonArray<NotificacionRow>(data);
  },

  marcarLeida: async (id: string): Promise<void> => {
    const token = await requireToken();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_marcar_notificacion_leida", { p_token: token, p_id: id });
    if (error) throw new Error(error.message);
  },
};

/** @deprecated Usar isAdminFromPlayersList */
export function isAdmin(players: PlayerSummary[]): boolean {
  return isAdminFromPlayersList(players);
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
    const f5rec = await buildF5PeerRatingsList(viewerId);
    const myRated = await fetchMyRatedTargetIds(viewerId);
    const myRatedF5Perfil = await fetchMyRatedF5PerfilTargetIds(viewerId);
    return playerPublic(row, received, viewerId, myRated, f5rec, myRatedF5Perfil);
  },

  players: async (): Promise<PlayersListPayload> => {
    const token = await requireToken();
    const viewerId = await sessionPlayerId();
    const historialSelf = await fetchMyHistorial(token);
    const myRated = await fetchMyRatedTargetIds(viewerId);
    const myRatedF5Perfil = await fetchMyRatedF5PerfilTargetIds(viewerId);
    const sb = getSupabase();
    const { data, error } = await sb.from("jugadores_publico").select(JUGADORES_PUBLICO).order("apodo", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as JugadorPublicoRow[];
    const jugadores = await Promise.all(
      rows.map(async (r) => {
        const p = mapPublicRow(r);
        if (p.id === viewerId) p.historialLesiones = historialSelf;
        const received = await ratingsTo(p.id);
        const f5rec = await buildF5PeerRatingsList(p.id);
        return playerPublic(p, received, viewerId, myRated, f5rec, myRatedF5Perfil);
      }),
    );
    const otros = jugadores.filter((p) => !p.isSelf);
    const faltanCalificar = otros.filter((p) => !p.ratedByMe);
    const yaCalificados = otros.filter((p) => p.ratedByMe);
    const faltanCalificarF5 = otros.filter((p) => !p.ratedF5PerfilByMe);
    const yaCalificadosF5 = otros.filter((p) => p.ratedF5PerfilByMe);
    return { jugadores, faltanCalificar, yaCalificados, faltanCalificarF5, yaCalificadosF5 };
  },

  player: async (id: string): Promise<PlayerDetail> => {
    const token = await requireToken();
    const viewerId = await sessionPlayerId();
    const p = await fetchJugadorPublico(id);
    if (!p) throw new Error("No encontrado");
    if (p.id === viewerId) p.historialLesiones = await fetchMyHistorial(token);
    const received = await ratingsTo(p.id);
    const f5rec = await buildF5PeerRatingsList(p.id);
    const peerDetail = peerAverageForPlayer(received.map((row) => ({ scores: row.puntajes ?? {} })));
    const myRatingRow = await findRating(viewerId, p.id);
    const myRated = await fetchMyRatedTargetIds(viewerId);
    const myRatedF5Perfil = await fetchMyRatedF5PerfilTargetIds(viewerId);
    const viewerRow = await fetchJugadorPublico(viewerId);
    const viewerIsAdmin = Boolean(viewerRow?.esAdmin);
    const myF5Row = await findF5PerfilRating(viewerId, p.id);
    const peerF5Agg = peerAverageF5(f5rec);

    const summary = playerPublic(p, received, viewerId, myRated, f5rec, myRatedF5Perfil);
    return {
      ...summary,
      dimensions: DIMENSION_ORDER,
      peerByDimension: peerDetail?.byDim ?? {},
      myRating: myRatingRow
        ? { scores: normalizeProfile(myRatingRow.puntajes ?? {}), updatedAt: myRatingRow.updated_at }
        : null,
      viewerIsAdmin,
      peerF5ByDimension: peerF5Agg?.byDim ?? {},
      myF5PerfilRating: myF5Row
        ? { scores: normalizeF5Profile(myF5Row.puntajes ?? {}), updatedAt: myF5Row.updated_at }
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
    const myRatedF5Perfil = await fetchMyRatedF5PerfilTargetIds(viewerId);
    const f5rec = await buildF5PeerRatingsList(target.id);
    return { saved: true, target: playerPublic(target, received, viewerId, myRated, f5rec, myRatedF5Perfil) };
  },

  ratePlayerF5Perfil: async (
    id: string,
    scores: F5ProfileScores,
  ): Promise<{ saved: boolean; target: PlayerSummary }> => {
    const token = await requireToken();
    const viewerId = await sessionPlayerId();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_valorar_f5_perfil", {
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
    const myRatedF5Perfil = await fetchMyRatedF5PerfilTargetIds(viewerId);
    const f5rec = await buildF5PeerRatingsList(target.id);
    return { saved: true, target: playerPublic(target, received, viewerId, myRated, f5rec, myRatedF5Perfil) };
  },

  ratePlayerF5Partido: async (
    partidoId: string,
    paraJugadorId: string,
    scores: F5ProfileScores,
  ): Promise<void> => {
    const token = await requireToken();
    const sb = getSupabase();
    const { error } = await sb.rpc("futbol_valorar_f5_partido", {
      p_token: token,
      p_partido_id: partidoId,
      p_para_jugador_id: paraJugadorId,
      p_puntajes: scores,
    });
    if (error) throw new Error(error.message);
  },

  pendientesValoracionF5Partidos: async (): Promise<
    { partido: PartidoRow; companeros: { id: string; apodo: string }[] }[]
  > => {
    const viewerId = await sessionPlayerId();
    const token = await requireToken();
    const sb = getSupabase();
    const { data: pData, error: pErr } = await sb.rpc("futbol_list_partidos", { p_token: token });
    if (pErr) throw new Error(pErr.message);
    const partidos = rpcJsonArray<PartidoRow>(pData);
    const { data: prData, error: prErr } = await sb.rpc("futbol_list_presencias", { p_token: token });
    if (prErr) throw new Error(prErr.message);
    const presencias = rpcJsonArray<PresenciaRow>(prData);
    const out: { partido: PartidoRow; companeros: { id: string; apodo: string }[] }[] = [];

    const { data: jData, error: jErr } = await sb.from("jugadores_publico").select("id,apodo").order("apodo");
    if (jErr) throw new Error(jErr.message);
    const jugRows = (jData ?? []) as { id: string; apodo: string }[];
    const apodoById = new Map(jugRows.map((j) => [String(j.id), String(j.apodo)]));

    for (const partido of partidos) {
      if (!partido.confirmado_admin) continue;
      const mine = presencias.filter((pr) => pr.partido_id === partido.id && pr.jugador_id === viewerId);
      if (!mine.length) continue;
      const mates = presencias.filter((pr) => pr.partido_id === partido.id && pr.jugador_id !== viewerId);
      const faltan: { id: string; apodo: string }[] = [];
      for (const m of mates) {
        const { data: row } = await sb
          .from("valoraciones_f5")
          .select("de_jugador_id")
          .eq("partido_id", partido.id)
          .eq("de_jugador_id", viewerId)
          .eq("para_jugador_id", m.jugador_id)
          .maybeSingle();
        if (!row) {
          faltan.push({ id: m.jugador_id, apodo: apodoById.get(m.jugador_id) ?? m.jugador_id.slice(0, 8) });
        }
      }
      if (faltan.length) out.push({ partido, companeros: faltan });
    }
    return out;
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
