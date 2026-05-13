import { F5_DIMENSION_ORDER, type F5Dimension, type F5ProfileScores } from "../dimensions-f5";

function clamp5(n: unknown): number | null {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return null;
  return Math.min(5, Math.max(1, v));
}

export function normalizeF5Profile(p: Record<string, unknown> | null | undefined): F5ProfileScores {
  const src = p && typeof p === "object" ? p : {};
  const out = {} as Record<F5Dimension, number>;
  for (const k of F5_DIMENSION_ORDER) {
    const v = clamp5(src[k]);
    out[k] = v != null ? v : 3;
  }
  return out as F5ProfileScores;
}

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Si en alguna dimensión la autopercepción es «excelente» (5), el peso del grupo sube al 90 %. */
export function f5UsesReducedSelfWeight(self: F5ProfileScores): boolean {
  return F5_DIMENSION_ORDER.some((k) => self[k] >= 5);
}

export function f5ProfileAverage(profile: F5ProfileScores | Record<string, unknown>): number {
  const norm = normalizeF5Profile(profile);
  const vals = F5_DIMENSION_ORDER.map((k) => norm[k]);
  return mean(vals);
}

export function peerAverageF5(
  ratingsReceived: { scores: F5ProfileScores | Record<string, unknown> }[],
): { byDim: Partial<Record<F5Dimension, number | null>>; overall: number | null; count: number } | null {
  if (!ratingsReceived.length) return null;
  const byDim = {} as Partial<Record<F5Dimension, number | null>>;
  for (const dim of F5_DIMENSION_ORDER) {
    const vals = ratingsReceived.map((r) => normalizeF5Profile(r.scores)[dim]);
    byDim[dim] = vals.length ? mean(vals) : null;
  }
  const overallDims = F5_DIMENSION_ORDER.map((d) => byDim[d]).filter((v): v is number => v != null);
  return {
    byDim,
    overall: overallDims.length ? mean(overallDims) : null,
    count: ratingsReceived.length,
  };
}

export function finalScoreF5(
  selfProfile: F5ProfileScores | Record<string, unknown>,
  ratingsReceived: { scores: F5ProfileScores | Record<string, unknown> }[],
): { value: number; selfAvg: number; peerAvg: number | null; peerCount: number } {
  const self = normalizeF5Profile(selfProfile);
  const selfAvg = f5ProfileAverage(self);
  const peer = peerAverageF5(ratingsReceived);
  if (peer?.overall == null) return { value: selfAvg, selfAvg, peerAvg: null, peerCount: 0 };
  const wSelf = f5UsesReducedSelfWeight(self) ? 0.1 : 0.35;
  const wPeer = 1 - wSelf;
  return {
    value: wSelf * selfAvg + wPeer * peer.overall,
    selfAvg,
    peerAvg: peer.overall,
    peerCount: peer.count,
  };
}
