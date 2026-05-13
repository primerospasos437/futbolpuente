/** Partición en dos equipos (misma lógica que server/teams.js). */
import type { Posicion } from "../types";

export type BalanceInput = { id: string; apodo: string; posicionPreferida: Posicion; score: number };

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
