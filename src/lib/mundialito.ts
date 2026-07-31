/**
 * Mundialito Personal — progresión estilo torneo (local, por jugador).
 *
 * Fases: Grupos → 16avos → Octavos → Cuartos → Semifinal → Final → ¡Campeón!
 *
 * Fase de Grupos (acumulativa):
 *   - Avanzás a 16avos con 2 victorias.
 *   - Máximo 1 empate permitido.
 *   - 1 derrota o el 2º empate = eliminación (reset a inicio de Grupos).
 *
 * Eliminatorias (16avos → Final): muerte súbita.
 *   - Ganado → avanza · Empatado → repite · Perdido → reset a Grupos.
 */

export type MundialitoPhase =
  | "grupos"
  | "dieciseisavos"
  | "octavos"
  | "cuartos"
  | "semis"
  | "final"
  | "campeon";

export type MatchResult = "ganamos" | "empatamos" | "perdimos";

export const MUNDIALITO_PHASES: {
  id: MundialitoPhase;
  label: string;
  short: string;
}[] = [
  { id: "grupos", label: "Fase de Grupos", short: "Grupos" },
  { id: "dieciseisavos", label: "16avos", short: "16avos" },
  { id: "octavos", label: "Octavos", short: "8vos" },
  { id: "cuartos", label: "Cuartos", short: "4tos" },
  { id: "semis", label: "Semifinal", short: "Semis" },
  { id: "final", label: "Final", short: "Final" },
  { id: "campeon", label: "¡Campeón!", short: "🏆" },
];

const PHASE_ORDER: MundialitoPhase[] = MUNDIALITO_PHASES.map((p) => p.id);

/** Fases de muerte súbita (después de grupos, antes de campeón). */
const KNOCKOUT_PHASES: MundialitoPhase[] = [
  "dieciseisavos",
  "octavos",
  "cuartos",
  "semis",
  "final",
];

export type MundialitoState = {
  phase: MundialitoPhase;
  edition: number;
  winsInEdition: number;
  matchesInEdition: number;
  /** Victorias acumuladas solo en Fase de Grupos (objetivo: 2). */
  victoriasGrupo: number;
  /** Empates acumulados solo en Fase de Grupos (máx. 1). */
  empatesGrupo: number;
  lastResult: MatchResult | null;
  lastMessage: string | null;
  updatedAt: string;
};

function storageKey(playerId: string): string {
  return `psb_mundialito_${playerId || "anon"}`;
}

export function defaultMundialitoState(): MundialitoState {
  return {
    phase: "grupos",
    edition: 1,
    winsInEdition: 0,
    matchesInEdition: 0,
    victoriasGrupo: 0,
    empatesGrupo: 0,
    lastResult: null,
    lastMessage: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Migra fases viejas / estados incompletos al esquema actual. */
function normalizePhase(phase: unknown): MundialitoPhase | null {
  if (typeof phase !== "string") return null;
  if (PHASE_ORDER.includes(phase as MundialitoPhase)) return phase as MundialitoPhase;
  // Compat: versiones anteriores sin 16avos
  if (phase === "semifinal") return "semis";
  return null;
}

export function loadMundialito(playerId: string): MundialitoState {
  try {
    const raw = localStorage.getItem(storageKey(playerId));
    if (!raw) return defaultMundialitoState();
    const parsed = JSON.parse(raw) as Partial<MundialitoState> & { phase?: string };
    const phase = normalizePhase(parsed.phase);
    if (!phase) return defaultMundialitoState();
    return {
      ...defaultMundialitoState(),
      ...parsed,
      phase,
      victoriasGrupo: Number(parsed.victoriasGrupo) || 0,
      empatesGrupo: Number(parsed.empatesGrupo) || 0,
    };
  } catch {
    return defaultMundialitoState();
  }
}

export function saveMundialito(playerId: string, state: MundialitoState): void {
  try {
    localStorage.setItem(storageKey(playerId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function phaseIndex(phase: MundialitoPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function phaseLabel(phase: MundialitoPhase): string {
  return MUNDIALITO_PHASES.find((p) => p.id === phase)?.label ?? phase;
}

export function isKnockoutPhase(phase: MundialitoPhase): boolean {
  return KNOCKOUT_PHASES.includes(phase);
}

function resetToGrupos(
  base: MundialitoState,
  message: string,
): MundialitoState {
  return {
    ...base,
    phase: "grupos",
    victoriasGrupo: 0,
    empatesGrupo: 0,
    lastMessage: message,
  };
}

function applyGruposResult(
  base: MundialitoState,
  current: MundialitoState,
  result: MatchResult,
): { next: MundialitoState; message: string; advanced: boolean; reset: boolean; champion: boolean } {
  if (result === "perdimos") {
    const next = resetToGrupos(
      base,
      "Eliminado en Fase de Grupos por derrota. Contadores a cero — ¡de nuevo desde el inicio!",
    );
    return { next, message: next.lastMessage!, advanced: false, reset: true, champion: false };
  }

  if (result === "empatamos") {
    const empates = current.empatesGrupo + 1;
    if (empates >= 2) {
      const next = resetToGrupos(
        base,
        "Eliminado en Fase de Grupos: segundo empate. Contadores a cero — ¡a empezar de nuevo!",
      );
      return { next, message: next.lastMessage!, advanced: false, reset: true, champion: false };
    }
    const next: MundialitoState = {
      ...base,
      phase: "grupos",
      victoriasGrupo: current.victoriasGrupo,
      empatesGrupo: empates,
      lastMessage: `Empate en Grupos (${empates}/1 permitido). Necesitás ${2 - current.victoriasGrupo} victoria${2 - current.victoriasGrupo === 1 ? "" : "s"} más.`,
    };
    return { next, message: next.lastMessage!, advanced: false, reset: false, champion: false };
  }

  // Victoria
  const victorias = current.victoriasGrupo + 1;
  if (victorias >= 2) {
    const next: MundialitoState = {
      ...base,
      phase: "dieciseisavos",
      victoriasGrupo: 0,
      empatesGrupo: 0,
      winsInEdition: current.winsInEdition + 1,
      lastMessage: "¡Clasificado! 2 victorias en Grupos. Avanzás a 16avos de final.",
    };
    return { next, message: next.lastMessage!, advanced: true, reset: false, champion: false };
  }

  const next: MundialitoState = {
    ...base,
    phase: "grupos",
    victoriasGrupo: victorias,
    empatesGrupo: current.empatesGrupo,
    winsInEdition: current.winsInEdition + 1,
    lastMessage: `Victoria en Grupos (${victorias}/2). ${current.empatesGrupo === 0 ? "Todavía podés empatar 1." : "Ya usaste tu empate permitido."}`,
  };
  return { next, message: next.lastMessage!, advanced: false, reset: false, champion: false };
}

function applyKnockoutResult(
  base: MundialitoState,
  current: MundialitoState,
  result: MatchResult,
): { next: MundialitoState; message: string; advanced: boolean; reset: boolean; champion: boolean } {
  if (result === "empatamos") {
    const next: MundialitoState = {
      ...base,
      lastMessage: `Empate en ${phaseLabel(current.phase)}. Se repite el partido — misma fase.`,
    };
    return { next, message: next.lastMessage!, advanced: false, reset: false, champion: false };
  }

  if (result === "perdimos") {
    const next = resetToGrupos(
      base,
      `Eliminado en ${phaseLabel(current.phase)}. Volvés a Fase de Grupos con contadores en cero.`,
    );
    return { next, message: next.lastMessage!, advanced: false, reset: true, champion: false };
  }

  // Victoria → siguiente fase
  const idx = phaseIndex(current.phase);
  const nextPhase = PHASE_ORDER[Math.min(idx + 1, PHASE_ORDER.length - 1)];
  const champion = nextPhase === "campeon";
  const next: MundialitoState = {
    ...base,
    phase: nextPhase,
    victoriasGrupo: 0,
    empatesGrupo: 0,
    winsInEdition: current.winsInEdition + 1,
    lastMessage: champion
      ? "🏆 ¡CAMPEÓN del Mundialito! Dominaste Grupos y todas las eliminatorias."
      : `¡Victoria! Avanzás a ${phaseLabel(nextPhase)}.`,
  };
  return { next, message: next.lastMessage!, advanced: true, reset: false, champion };
}

/**
 * Aplica el resultado de un partido marcado como Mundialito.
 */
export function applyMundialitoResult(
  current: MundialitoState,
  result: MatchResult,
): { next: MundialitoState; message: string; advanced: boolean; reset: boolean; champion: boolean } {
  const base: MundialitoState = {
    ...current,
    matchesInEdition: current.matchesInEdition + 1,
    lastResult: result,
    updatedAt: new Date().toISOString(),
  };

  if (current.phase === "campeon") {
    const next = {
      ...base,
      lastMessage: "Ya sos campeón de esta edición. Tocá «Jugar nueva edición» para reiniciar.",
    };
    return { next, message: next.lastMessage!, advanced: false, reset: false, champion: true };
  }

  if (current.phase === "grupos") {
    return applyGruposResult(base, current, result);
  }

  return applyKnockoutResult(base, current, result);
}

/** Reinicia progresión para una nueva edición (después de campeón o a voluntad). */
export function startNewMundialitoEdition(current: MundialitoState): MundialitoState {
  return {
    ...defaultMundialitoState(),
    edition: current.edition + 1,
    lastMessage: `Edición #${current.edition + 1} arrancada. Objetivo en Grupos: 2 victorias (máx. 1 empate).`,
    updatedAt: new Date().toISOString(),
  };
}
