const BRIDGE_ENTERED_KEY = "psb_bridge_entered";
const BRIDGE_SPORT_KEY = "psb_selected_sport";
const BRIDGE_GRUPO_KEY = "psb_active_grupo";

export function hasBridgeEntered(): boolean {
  try {
    return sessionStorage.getItem(BRIDGE_ENTERED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markBridgeEntered(): void {
  try {
    sessionStorage.setItem(BRIDGE_ENTERED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearBridgeEntered(): void {
  try {
    sessionStorage.removeItem(BRIDGE_ENTERED_KEY);
    sessionStorage.removeItem(BRIDGE_SPORT_KEY);
    sessionStorage.removeItem(BRIDGE_GRUPO_KEY);
  } catch {
    /* ignore */
  }
}

/** Vuelve a la landing sin cerrar sesión (cambiar deporte). Conserva el grupo. */
export function reopenBridgeLanding(): void {
  try {
    sessionStorage.removeItem(BRIDGE_ENTERED_KEY);
  } catch {
    /* ignore */
  }
}

/** Vuelve al wizard de grupos (cambia de grupo). Conserva el deporte. */
export function reopenGroupPicker(): void {
  try {
    sessionStorage.removeItem(BRIDGE_ENTERED_KEY);
    sessionStorage.removeItem(BRIDGE_GRUPO_KEY);
  } catch {
    /* ignore */
  }
}

export function setSelectedSport(sportId: string): void {
  try {
    sessionStorage.setItem(BRIDGE_SPORT_KEY, sportId);
  } catch {
    /* ignore */
  }
}

export function getSelectedSport(): string | null {
  try {
    return sessionStorage.getItem(BRIDGE_SPORT_KEY);
  } catch {
    return null;
  }
}

export function setActiveGrupoId(grupoId: string): void {
  try {
    sessionStorage.setItem(BRIDGE_GRUPO_KEY, String(grupoId).trim());
  } catch {
    /* ignore */
  }
}

export function getActiveGrupoId(): string | null {
  try {
    const v = sessionStorage.getItem(BRIDGE_GRUPO_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function clearActiveGrupoId(): void {
  try {
    sessionStorage.removeItem(BRIDGE_GRUPO_KEY);
  } catch {
    /* ignore */
  }
}

/** Listo para mostrar el Shell: sesión + deporte + grupo + flag de entrada. */
export function canEnterAppShell(): boolean {
  return hasBridgeEntered() && Boolean(getSelectedSport()) && Boolean(getActiveGrupoId());
}
