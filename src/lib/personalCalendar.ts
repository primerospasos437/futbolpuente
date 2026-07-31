/**
 * Agenda personal de encuentros (Mi Calendario).
 * Independiente de partidos de grupo y de la carga de stats/Mundialito.
 */

export type FutbolFormato = "F5" | "F7" | "F8" | "F9" | "F11";

export const FUTBOL_FORMATOS: FutbolFormato[] = ["F5", "F7", "F8", "F9", "F11"];

export type PersonalEncuentro = {
  id: string;
  createdAt: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  lugar: string;
  tipo: FutbolFormato;
  notificar: boolean;
};

export type PersonalEncuentroInput = Omit<PersonalEncuentro, "id" | "createdAt">;

function storageKey(playerId: string): string {
  return `psb_personal_calendar_${playerId || "anon"}`;
}

export function loadPersonalEncuentros(playerId: string): PersonalEncuentro[] {
  try {
    const raw = localStorage.getItem(storageKey(playerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersonalEncuentro[];
    return Array.isArray(parsed) ? parsed : [];
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
    id: `pe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const list = sortEncuentros([item, ...loadPersonalEncuentros(playerId)]);
  savePersonalEncuentros(playerId, list.slice(0, 100));
  return item;
}

export function removePersonalEncuentro(playerId: string, id: string): void {
  const list = loadPersonalEncuentros(playerId).filter((e) => e.id !== id);
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
