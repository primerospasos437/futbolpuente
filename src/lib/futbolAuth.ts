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
  if (m.includes("Could not choose the best candidate function")) {
    return "Error de base de datos: hay funciones duplicadas de registro. Ejecutá en Postgres la migración supabase/11_futbol_auth_register_una_sola_firma.sql (o reaplicá 04_rpc_futbol_auth.sql).";
  }
  if (m.includes("Ese correo ya está registrado")) return "Ese correo ya está registrado";
  if (m.includes("Credenciales incorrectas")) return "Credenciales incorrectas";
  if (m.includes("No autorizado")) return "No autorizado";
  return m;
}

/**
 * Registro vía RPC `futbol_auth_register`: normaliza tipos, enums, fecha ISO (`null` si vacía), números y JSON del perfil
 * antes de enviar a PostgREST (la columna `fecha_nacimiento` es tipo `date`; no se envía texto vacío).
 *
 * `p_fecha_nacimiento`: `null` o `YYYY-MM-DD` válido de `normalizeFechaNacimientoForDb`.
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

/** Valida el Bearer token guardado (tabla sesiones) sin pasar por el servidor Node. */
export async function validateSessionWithSupabase(token: string): Promise<boolean> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("futbol_auth_validate_token", { p_token: String(token ?? "").trim() });
  if (error) return false;
  const row = data as { valid?: boolean } | null;
  return Boolean(row && row.valid === true);
}
