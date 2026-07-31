/**
 * Partidos individuales del jugador (dashboard personal).
 * Persistidos en localStorage hasta tener backend dedicado.
 */

import { defaultF5Scores, type F5ProfileScores } from "../dimensions-f5";
import { defaultScores } from "../dimensions";
import type { ProfileScores } from "../types";
import { f5ProfileAverage } from "./scoringF5";
import { profileAverage } from "./scoring";
import type { MatchResult } from "./mundialito";
import type { FutbolFormato } from "./personalCalendar";
import { FUTBOL_FORMATOS } from "./personalCalendar";

/** @deprecated usar FutbolFormato; se mantiene alias para datos viejos */
export type PersonalMatchTipo = FutbolFormato | "f5" | "f11";

export type SkillFamily = "f5" | "f11";

/** F5 / F7 / F8 → métricas chicas; F9 / F11 → métricas grandes. */
export function skillFamilyForFormato(tipo: string): SkillFamily {
  const t = normalizeFormato(tipo);
  if (t === "F9" || t === "F11") return "f11";
  return "f5";
}

export function normalizeFormato(raw: string | null | undefined): FutbolFormato {
  const s = String(raw ?? "F5").trim().toUpperCase();
  if (s === "F5" || s === "5") return "F5";
  if (s === "F7" || s === "7") return "F7";
  if (s === "F8" || s === "8") return "F8";
  if (s === "F9" || s === "9") return "F9";
  if (s === "F11" || s === "11") return "F11";
  // legacy lowercase
  if (s === "FÚTBOL 5" || raw === "f5") return "F5";
  if (raw === "f11") return "F11";
  return "F5";
}

export type PersonalMatch = {
  id: string;
  createdAt: string;
  tipo: FutbolFormato;
  resultado: MatchResult;
  goles: number;
  asistencias: number;
  quites: number;
  atajadas: number;
  /** Promedio general 1–5 (derivado de skills o estrellas legacy). */
  rendimiento: number;
  esMundialito: boolean;
  /** Autocalificación por dimensiones (F5/F7/F8). */
  skillsF5?: F5ProfileScores;
  /** Autocalificación por dimensiones (F9/F11). */
  skillsF11?: ProfileScores;
};

export type PersonalMatchInput = Omit<PersonalMatch, "id" | "createdAt">;

export type PersonalStatsSummary = {
  partidos: number;
  goles: number;
  asistencias: number;
  quites: number;
  atajadas: number;
  avgRendimiento: number | null;
  ganados: number;
  empatados: number;
  perdidos: number;
  /** Promedio de autocals en partidos formato chico (F5/F7/F8). */
  avgF5: number | null;
  /** Promedio de autocals en partidos formato grande (F9/F11). */
  avgF11: number | null;
  partidosF5: number;
  partidosF11: number;
};

function storageKey(playerId: string): string {
  return `psb_personal_matches_${playerId || "anon"}`;
}

function migrateMatch(raw: Record<string, unknown>): PersonalMatch {
  const tipo = normalizeFormato(String(raw.tipo ?? "F5"));
  const skillsF5 = raw.skillsF5 && typeof raw.skillsF5 === "object" ? (raw.skillsF5 as F5ProfileScores) : undefined;
  const skillsF11 = raw.skillsF11 && typeof raw.skillsF11 === "object" ? (raw.skillsF11 as ProfileScores) : undefined;
  let rendimiento = Number(raw.rendimiento) || 3;
  if (skillsF5 && skillFamilyForFormato(tipo) === "f5") {
    rendimiento = f5ProfileAverage(skillsF5);
  } else if (skillsF11 && skillFamilyForFormato(tipo) === "f11") {
    rendimiento = profileAverage(skillsF11);
  }
  return {
    id: String(raw.id ?? `pm_${Date.now()}`),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    tipo,
    resultado: (raw.resultado as MatchResult) || "ganamos",
    goles: Number(raw.goles) || 0,
    asistencias: Number(raw.asistencias) || 0,
    quites: Number(raw.quites) || 0,
    atajadas: Number(raw.atajadas) || 0,
    rendimiento,
    esMundialito: Boolean(raw.esMundialito),
    skillsF5,
    skillsF11,
  };
}

export function loadPersonalMatches(playerId: string): PersonalMatch[] {
  try {
    const raw = localStorage.getItem(storageKey(playerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((m) => migrateMatch((m && typeof m === "object" ? m : {}) as Record<string, unknown>));
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

export function computeMatchRendimiento(input: PersonalMatchInput): number {
  const family = skillFamilyForFormato(input.tipo);
  if (family === "f5" && input.skillsF5) return f5ProfileAverage(input.skillsF5);
  if (family === "f11" && input.skillsF11) return profileAverage(input.skillsF11);
  return Math.min(5, Math.max(1, Number(input.rendimiento) || 3));
}

export function addPersonalMatch(playerId: string, input: PersonalMatchInput): PersonalMatch {
  const tipo = normalizeFormato(input.tipo);
  const rendimiento = computeMatchRendimiento({ ...input, tipo });
  const match: PersonalMatch = {
    ...input,
    tipo,
    rendimiento,
    id: `pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const list = [match, ...loadPersonalMatches(playerId)];
  savePersonalMatches(playerId, list.slice(0, 200));
  return match;
}

export function emptyPersonalMatchInput(mundialito = false, tipo: FutbolFormato = "F5"): PersonalMatchInput {
  const family = skillFamilyForFormato(tipo);
  return {
    tipo,
    resultado: "ganamos",
    goles: 0,
    asistencias: 0,
    quites: 0,
    atajadas: 0,
    rendimiento: 3,
    esMundialito: mundialito,
    skillsF5: family === "f5" ? defaultF5Scores() : undefined,
    skillsF11: family === "f11" ? defaultScores() : undefined,
  };
}

export function summarizePersonalMatches(list: PersonalMatch[]): PersonalStatsSummary {
  const empty: PersonalStatsSummary = {
    partidos: 0,
    goles: 0,
    asistencias: 0,
    quites: 0,
    atajadas: 0,
    avgRendimiento: null,
    ganados: 0,
    empatados: 0,
    perdidos: 0,
    avgF5: null,
    avgF11: null,
    partidosF5: 0,
    partidosF11: 0,
  };
  if (!list.length) return empty;

  let goles = 0;
  let asistencias = 0;
  let quites = 0;
  let atajadas = 0;
  let rendSum = 0;
  let ganados = 0;
  let empatados = 0;
  let perdidos = 0;
  const f5Rends: number[] = [];
  const f11Rends: number[] = [];

  for (const m of list) {
    goles += m.goles;
    asistencias += m.asistencias;
    quites += m.quites;
    atajadas += m.atajadas;
    rendSum += m.rendimiento;
    if (m.resultado === "ganamos") ganados += 1;
    else if (m.resultado === "empatamos") empatados += 1;
    else perdidos += 1;

    const family = skillFamilyForFormato(m.tipo);
    if (family === "f5") {
      f5Rends.push(m.skillsF5 ? f5ProfileAverage(m.skillsF5) : m.rendimiento);
    } else {
      f11Rends.push(m.skillsF11 ? profileAverage(m.skillsF11) : m.rendimiento);
    }
  }

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    partidos: list.length,
    goles,
    asistencias,
    quites,
    atajadas,
    avgRendimiento: rendSum / list.length,
    ganados,
    empatados,
    perdidos,
    avgF5: mean(f5Rends),
    avgF11: mean(f11Rends),
    partidosF5: f5Rends.length,
    partidosF11: f11Rends.length,
  };
}

export { FUTBOL_FORMATOS };
