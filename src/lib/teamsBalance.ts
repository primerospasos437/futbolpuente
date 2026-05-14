/** Partición en dos equipos (misma lógica que server/teams.js). */
import type { Posicion } from "../types";

export type BalanceInput = { id: string; apodo: string; posicionPreferida: Posicion; score: number };

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
 * Partición en dos equipos minimizando diferencia de suma de notas, y respetando pares que no deben
 * quedar en el mismo equipo (aristas no dirigidas).
 */
export function balanceTwoTeamsWithAvoid(
  players: BalanceInput[],
  avoidEdges: [string, string][],
  iterations = 800,
): { teamA: BalanceInput[]; teamB: BalanceInput[]; diff: number } {
  const avoid = new Set(avoidEdges.map(([x, y]) => edgeKey(x, y)));
  const { teamA: a0, teamB: b0, diff: d0 } = balanceTwoTeams(players, iterations);
  if (avoid.size === 0) return { teamA: a0, teamB: b0, diff: d0 };

  let teamA = [...a0];
  let teamB = [...b0];
  let sumA = teamA.reduce((s, p) => s + p.score, 0);
  let sumB = teamB.reduce((s, p) => s + p.score, 0);

  const diffAbs = () => Math.abs(sumA - sumB);

  const doSwap = (ia: number, ib: number) => {
    const pa = teamA[ia];
    const pb = teamB[ib];
    sumA = sumA - pa.score + pb.score;
    sumB = sumB - pb.score + pa.score;
    teamA[ia] = pb;
    teamB[ib] = pa;
  };

  for (let round = 0; round < 800 && totalViolations(teamA, teamB, avoid) > 0; round += 1) {
    const vBefore = totalViolations(teamA, teamB, avoid);
    const dBefore = diffAbs();
    let bestIa = -1;
    let bestIb = -1;
    let bestKey = Number.POSITIVE_INFINITY;
    for (let ia = 0; ia < teamA.length; ia += 1) {
      for (let ib = 0; ib < teamB.length; ib += 1) {
        const pa = teamA[ia];
        const pb = teamB[ib];
        const na = sumA - pa.score + pb.score;
        const nb = sumB - pb.score + pa.score;
        const ta = teamA.slice();
        const tb = teamB.slice();
        ta[ia] = pb;
        tb[ib] = pa;
        const v = totalViolations(ta, tb, avoid);
        const d = Math.abs(na - nb);
        const key = v * 1e9 + d;
        if (key < bestKey) {
          bestKey = key;
          bestIa = ia;
          bestIb = ib;
        }
      }
    }
    if (bestIa < 0) break;
    const pa = teamA[bestIa];
    const pb = teamB[bestIb];
    const na = sumA - pa.score + pb.score;
    const nb = sumB - pb.score + pa.score;
    const ta = teamA.slice();
    const tb = teamB.slice();
    ta[bestIa] = pb;
    tb[bestIb] = pa;
    const vAfter = totalViolations(ta, tb, avoid);
    const dAfter = Math.abs(na - nb);
    if (vAfter > vBefore || (vAfter === vBefore && dAfter + 1e-9 >= dBefore)) break;
    doSwap(bestIa, bestIb);
  }

  return { teamA, teamB, diff: diffAbs() };
}

export function balanceTwoTeams(players: BalanceInput[], iterations = 800): {
  teamA: BalanceInput[];
  teamB: BalanceInput[];
  diff: number;
} {
  if (players.length < 2) {
    return { teamA: [...players], teamB: [], diff: 0 };
  }

  const sorted = [...players].sort((a, b) => b.score - a.score);
  let teamA: BalanceInput[] = [];
  let teamB: BalanceInput[] = [];
  let sumA = 0;
  let sumB = 0;

  for (const p of sorted) {
    if (sumA <= sumB) {
      teamA.push(p);
      sumA += p.score;
    } else {
      teamB.push(p);
      sumB += p.score;
    }
  }

  const diffAbs = () => Math.abs(sumA - sumB);
  const improve = () => {
    let best = diffAbs();
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < teamA.length; i++) {
        for (let j = 0; j < teamB.length; j++) {
          const a = teamA[i];
          const b = teamB[j];
          const newSumA = sumA - a.score + b.score;
          const newSumB = sumB - b.score + a.score;
          const nd = Math.abs(newSumA - newSumB);
          if (nd + 1e-9 < best) {
            teamA[i] = b;
            teamB[j] = a;
            sumA = newSumA;
            sumB = newSumB;
            best = nd;
            improved = true;
          }
        }
      }
    }
  };

  for (let k = 0; k < iterations; k++) {
    improve();
    if (teamA.length === 0 || teamB.length === 0) break;
    const ia = Math.floor(Math.random() * teamA.length);
    const ib = Math.floor(Math.random() * teamB.length);
    const a = teamA[ia];
    const b = teamB[ib];
    sumA = sumA - a.score + b.score;
    sumB = sumB - b.score + a.score;
    teamA[ia] = b;
    teamB[ib] = a;
  }
  improve();

  return {
    teamA,
    teamB,
    diff: Math.abs(sumA - sumB),
  };
}
