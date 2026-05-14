import { DIMENSION_ORDER } from "../dimensions";
import { F5_DIMENSION_ORDER } from "../dimensions-f5";
import type { Dimension, F5ProfileScores, Pie, Posicion, ProfileScores } from "../types";

/**
 * Valores exactos del CHECK en `jugadores` (schema.sql) y del RPC `futbol_auth_register`.
 */
export const POSICION_RPC = ["portero", "defensa", "medio", "delantero"] as const;
export type PosicionRpc = (typeof POSICION_RPC)[number];

export const PIE_RPC = ["derecho", "izquierdo", "ambos"] as const;
export type PieRpc = (typeof PIE_RPC)[number];

const POS_SET = new Set<string>(POSICION_RPC);
const PIE_SET = new Set<string>(PIE_RPC);

export function sanitizePosicionRpc(value: unknown, fallback: PosicionRpc = "medio"): PosicionRpc {
  const s = String(value ?? "").trim().toLowerCase();
  return POS_SET.has(s) ? (s as PosicionRpc) : fallback;
}

export function sanitizePieRpc(value: unknown, fallback: PieRpc = "derecho"): PieRpc {
  const s = String(value ?? "").trim().toLowerCase();
  return PIE_SET.has(s) ? (s as PieRpc) : fallback;
}

/** Email sintético para `usuarios.email` (UNIQUE); local-part seguro a partir del apodo ya recortado. */
export function emailFromApodo(apodoTrimmed: string): string {
  const slug = apodoTrimmed
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "jugador"}@futbol.com`;
}

/**
 * Normaliza para columna/RPC tipo `date` en PostgreSQL: cadena ISO `YYYY-MM-DD` o cadena vacía si no hay fecha válida.
 * El cliente debe enviar `null` a PostgREST cuando el resultado sea vacío (no `''`), para que coincida con `date`.
 */
export function normalizeFechaNacimientoForDb(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  // Acepta `YYYY-M-D` del usuario y la canoniza a `YYYY-MM-DD`; rechaza otros formatos.
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return "";
  if (y < 1 || y > 9999 || mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return "";
  const mm = String(mo).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** Entero o null para columna `altura_cm` (NULL permitido). */
export function normalizeAlturaCmRpc(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    const r = Math.round(input);
    if (r < 120 || r > 230) throw new Error("Altura (cm): número entre 120 y 230, o vacío");
    return r;
  }
  const s = String(input).trim();
  if (!s) return null;
  const h = Number(s.replace(",", "."));
  if (!Number.isFinite(h) || h < 120 || h > 230) throw new Error("Altura (cm): número entre 120 y 230, o vacío");
  return Math.round(h);
}

/** NUMERIC(5,1) o null para `peso_kg`. */
export function normalizePesoKgRpc(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    const r = Math.round(input * 10) / 10;
    if (r < 35 || r > 160) throw new Error("Peso (kg): número entre 35 y 160, o vacío");
    return r;
  }
  const s = String(input).trim();
  if (!s) return null;
  const w = Number(s.replace(",", "."));
  if (!Number.isFinite(w) || w < 35 || w > 160) throw new Error("Peso (kg): número entre 35 y 160, o vacío");
  return Math.round(w * 10) / 10;
}

/** Garantiza JSONB con números enteros 1–10 en las 18 claves (evita strings en PostgreSQL). */
export function normalizeProfileScoresRpc(profile: ProfileScores | Record<string, unknown> | null | undefined): ProfileScores {
  const src = profile && typeof profile === "object" ? profile : {};
  const out = {} as Record<Dimension, number>;
  for (const key of DIMENSION_ORDER) {
    const n = Number((src as Record<string, unknown>)[key]);
    if (!Number.isFinite(n)) {
      out[key] = 5;
      continue;
    }
    const v = Math.round(n);
    out[key] = Math.min(10, Math.max(1, v));
  }
  return out as ProfileScores;
}

/** Garantiza JSONB con números enteros 1–5 en las 12 claves F5. */
export function normalizeProfileF5ScoresRpc(
  profile: F5ProfileScores | Record<string, unknown> | null | undefined,
): F5ProfileScores {
  const src = profile && typeof profile === "object" ? profile : {};
  const out = {} as Record<string, number>;
  for (const key of F5_DIMENSION_ORDER) {
    const n = Number((src as Record<string, unknown>)[key]);
    if (!Number.isFinite(n)) {
      out[key] = 3;
      continue;
    }
    const v = Math.round(n);
    out[key] = Math.min(5, Math.max(1, v));
  }
  return out as F5ProfileScores;
}

export function normalizeEmailForRegister(raw: string): string {
  const e = String(raw ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Correo electrónico inválido");
  if (e.length > 254) throw new Error("Correo demasiado largo");
  return e;
}

export type RegisterFormRaw = {
  nombreCompleto: string;
  apodo: string;
  /** Correo real para recuperar el PIN (único en el grupo). */
  email: string;
  pin: string;
  posicionPreferida: Posicion | string;
  posicionAlternativa: Posicion | string;
  pieDominante: Pie | string;
  fechaNacimiento: string;
  contacto: string;
  /** Acepta string del formulario o número ya parseado; nunca se envía como string al RPC. */
  alturaCm?: string | number | null;
  pesoKg?: string | number | null;
  profile?: ProfileScores | Record<string, unknown>;
};

export type FutbolAuthRegisterRpcArgs = {
  p_nombre_completo: string;
  p_apodo: string;
  p_email: string;
  p_pin_hash: string;
  p_posicion_preferida: PosicionRpc;
  p_posicion_alternativa: PosicionRpc;
  p_pie_dominante: PieRpc;
  /** `null` si no hay fecha; si hay, ISO `YYYY-MM-DD` (Postgres `date`). */
  p_fecha_nacimiento: string | null;
  p_contacto: string;
  p_altura_cm: number | null;
  p_peso_kg: number | null;
  p_perfil_scores: ProfileScores;
};

/**
 * Normaliza el formulario de registro antes del RPC `futbol_auth_register`:
 * strings recortados, enums válidos, fecha solo ISO o null, números y JSON del perfil.
 */
export function buildFutbolAuthRegisterRpcArgs(raw: RegisterFormRaw, pinHashHex: string): FutbolAuthRegisterRpcArgs {
  const nombreCompleto = String(raw.nombreCompleto ?? "").trim();
  const apodo = String(raw.apodo ?? "").trim();
  const pinHash = String(pinHashHex ?? "").trim().toLowerCase();
  if (!nombreCompleto) throw new Error("El nombre completo es obligatorio");
  if (!apodo) throw new Error("El apodo es obligatorio");
  if (!pinHash) throw new Error("PIN inválido");

  const posPrincipal = sanitizePosicionRpc(raw.posicionPreferida, "medio");
  const posAlt = sanitizePosicionRpc(raw.posicionAlternativa, posPrincipal);
  const pie = sanitizePieRpc(raw.pieDominante, "derecho");

  const fechaIso = normalizeFechaNacimientoForDb(raw.fechaNacimiento);
  const fechaRpc = fechaIso === "" ? null : fechaIso;
  const contacto = String(raw.contacto ?? "").trim();

  const altura_cm = normalizeAlturaCmRpc(raw.alturaCm);
  const peso_kg = normalizePesoKgRpc(raw.pesoKg);
  const perfil_scores = {} as ProfileScores;

  const pEmail = normalizeEmailForRegister(String(raw.email ?? "").trim());

  return {
    p_nombre_completo: nombreCompleto,
    p_apodo: apodo,
    p_email: pEmail,
    p_pin_hash: pinHash,
    p_posicion_preferida: posPrincipal,
    p_posicion_alternativa: posAlt,
    p_pie_dominante: pie,
    p_fecha_nacimiento: fechaRpc,
    p_contacto: contacto,
    p_altura_cm: altura_cm,
    p_peso_kg: peso_kg,
    p_perfil_scores: perfil_scores,
  };
}
