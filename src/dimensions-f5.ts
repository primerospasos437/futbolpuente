export const F5_DIMENSION_ORDER = [
  "pulmon",
  "pegada",
  "pase",
  "quite",
  "compromiso",
] as const;

export type F5Dimension = (typeof F5_DIMENSION_ORDER)[number];

export type F5ProfileScores = Record<F5Dimension, number>;

export const F5_LABELS: Record<F5Dimension, string> = {
  pulmon: "Pulmón",
  pegada: "Pegada",
  pase: "Pase",
  quite: "Quite",
  compromiso: "Compromiso",
};

export const F5_SHORT: Record<F5Dimension, string> = {
  pulmon: "Físico / Despliegue",
  pegada: "Ataque / Gol",
  pase: "Juego / Visión",
  quite: "Defensa / Marca",
  compromiso: "Actitud / Colaboración",
};

export const F5_HELP: Record<F5Dimension, string> = {
  pulmon: "Cuánto corre, idas y vueltas durante los 60 minutos.",
  pegada: "Efectividad, remate al arco y definición.",
  pase: "Claridad para distribuir y dar asistencias sin regalar la pelota.",
  quite: "Firmeza abajo y recuperación.",
  compromiso: "El ida y vuelta solidario, el esfuerzo por el equipo y la ayuda constante a los compañeros.",
};

/** Una sola sección: las 5 métricas F5. */
export const F5_SECTIONS: {
  id: string;
  title: string;
  keys: F5Dimension[];
}[] = [
  {
    id: "metricas",
    title: "Las 5 métricas F5",
    keys: [...F5_DIMENSION_ORDER],
  },
];

export function defaultF5Scores(): F5ProfileScores {
  const o = {} as Record<F5Dimension, number>;
  for (const k of F5_DIMENSION_ORDER) o[k] = 3;
  return o as F5ProfileScores;
}

/** Perfil F5 aún no guardado (mostrar 0 hasta guardar en «Mis perfiles»). */
export function defaultF5ScoresZeros(): F5ProfileScores {
  const o = {} as Record<F5Dimension, number>;
  for (const k of F5_DIMENSION_ORDER) o[k] = 0;
  return o as F5ProfileScores;
}

export const F5_SCALE_LABELS = ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"] as const;

/** Emojis para la UI de estrellas (opcional en labels). */
export const F5_ICONS: Record<F5Dimension, string> = {
  pulmon: "🏃‍♂️",
  pegada: "🎯",
  pase: "🧠",
  quite: "🛡️",
  compromiso: "🤝",
};
