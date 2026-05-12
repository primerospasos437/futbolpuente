import type { Posicion, ProfileScores } from "../types";

export interface TeamBalancePlayer {
  id: string;
  apodo: string;
  posicionPreferida: Posicion;
  posicionAlternativa: Posicion;
  /** Promedio final (35/65) — se conserva para UI y guardado de partido */
  score: number;
  profile: ProfileScores;
  arcoScores: { valor: number; comunicacion: number; manos: number } | null;
}

const POSITIONS: Posicion[] = ["portero", "defensa", "medio", "delantero"];

function clamp10(n: number): number {
  return Math.min(10, Math.max(1, n));
}

function avgDims(profile: ProfileScores, keys: (keyof ProfileScores)[]): number {
  const vals = keys.map((k) => clamp10(Number(profile[k]) || 5));
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Capacidad de ir al arco (portero o backup con arcoScores / lectura de juego). */
export function gkCapability(p: TeamBalancePlayer): number {
  if (p.posicionPreferida === "portero") {
    return clamp10(
      avgDims(p.profile, ["posicionamiento", "comprensionTactica", "agilidadCoordinacion", "fuerzaPotencia"]) * 1.08,
    );
  }
  if (p.arcoScores) {
    return clamp10(
      (clamp10(p.arcoScores.valor) + clamp10(p.arcoScores.comunicacion) + clamp10(p.arcoScores.manos)) / 3,
    );
  }
  return clamp10(avgDims(p.profile, ["posicionamiento", "comprensionTactica"]) * 0.92);
}

function roleVectors(p: TeamBalancePlayer) {
  const profile = p.profile;
  return {
    gk: gkCapability(p),
    def: avgDims(profile, ["posicionamiento", "comprensionTactica", "fuerzaPotencia", "juegoAereo"]),
    mid: avgDims(profile, ["pase", "visionJuego", "movimientosSinBalon", "tomaDecisiones"]),
    atk: avgDims(profile, ["remateFinalizacion", "regate1v1", "visionJuego", "movimientosSinBalon"]),
    collab: avgDims(profile, ["espirituEquipo", "actitudDisciplina", "tomaDecisiones"]),
    resist: avgDims(profile, ["resistencia", "velocidadAceleracion", "fuerzaPotencia"]),
  };
}

function countPreferred(team: TeamBalancePlayer[], pos: Posicion): number {
  return team.filter((p) => p.posicionPreferida === pos).length;
}

function sumScores(team: TeamBalancePlayer[]): number {
  return team.reduce((s, p) => s + p.score, 0);
}

function sumVec(team: TeamBalancePlayer[], key: keyof ReturnType<typeof roleVectors>): number {
  return team.reduce((s, p) => s + roleVectors(p)[key], 0);
}

function bestGk(team: TeamBalancePlayer[]): number {
  if (!team.length) return 0;
  return Math.max(...team.map((p) => gkCapability(p)));
}

/**
 * Coste multiobjetivo: reparto de posiciones, habilidades por rol, arco, compensación defensa↔colaboración+resistencia.
 */
function teamSplitCost(teamA: TeamBalancePlayer[], teamB: TeamBalancePlayer[]): number {
  let cost = 0;
  const wPos = 4;
  const wGkBest = 2.8;
  const wVec = 0.55;
  const wScore = 0.45;
  const wComp = 3.2;

  for (const pos of POSITIONS) {
    cost += wPos * Math.abs(countPreferred(teamA, pos) - countPreferred(teamB, pos));
  }

  cost += wGkBest * Math.abs(bestGk(teamA) - bestGk(teamB));

  const keys: (keyof ReturnType<typeof roleVectors>)[] = ["def", "mid", "atk", "collab", "resist"];
  for (const k of keys) {
    cost += wVec * Math.abs(sumVec(teamA, k) - sumVec(teamB, k));
  }

  cost += wScore * Math.abs(sumScores(teamA) - sumScores(teamB));

  const defA = sumVec(teamA, "def");
  const defB = sumVec(teamB, "def");
  const collabA = sumVec(teamA, "collab");
  const collabB = sumVec(teamB, "collab");
  const resA = sumVec(teamA, "resist");
  const resB = sumVec(teamB, "resist");
  const eps = 0.35;
  if (defA + eps < defB) {
    if (collabA + resA + eps < collabB + resB) cost += wComp;
  } else if (defB + eps < defA) {
    if (collabB + resB + eps < collabA + resA) cost += wComp;
  }

  const porA = countPreferred(teamA, "portero");
  const porB = countPreferred(teamB, "portero");
  if (porA === 0 && porB === 0) {
    cost += 1.2 * Math.abs(bestGk(teamA) - bestGk(teamB));
  }

  return cost;
}

function cloneTeams(teamA: TeamBalancePlayer[], teamB: TeamBalancePlayer[]) {
  return { teamA: [...teamA], teamB: [...teamB] };
}

/**
 * Parte jugadores en dos equipos optimizando posiciones y vectores de juego (no solo el promedio general).
 */
export function balanceTeamsPositional(players: TeamBalancePlayer[], iterations = 3500): {
  teamA: TeamBalancePlayer[];
  teamB: TeamBalancePlayer[];
  diff: number;
} {
  if (players.length < 2) {
    return { teamA: [...players], teamB: [], diff: 0 };
  }

  const sorted = [...players].sort((a, b) => b.score - a.score);
  let teamA: TeamBalancePlayer[] = [];
  let teamB: TeamBalancePlayer[] = [];

  for (const p of sorted) {
    const tryA = cloneTeams([...teamA, p], teamB);
    const tryB = cloneTeams(teamA, [...teamB, p]);
    const cA = teamSplitCost(tryA.teamA, tryA.teamB);
    const cB = teamSplitCost(tryB.teamA, tryB.teamB);
    if (cA <= cB) {
      teamA.push(p);
    } else {
      teamB.push(p);
    }
  }

  let best = teamSplitCost(teamA, teamB);
  let bestA = [...teamA];
  let bestB = [...teamB];

  const improveLocal = () => {
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < teamA.length; i++) {
        for (let j = 0; j < teamB.length; j++) {
          const na = [...teamA];
          const nb = [...teamB];
          const t = na[i];
          na[i] = nb[j];
          nb[j] = t;
          const c = teamSplitCost(na, nb);
          if (c + 1e-9 < best) {
            teamA = na;
            teamB = nb;
            best = c;
            bestA = [...teamA];
            bestB = [...teamB];
            improved = true;
          }
        }
      }
    }
  };

  improveLocal();

  for (let k = 0; k < iterations; k++) {
    if (!teamA.length || !teamB.length) break;
    const ia = Math.floor(Math.random() * teamA.length);
    const ib = Math.floor(Math.random() * teamB.length);
    const a = teamA[ia];
    const b = teamB[ib];
    teamA[ia] = b;
    teamB[ib] = a;
    const c = teamSplitCost(teamA, teamB);
    if (c < best) {
      best = c;
      bestA = [...teamA];
      bestB = [...teamB];
    } else {
      teamA[ia] = a;
      teamB[ib] = b;
    }
    if (k % 120 === 0) improveLocal();
  }

  improveLocal();

  return {
    teamA: bestA,
    teamB: bestB,
    diff: best,
  };
}
