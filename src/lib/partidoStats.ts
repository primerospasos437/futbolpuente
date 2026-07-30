import type { PartidoRow, PresenciaRow } from "../types";
import { isUsableApodo, parseEquipoNombres } from "./partidoEquipos";

export type ResultLetter = "G" | "P" | "E";

export type PlayerMatchStat = {
  jugadorId: string;
  apodo: string;
  pj: number;
  g: number;
  p: number;
  e: number;
  pctVict: number;
  /** Racha actual: "G3", "P2", "E1" o "—" */
  racha: string;
};

export type ClarosOscurosStandings = {
  clarosWins: number;
  oscurosWins: number;
  empates: number;
  partidosConResultado: number;
};

export type LastFinishedMatch = {
  partido: PartidoRow;
  golesClaros: number;
  golesOscuros: number;
  ganador: "claros" | "oscuros" | "empate";
  mvpId: string | null;
  comentario: string | null;
};

export type FunStatCard = {
  id: string;
  title: string;
  value: string;
  detail?: string;
  /** Nombres extras debajo del valor principal */
  names?: string[];
  tone?: "gold" | "red" | "green" | "orange" | "blue" | "purple";
};

export type PairStat = {
  aId: string;
  bId: string;
  aApodo: string;
  bApodo: string;
  pj: number;
  g: number;
  p: number;
  e: number;
  pctVict: number;
};

export type MatchDifficulty = "facil" | "parejo" | "disparejo";

export type SeasonSummary = {
  totalPartidos: number;
  clarosWins: number;
  oscurosWins: number;
  empates: number;
  facil: number;
  parejo: number;
  disparejo: number;
  jugadoresUnicos: number;
};

export type WinEvolutionPoint = {
  fecha: string;
  label: string;
  claros: number;
  oscuros: number;
};

export type RecentMatchStat = {
  id: string;
  fecha: string;
  golesClaros: number;
  golesOscuros: number;
  dificultad: MatchDifficulty;
  mvpId: string | null;
  comentario: string | null;
};

export type DifficultyRow = {
  jugadorId: string;
  apodo: string;
  facil: { pj: number; g: number; pct: number };
  parejo: { pj: number; g: number; pct: number };
  disparejo: { pj: number; g: number; pct: number };
};

export type CuriosityCard = {
  id: string;
  title: string;
  body: string;
  icon: string;
  tone: "gold" | "red" | "green" | "orange" | "blue" | "purple";
};

export type ConclusionItem = {
  id: string;
  text: string;
};

/** Resuelve el apodo real de un jugador; nunca expone el UUID crudo en la UI. */
export function resolveApodo(id: string, apodoById: Map<string, string>, fallback?: string): string {
  const live = apodoById.get(id);
  if (live && isUsableApodo(live, id)) return live;
  if (fallback && isUsableApodo(fallback, id)) return fallback;
  return "Ex-jugador";
}

export function classifyDifficulty(gc: number, go: number): MatchDifficulty {
  const diff = Math.abs(gc - go);
  if (diff <= 1) return "parejo";
  if (diff === 2) return "disparejo";
  return "facil";
}

export function difficultyLabel(d: MatchDifficulty): string {
  if (d === "facil") return "FÁCIL";
  if (d === "parejo") return "PAREJO";
  return "DISPAREJO";
}

export type RivalNemesisRow = {
  jugadorId: string;
  apodo: string;
  rivalId: string | null;
  rivalApodo: string | null;
  winsVs: number;
  nemesisId: string | null;
  nemesisApodo: string | null;
  lossesVs: number;
};

type LineupSlot = { id: string; equipo: "claros" | "oscuros"; apodo: string };

export function partidoTieneResultado(p: PartidoRow): boolean {
  return p.goles_claros != null && p.goles_oscuros != null;
}

export function finishedMatchesDesc(partidos: PartidoRow[]): PartidoRow[] {
  return partidos
    .filter((p) => p.confirmado_admin === true && partidoTieneResultado(p))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

function resultForTeam(gc: number, go: number, equipo: "claros" | "oscuros"): ResultLetter {
  if (gc === go) return "E";
  if (equipo === "claros") return gc > go ? "G" : "P";
  return go > gc ? "G" : "P";
}

function streakLabel(results: ResultLetter[]): string {
  if (!results.length) return "—";
  const first = results[0];
  let n = 0;
  for (const r of results) {
    if (r !== first) break;
    n += 1;
  }
  return `${first}${n}`;
}

function maxStreakOf(resultsChronoOldestFirst: ResultLetter[], letter: "G" | "P"): number {
  let best = 0;
  let cur = 0;
  for (const r of resultsChronoOldestFirst) {
    if (r === letter) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function lineupForMatch(
  p: PartidoRow,
  presencias: PresenciaRow[],
  apodoById: Map<string, string>,
): LineupSlot[] {
  const fromJson = [
    ...parseEquipoNombres(p.equipo_claros, apodoById).map((x) => ({
      id: x.id,
      equipo: "claros" as const,
      apodo: x.apodo,
    })),
    ...parseEquipoNombres(p.equipo_oscuros, apodoById).map((x) => ({
      id: x.id,
      equipo: "oscuros" as const,
      apodo: x.apodo,
    })),
  ];
  const apodoFromJson = new Map(fromJson.map((x) => [x.id, x.apodo]));

  const fromPres = presencias.filter(
    (pr) =>
      pr.partido_id === p.id && (pr.estado === "convocado" || pr.estado === "presente"),
  );
  if (fromPres.length > 0) {
    return fromPres.map((pr) => ({
      id: pr.jugador_id,
      equipo: pr.equipo,
      // Prioridad: roster actual → apodo guardado en el JSON del partido → Ex-jugador
      apodo: resolveApodo(pr.jugador_id, apodoById, apodoFromJson.get(pr.jugador_id)),
    }));
  }
  return fromJson;
}

/**
 * Ranking a partir de partidos con resultado + planteles (JSON o presencias).
 * Orden: % victoria desc, luego G desc, luego PJ desc.
 */
export function buildPlayerRanking(
  partidos: PartidoRow[],
  presencias: PresenciaRow[],
  apodoById: Map<string, string>,
): PlayerMatchStat[] {
  const finished = finishedMatchesDesc(partidos);

  type Acc = {
    apodo: string;
    pj: number;
    g: number;
    p: number;
    e: number;
    /** Más reciente primero */
    recent: ResultLetter[];
    /** Más antiguo primero (para rachas máximas) */
    chrono: ResultLetter[];
  };
  const byId = new Map<string, Acc>();

  function ensure(id: string, apodo: string) {
    let a = byId.get(id);
    if (!a) {
      a = { apodo, pj: 0, g: 0, p: 0, e: 0, recent: [], chrono: [] };
      byId.set(id, a);
    }
    return a;
  }

  // Procesar de más viejo a más nuevo para chrono; recent se arma al revés
  const oldestFirst = [...finished].reverse();
  for (const p of oldestFirst) {
    const gc = Number(p.goles_claros);
    const go = Number(p.goles_oscuros);
    const slots = lineupForMatch(p, presencias, apodoById);
    for (const s of slots) {
      const acc = ensure(s.id, apodoById.get(s.id) ?? s.apodo);
      if (apodoById.has(s.id)) acc.apodo = apodoById.get(s.id)!;
      const r = resultForTeam(gc, go, s.equipo);
      acc.pj += 1;
      if (r === "G") acc.g += 1;
      else if (r === "P") acc.p += 1;
      else acc.e += 1;
      acc.chrono.push(r);
    }
  }

  for (const a of byId.values()) {
    a.recent = [...a.chrono].reverse();
  }

  const rows: PlayerMatchStat[] = [...byId.entries()].map(([jugadorId, a]) => ({
    jugadorId,
    apodo: a.apodo,
    pj: a.pj,
    g: a.g,
    p: a.p,
    e: a.e,
    pctVict: a.pj > 0 ? (a.g / a.pj) * 100 : 0,
    racha: streakLabel(a.recent),
  }));

  rows.sort((a, b) => {
    if (b.pctVict !== a.pctVict) return b.pctVict - a.pctVict;
    if (b.g !== a.g) return b.g - a.g;
    return b.pj - a.pj;
  });
  return rows;
}

/** Expone rachas máximas por jugador (uso interno de fun stats). */
function playerChronoMap(
  partidos: PartidoRow[],
  presencias: PresenciaRow[],
  apodoById: Map<string, string>,
): Map<string, { apodo: string; chrono: ResultLetter[]; g: number; p: number; pj: number }> {
  const finished = finishedMatchesDesc(partidos);
  const oldestFirst = [...finished].reverse();
  const byId = new Map<string, { apodo: string; chrono: ResultLetter[]; g: number; p: number; pj: number }>();

  for (const p of oldestFirst) {
    const gc = Number(p.goles_claros);
    const go = Number(p.goles_oscuros);
    for (const s of lineupForMatch(p, presencias, apodoById)) {
      let a = byId.get(s.id);
      if (!a) {
        a = { apodo: apodoById.get(s.id) ?? s.apodo, chrono: [], g: 0, p: 0, pj: 0 };
        byId.set(s.id, a);
      }
      if (apodoById.has(s.id)) a.apodo = apodoById.get(s.id)!;
      const r = resultForTeam(gc, go, s.equipo);
      a.chrono.push(r);
      a.pj += 1;
      if (r === "G") a.g += 1;
      if (r === "P") a.p += 1;
    }
  }
  return byId;
}

export function buildFunStats(
  partidos: PartidoRow[],
  presencias: PresenciaRow[],
  apodoById: Map<string, string>,
): FunStatCard[] {
  const cards: FunStatCard[] = [];
  const chrono = playerChronoMap(partidos, presencias, apodoById);
  const finished = finishedMatchesDesc(partidos);

  const mvpCount = new Map<string, number>();
  for (const p of finished) {
    if (!p.mvp_jugador_id) continue;
    mvpCount.set(p.mvp_jugador_id, (mvpCount.get(p.mvp_jugador_id) ?? 0) + 1);
  }
  const mvpSorted = [...mvpCount.entries()].sort((a, b) => b[1] - a[1]);
  const mvpTop = mvpSorted[0];
  cards.push({
    id: "mvp",
    title: "MVP histórico",
    value: mvpTop ? (apodoById.get(mvpTop[0]) ?? "—") : "—",
    detail: mvpTop ? `${mvpTop[1]} vez${mvpTop[1] === 1 ? "" : "es"}` : "Sin MVPs cargados",
    names: mvpSorted.slice(1, 4).map(([id, n]) => `${resolveApodo(id, apodoById)} (${n})`),
    tone: "gold",
  });

  const byLosses = [...chrono.entries()]
    .map(([id, a]) => ({ id, apodo: a.apodo, p: a.p }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p);
  cards.push({
    id: "losses",
    title: "Rey de derrotas",
    value: byLosses[0]?.apodo ?? "—",
    detail: byLosses[0] ? `${byLosses[0].p} derrota${byLosses[0].p === 1 ? "" : "s"}` : undefined,
    names: byLosses.slice(1, 4).map((x) => `${x.apodo} (${x.p})`),
    tone: "red",
  });

  const drySpell = [...chrono.entries()]
    .map(([id, a]) => {
      const recent = [...a.chrono].reverse();
      let n = 0;
      for (const r of recent) {
        if (r === "G") break;
        n += 1;
      }
      return { id, apodo: a.apodo, n, pj: a.pj, g: a.g };
    })
    .filter((x) => x.n >= 2 || (x.pj > 0 && x.g === 0))
    .sort((a, b) => b.n - a.n || b.pj - a.pj);
  cards.push({
    id: "dry",
    title: "Más partidos sin ganar",
    value: drySpell[0]?.apodo ?? "—",
    detail: drySpell[0]
      ? drySpell[0].g === 0
        ? `${drySpell[0].pj} PJ sin victoria`
        : `${drySpell[0].n} seguidos`
      : undefined,
    names: drySpell.slice(1, 3).map((x) => x.apodo),
    tone: "purple",
  });

  let bestWin: { apodo: string; n: number } | null = null;
  let bestLoss: { apodo: string; n: number } | null = null;
  const winStreakNames: string[] = [];
  const lossStreakNames: string[] = [];
  for (const a of chrono.values()) {
    const wg = maxStreakOf(a.chrono, "G");
    const wl = maxStreakOf(a.chrono, "P");
    if (wg > 0) {
      if (!bestWin || wg > bestWin.n) {
        if (bestWin) winStreakNames.unshift(`${bestWin.apodo} (${bestWin.n})`);
        bestWin = { apodo: a.apodo, n: wg };
      } else if (wg === bestWin.n && a.apodo !== bestWin.apodo) {
        winStreakNames.push(`${a.apodo} (${wg})`);
      }
    }
    if (wl > 0) {
      if (!bestLoss || wl > bestLoss.n) {
        if (bestLoss) lossStreakNames.unshift(`${bestLoss.apodo} (${bestLoss.n})`);
        bestLoss = { apodo: a.apodo, n: wl };
      } else if (wl === bestLoss.n && a.apodo !== bestLoss.apodo) {
        lossStreakNames.push(`${a.apodo} (${wl})`);
      }
    }
  }
  cards.push({
    id: "win-streak",
    title: "Mayor racha ganadora",
    value: bestWin ? bestWin.apodo : "—",
    detail: bestWin ? `${bestWin.n} seguidas` : undefined,
    names: winStreakNames.slice(0, 3),
    tone: "orange",
  });
  cards.push({
    id: "loss-streak",
    title: "Mayor racha perdedora",
    value: bestLoss ? bestLoss.apodo : "—",
    detail: bestLoss ? `${bestLoss.n} seguidas` : undefined,
    names: lossStreakNames.slice(0, 3),
    tone: "blue",
  });

  return cards;
}

export function buildPairStats(
  partidos: PartidoRow[],
  presencias: PresenciaRow[],
  apodoById: Map<string, string>,
): {
  mejores: PairStat[];
  peores: PairStat[];
  masJuntas: PairStat[];
  invictas: PairStat[];
  invictasCount: number;
} {
  type Acc = {
    aId: string;
    bId: string;
    aApodo: string;
    bApodo: string;
    pj: number;
    g: number;
    p: number;
    e: number;
  };
  const pairs = new Map<string, Acc>();

  const finished = finishedMatchesDesc(partidos);
  for (const p of finished) {
    const gc = Number(p.goles_claros);
    const go = Number(p.goles_oscuros);
    const slots = lineupForMatch(p, presencias, apodoById);
    const byTeam: Record<"claros" | "oscuros", LineupSlot[]> = { claros: [], oscuros: [] };
    for (const s of slots) byTeam[s.equipo].push(s);

    for (const equipo of ["claros", "oscuros"] as const) {
      const team = byTeam[equipo];
      const r = resultForTeam(gc, go, equipo);
      for (let i = 0; i < team.length; i += 1) {
        for (let j = i + 1; j < team.length; j += 1) {
          const sa = team[i];
          const sb = team[j];
          const key = pairKey(sa.id, sb.id);
          let acc = pairs.get(key);
          if (!acc) {
            const ordered = sa.id < sb.id ? [sa, sb] : [sb, sa];
            acc = {
              aId: ordered[0].id,
              bId: ordered[1].id,
              aApodo: ordered[0].apodo,
              bApodo: ordered[1].apodo,
              pj: 0,
              g: 0,
              p: 0,
              e: 0,
            };
            pairs.set(key, acc);
          } else {
            // Si en un partido posterior aparece un apodo usable, actualizamos.
            const aSlot = sa.id === acc.aId ? sa : sb;
            const bSlot = sa.id === acc.bId ? sa : sb;
            if (!isUsableApodo(acc.aApodo, acc.aId) && isUsableApodo(aSlot.apodo, aSlot.id)) {
              acc.aApodo = aSlot.apodo;
            }
            if (!isUsableApodo(acc.bApodo, acc.bId) && isUsableApodo(bSlot.apodo, bSlot.id)) {
              acc.bApodo = bSlot.apodo;
            }
          }
          acc.pj += 1;
          if (r === "G") acc.g += 1;
          else if (r === "P") acc.p += 1;
          else acc.e += 1;
        }
      }
    }
  }

  const all: PairStat[] = [...pairs.values()].map((a) => ({
    aId: a.aId,
    bId: a.bId,
    aApodo: resolveApodo(a.aId, apodoById, a.aApodo),
    bApodo: resolveApodo(a.bId, apodoById, a.bApodo),
    pj: a.pj,
    g: a.g,
    p: a.p,
    e: a.e,
    pctVict: a.pj > 0 ? (a.g / a.pj) * 100 : 0,
  }));

  const conMin = (minPj: number) => all.filter((x) => x.pj >= minPj);
  const minForPct = Math.max(1, Math.min(2, finished.length));

  const mejores = [...conMin(minForPct)].sort((a, b) => {
    if (b.pctVict !== a.pctVict) return b.pctVict - a.pctVict;
    return b.pj - a.pj;
  }).slice(0, 5);

  const peores = [...conMin(minForPct)].sort((a, b) => {
    if (a.pctVict !== b.pctVict) return a.pctVict - b.pctVict;
    return b.pj - a.pj;
  }).slice(0, 5);

  const masJuntas = [...all].sort((a, b) => b.pj - a.pj || b.pctVict - a.pctVict).slice(0, 5);
  const invictas = all
    .filter((x) => x.pj >= 1 && x.p === 0 && x.g > 0)
    .sort((a, b) => b.pj - a.pj || b.g - a.g)
    .slice(0, 5);

  return { mejores, peores, masJuntas, invictas, invictasCount: invictas.length };
}

export function buildSeasonSummary(
  partidos: PartidoRow[],
  presencias: PresenciaRow[],
  apodoById: Map<string, string>,
): SeasonSummary {
  const finished = finishedMatchesDesc(partidos);
  let clarosWins = 0;
  let oscurosWins = 0;
  let empates = 0;
  let facil = 0;
  let parejo = 0;
  let disparejo = 0;
  const players = new Set<string>();

  for (const p of finished) {
    const gc = Number(p.goles_claros);
    const go = Number(p.goles_oscuros);
    if (gc > go) clarosWins += 1;
    else if (go > gc) oscurosWins += 1;
    else empates += 1;
    const d = classifyDifficulty(gc, go);
    if (d === "facil") facil += 1;
    else if (d === "parejo") parejo += 1;
    else disparejo += 1;
    for (const s of lineupForMatch(p, presencias, apodoById)) players.add(s.id);
  }

  return {
    totalPartidos: finished.length,
    clarosWins,
    oscurosWins,
    empates,
    facil,
    parejo,
    disparejo,
    jugadoresUnicos: players.size,
  };
}

export function buildWinEvolution(partidos: PartidoRow[]): WinEvolutionPoint[] {
  const oldest = [...finishedMatchesDesc(partidos)].reverse();
  let claros = 0;
  let oscuros = 0;
  const points: WinEvolutionPoint[] = [];
  for (const p of oldest) {
    const gc = Number(p.goles_claros);
    const go = Number(p.goles_oscuros);
    if (gc > go) claros += 1;
    else if (go > gc) oscuros += 1;
    const [, m, d] = p.fecha.split("-");
    points.push({
      fecha: p.fecha,
      label: `${d}/${m}`,
      claros,
      oscuros,
    });
  }
  return points;
}

export function buildRecentMatches(partidos: PartidoRow[], limit = 6): RecentMatchStat[] {
  return finishedMatchesDesc(partidos)
    .slice(0, limit)
    .map((p) => {
      const gc = Number(p.goles_claros);
      const go = Number(p.goles_oscuros);
      return {
        id: p.id,
        fecha: p.fecha,
        golesClaros: gc,
        golesOscuros: go,
        dificultad: classifyDifficulty(gc, go),
        mvpId: p.mvp_jugador_id ?? null,
        comentario: p.comentario_partido?.trim() || null,
      };
    });
}

export function buildDifficultyPerformance(
  partidos: PartidoRow[],
  presencias: PresenciaRow[],
  apodoById: Map<string, string>,
): DifficultyRow[] {
  type Bucket = { pj: number; g: number };
  const byId = new Map<
    string,
    { apodo: string; facil: Bucket; parejo: Bucket; disparejo: Bucket }
  >();

  for (const p of finishedMatchesDesc(partidos)) {
    const gc = Number(p.goles_claros);
    const go = Number(p.goles_oscuros);
    const diff = classifyDifficulty(gc, go);
    for (const s of lineupForMatch(p, presencias, apodoById)) {
      let a = byId.get(s.id);
      if (!a) {
        a = {
          apodo: apodoById.get(s.id) ?? s.apodo,
          facil: { pj: 0, g: 0 },
          parejo: { pj: 0, g: 0 },
          disparejo: { pj: 0, g: 0 },
        };
        byId.set(s.id, a);
      }
      if (apodoById.has(s.id)) a.apodo = apodoById.get(s.id)!;
      const bucket = a[diff];
      bucket.pj += 1;
      if (resultForTeam(gc, go, s.equipo) === "G") bucket.g += 1;
    }
  }

  const pct = (b: Bucket) => (b.pj > 0 ? (b.g / b.pj) * 100 : 0);
  return [...byId.entries()]
    .map(([jugadorId, a]) => ({
      jugadorId,
      apodo: a.apodo,
      facil: { ...a.facil, pct: pct(a.facil) },
      parejo: { ...a.parejo, pct: pct(a.parejo) },
      disparejo: { ...a.disparejo, pct: pct(a.disparejo) },
    }))
    .sort((a, b) => a.apodo.localeCompare(b.apodo, "es"));
}

export function buildCuriosidades(
  partidos: PartidoRow[],
  presencias: PresenciaRow[],
  apodoById: Map<string, string>,
  pairs: { mejores: PairStat[]; invictas: PairStat[] },
  ranking: PlayerMatchStat[],
): CuriosityCard[] {
  const cards: CuriosityCard[] = [];
  const finished = finishedMatchesDesc(partidos);
  if (!finished.length) return cards;

  if (pairs.mejores[0]) {
    const p = pairs.mejores[0];
    cards.push({
      id: "duo",
      icon: "⚔️",
      title: "Dupla letal",
      body: `${p.aApodo} + ${p.bApodo} ganan el ${p.pctVict.toFixed(0)}% juntos (${p.pj} PJ).`,
      tone: "green",
    });
  }
  if (pairs.invictas[0]) {
    const p = pairs.invictas[0];
    cards.push({
      id: "invicta",
      icon: "🛡️",
      title: "Invictos juntos",
      body: `${p.aApodo} + ${p.bApodo}: ${p.g} victorias sin derrota.`,
      tone: "blue",
    });
  }
  const top = ranking[0];
  if (top && top.pj > 0) {
    cards.push({
      id: "leader",
      icon: "⭐",
      title: "Líder del ranking",
      body: `${top.apodo} manda con ${top.pctVict.toFixed(0)}% de victorias (${top.g}G-${top.p}P).`,
      tone: "gold",
    });
  }
  const last = finished[0];
  if (last?.mvp_jugador_id) {
    cards.push({
      id: "last-mvp",
      icon: "🥇",
      title: "Último MVP",
      body: `${apodoById.get(last.mvp_jugador_id) ?? "Jugador"} brilló en el ${Number(last.goles_claros)}-${Number(last.goles_oscuros)}.`,
      tone: "orange",
    });
  }
  const undefeated = ranking.filter((r) => r.pj >= 2 && r.p === 0);
  if (undefeated[0]) {
    cards.push({
      id: "undefeated",
      icon: "🔥",
      title: "Imparable",
      body: `${undefeated[0].apodo} sigue sin perder (${undefeated[0].pj} PJ).`,
      tone: "purple",
    });
  }
  const unique = new Set<string>();
  for (const p of finished) {
    for (const s of lineupForMatch(p, presencias, apodoById)) unique.add(s.id);
  }
  if (unique.size) {
    cards.push({
      id: "roster",
      icon: "👥",
      title: "Plantel activo",
      body: `${unique.size} jugadores distintos ya sumaron minutos esta temporada.`,
      tone: "blue",
    });
  }
  return cards.slice(0, 6);
}

export function buildConclusiones(
  summary: SeasonSummary,
  ranking: PlayerMatchStat[],
  trends: TrendBuckets,
  pairs: { invictasCount: number },
  apodoById: Map<string, string>,
  partidos: PartidoRow[],
): ConclusionItem[] {
  const items: ConclusionItem[] = [];
  if (summary.totalPartidos === 0) return items;

  items.push({
    id: "season",
    text: `Después de ${summary.totalPartidos} partido${summary.totalPartidos === 1 ? "" : "s"}: Claros ${summary.clarosWins} – ${summary.oscurosWins} Oscuros${summary.empates ? ` (${summary.empates} empates)` : ""}.`,
  });

  const top = ranking[0];
  if (top && top.pj > 0) {
    items.push({
      id: "leader",
      text: `${top.apodo} lidera el ranking con ${top.pctVict.toFixed(0)}% de victorias.`,
    });
  }

  if (trends.subiendo[0]) {
    items.push({
      id: "racha-g",
      text: `${trends.subiendo[0].apodo} viene en racha ganadora (${trends.subiendo[0].racha}).`,
    });
  }

  if (trends.bajando[0]) {
    items.push({
      id: "racha-p",
      text: `${trends.bajando[0].apodo} acumula derrotas seguidas (${trends.bajando[0].racha}).`,
    });
  }

  if (trends.sinGanar.length) {
    const nombres = trends.sinGanar
      .slice(0, 3)
      .map((t) => t.apodo)
      .join(", ");
    items.push({
      id: "sin-ganar",
      text:
        trends.sinGanar.length === 1
          ? `${nombres} es el único sin victorias todavía.`
          : `${nombres}${trends.sinGanar.length > 3 ? " y más" : ""} siguen sin ganar.`,
    });
  }

  if (pairs.invictasCount > 0) {
    items.push({
      id: "duplas",
      text: `Hay ${pairs.invictasCount} dupla${pairs.invictasCount === 1 ? "" : "s"} invicta${pairs.invictasCount === 1 ? "" : "s"} en el grupo.`,
    });
  }

  const last = finishedMatchesDesc(partidos)[0];
  if (last?.mvp_jugador_id) {
    items.push({
      id: "mvp",
      text: `Último MVP: ${apodoById.get(last.mvp_jugador_id) ?? "—"} (${Number(last.goles_claros)}-${Number(last.goles_oscuros)}).`,
    });
  }

  if (summary.parejo >= summary.facil && summary.parejo >= summary.disparejo && summary.parejo > 0) {
    items.push({
      id: "parejos",
      text: "La mayoría de los partidos fueron muy parejos: se definen por poco.",
    });
  }

  return items.slice(0, 7);
}

export function buildRivalNemesis(
  partidos: PartidoRow[],
  presencias: PresenciaRow[],
  apodoById: Map<string, string>,
): RivalNemesisRow[] {
  /** wins[a][b] = veces que a ganó contra b (equipos opuestos) */
  const wins = new Map<string, Map<string, number>>();
  /** Apodos vistos en lineups (incluye históricos del JSON del partido). */
  const seenApodos = new Map<string, string>();

  function addWin(winner: string, loser: string) {
    let m = wins.get(winner);
    if (!m) {
      m = new Map();
      wins.set(winner, m);
    }
    m.set(loser, (m.get(loser) ?? 0) + 1);
  }

  for (const p of finishedMatchesDesc(partidos)) {
    const gc = Number(p.goles_claros);
    const go = Number(p.goles_oscuros);
    if (gc === go) continue;
    const slots = lineupForMatch(p, presencias, apodoById);
    for (const s of slots) {
      if (isUsableApodo(s.apodo, s.id) && !seenApodos.has(s.id)) {
        seenApodos.set(s.id, s.apodo);
      }
    }
    const claros = slots.filter((s) => s.equipo === "claros").map((s) => s.id);
    const oscuros = slots.filter((s) => s.equipo === "oscuros").map((s) => s.id);
    const winners = gc > go ? claros : oscuros;
    const losers = gc > go ? oscuros : claros;
    for (const w of winners) {
      for (const l of losers) addWin(w, l);
    }
  }

  const playerIds = new Set<string>();
  for (const [w, m] of wins) {
    playerIds.add(w);
    for (const l of m.keys()) playerIds.add(l);
  }

  const nameOf = (id: string) => resolveApodo(id, apodoById, seenApodos.get(id));

  const rows: RivalNemesisRow[] = [];
  for (const id of playerIds) {
    let rivalId: string | null = null;
    let winsVs = 0;
    const myWins = wins.get(id);
    if (myWins) {
      for (const [opp, n] of myWins) {
        if (n > winsVs) {
          winsVs = n;
          rivalId = opp;
        }
      }
    }

    let nemesisId: string | null = null;
    let lossesVs = 0;
    for (const [other, m] of wins) {
      const n = m.get(id) ?? 0;
      if (n > lossesVs) {
        lossesVs = n;
        nemesisId = other;
      }
    }

    rows.push({
      jugadorId: id,
      apodo: nameOf(id),
      rivalId,
      rivalApodo: rivalId ? nameOf(rivalId) : null,
      winsVs,
      nemesisId,
      nemesisApodo: nemesisId ? nameOf(nemesisId) : null,
      lossesVs,
    });
  }

  rows.sort((a, b) => a.apodo.localeCompare(b.apodo, "es"));
  return rows;
}

export type TrendBuckets = {
  subiendo: { id: string; apodo: string; racha: string }[];
  bajando: { id: string; apodo: string; racha: string }[];
  sinGanar: { id: string; apodo: string; pj: number }[];
  invictos: { id: string; apodo: string; pj: number }[];
};

export function buildTrends(ranking: PlayerMatchStat[]): TrendBuckets {
  const subiendo = ranking
    .filter((r) => r.racha.startsWith("G") && Number(r.racha.slice(1)) >= 2)
    .map((r) => ({ id: r.jugadorId, apodo: r.apodo, racha: r.racha }))
    .slice(0, 6);
  const bajando = ranking
    .filter((r) => r.racha.startsWith("P") && Number(r.racha.slice(1)) >= 2)
    .map((r) => ({ id: r.jugadorId, apodo: r.apodo, racha: r.racha }))
    .slice(0, 6);
  const sinGanar = ranking
    .filter((r) => r.pj > 0 && r.g === 0)
    .map((r) => ({ id: r.jugadorId, apodo: r.apodo, pj: r.pj }))
    .slice(0, 8);
  const invictos = ranking
    .filter((r) => r.pj >= 2 && r.p === 0)
    .map((r) => ({ id: r.jugadorId, apodo: r.apodo, pj: r.pj }))
    .slice(0, 6);
  return { subiendo, bajando, sinGanar, invictos };
}

export function buildClarosOscurosStandings(partidos: PartidoRow[]): ClarosOscurosStandings {
  let clarosWins = 0;
  let oscurosWins = 0;
  let empates = 0;
  let n = 0;
  for (const p of partidos) {
    if (!partidoTieneResultado(p) || p.confirmado_admin !== true) continue;
    n += 1;
    const gc = Number(p.goles_claros);
    const go = Number(p.goles_oscuros);
    if (gc > go) clarosWins += 1;
    else if (go > gc) oscurosWins += 1;
    else empates += 1;
  }
  return { clarosWins, oscurosWins, empates, partidosConResultado: n };
}

export function getLastFinishedMatch(partidos: PartidoRow[]): LastFinishedMatch | null {
  const finished = finishedMatchesDesc(partidos);
  const p = finished[0];
  if (!p) return null;
  const gc = Number(p.goles_claros);
  const go = Number(p.goles_oscuros);
  return {
    partido: p,
    golesClaros: gc,
    golesOscuros: go,
    ganador: gc > go ? "claros" : go > gc ? "oscuros" : "empate",
    mvpId: p.mvp_jugador_id ?? null,
    comentario: p.comentario_partido?.trim() || null,
  };
}

/** Resultado individual para chips en la lista. */
export type PlayerResultChip = {
  letter: ResultLetter;
  score: string;
};

/** Resumen corto para la lista de jugadores (últimos resultados + compañero frecuente). */
export type PlayerListSnippet = {
  /** Más reciente primero (máx. 4). */
  lastChips: PlayerResultChip[];
  wins: number;
  draws: number;
  losses: number;
  /** Compañero con quien más coincidió (≥3 partidos juntos). */
  frequentMate: string | null;
  frequentMateCount: number;
};

export function buildPlayerListSnippets(
  partidos: PartidoRow[],
  presencias: PresenciaRow[],
  apodoById: Map<string, string>,
): Map<string, PlayerListSnippet> {
  const finished = finishedMatchesDesc(partidos);
  const out = new Map<string, PlayerListSnippet>();
  const mateCounts = new Map<string, Map<string, number>>();

  function ensure(id: string): PlayerListSnippet {
    let s = out.get(id);
    if (!s) {
      s = {
        lastChips: [],
        wins: 0,
        draws: 0,
        losses: 0,
        frequentMate: null,
        frequentMateCount: 0,
      };
      out.set(id, s);
    }
    return s;
  }

  // finished = más reciente primero → acumular W/D/L y chips
  for (const p of finished) {
    const gc = Number(p.goles_claros);
    const go = Number(p.goles_oscuros);
    const slots = lineupForMatch(p, presencias, apodoById);
    const byTeam = {
      claros: slots.filter((s) => s.equipo === "claros").map((s) => s.id),
      oscuros: slots.filter((s) => s.equipo === "oscuros").map((s) => s.id),
    };

    for (const s of slots) {
      const sn = ensure(s.id);
      const letter = resultForTeam(gc, go, s.equipo);
      const score = s.equipo === "claros" ? `${gc}-${go}` : `${go}-${gc}`;
      if (letter === "G") sn.wins += 1;
      else if (letter === "E") sn.draws += 1;
      else sn.losses += 1;
      if (sn.lastChips.length < 4) {
        sn.lastChips.push({ letter, score });
      }

      const mates = byTeam[s.equipo].filter((id) => id !== s.id);
      let bag = mateCounts.get(s.id);
      if (!bag) {
        bag = new Map();
        mateCounts.set(s.id, bag);
      }
      for (const mid of mates) {
        bag.set(mid, (bag.get(mid) ?? 0) + 1);
      }
    }
  }

  for (const [id, bag] of mateCounts) {
    let bestId: string | null = null;
    let bestN = 0;
    for (const [mid, n] of bag) {
      if (n > bestN) {
        bestN = n;
        bestId = mid;
      }
    }
    if (bestId && bestN >= 3) {
      const sn = ensure(id);
      sn.frequentMate = resolveApodo(bestId, apodoById);
      sn.frequentMateCount = bestN;
    }
  }

  return out;
}

/** Insight narrativo para la previa Claros vs Oscuros. */
export type MatchPreviewInsight = {
  id: string;
  icon: string;
  title: string;
  body: string;
  tone?: "green" | "red" | "blue" | "purple" | "gold" | "orange";
  /** Últimos resultados (G/E/P) para mostrar como chips. */
  chips?: ResultLetter[];
  /** Apodos a mostrar como avatares. */
  names?: string[];
  /** Métrica corta a la derecha (ej. "2-0", "40%"). */
  metric?: string;
};

type PreviewPlayer = { id: string; apodo: string };

/**
 * Analiza Claros vs Oscuros contra el historial y arma tarjetas de previa
 * (rachas, enfrentamientos, duplas, debutantes, serie de color, etc.).
 */
export function buildMatchPreviewInsights(
  claros: PreviewPlayer[],
  oscuros: PreviewPlayer[],
  partidos: PartidoRow[],
  presencias: PresenciaRow[],
  apodoById: Map<string, string>,
): MatchPreviewInsight[] {
  const claroIds = new Set(claros.map((p) => p.id));
  const oscuroIds = new Set(oscuros.map((p) => p.id));
  const allIds = new Set([...claroIds, ...oscuroIds]);
  if (allIds.size < 2) return [];

  const nameOf = (id: string, fallback?: string) => resolveApodo(id, apodoById, fallback);
  const apodoLive = (p: PreviewPlayer) => nameOf(p.id, p.apodo);

  const ranking = buildPlayerRanking(partidos, presencias, apodoById);
  const byId = new Map(ranking.map((r) => [r.jugadorId, r]));
  const standings = buildClarosOscurosStandings(partidos);

  // H2H cruzado + duplas del mismo lado, solo con jugadores de este partido.
  type PairAcc = { aId: string; bId: string; pj: number; g: number; p: number; e: number };
  const sameTeamPairs = new Map<string, PairAcc>();
  const crossWins = new Map<string, Map<string, number>>(); // winner -> loser -> n

  function bumpCross(w: string, l: string) {
    let m = crossWins.get(w);
    if (!m) {
      m = new Map();
      crossWins.set(w, m);
    }
    m.set(l, (m.get(l) ?? 0) + 1);
  }

  function bumpPair(a: string, b: string, letter: ResultLetter) {
    const key = pairKey(a, b);
    let acc = sameTeamPairs.get(key);
    if (!acc) {
      acc = { aId: a < b ? a : b, bId: a < b ? b : a, pj: 0, g: 0, p: 0, e: 0 };
      sameTeamPairs.set(key, acc);
    }
    acc.pj += 1;
    if (letter === "G") acc.g += 1;
    else if (letter === "P") acc.p += 1;
    else acc.e += 1;
  }

  for (const p of finishedMatchesDesc(partidos)) {
    const gc = Number(p.goles_claros);
    const go = Number(p.goles_oscuros);
    const slots = lineupForMatch(p, presencias, apodoById);
    const teamA = slots.filter((s) => s.equipo === "claros").map((s) => s.id);
    const teamB = slots.filter((s) => s.equipo === "oscuros").map((s) => s.id);

    for (const equipo of ["claros", "oscuros"] as const) {
      const ids = equipo === "claros" ? teamA : teamB;
      const letter = resultForTeam(gc, go, equipo);
      for (let i = 0; i < ids.length; i += 1) {
        if (!allIds.has(ids[i])) continue;
        for (let j = i + 1; j < ids.length; j += 1) {
          if (!allIds.has(ids[j])) continue;
          // Solo duplas que hoy vuelven a estar del mismo lado
          const sameSideNow =
            (claroIds.has(ids[i]) && claroIds.has(ids[j])) ||
            (oscuroIds.has(ids[i]) && oscuroIds.has(ids[j]));
          if (sameSideNow) bumpPair(ids[i], ids[j], letter);
        }
      }
    }

    if (gc === go) continue;
    const winners = gc > go ? teamA : teamB;
    const losers = gc > go ? teamB : teamA;
    for (const w of winners) {
      if (!allIds.has(w)) continue;
      for (const l of losers) {
        if (!allIds.has(l)) continue;
        // Solo si hoy están enfrentados (lados opuestos)
        const opposedNow =
          (claroIds.has(w) && oscuroIds.has(l)) || (oscuroIds.has(w) && claroIds.has(l));
        if (opposedNow) bumpCross(w, l);
      }
    }
  }

  const cards: MatchPreviewInsight[] = [];

  // 1) Debutantes
  const debuts = [...claros, ...oscuros].filter((p) => (byId.get(p.id)?.pj ?? 0) === 0);
  if (debuts.length) {
    cards.push({
      id: "debuts",
      icon: "🆕",
      title: debuts.length === 1 ? "Hay debut" : "Hay debutantes",
      body:
        debuts.length === 1
          ? `${apodoLive(debuts[0])} juega su primer partido del grupo.`
          : `${debuts.map(apodoLive).join(", ")} todavía no tienen partidos registrados.`,
      tone: "purple",
      names: debuts.slice(0, 4).map(apodoLive),
      metric: String(debuts.length),
    });
  }

  // 2) Mejor enfrentamiento cruzado
  let bestH2h: { a: string; b: string; wa: number; wb: number } | null = null;
  for (const [w, m] of crossWins) {
    for (const [l, n] of m) {
      if (n < 1) continue;
      const reverse = crossWins.get(l)?.get(w) ?? 0;
      // Ordenar para no duplicar el par
      const [a, b, wa, wb] = w < l ? [w, l, n, reverse] : [l, w, reverse, n];
      const total = wa + wb;
      if (total < 1) continue;
      if (
        !bestH2h ||
        total > bestH2h.wa + bestH2h.wb ||
        (total === bestH2h.wa + bestH2h.wb && Math.abs(wa - wb) > Math.abs(bestH2h.wa - bestH2h.wb))
      ) {
        bestH2h = { a, b, wa, wb };
      }
    }
  }
  if (bestH2h && bestH2h.wa + bestH2h.wb >= 1) {
    const aName = nameOf(bestH2h.a);
    const bName = nameOf(bestH2h.b);
    cards.push({
      id: "h2h",
      icon: "⚔️",
      title: `${aName} vs ${bName}`,
      body:
        bestH2h.wa === bestH2h.wb
          ? `Historial parejo entre ellos: ${bestH2h.wa}-${bestH2h.wb} cuando se cruzaron.`
          : bestH2h.wa > bestH2h.wb
            ? `${aName} le lleva ventaja a ${bName} (${bestH2h.wa}-${bestH2h.wb}) en enfrentamientos directos.`
            : `${bName} le lleva ventaja a ${aName} (${bestH2h.wb}-${bestH2h.wa}) en enfrentamientos directos.`,
      tone: "orange",
      names: [aName, bName],
      metric: `${Math.max(bestH2h.wa, bestH2h.wb)}-${Math.min(bestH2h.wa, bestH2h.wb)}`,
    });
  }

  // 3) Racha en racha (subiendo)
  const streakers = ranking
    .filter((r) => allIds.has(r.jugadorId) && r.racha.startsWith("G") && Number(r.racha.slice(1)) >= 2)
    .sort((a, b) => Number(b.racha.slice(1)) - Number(a.racha.slice(1)));
  if (streakers[0]) {
    const r = streakers[0];
    const n = Number(r.racha.slice(1));
    cards.push({
      id: "win-streak",
      icon: "🔥",
      title: `${r.apodo} viene en racha`,
      body: `Lleva ${n} victoria${n === 1 ? "" : "s"} seguida${n === 1 ? "" : "s"}. Si sigue así, puede desbalancear el partido.`,
      tone: "green",
      names: [r.apodo],
      chips: Array.from({ length: Math.min(n, 5) }, () => "G" as ResultLetter),
      metric: r.racha,
    });
  }

  // 4) Racha negativa
  const cold = ranking
    .filter((r) => allIds.has(r.jugadorId) && r.racha.startsWith("P") && Number(r.racha.slice(1)) >= 2)
    .sort((a, b) => Number(b.racha.slice(1)) - Number(a.racha.slice(1)));
  if (cold[0]) {
    const r = cold[0];
    const n = Number(r.racha.slice(1));
    cards.push({
      id: "loss-streak",
      icon: "🧊",
      title: `${r.apodo} viene flojo`,
      body: `${n} derrota${n === 1 ? "" : "s"} al hilo. Hoy es una chance de cortar la racha… o seguirla.`,
      tone: "blue",
      names: [r.apodo],
      chips: Array.from({ length: Math.min(n, 5) }, () => "P" as ResultLetter),
      metric: r.racha,
    });
  }

  // 5) Mejor % del partido
  const withMin = ranking.filter((r) => allIds.has(r.jugadorId) && r.pj >= 2);
  const bestPct = [...withMin].sort((a, b) => b.pctVict - a.pctVict || b.g - a.g)[0];
  if (bestPct) {
    cards.push({
      id: "best-pct",
      icon: "📈",
      title: `Más efectivo: ${bestPct.apodo}`,
      body: `${bestPct.g}G-${bestPct.p}P-${bestPct.e}E en ${bestPct.pj} PJ. Gana el ${bestPct.pctVict.toFixed(0)}% de sus partidos.`,
      tone: "gold",
      names: [bestPct.apodo],
      metric: `${bestPct.pctVict.toFixed(0)}%`,
    });
  }

  // 6) Peor % del partido
  const worstPct = [...withMin].sort((a, b) => a.pctVict - b.pctVict || b.p - a.p)[0];
  if (worstPct && (!bestPct || worstPct.jugadorId !== bestPct.jugadorId)) {
    cards.push({
      id: "worst-pct",
      icon: "📉",
      title: `Más irregular: ${worstPct.apodo}`,
      body: `${worstPct.g}G-${worstPct.p}P-${worstPct.e}E · ${worstPct.pctVict.toFixed(0)}% de victorias. Hoy busca enderezarlo.`,
      tone: "red",
      names: [worstPct.apodo],
      metric: `${worstPct.pctVict.toFixed(0)}%`,
    });
  }

  // 7) Mejor dupla del mismo lado
  const pairRows = [...sameTeamPairs.values()]
    .filter((x) => x.pj >= 2)
    .map((x) => ({
      ...x,
      pct: (x.g / x.pj) * 100,
      aApodo: nameOf(x.aId),
      bApodo: nameOf(x.bId),
    }));
  const bestDuo = [...pairRows].sort((a, b) => b.pct - a.pct || b.pj - a.pj)[0];
  if (bestDuo && bestDuo.pct >= 50) {
    cards.push({
      id: "best-duo",
      icon: "🤝",
      title: `${bestDuo.aApodo} + ${bestDuo.bApodo}`,
      body: `Cuando juegan juntos: ${bestDuo.g}-${bestDuo.p}-${bestDuo.e} (${bestDuo.pct.toFixed(0)}% en ${bestDuo.pj} PJ). Hoy vuelven a estar del mismo lado.`,
      tone: "green",
      names: [bestDuo.aApodo, bestDuo.bApodo],
      metric: `${bestDuo.pct.toFixed(0)}%`,
    });
  }

  // 8) Peor dupla del mismo lado
  const worstDuo = [...pairRows].sort((a, b) => a.pct - b.pct || b.pj - a.pj)[0];
  if (worstDuo && (!bestDuo || worstDuo.aId !== bestDuo.aId || worstDuo.bId !== bestDuo.bId) && worstDuo.pct <= 40) {
    cards.push({
      id: "worst-duo",
      icon: "💀",
      title: `${worstDuo.aApodo} + ${worstDuo.bApodo}`,
      body: `Juntos van ${worstDuo.g}-${worstDuo.p}-${worstDuo.e} (${worstDuo.pct.toFixed(0)}%). La mufa vuelve a juntarse… o se rompe hoy.`,
      tone: "red",
      names: [worstDuo.aApodo, worstDuo.bApodo],
      metric: `${worstDuo.g}-${worstDuo.p}`,
    });
  }

  // 9) Serie de color
  if (standings.partidosConResultado > 0) {
    cards.push({
      id: "color-series",
      icon: "🎨",
      title: "Serie Claros vs Oscuros",
      body: `En la temporada: Claros ${standings.clarosWins} – ${standings.oscurosWins} Oscuros${
        standings.empates ? ` (${standings.empates} empate${standings.empates === 1 ? "" : "s"})` : ""
      }.`,
      tone: "gold",
      metric: `${standings.clarosWins}-${standings.oscurosWins}`,
    });
  }

  // 10) Factores a favor (resumen)
  const favorOscuros: string[] = [];
  const favorClaros: string[] = [];
  for (const r of streakers.slice(0, 3)) {
    const tip = `${r.apodo} en racha (${r.racha})`;
    if (claroIds.has(r.jugadorId)) favorClaros.push(tip);
    else favorOscuros.push(tip);
  }
  for (const r of withMin.filter((x) => x.pctVict >= 60).slice(0, 4)) {
    const tip = `${r.apodo} al ${r.pctVict.toFixed(0)}%`;
    if (claroIds.has(r.jugadorId)) {
      if (!favorClaros.some((t) => t.startsWith(r.apodo))) favorClaros.push(tip);
    } else if (!favorOscuros.some((t) => t.startsWith(r.apodo))) {
      favorOscuros.push(tip);
    }
  }
  if (favorClaros.length || favorOscuros.length) {
    const side =
      favorClaros.length === favorOscuros.length
        ? "ambos lados tienen argumentos"
        : favorClaros.length > favorOscuros.length
          ? "Claros llegan con más factores a favor"
          : "Oscuros llegan con más factores a favor";
    const bits = [
      ...favorClaros.slice(0, 2).map((t) => `☀️ ${t}`),
      ...favorOscuros.slice(0, 2).map((t) => `🌙 ${t}`),
    ];
    cards.push({
      id: "favor",
      icon: "🎯",
      title: "Factores a favor",
      body: `${side.charAt(0).toUpperCase() + side.slice(1)}. ${bits.join(" · ")}.`,
      tone: favorClaros.length >= favorOscuros.length ? "gold" : "purple",
    });
  }

  return cards.slice(0, 10);
}

