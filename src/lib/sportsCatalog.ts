import type { SportCarouselItem } from "../components/SportCarousel";

export const SPORTS_CATALOG: SportCarouselItem[] = [
  { id: "futbol", icon: "⚽", name: "Fútbol", available: true },
  { id: "padel", icon: "🎾", name: "Pádel", available: false },
  { id: "basquet", icon: "🏀", name: "Básquet", available: false },
  { id: "voley", icon: "🏐", name: "Vóley", available: false },
  { id: "tenis", icon: "🥎", name: "Tenis", available: false },
  { id: "hockey", icon: "🏑", name: "Hockey", available: false },
];

export function sportNameById(id: string | null): string | null {
  if (!id) return null;
  return SPORTS_CATALOG.find((s) => s.id === id)?.name ?? null;
}

/** Ruta pública del logo (reemplazá `public/playsportbridge-logo.png`). */
export const PSB_LOGO_SRC = "/playsportbridge-logo.png";
