import type { SportCarouselItem } from "../components/SportCarousel";

export const SPORTS_CATALOG: SportCarouselItem[] = [
  { id: "futbol", icon: "⚽", image: "/sports/futbol.webp", name: "Fútbol", available: true },
  { id: "padel", icon: "🎾", image: "/sports/padel.webp", name: "Pádel", available: false },
  { id: "basquet", icon: "🏀", image: "/sports/basquet.webp", name: "Básquet", available: false },
  { id: "voley", icon: "🏐", image: "/sports/voley.webp", name: "Vóley", available: false },
  { id: "tenis", icon: "🥎", image: "/sports/tenis.webp", name: "Tenis", available: false },
  { id: "hockey", icon: "🏑", image: "/sports/hockey.webp", name: "Hockey", available: false },
];

export function sportNameById(id: string | null): string | null {
  if (!id) return null;
  return SPORTS_CATALOG.find((s) => s.id === id)?.name ?? null;
}

/** Ruta pública del logo (reemplazá `public/playsportbridge-logo.png`). */
export const PSB_LOGO_SRC = "/playsportbridge-logo.png";
