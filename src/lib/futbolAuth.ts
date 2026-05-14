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
  if (m.includes("Ese correo ya está registrado")) return "Ese correo ya está registrado";
  if (m.includes("Credenciales incorrectas")) return "Credenciales incorrectas";
  if (m.includes("No autorizado")) return "No autorizado";
  if (m.includes("usuario_id") && m.includes("null")) {
    return "Error de registro en base de datos (cuenta sin vincular). Ejecutá la migración supabase/18_futbol_auth_register_usuario_id_y_cuenta.sql o contactá al administrador.";
  }
  if (m.includes("posicion_principal") && m.includes("null")) {
    return "Error de registro: falta la posición principal. Volvé a aplicar la migración SQL en Supabase (versión actual de 18 con p_posicion_principal) o contactá al administrador.";
  }
  return m;
}

function authSignUpErrorMessage(err: { message?: string; status?: number }): string {
  const m = String(err.message || "Error de registro");
  const lower = m.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "Ese correo ya está registrado (cuenta de acceso).";
  }
  if (lower.includes("password") && lower.includes("least")) {
    return "La contraseña de acceso no cumple los requisitos mínimos. Probá con un PIN más largo.";
  }
  if (lower.includes("invalid") && lower.includes("email")) {
    return "El correo electrónico no es válido.";
  }
  if (lower.includes("signup") && lower.includes("disabled")) {
    return "El registro con correo está deshabilitado en el proyecto Supabase (Auth).";
  }
  return m;
}

/** Contraseña para Supabase Auth (no es el PIN del grupo): larga y determinística a partir del PIN y el mail. */
function passwordForSupabaseAuth(pin: string, emailNorm: string): string {
  const p = String(pin ?? "").trim();
  const e = String(emailNorm ?? "").trim().toLowerCase();
  const combined = `${p}::futbolpuenteclub::${e}`;
  return combined.length > 72 ? combined.slice(0, 72) : combined;
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

  const authPassword = passwordForSupabaseAuth(pin, args.p_email);
  const { data: authData, error: authError } = await sb.auth.signUp({
    email: args.p_email,
    password: authPassword,
    options: {
      data: {
        apodo: args.p_apodo,
        nombre_completo: args.p_nombre_completo,
      },
    },
  });

  if (authError) {
    throw new Error(authSignUpErrorMessage(authError));
  }

  const uid = authData.user?.id;
  if (!uid) {
    throw new Error(
      "No se obtuvo el identificador de la cuenta de acceso. Si tu proyecto exige confirmar el correo, revisá el bandeja de entrada o desactivá «Confirm email» para pruebas.",
    );
  }

  const rpcPayload = { ...args, p_cuenta_id: uid };

  try {
    const { data, error } = await sb.rpc("futbol_auth_register", rpcPayload);
    if (error) throw new Error(rpcErrorMessage(error));
    const row = data as { token?: string; playerId?: string };
    if (!row?.token || !row?.playerId) throw new Error("Respuesta inválida del registro");
    await sb.auth.signOut();
    return { token: row.token, playerId: row.playerId };
  } catch (e) {
    await sb.auth.signOut();
    throw e;
  }
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
