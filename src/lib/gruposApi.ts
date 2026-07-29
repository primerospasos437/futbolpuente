import { getToken, invalidateSessionPlayerCache } from "../api";
import { sha256Hex } from "./futbolAuth";
import { getSupabase } from "./supabase";
import { isDemoMode } from "./demoMode";

export type GrupoMembership = {
  grupoId: string;
  nombre: string;
  deporte: string;
  rol: "admin" | "miembro" | string;
  esAdmin: boolean;
  jugadorId: string;
  joinedAt?: string;
  inviteCode?: string | null;
  /** Notificaciones no leídas de esta ficha en el grupo. */
  unreadCount?: number;
  /** Título del aviso más reciente sin leer. */
  unreadPreview?: string | null;
};

function requireToken(): string {
  const t = getToken();
  if (!t) throw new Error("No autorizado");
  return t;
}

function rpcErrorMessage(err: { message?: string }): string {
  return String(err.message || "Error de grupo");
}

function mapGrupo(raw: Record<string, unknown>): GrupoMembership {
  return {
    grupoId: String(raw.grupoId ?? raw.grupoid ?? ""),
    nombre: String(raw.nombre ?? ""),
    deporte: String(raw.deporte ?? "futbol"),
    rol: String(raw.rol ?? "miembro"),
    esAdmin: Boolean(raw.esAdmin ?? raw.rol === "admin"),
    jugadorId: String(raw.jugadorId ?? raw.jugadorid ?? ""),
    joinedAt: raw.joinedAt != null ? String(raw.joinedAt) : undefined,
    inviteCode: raw.inviteCode != null ? String(raw.inviteCode) : null,
    unreadCount: Number(raw.unreadCount ?? raw.unreadcount ?? 0) || 0,
    unreadPreview:
      raw.unreadPreview != null || raw.unreadpreview != null
        ? String(raw.unreadPreview ?? raw.unreadpreview)
        : null,
  };
}

function parseGrupoResult(data: unknown): GrupoMembership {
  const obj = (typeof data === "string" ? JSON.parse(data) : data) as Record<string, unknown>;
  return mapGrupo(obj ?? {});
}

/** Demo local: un solo grupo ficticio. */
const DEMO_GRUPO: GrupoMembership = {
  grupoId: "demo-grupo",
  nombre: "Demo · Fútbol Puente",
  deporte: "futbol",
  rol: "miembro",
  esAdmin: false,
  jugadorId: "",
  inviteCode: null,
};

export async function misGrupos(): Promise<GrupoMembership[]> {
  if (isDemoMode()) return [DEMO_GRUPO];
  const token = requireToken();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("mis_grupos", { p_token: token });
  if (error) throw new Error(rpcErrorMessage(error));
  const arr = Array.isArray(data) ? data : typeof data === "string" ? JSON.parse(data) : [];
  if (!Array.isArray(arr)) return [];
  return (arr as Record<string, unknown>[]).map(mapGrupo).filter((g) => g.grupoId);
}

export async function grupoCrear(opts: {
  nombre: string;
  pin: string;
  deporte?: string;
  apodo?: string;
}): Promise<GrupoMembership> {
  if (isDemoMode()) {
    return { ...DEMO_GRUPO, nombre: opts.nombre.trim() || DEMO_GRUPO.nombre, rol: "admin", esAdmin: true };
  }
  const token = requireToken();
  const pin = String(opts.pin ?? "").trim();
  if (pin.length < 4) throw new Error("PIN del grupo: mínimo 4 caracteres");
  const pinHash = await sha256Hex(pin);
  const sb = getSupabase();
  const { data, error } = await sb.rpc("grupo_crear", {
    p_token: token,
    p_nombre: opts.nombre.trim(),
    p_pin_hash: pinHash,
    p_deporte: opts.deporte ?? "futbol",
    p_apodo: opts.apodo?.trim() || null,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  invalidateSessionPlayerCache();
  return parseGrupoResult(data);
}

export async function grupoUnirse(opts: {
  pin?: string;
  nombre?: string;
  inviteCode?: string;
  deporte?: string;
  apodo?: string;
}): Promise<GrupoMembership> {
  if (isDemoMode()) return { ...DEMO_GRUPO, nombre: opts.nombre?.trim() || DEMO_GRUPO.nombre };
  const token = requireToken();
  const pin = opts.pin != null ? String(opts.pin).trim() : "";
  const pinHash = pin ? await sha256Hex(pin) : null;
  const sb = getSupabase();
  const { data, error } = await sb.rpc("grupo_unirse", {
    p_token: token,
    p_pin_hash: pinHash,
    p_nombre: opts.nombre?.trim() || null,
    p_invite_code: opts.inviteCode?.trim() || null,
    p_deporte: opts.deporte ?? "futbol",
    p_apodo: opts.apodo?.trim() || null,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  invalidateSessionPlayerCache();
  return parseGrupoResult(data);
}

export async function grupoEntrar(grupoId: string): Promise<GrupoMembership> {
  if (isDemoMode()) return DEMO_GRUPO;
  const token = requireToken();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("grupo_entrar", {
    p_token: token,
    p_grupo_id: grupoId,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  invalidateSessionPlayerCache();
  return parseGrupoResult(data);
}
