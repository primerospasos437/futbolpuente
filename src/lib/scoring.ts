/**
 * Cálculo de promedios y nota final (misma lógica que server/scores.js), para uso en el cliente.
 * Escala unificada 1–5 (estrellas). Valores legacy 6–10 se mapean a 1–5.
 */
import { DIMENSION_ORDER } from "../dimensions";
import type { Dimension, ProfileScores } from "../types";

const PROFILE_DIMS = DIMENSION_ORDER;

/** Convierte nota a escala 1–5 (acepta legacy 1–10). */
function toStar5(n: unknown): number | null {
  const raw = Number(n);
  if (!Number.isFinite(raw)) return null;
  const v = Math.round(raw);
  if (v > 5) return Math.min(5, Math.max(1, Math.round(v / 2)));
  return Math.min(5, Math.max(1, v));
}

function isLegacyProfile(p: Record<string, unknown>): boolean {
  return p.tecnica != null && p.controlPrimerToque == null;
}

function legacyDimension(k: Dimension, p: Record<string, unknown>): number {
  const t = toStar5(p.tecnica) ?? 3;
  const r = toStar5(p.remate) ?? 3;
  const v = toStar5(p.velocidad) ?? 3;
  const res = toStar5(p.resistencia) ?? 3;
  const vi = toStar5(p.visionJuego) ?? 3;
  const d = toStar5(p.defensa) ?? 3;
  const m = toStar5(p.mentalidadEquipo) ?? 3;
  const map: Record<Dimension, number> = {
    controlPrimerToque: t,
    pase: t,
    regate1v1: t,
    remateFinalizacion: r,
    juegoAereo: Math.round((t + r) / 2),
    posicionamiento: d,
    visionJuego: vi,
    movimientosSinBalon: vi,
    tomaDecisiones: vi,
    comprensionTactica: d,
    velocidadAceleracion: v,
    resistencia: res,
    fuerzaPotencia: d,
    agilidadCoordinacion: v,
    fortalezaMental: m,
    actitudDisciplina: m,
    espirituEquipo: m,
    motivacion: m,
  };
  return Math.min(5, Math.max(1, map[k] ?? 3));
}

export function normalizeProfile(p: Record<string, unknown> | null | undefined): ProfileScores {
  const src = p && typeof p === "object" ? p : {};
  const leg = isLegacyProfile(src);
  const out = {} as Record<Dimension, number>;
  for (const k of PROFILE_DIMS) {
    const v = toStar5(src[k as keyof typeof src]);
    if (v != null) out[k] = v;
    else if (leg) out[k] = legacyDimension(k, src);
    else out[k] = 3;
  }
  return out as ProfileScores;
}

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function profileAverage(profile: ProfileScores | Record<string, unknown>): number {
  const norm = normalizeProfile(profile);
  const vals = PROFILE_DIMS.map((k) => norm[k]).filter((n) => !Number.isNaN(n));
  return mean(vals);
}

export function peerAverageForPlayer(ratingsReceived: { scores: ProfileScores | Record<string, unknown> }[]): {
  byDim: Partial<Record<Dimension, number | null>>;
  overall: number | null;
  count: number;
} | null {
  if (!ratingsReceived.length) return null;
  const byDim = {} as Partial<Record<Dimension, number | null>>;
  for (const dim of PROFILE_DIMS) {
    const vals = ratingsReceived.map((r) => normalizeProfile(r.scores)[dim]);
    byDim[dim] = vals.length ? mean(vals) : null;
  }
  const overallDims = PROFILE_DIMS.map((d) => byDim[d]).filter((v): v is number => v != null);
  return {
    byDim,
    overall: overallDims.length ? mean(overallDims) : null,
    count: ratingsReceived.length,
  };
}

/** Si en alguna dimensión la autopercepción es 5 (máximo), el peso del grupo pasa a 90 %. */
export function usesHighSelfPerception(selfProfile: ProfileScores | Record<string, unknown>): boolean {
  const norm = normalizeProfile(selfProfile);
  return PROFILE_DIMS.some((k) => norm[k] >= 5);
}

export function finalScore(
  selfProfile: ProfileScores | Record<string, unknown>,
  ratingsReceived: { scores: ProfileScores | Record<string, unknown> }[],
  opts?: { ignoreSelf?: boolean },
): { value: number; selfAvg: number; peerAvg: number | null; peerCount: number } {
  if (opts?.ignoreSelf) {
    const peer = peerAverageForPlayer(ratingsReceived);
    if (peer?.overall == null) return { value: 0, selfAvg: 0, peerAvg: null, peerCount: 0 };
    return { value: peer.overall, selfAvg: 0, peerAvg: peer.overall, peerCount: peer.count };
  }
  const selfAvg = profileAverage(selfProfile);
  const peer = peerAverageForPlayer(ratingsReceived);
  if (peer?.overall == null) return { value: selfAvg, selfAvg, peerAvg: null, peerCount: 0 };
  const wSelf = usesHighSelfPerception(selfProfile) ? 0.15 : 0.35;
  const wPeer = 1 - wSelf;
  return {
    value: wSelf * selfAvg + wPeer * peer.overall,
    selfAvg,
    peerAvg: peer.overall,
    peerCount: peer.count,
  };
}
