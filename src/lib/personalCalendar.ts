/**
 * Agenda personal de encuentros (Mi Calendario).
 * Independiente de partidos de grupo y de la carga de stats/Mundialito.
 */

export type FutbolFormato = "F5" | "F7" | "F8" | "F9" | "F11";

export const FUTBOL_FORMATOS: FutbolFormato[] = ["F5", "F7", "F8", "F9", "F11"];

export type CamisetaColor = "claros" | "oscuros";

export type PersonalEncuentro = {
  id: string;
  createdAt: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  lugar: string;
  tipo: FutbolFormato;
  notificar: boolean;
  /** Color de camiseta del lado en el que jugás. */
  camiseta: CamisetaColor;
  /** Si ya se disparó el recordatorio post-partido. */
  reminderSent?: boolean;
};

export type PersonalEncuentroInput = Omit<PersonalEncuentro, "id" | "createdAt" | "reminderSent">;

function storageKey(playerId: string): string {
  return `psb_personal_calendar_${playerId || "anon"}`;
}

function migrateEncuentro(raw: Record<string, unknown>): PersonalEncuentro {
  const camiseta = raw.camiseta === "oscuros" ? "oscuros" : "claros";
  return {
    id: String(raw.id ?? `pe_${Date.now()}`),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    fecha: String(raw.fecha ?? ""),
    hora: String(raw.hora ?? "20:00"),
    lugar: String(raw.lugar ?? ""),
    tipo: (String(raw.tipo ?? "F5").toUpperCase() as FutbolFormato) || "F5",
    notificar: Boolean(raw.notificar),
    camiseta,
    reminderSent: Boolean(raw.reminderSent),
  };
}

export function loadPersonalEncuentros(playerId: string): PersonalEncuentro[] {
  try {
    const raw = localStorage.getItem(storageKey(playerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e) => migrateEncuentro((e && typeof e === "object" ? e : {}) as Record<string, unknown>));
  } catch {
    return [];
  }
}

function savePersonalEncuentros(playerId: string, list: PersonalEncuentro[]): void {
  try {
    localStorage.setItem(storageKey(playerId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function addPersonalEncuentro(playerId: string, input: PersonalEncuentroInput): PersonalEncuentro {
  const item: PersonalEncuentro = {
    ...input,
    lugar: input.lugar.trim(),
    camiseta: input.camiseta === "oscuros" ? "oscuros" : "claros",
    id: `pe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    reminderSent: false,
  };
  const list = sortEncuentros([item, ...loadPersonalEncuentros(playerId)]);
  savePersonalEncuentros(playerId, list.slice(0, 100));
  return item;
}

export function removePersonalEncuentro(playerId: string, id: string): void {
  const list = loadPersonalEncuentros(playerId).filter((e) => e.id !== id);
  savePersonalEncuentros(playerId, list);
}

export function updatePersonalEncuentro(
  playerId: string,
  id: string,
  patch: Partial<PersonalEncuentro>,
): void {
  const list = loadPersonalEncuentros(playerId).map((e) => (e.id === id ? { ...e, ...patch } : e));
  savePersonalEncuentros(playerId, list);
}

/** Orden: próximos primero (fecha+hora asc). */
export function sortEncuentros(list: PersonalEncuentro[]): PersonalEncuentro[] {
  return [...list].sort((a, b) => {
    const ka = `${a.fecha}T${a.hora}`;
    const kb = `${b.fecha}T${b.hora}`;
    return ka.localeCompare(kb);
  });
}

export function formatEncuentroFecha(fecha: string, hora: string): string {
  try {
    const d = new Date(`${fecha}T${hora || "00:00"}`);
    if (Number.isNaN(d.getTime())) return `${fecha} · ${hora}`;
    return d.toLocaleString("es-AR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return `${fecha} · ${hora}`;
  }
}

export function isEncuentroPast(e: PersonalEncuentro): boolean {
  const t = new Date(`${e.fecha}T${e.hora || "00:00"}`).getTime();
  return Number.isFinite(t) && t < Date.now();
}

/** Minutos después del kickoff para recordar cargar/calificar (partido ~75′). */
export const POST_MATCH_REMINDER_MINUTES = 90;

export function encuentroReminderDueAt(e: PersonalEncuentro): number {
  const start = new Date(`${e.fecha}T${e.hora || "00:00"}`).getTime();
  if (!Number.isFinite(start)) return Number.POSITIVE_INFINITY;
  return start + POST_MATCH_REMINDER_MINUTES * 60_000;
}

export function isPostMatchReminderDue(e: PersonalEncuentro, now = Date.now()): boolean {
  if (!e.notificar || e.reminderSent) return false;
  return now >= encuentroReminderDueAt(e);
}
