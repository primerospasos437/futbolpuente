/** Partición en dos equipos equilibrando promedio por dimensión y puestos en cancha. */
import { DIMENSION_ORDER } from "../dimensions";
import { F5_DIMENSION_ORDER } from "../dimensions-f5";
import type { PlayerSummary, Posicion } from "../types";

export type BalanceInput = {
  id: string;
  apodo: string;
  posicionPreferida: Posicion;
  posicionAlternativa: Posicion;
  /** Notas por dimensión (F11 1–10 o F5 1–5). */
  dimensionScores: number[];
  /** Promedio de dimensiones (referencia en UI). */
  score: number;
};

export const TEAM_LABEL_CLAROS = "CLAROS";
export const TEAM_LABEL_OSCUROS = "OSCUROS";

type PosCounts = Record<Posicion, number>;

const POS_WEIGHT = 0.4;

function emptyCounts(): PosCounts {
  return { defensa: 0, medio: 0, delantero: 0, portero: 0 };
}

function positionImbalance(cA: PosCounts, cB: PosCounts): number {
  return (
    Math.abs(cA.defensa - cB.defensa) +
    Math.abs(cA.medio - cB.medio) +
    Math.abs(cA.delantero - cB.delantero) +
    Math.abs(cA.portero - cB.portero) * 1.5
  );
}

function teamDimMeans(team: BalanceInput[], dimCount: number): number[] {
  if (team.length === 0) return Array(dimCount).fill(0);
  const sums = Array(dimCount).fill(0);
  for (const p of team) {
    for (let d = 0; d < dimCount; d += 1) sums[d] += p.dimensionScores[d] ?? 0;
  }
  return sums.map((s) => s / team.length);
}

/** Suma de |promedio dimensión A − promedio dimensión B| entre ambos equipos. */
export function dimensionImbalance(teamA: BalanceInput[], teamB: BalanceInput[]): number {
  const dimCount = teamA[0]?.dimensionScores.length ?? teamB[0]?.dimensionScores.length ?? 0;
  if (dimCount === 0) return 0;
  const ma = teamDimMeans(teamA, dimCount);
  const mb = teamDimMeans(teamB, dimCount);
  let sum = 0;
  for (let d = 0; d < dimCount; d += 1) sum += Math.abs(ma[d] - mb[d]);
  return sum;
}

type PartitionState = {
  teamA: BalanceInput[];
  teamB: BalanceInput[];
  assignA: Map<string, Posicion>;
  assignB: Map<string, Posicion>;
};

function getCounts(state: PartitionState): { a: PosCounts; b: PosCounts } {
  const a = emptyCounts();
  const b = emptyCounts();
  for (const p of state.teamA) {
    const pos = state.assignA.get(p.id) ?? p.posicionPreferida;
    a[pos] += 1;
  }
  for (const p of state.teamB) {
    const pos = state.assignB.get(p.id) ?? p.posicionPreferida;
    b[pos] += 1;
  }
  return { a, b };
}

function choosePos(p: BalanceInput, cA: PosCounts, cB: PosCounts, toA: boolean): Posicion {
  const opts: Posicion[] = [p.posicionPreferida];
  if (p.posicionAlternativa !== p.posicionPreferida) opts.push(p.posicionAlternativa);
  let best = opts[0];
  let bestImb = Number.POSITIVE_INFINITY;
  for (const pos of opts) {
    const na = { ...cA };
    const nb = { ...cB };
    if (toA) na[pos] += 1;
    else nb[pos] += 1;
    const imb = positionImbalance(na, nb);
    if (imb < bestImb) {
      bestImb = imb;
      best = pos;
    }
  }
  return best;
}

function rebuildAssignments(state: PartitionState): void {
  state.assignA.clear();
  state.assignB.clear();
  const cA = emptyCounts();
  const cB = emptyCounts();
  for (const p of state.teamA) {
    const pos = choosePos(p, cA, cB, true);
    state.assignA.set(p.id, pos);
    cA[pos] += 1;
  }
  for (const p of state.teamB) {
    const pos = choosePos(p, cA, cB, false);
    state.assignB.set(p.id, pos);
    cB[pos] += 1;
  }
}

function totalCost(state: PartitionState): number {
  const dimImb = dimensionImbalance(state.teamA, state.teamB);
  const { a, b } = getCounts(state);
  return dimImb + POS_WEIGHT * positionImbalance(a, b);
}

function cloneState(state: PartitionState): PartitionState {
  return {
    teamA: [...state.teamA],
    teamB: [...state.teamB],
    assignA: new Map(state.assignA),
    assignB: new Map(state.assignB),
  };
}

function addPlayer(state: PartitionState, p: BalanceInput, toA: boolean): void {
  const { a, b } = getCounts(state);
  const pos = choosePos(p, a, b, toA);
  if (toA) {
    state.teamA.push(p);
    state.assignA.set(p.id, pos);
  } else {
    state.teamB.push(p);
    state.assignB.set(p.id, pos);
  }
}

function swapPlayers(state: PartitionState, ia: number, ib: number): void {
  const pa = state.teamA[ia];
  const pb = state.teamB[ib];
  state.teamA[ia] = pb;
  state.teamB[ib] = pa;
  state.assignA.delete(pa.id);
  state.assignB.delete(pb.id);
  rebuildAssignments(state);
}

function vectorSum(p: BalanceInput): number {
  return p.dimensionScores.reduce((a, b) => a + b, 0);
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

function assignPlayerWithSizeCap(
  state: PartitionState,
  p: BalanceInput,
  sizeA: number,
  sizeB: number,
): void {
  const canA = state.teamA.length < sizeA;
  const canB = state.teamB.length < sizeB;
  if (canA && !canB) {
    addPlayer(state, p, true);
    return;
  }
  if (!canA && canB) {
    addPlayer(state, p, false);
    return;
  }
  if (!canA && !canB) {
    throw new Error("No hay cupo en ningún equipo al armar la partición.");
  }
  const tryA = cloneState(state);
  addPlayer(tryA, p, true);
  const tryB = cloneState(state);
  addPlayer(tryB, p, false);
  addPlayer(state, p, totalCost(tryA) <= totalCost(tryB));
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
 * Partición en dos equipos equilibrando promedios por dimensión y puestos (defensa / medio / delantero),
 * respetando pares que no deben quedar en el mismo equipo.
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
    assignA: new Map(),
    assignB: new Map(),
  };
  rebuildAssignments(state);

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
  const sorted = [...players].sort((a, b) => vectorSum(b) - vectorSum(a));
  const state: PartitionState = {
    teamA: [],
    teamB: [],
    assignA: new Map(),
    assignB: new Map(),
  };

  for (const p of sorted) {
    assignPlayerWithSizeCap(state, p, sizeA, sizeB);
  }
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
    improve();
    if (state.teamA.length === 0 || state.teamB.length === 0) break;
    const ia = Math.floor(Math.random() * state.teamA.length);
    const ib = Math.floor(Math.random() * state.teamB.length);
    const trial = cloneState(state);
    swapPlayers(trial, ia, ib);
    if (totalCost(trial) <= totalCost(state)) swapPlayers(state, ia, ib);
  }
  improve();
  assertBalancedSizes(state.teamA, state.teamB, sizeA, sizeB);

  return {
    teamA: state.teamA,
    teamB: state.teamB,
    diff: dimensionImbalance(state.teamA, state.teamB),
  };
}
