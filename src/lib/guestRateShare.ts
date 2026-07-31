/**
 * Link / QR para que un desconocido califique al jugador sin tener cuenta.
 * Las notas se guardan en Supabase (tabla valoraciones_invitado) y se espejan en localStorage.
 */

import { getSupabase } from "./supabase";
import type { F5ProfileScores, ProfileScores } from "../types";
import type { SkillFamily } from "./personalMatches";

export type GuestSharePayload = {
  v: 1;
  playerId: string;
  apodo: string;
  formato: SkillFamily;
  shareId: string;
};

export type GuestRatingRow = {
  id: string;
  jugador_id: string;
  share_id: string;
  formato: SkillFamily;
  scores: F5ProfileScores | ProfileScores;
  autor_nombre: string | null;
  created_at: string;
};

function inboxKey(playerId: string): string {
  return `psb_guest_inbox_${playerId || "anon"}`;
}

function b64urlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode<T>(token: string): T | null {
  try {
    const pad = token.length % 4 === 0 ? "" : "=".repeat(4 - (token.length % 4));
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function createGuestShare(input: {
  playerId: string;
  apodo: string;
  formato: SkillFamily;
}): { payload: GuestSharePayload; token: string; url: string } {
  const payload: GuestSharePayload = {
    v: 1,
    playerId: input.playerId,
    apodo: input.apodo.trim() || "Jugador",
    formato: input.formato,
    shareId: `gs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  };
  const token = b64urlEncode(payload);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/valorar-invitado/${token}`;
  return { payload, token, url };
}

export function parseGuestShareToken(token: string): GuestSharePayload | null {
  const p = b64urlDecode<GuestSharePayload>(token);
  if (!p || p.v !== 1 || !p.playerId || !p.shareId) return null;
  if (p.formato !== "f5" && p.formato !== "f11") return null;
  return p;
}

export function qrImageUrl(dataUrl: string, size = 220): string {
  const q = encodeURIComponent(dataUrl);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${q}&bgcolor=0a0f18&color=3dff9a&qzone=2`;
}

function loadInbox(playerId: string): GuestRatingRow[] {
  try {
    const raw = localStorage.getItem(inboxKey(playerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GuestRatingRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveInbox(playerId: string, rows: GuestRatingRow[]): void {
  try {
    localStorage.setItem(inboxKey(playerId), JSON.stringify(rows.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

export function listGuestRatingsLocal(playerId: string): GuestRatingRow[] {
  return loadInbox(playerId);
}

/** Inserta valoración de un invitado (Supabase + espejo local del jugador si mismo device). */
export async function submitGuestRating(input: {
  share: GuestSharePayload;
  scores: F5ProfileScores | ProfileScores;
  autorNombre?: string;
}): Promise<{ ok: boolean; warning?: string }> {
  const row: GuestRatingRow = {
    id: `gr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    jugador_id: input.share.playerId,
    share_id: input.share.shareId,
    formato: input.share.formato,
    scores: input.scores,
    autor_nombre: input.autorNombre?.trim() || null,
    created_at: new Date().toISOString(),
  };

  // Espejo local (útil en demo / mismo navegador)
  saveInbox(input.share.playerId, [row, ...loadInbox(input.share.playerId)]);

  try {
    const sb = getSupabase();
    const { error } = await sb.from("valoraciones_invitado").insert({
      id: row.id,
      jugador_id: row.jugador_id,
      share_id: row.share_id,
      formato: row.formato,
      scores: row.scores,
      autor_nombre: row.autor_nombre,
      created_at: row.created_at,
    });
    if (error) {
      return {
        ok: true,
        warning:
          "Guardamos tu nota en este dispositivo. Si el jugador abre la app en otro lado, puede necesitar la tabla Supabase valoraciones_invitado.",
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: true,
      warning: "Nota guardada localmente. El jugador la verá si usa el mismo navegador o cuando esté la sync en la nube.",
    };
  }
}

export async function fetchGuestRatingsForPlayer(playerId: string): Promise<GuestRatingRow[]> {
  const local = loadInbox(playerId);
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("valoraciones_invitado")
      .select("id,jugador_id,share_id,formato,scores,autor_nombre,created_at")
      .eq("jugador_id", playerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error || !data) return local;
    const remote = data as GuestRatingRow[];
    const byId = new Map<string, GuestRatingRow>();
    for (const r of [...remote, ...local]) byId.set(r.id, r);
    const merged = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    saveInbox(playerId, merged);
    return merged;
  } catch {
    return local;
  }
}
