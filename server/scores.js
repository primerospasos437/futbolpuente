/** Dimensiones valorables (autopercepción y valoraciones de compañeros), escala 1–10 */
export const PROFILE_DIMS = [
  // Capacidades técnicas (manejo del balón)
  "controlPrimerToque",
  "pase",
  "regate1v1",
  "remateFinalizacion",
  "juegoAereo",
  // Capacidades tácticas
  "posicionamiento",
  "visionJuego",
  "movimientosSinBalon",
  "tomaDecisiones",
  "comprensionTactica",
  // Capacidades físicas (sin historial de lesiones: es texto propio)
  "velocidadAceleracion",
  "resistencia",
  "fuerzaPotencia",
  "agilidadCoordinacion",
  // Capacidades psicológicas y personales
  "fortalezaMental",
  "actitudDisciplina",
  "espirituEquipo",
  "motivacion",
];

/** Alias para código que importaba DIMS */
export const DIMS = PROFILE_DIMS;

function clamp10(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return null;
  return Math.min(10, Math.max(1, v));
}

function isLegacyProfile(p) {
  if (!p || typeof p !== "object") return false;
  return p.tecnica != null && p.controlPrimerToque == null;
}

/** Si solo existían las 7 dimensiones viejas, inferir las nuevas */
function legacyDimension(k, p) {
  const t = clamp10(p.tecnica) ?? 5;
  const r = clamp10(p.remate) ?? 5;
  const v = clamp10(p.velocidad) ?? 5;
  const res = clamp10(p.resistencia) ?? 5;
  const vi = clamp10(p.visionJuego) ?? 5;
  const d = clamp10(p.defensa) ?? 5;
  const m = clamp10(p.mentalidadEquipo) ?? 5;
  const map = {
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

/**
 * Perfil o bloque de valoración con las 18 claves normalizadas.
 */
export function normalizeProfile(p = {}) {
  const leg = isLegacyProfile(p);
  const out = {};
  for (const k of PROFILE_DIMS) {
    const v = clamp10(p[k]);
    if (v != null) out[k] = v;
    else if (leg) out[k] = legacyDimension(k, p);
    else out[k] = 5;
  }
  return out;
}

export function defaultProfileScores() {
  return normalizeProfile({});
}

export function mean(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function profileAverage(profile) {
  const norm = normalizeProfile(profile);
  const vals = PROFILE_DIMS.map((k) => norm[k]).filter((n) => !Number.isNaN(n));
  return mean(vals);
}

/** Peer ratings: array de { scores } */
export function peerAverageForPlayer(ratingsReceived) {
  if (!ratingsReceived.length) return null;
  const byDim = {};
  for (const dim of PROFILE_DIMS) {
    const vals = ratingsReceived.map((r) => normalizeProfile(r.scores)[dim]);
    byDim[dim] = vals.length ? mean(vals) : null;
  }
  const overallDims = PROFILE_DIMS.map((d) => byDim[d]).filter((v) => v != null);
  return {
    byDim,
    overall: overallDims.length ? mean(overallDims) : null,
    count: ratingsReceived.length,
  };
}

export function usesHighSelfPerception(selfProfile) {
  const norm = normalizeProfile(selfProfile);
  return PROFILE_DIMS.some((k) => norm[k] >= 8);
}

/**
 * Nota final: mezcla autopercepción con compañeros.
 */
export function finalScore(selfProfile, ratingsReceived, opts) {
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
