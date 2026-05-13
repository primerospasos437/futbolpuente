/**
 * Cálculo de promedios y nota final (misma lógica que server/scores.js), para uso en el cliente.
 */
import { DIMENSION_ORDER } from "../dimensions";
import type { Dimension, ProfileScores } from "../types";

const PROFILE_DIMS = DIMENSION_ORDER;

function clamp10(n: unknown): number | null {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return null;
  return Math.min(10, Math.max(1, v));
}

function isLegacyProfile(p: Record<string, unknown>): boolean {
  return p.tecnica != null && p.controlPrimerToque == null;
}

function legacyDimension(k: Dimension, p: Record<string, unknown>): number {
  const t = clamp10(p.tecnica) ?? 5;
  const r = clamp10(p.remate) ?? 5;
  const v = clamp10(p.velocidad) ?? 5;
  const res = clamp10(p.resistencia) ?? 5;
  const vi = clamp10(p.visionJuego) ?? 5;
  const d = clamp10(p.defensa) ?? 5;
  const m = clamp10(p.mentalidadEquipo) ?? 5;
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
  return map[k] ?? 5;
}

export function normalizeProfile(p: Record<string, unknown> | null | undefined): ProfileScores {
  const src = p && typeof p === "object" ? p : {};
  const leg = isLegacyProfile(src);
  const out = {} as Record<Dimension, number>;
  for (const k of PROFILE_DIMS) {
    const v = clamp10(src[k as keyof typeof src]);
    if (v != null) out[k] = v;
    else if (leg) out[k] = legacyDimension(k, src);
    else out[k] = 5;
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

/** Si en alguna dimensión la autopercepción es 8, 9 o 10, el peso del grupo pasa a 90 %. */
export function usesHighSelfPerception(selfProfile: ProfileScores | Record<string, unknown>): boolean {
  const norm = normalizeProfile(selfProfile);
  return PROFILE_DIMS.some((k) => norm[k] >= 8);
}

export function finalScore(
  selfProfile: ProfileScores | Record<string, unknown>,
  ratingsReceived: { scores: ProfileScores | Record<string, unknown> }[],
): { value: number; selfAvg: number; peerAvg: number | null; peerCount: number } {
  const selfAvg = profileAverage(selfProfile);
  const peer = peerAverageForPlayer(ratingsReceived);
  if (peer?.overall == null) return { value: selfAvg, selfAvg, peerAvg: null, peerCount: 0 };
  const wSelf = usesHighSelfPerception(selfProfile) ? 0.1 : 0.35;
  const wPeer = 1 - wSelf;
  return {
    value: wSelf * selfAvg + wPeer * peer.overall,
    selfAvg,
    peerAvg: peer.overall,
    peerCount: peer.count,
  };
}
