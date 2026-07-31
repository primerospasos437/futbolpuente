/**
 * Partidos individuales del jugador (dashboard personal).
 * Persistidos en localStorage hasta tener backend dedicado.
 */

import type { MatchResult } from "./mundialito";

export type PersonalMatchTipo = "f5" | "f11";

export type PersonalMatch = {
  id: string;
  createdAt: string;
  tipo: PersonalMatchTipo;
  resultado: MatchResult;
  goles: number;
  asistencias: number;
  quites: number;
  atajadas: number;
  rendimiento: number; // 1–5
  esMundialito: boolean;
};

export type PersonalMatchInput = Omit<PersonalMatch, "id" | "createdAt">;

export type PersonalStatsSummary = {
  partidos: number;
  goles: number;
  asistencias: number;
  quites: number;
  atajadas: number;
  avgRendimiento: number | null;
};

function storageKey(playerId: string): string {
  return `psb_personal_matches_${playerId || "anon"}`;
}

export function loadPersonalMatches(playerId: string): PersonalMatch[] {
  try {
    const raw = localStorage.getItem(storageKey(playerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersonalMatch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePersonalMatches(playerId: string, list: PersonalMatch[]): void {
  try {
    localStorage.setItem(storageKey(playerId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function addPersonalMatch(playerId: string, input: PersonalMatchInput): PersonalMatch {
  const match: PersonalMatch = {
    ...input,
    id: `pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const list = [match, ...loadPersonalMatches(playerId)];
  savePersonalMatches(playerId, list.slice(0, 200));
  return match;
}

export function summarizePersonalMatches(list: PersonalMatch[]): PersonalStatsSummary {
  if (!list.length) {
    return { partidos: 0, goles: 0, asistencias: 0, quites: 0, atajadas: 0, avgRendimiento: null };
  }
  let goles = 0;
  let asistencias = 0;
  let quites = 0;
  let atajadas = 0;
  let rendSum = 0;
  for (const m of list) {
    goles += m.goles;
    asistencias += m.asistencias;
    quites += m.quites;
    atajadas += m.atajadas;
    rendSum += m.rendimiento;
  }
  return {
    partidos: list.length,
    goles,
    asistencias,
    quites,
    atajadas,
    avgRendimiento: rendSum / list.length,
  };
}
