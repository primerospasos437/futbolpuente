const THEME_STORAGE_KEY = "psb_color_theme";

export type ColorTheme = "dark" | "light";

export function isLightMode(): boolean {
  return typeof document !== "undefined" && document.body.classList.contains("light-mode");
}

export function getStoredTheme(): ColorTheme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Aplica tema en <body> (clase .light-mode). */
export function applyTheme(theme: ColorTheme): void {
  document.body.classList.toggle("light-mode", theme === "light");
}

export function setTheme(theme: ColorTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
}

/** Alterna modo claro/oscuro y devuelve el tema activo. */
export function toggleTheme(): ColorTheme {
  const next: ColorTheme = isLightMode() ? "dark" : "light";
  setTheme(next);
  return next;
}

/** Llamar una vez al arranque (antes del primer render). */
export function initTheme(): void {
  applyTheme(getStoredTheme());
}
