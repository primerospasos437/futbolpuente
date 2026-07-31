/**
 * Recordatorios locales (campanita) — post-partido de Mi Calendario, etc.
 * Se mezclan con notificaciones de servidor en la UI.
 */

import type { NotificacionRow } from "../types";

const KEY = "psb_local_notifications";
export const LOCAL_NOTIF_EVENT = "psb-local-notif-changed";

function loadAll(): NotificacionRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NotificacionRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(list: NotificacionRow[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 80)));
    window.dispatchEvent(new Event(LOCAL_NOTIF_EVENT));
  } catch {
    /* ignore */
  }
}

export function listLocalNotifications(): NotificacionRow[] {
  return loadAll().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function markLocalNotificationRead(id: string): void {
  saveAll(loadAll().map((n) => (n.id === id ? { ...n, leida: true } : n)));
}

export function pushLocalNotification(input: {
  tipo: string;
  titulo: string;
  cuerpo: string;
  datos?: Record<string, unknown>;
  /** Evita duplicados (ej. mismo encuentro). */
  dedupeKey?: string;
}): NotificacionRow | null {
  const list = loadAll();
  if (input.dedupeKey) {
    const exists = list.some((n) => n.datos?.dedupeKey === input.dedupeKey);
    if (exists) return null;
  }
  const row: NotificacionRow = {
    id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    tipo: input.tipo,
    titulo: input.titulo,
    cuerpo: input.cuerpo,
    datos: { ...(input.datos ?? {}), dedupeKey: input.dedupeKey },
    leida: false,
    created_at: new Date().toISOString(),
  };
  saveAll([row, ...list]);
  return row;
}

/** Marca un encuentro como “ya recordado post-partido”. */
export function hasPostMatchReminder(encuentroId: string): boolean {
  return loadAll().some((n) => n.datos?.dedupeKey === `cal_post_${encuentroId}`);
}
