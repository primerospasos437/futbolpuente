import { pushLocalNotification } from "./localNotifications";
import {
  isPostMatchReminderDue,
  loadPersonalEncuentros,
  updatePersonalEncuentro,
  formatEncuentroFecha,
  type PersonalEncuentro,
} from "./personalCalendar";

/**
 * Revisa la agenda del jugador y crea notificaciones post-partido
 * para recordar cargar stats y autoevaluarse.
 */
export function syncCalendarPostMatchReminders(playerId: string): number {
  if (!playerId) return 0;
  const list = loadPersonalEncuentros(playerId);
  let n = 0;
  for (const e of list) {
    if (!isPostMatchReminderDue(e)) continue;
    const created = pushLocalNotification({
      tipo: "calendario_cargar_partido",
      titulo: "¿Cómo te fue?",
      cuerpo: `Ya pasó tu ${e.tipo} en ${e.lugar}. Cargá el partido y calificá tu rendimiento.`,
      datos: {
        encuentroId: e.id,
        tipo: e.tipo,
        href: "/mi-calendario?cargar=1",
      },
      dedupeKey: `cal_post_${e.id}`,
    });
    if (created) {
      updatePersonalEncuentro(playerId, e.id, { reminderSent: true });
      n += 1;
      maybeBrowserNotify(e);
    }
  }
  return n;
}

function maybeBrowserNotify(e: PersonalEncuentro): void {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    new Notification("PlaySportBridge · Recordatorio", {
      body: `Cargá tu ${e.tipo} · ${formatEncuentroFecha(e.fecha, e.hora)}`,
      tag: `cal_post_${e.id}`,
    });
  } catch {
    /* ignore */
  }
}

export async function ensureNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  try {
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      return Notification.permission;
    }
    return await Notification.requestPermission();
  } catch {
    return "unsupported";
  }
}
