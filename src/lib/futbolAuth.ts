import { getSupabase } from "./supabase";
import { buildFutbolAuthRegisterRpcArgs, type RegisterFormRaw } from "./futbolRegistration";

export type { RegisterFormRaw } from "./futbolRegistration";
export { emailFromApodo } from "./futbolRegistration";

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

/**
 * Registro vía RPC `futbol_auth_register`: normaliza tipos, enums, fecha ISO, números y JSON del perfil
 * antes de enviar a PostgREST (evita strings donde PostgreSQL espera int/numeric/jsonb).
 *
 * `p_fecha_nacimiento` sale de `normalizeFechaNacimientoForDb`: solo `''` o `YYYY-MM-DD` válido en calendario.
 */
export async function registerWithSupabase(raw: RegisterFormRaw): Promise<{ token: string; playerId: string }> {
  const pin = String(raw.pin ?? "").trim();
  if (pin.length < 4) throw new Error("PIN: mínimo 4 caracteres");

  const pinHash = await sha256Hex(pin);
  const args = buildFutbolAuthRegisterRpcArgs(raw, pinHash);

  const sb = getSupabase();
  const { data, error } = await sb.rpc("futbol_auth_register", args);
  if (error) throw new Error(rpcErrorMessage(error));
  const row = data as { token?: string; playerId?: string };
  if (!row?.token || !row?.playerId) throw new Error("Respuesta inválida del registro");
  return { token: row.token, playerId: row.playerId };
}

export async function loginWithSupabase(apodo: string, pin: string): Promise<{ token: string; playerId: string }> {
  const pinHash = await sha256Hex(String(pin ?? "").trim());
  const sb = getSupabase();
  const { data, error } = await sb.rpc("futbol_auth_login", {
    p_apodo: String(apodo ?? "").trim(),
    p_pin_hash: pinHash,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  const row = data as { token?: string; playerId?: string };
  if (!row?.token || !row?.playerId) throw new Error("Respuesta inválida del login");
  return { token: row.token, playerId: row.playerId };
}

/** Valida el Bearer token y devuelve el jugador asociado (para sincronizar `futbol_grupo_player_id`). */
export async function validateSessionWithSupabase(token: string): Promise<{ ok: boolean; playerId?: string }> {
  try {
    const sb = getSupabase();
    const { data, error } = await sb.rpc("futbol_auth_validate_token", { p_token: String(token ?? "").trim() });
    if (error) return { ok: false };
    const row = data as { valid?: boolean; jugadorId?: string } | null;
    if (!row || row.valid !== true) return { ok: false };
    const playerId = typeof row.jugadorId === "string" && row.jugadorId.length ? row.jugadorId : undefined;
    return { ok: true, playerId };
  } catch {
    return { ok: false };
  }
}
