import { useCallback, useEffect, useState } from "react";
import { getStoredTheme, isLightMode, toggleTheme, type ColorTheme } from "../lib/theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ColorTheme>(() =>
    typeof document !== "undefined" && isLightMode() ? "light" : getStoredTheme(),
  );

  useEffect(() => {
    setTheme(isLightMode() ? "light" : "dark");
  }, []);

  const onToggle = useCallback(() => {
    const next = toggleTheme();
    setTheme(next);
  }, []);

  const isLight = theme === "light";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={isLight ? "Activar modo oscuro" : "Activar modo claro"}
      title={isLight ? "Modo oscuro" : "Modo claro"}
    >
      {isLight ? "🌙" : "☀️"}
    </button>
  );
}
