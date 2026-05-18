/** Sesión demo 100 % frontend; no escribe en Supabase. */
export const DEMO_TOKEN = "__futbol_demo_guest__";
export const DEMO_FLAG_KEY = "futbol_demo_mode";
export const DEMO_GUEST_EMAIL = "invitado@futbolpuente.com";
export const DEMO_GUEST_ID = "demo-guest-0001";
export const DEMO_GUEST_APODO = "Invitado";

const TOKEN_KEY = "futbol_grupo_token";

export function isDemoMode(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(DEMO_FLAG_KEY) === "1";
}

export function isDemoEmail(email: string | null | undefined): boolean {
  return String(email ?? "").trim().toLowerCase() === DEMO_GUEST_EMAIL;
}

export function getDemoPlayerId(): string {
  return DEMO_GUEST_ID;
}

export function startDemoSession(): { token: string; playerId: string } {
  localStorage.setItem(DEMO_FLAG_KEY, "1");
  localStorage.setItem(TOKEN_KEY, DEMO_TOKEN);
  return { token: DEMO_TOKEN, playerId: DEMO_GUEST_ID };
}

export function clearDemoSession(): void {
  localStorage.removeItem(DEMO_FLAG_KEY);
}
