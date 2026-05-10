import { getSupabase } from "./supabase";
import type { ProfileScores } from "../types";

export async function sha256Hex(plain: string): Promise<string> {
  const enc = new TextEncoder().encode(String(plain));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function rpcErrorMessage(err: { message?: string; details?: string; hint?: string }): string {
  const m = String(err.message || "Error");
  if (m.includes("Ese apodo ya está registrado")) return "Ese apodo ya está registrado";
  if (m.includes("Credenciales incorrectas")) return "Credenciales incorrectas";
  if (m.includes("No autorizado")) return "No autorizado";
  return m;
}

/** Email sintético para `usuarios.email` (NOT NULL / UNIQUE); local-part seguro a partir del apodo. */
export function emailFromApodo(apodo: string): string {
  const slug = apodo
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "jugador"}@futbol.com`;
}

export type RegisterSupabaseInput = {
  nombreCompleto: string;
  apodo: string;
  pin: string;
  posicionPreferida: string;
  posicionAlternativa: string;
  pieDominante: string;
  fechaNacimiento: string;
  contacto: string;
  alturaCm: number | null;
  pesoKg: number | null;
  profile: ProfileScores;
};

export async function registerWithSupabase(input: RegisterSupabaseInput): Promise<{ token: string; playerId: string }> {
  const pinHash = await sha256Hex(input.pin);
  const pEmail = emailFromApodo(input.apodo);
  const sb = getSupabase();
  const { data, error } = await sb.rpc("futbol_auth_register", {
    p_nombre_completo: input.nombreCompleto.trim(),
    p_apodo: input.apodo.trim(),
    p_email: pEmail,
    p_pin_hash: pinHash,
    p_posicion_preferida: input.posicionPreferida,
    p_posicion_alternativa: input.posicionAlternativa,
    p_pie_dominante: input.pieDominante,
    p_fecha_nacimiento: input.fechaNacimiento ?? "",
    p_contacto: input.contacto ?? "",
    p_altura_cm: input.alturaCm,
    p_peso_kg: input.pesoKg,
    p_perfil_scores: input.profile,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  const row = data as { token?: string; playerId?: string };
  if (!row?.token || !row?.playerId) throw new Error("Respuesta inválida del registro");
  return { token: row.token, playerId: row.playerId };
}

export async function loginWithSupabase(apodo: string, pin: string): Promise<{ token: string; playerId: string }> {
  const pinHash = await sha256Hex(pin);
  const sb = getSupabase();
  const { data, error } = await sb.rpc("futbol_auth_login", {
    p_apodo: apodo.trim(),
    p_pin_hash: pinHash,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  const row = data as { token?: string; playerId?: string };
  if (!row?.token || !row?.playerId) throw new Error("Respuesta inválida del login");
  return { token: row.token, playerId: row.playerId };
}

/** Valida el Bearer token guardado (tabla sesiones) sin pasar por el servidor Node. */
export async function validateSessionWithSupabase(token: string): Promise<boolean> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("futbol_auth_validate_token", { p_token: token });
  if (error) return false;
  const row = data as { valid?: boolean } | null;
  return Boolean(row && row.valid === true);
}
