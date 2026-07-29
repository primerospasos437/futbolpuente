/** Partición en dos equipos equilibrando puestos en cancha y, en segundo lugar, notas. */
import { DIMENSION_ORDER } from "../dimensions";
import { F5_DIMENSION_ORDER } from "../dimensions-f5";
import type { Dimension, PlayerSummary, Posicion } from "../types";

export type BalanceInput = {
  id: string;
  apodo: string;
  posicionPreferida: Posicion;
  posicionAlternativa: Posicion;
  /** Notas por dimensión (F11 o F5, escala 1–5). */
  dimensionScores: number[];
  /** Promedio de dimensiones (referencia en UI). */
  score: number;
  /**
   * Despliegue / ida-y-vuelta (pulmón+compromiso en F5; resistencia+espíritu+actitud+posicionamiento en F11).
   * Sirve para cubrir huecos defensivos con delanteros/medios colaborativos.
   */
  workRate: number;
};

export const TEAM_LABEL_CLAROS = "CLAROS";
export const TEAM_LABEL_OSCUROS = "OSCUROS";

type PosCounts = Record<Posicion, number>;

/** Prioridad alta: un desbalance de 1 por puesto pesa más que varias décimas de nota. */
const POS_WEIGHT = 14;
const FIELD_ORDER: Posicion[] = ["portero", "defensa", "medio", "delantero"];
/** Roles que pueden “bajar” a cubrir cuando faltan defensores. */
const COVER_ROLES: Posicion[] = ["delantero", "medio"];

function emptyCounts(): PosCounts {
  return { defensa: 0, medio: 0, delantero: 0, portero: 0 };
}

function positionImbalance(cA: PosCounts, cB: PosCounts): number {
  return (
    Math.abs(cA.defensa - cB.defensa) +
    Math.abs(cA.medio - cB.medio) +
    Math.abs(cA.delantero - cB.delantero) +
    Math.abs(cA.portero - cB.portero) * 2
  );
}

function preferredCounts(teamA: BalanceInput[], teamB: BalanceInput[]): { a: PosCounts; b: PosCounts } {
  const a = emptyCounts();
  const b = emptyCounts();
  for (const p of teamA) a[p.posicionPreferida] += 1;
  for (const p of teamB) b[p.posicionPreferida] += 1;
  return { a, b };
}

function teamDimMeans(team: BalanceInput[], dimCount: number): number[] {
  if (team.length === 0) return Array(dimCount).fill(0);
  const sums = Array(dimCount).fill(0);
  for (const p of team) {
    for (let d = 0; d < dimCount; d += 1) sums[d] += p.dimensionScores[d] ?? 0;
  }
  return sums.map((s) => s / team.length);
}

/** Suma de |promedio dimensión A − B| (sin normalizar). */
export function dimensionImbalance(teamA: BalanceInput[], teamB: BalanceInput[]): number {
  const dimCount = teamA[0]?.dimensionScores.length ?? teamB[0]?.dimensionScores.length ?? 0;
  if (dimCount === 0) return 0;
  const ma = teamDimMeans(teamA, dimCount);
  const mb = teamDimMeans(teamB, dimCount);
  let sum = 0;
  for (let d = 0; d < dimCount; d += 1) sum += Math.abs(ma[d] - mb[d]);
  return sum;
}

function dimensionImbalanceNorm(teamA: BalanceInput[], teamB: BalanceInput[]): number {
  const dimCount = teamA[0]?.dimensionScores.length ?? teamB[0]?.dimensionScores.length ?? 0;
  if (dimCount === 0) return 0;
  return dimensionImbalance(teamA, teamB) / dimCount;
}

/** Ida y vuelta / colaboración (para cubrir el lado con menos defensa). */
export function workRateFromScores(dimensionScores: number[]): number {
  if (dimensionScores.length === F5_DIMENSION_ORDER.length) {
    const pulmon = dimensionScores[F5_DIMENSION_ORDER.indexOf("pulmon")] ?? 0;
    const compromiso = dimensionScores[F5_DIMENSION_ORDER.indexOf("compromiso")] ?? 0;
    return (pulmon + compromiso) / 2;
  }
  const pick = (key: Dimension) => {
    const i = DIMENSION_ORDER.indexOf(key);
    return i >= 0 ? (dimensionScores[i] ?? 0) : 0;
  };
  return (
    (pick("resistencia") +
      pick("espirituEquipo") +
      pick("actitudDisciplina") +
      pick("posicionamiento")) /
    4
  );
}

type PartitionState = {
  teamA: BalanceInput[];
  teamB: BalanceInput[];
};

function totalCost(state: PartitionState): number {
  const { a, b } = preferredCounts(state.teamA, state.teamB);
  return POS_WEIGHT * positionImbalance(a, b) + dimensionImbalanceNorm(state.teamA, state.teamB);
}

function cloneState(state: PartitionState): PartitionState {
  return {
    teamA: [...state.teamA],
    teamB: [...state.teamB],
  };
}

function swapPlayers(state: PartitionState, ia: number, ib: number): void {
  const pa = state.teamA[ia];
  const pb = state.teamB[ib];
  state.teamA[ia] = pb;
  state.teamB[ib] = pa;
}

function teamScoreSum(team: BalanceInput[]): number {
  return team.reduce((s, p) => s + p.score, 0);
}

/** Tamaños fijos: mitad cada uno (par) o diferencia máxima 1 (impar). */
export function targetTeamSizes(totalPlayers: number): { sizeA: number; sizeB: number } {
  const sizeA = Math.floor(totalPlayers / 2);
  return { sizeA, sizeB: totalPlayers - sizeA };
}

function assertBalancedSizes(
  teamA: BalanceInput[],
  teamB: BalanceInput[],
  sizeA: number,
  sizeB: number,
): void {
  if (teamA.length !== sizeA || teamB.length !== sizeB) {
    throw new Error(
      `Partición inválida: CLAROS ${teamA.length}/${sizeA}, OSCUROS ${teamB.length}/${sizeB}`,
    );
  }
}

/**
 * Semilla: por cada puesto preferido, reparte en zigzag (fuerte/débil)
 * para no amontonar todos los defensores o mediocampistas de un lado.
 * Delanteros/medios se ordenan también por workRate cuando ya hay desbalance de defensas.
 */
function seedByPreferredPosition(
  players: BalanceInput[],
  sizeA: number,
  sizeB: number,
): PartitionState {
  const state: PartitionState = { teamA: [], teamB: [] };
  const buckets = new Map<Posicion, BalanceInput[]>();
  for (const pos of FIELD_ORDER) buckets.set(pos, []);
  for (const p of players) {
    const list = buckets.get(p.posicionPreferida) ?? [];
    list.push(p);
    buckets.set(p.posicionPreferida, list);
  }
  for (const pos of FIELD_ORDER) {
    let list = [...(buckets.get(pos) ?? [])];
    if (pos === "delantero" || pos === "medio") {
      list.sort((a, b) => b.workRate - a.workRate || b.score - a.score);
    } else {
      list.sort((a, b) => b.score - a.score);
    }
    for (const p of list) {
      const canA = state.teamA.length < sizeA;
      const canB = state.teamB.length < sizeB;
      if (canA && !canB) {
        state.teamA.push(p);
        continue;
      }
      if (!canA && canB) {
        state.teamB.push(p);
        continue;
      }
      const { a, b } = preferredCounts(state.teamA, state.teamB);

      // Delantero/medio colaborativo → equipo con menos defensores
      if ((pos === "delantero" || pos === "medio") && a.defensa !== b.defensa) {
        const preferWeakDefA = a.defensa < b.defensa;
        if (preferWeakDefA && canA) {
          state.teamA.push(p);
          continue;
        }
        if (!preferWeakDefA && canB) {
          state.teamB.push(p);
          continue;
        }
      }

      const preferA =
        a[pos] < b[pos] || (a[pos] === b[pos] && teamScoreSum(state.teamA) <= teamScoreSum(state.teamB));
      if (preferA && canA) state.teamA.push(p);
      else if (!preferA && canB) state.teamB.push(p);
      else if (canA) state.teamA.push(p);
      else state.teamB.push(p);
    }
  }
  for (const p of players) {
    if (state.teamA.includes(p) || state.teamB.includes(p)) continue;
    if (state.teamA.length < sizeA) state.teamA.push(p);
    else state.teamB.push(p);
  }
  return state;
}

/**
 * Si un equipo tiene menos defensores, mueve ahí al delantero (o medio) con más
 * pulmón/compromiso, intercambiándolo por uno menos colaborativo del otro lado.
 * No cambia el conteo de puestos (swap mismo rol).
 */
function alignWorkRateToDefensiveNeed(state: PartitionState): void {
  for (let pass = 0; pass < 4; pass += 1) {
    const { a, b } = preferredCounts(state.teamA, state.teamB);
    if (a.defensa === b.defensa) return;

    const weakIsA = a.defensa < b.defensa;
    const weak = weakIsA ? state.teamA : state.teamB;
    const strong = weakIsA ? state.teamB : state.teamA;

    let swapped = false;
    for (const role of COVER_ROLES) {
      const weakRole = weak.filter((p) => p.posicionPreferida === role);
      const strongRole = strong.filter((p) => p.posicionPreferida === role);
      if (!weakRole.length || !strongRole.length) continue;

      const bestStrong = [...strongRole].sort((x, y) => y.workRate - x.workRate)[0];
      const worstWeak = [...weakRole].sort((x, y) => x.workRate - y.workRate)[0];
      if (bestStrong.workRate < worstWeak.workRate + 0.2) continue;

      const ia = state.teamA.findIndex((p) => p.id === (weakIsA ? worstWeak.id : bestStrong.id));
      const ib = state.teamB.findIndex((p) => p.id === (weakIsA ? bestStrong.id : worstWeak.id));
      if (ia < 0 || ib < 0) continue;
      swapPlayers(state, ia, ib);
      swapped = true;
      break;
    }
    if (!swapped) return;
  }
}

export function playerToBalanceInput(p: PlayerSummary, useF5: boolean): BalanceInput {
  const dimensionScores = useF5
    ? F5_DIMENSION_ORDER.map((k) => p.f5Profile[k] ?? 0)
    : DIMENSION_ORDER.map((k) => p.profile[k] ?? 0);
  const score =
    dimensionScores.length > 0
      ? dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length
      : 0;
  return {
    id: p.id,
    apodo: p.apodo,
    posicionPreferida: p.posicionPreferida,
    posicionAlternativa: p.posicionAlternativa ?? p.posicionPreferida,
    dimensionScores,
    score,
    workRate: workRateFromScores(dimensionScores),
  };
}

export function teamAverageScore(team: BalanceInput[]): number {
  if (team.length === 0) return 0;
  return team.reduce((s, p) => s + p.score, 0) / team.length;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function countTeamViolations(team: BalanceInput[], avoid: Set<string>): number {
  let c = 0;
  for (let i = 0; i < team.length; i += 1) {
    for (let j = i + 1; j < team.length; j += 1) {
      if (avoid.has(edgeKey(team[i].id, team[j].id))) c += 1;
    }
  }
  return c;
}

function totalViolations(teamA: BalanceInput[], teamB: BalanceInput[], avoid: Set<string>): number {
  return countTeamViolations(teamA, avoid) + countTeamViolations(teamB, avoid);
}

/**
 * Partición en dos equipos: primero equilibra puestos preferidos, después notas.
 * Respeta pares que no deben quedar en el mismo equipo.
 */
export function balanceTwoTeamsWithAvoid(
  players: BalanceInput[],
  avoidEdges: [string, string][],
  iterations = 800,
): { teamA: BalanceInput[]; teamB: BalanceInput[]; diff: number } {
  const avoid = new Set(avoidEdges.map(([x, y]) => edgeKey(x, y)));
  const { teamA: a0, teamB: b0, diff: d0 } = balanceTwoTeams(players, iterations);
  if (avoid.size === 0) return { teamA: a0, teamB: b0, diff: d0 };

  let state: PartitionState = {
    teamA: [...a0],
    teamB: [...b0],
  };

  const costWithViolations = (s: PartitionState) => {
    const v = totalViolations(s.teamA, s.teamB, avoid);
    return v * 1e9 + totalCost(s);
  };

  for (let round = 0; round < 800 && totalViolations(state.teamA, state.teamB, avoid) > 0; round += 1) {
    const vBefore = totalViolations(state.teamA, state.teamB, avoid);
    const cBefore = costWithViolations(state);
    let bestIa = -1;
    let bestIb = -1;
    let bestKey = Number.POSITIVE_INFINITY;
    for (let ia = 0; ia < state.teamA.length; ia += 1) {
      for (let ib = 0; ib < state.teamB.length; ib += 1) {
        const trial = cloneState(state);
        swapPlayers(trial, ia, ib);
        const key = costWithViolations(trial);
        if (key < bestKey) {
          bestKey = key;
          bestIa = ia;
          bestIb = ib;
        }
      }
    }
    if (bestIa < 0) break;
    const trial = cloneState(state);
    swapPlayers(trial, bestIa, bestIb);
    const vAfter = totalViolations(trial.teamA, trial.teamB, avoid);
    const cAfter = costWithViolations(trial);
    if (vAfter > vBefore || (vAfter === vBefore && cAfter + 1e-9 >= cBefore)) break;
    swapPlayers(state, bestIa, bestIb);
  }

  alignWorkRateToDefensiveNeed(state);

  const { sizeA, sizeB } = targetTeamSizes(players.length);
  assertBalancedSizes(state.teamA, state.teamB, sizeA, sizeB);

  return {
    teamA: state.teamA,
    teamB: state.teamB,
    diff: dimensionImbalance(state.teamA, state.teamB),
  };
}

export function balanceTwoTeams(
  players: BalanceInput[],
  iterations = 800,
): { teamA: BalanceInput[]; teamB: BalanceInput[]; diff: number } {
  const n = players.length;
  if (n < 2) {
    return { teamA: [...players], teamB: [], diff: 0 };
  }

  const { sizeA, sizeB } = targetTeamSizes(n);
  const state = seedByPreferredPosition(players, sizeA, sizeB);
  assertBalancedSizes(state.teamA, state.teamB, sizeA, sizeB);

  const improve = () => {
    let best = totalCost(state);
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < state.teamA.length; i += 1) {
        for (let j = 0; j < state.teamB.length; j += 1) {
          const trial = cloneState(state);
          swapPlayers(trial, i, j);
          const c = totalCost(trial);
          const posBefore = preferredCounts(state.teamA, state.teamB);
          const posAfter = preferredCounts(trial.teamA, trial.teamB);
          const imbBefore = positionImbalance(posBefore.a, posBefore.b);
          const imbAfter = positionImbalance(posAfter.a, posAfter.b);
          if (imbAfter > imbBefore) continue;
          if (c + 1e-9 < best) {
            swapPlayers(state, i, j);
            best = c;
            improved = true;
          }
        }
      }
    }
  };

  improve();
  for (let k = 0; k < iterations; k += 1) {
    if (state.teamA.length === 0 || state.teamB.length === 0) break;
    const ia = Math.floor(Math.random() * state.teamA.length);
    const ib = Math.floor(Math.random() * state.teamB.length);
    const trial = cloneState(state);
    swapPlayers(trial, ia, ib);
    const posBefore = preferredCounts(state.teamA, state.teamB);
    const posAfter = preferredCounts(trial.teamA, trial.teamB);
    const imbBefore = positionImbalance(posBefore.a, posBefore.b);
    const imbAfter = positionImbalance(posAfter.a, posAfter.b);
    if (imbAfter > imbBefore) continue;
    if (totalCost(trial) <= totalCost(state)) swapPlayers(state, ia, ib);
  }
  improve();
  alignWorkRateToDefensiveNeed(state);
  assertBalancedSizes(state.teamA, state.teamB, sizeA, sizeB);

  return {
    teamA: state.teamA,
    teamB: state.teamB,
    diff: dimensionImbalance(state.teamA, state.teamB),
  };
}
