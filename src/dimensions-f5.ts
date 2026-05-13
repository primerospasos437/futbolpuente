export const F5_DIMENSION_ORDER = [
  "inteligencia_espacial",
  "transicion_def_of",
  "lectura_juego_coberturas",
  "retencion_bal_pausa",
  "eficacia_pase_apoyo",
  "resolucion_espacios_reducidos",
  "resistencia_intermitente",
  "fuerza_apoyo_core",
  "velocidad_reaccion",
  "colaboracion_colectiva",
  "comunicacion_asertiva",
  "control_emocional",
] as const;

export type F5Dimension = (typeof F5_DIMENSION_ORDER)[number];

export type F5ProfileScores = Record<F5Dimension, number>;

export const F5_LABELS: Record<F5Dimension, string> = {
  inteligencia_espacial: "Inteligencia espacial (movimiento sin pelota)",
  transicion_def_of: "Transición defensiva-ofensiva",
  lectura_juego_coberturas: "Lectura de juego y coberturas",
  retencion_bal_pausa: "Retención del balón y pausa",
  eficacia_pase_apoyo: "Eficacia en el pase de apoyo",
  resolucion_espacios_reducidos: "Resolución en espacios reducidos",
  resistencia_intermitente: "Resistencia intermitente de alta intensidad",
  fuerza_apoyo_core: "Fuerza de apoyo y estabilidad (core)",
  velocidad_reaccion: "Velocidad de reacción",
  colaboracion_colectiva: "Colaboración colectiva (espíritu de equipo)",
  comunicacion_asertiva: "Comunicación asertiva",
  control_emocional: "Control emocional (resiliencia)",
};

export const F5_HELP: Record<F5Dimension, string> = {
  inteligencia_espacial:
    "Capacidad para desmarcarse en espacios cortos, crear líneas de pase limpias y arrastrar marcas para liberar a los compañeros.",
  transicion_def_of:
    "Velocidad mental para pasar del ataque a la defensa inmediatamente tras la pérdida del balón (evita que el equipo quede mal parado).",
  lectura_juego_coberturas:
    "Anticipación de las líneas de pase del rival y ocupación inteligente de los espacios vacíos cuando un compañero sale a presionar.",
  retencion_bal_pausa:
    "Capacidad de proteger la pelota bajo presión, esconderla con el cuerpo y decidir cuándo acelerar o cuándo congelar el juego.",
  eficacia_pase_apoyo:
    "Precisión para jugar de primera o dar pases de seguridad hacia el cierre o el arquero para resetear la jugada y mantener la posesión.",
  resolucion_espacios_reducidos:
    "Habilidad técnica para controlar, orientar el cuerpo y rematar o asistir con la mínima cantidad de toques posibles.",
  resistencia_intermitente:
    "Capacidad para realizar sprints cortos y explosivos de manera repetitiva, recuperándose rápidamente entre esfuerzos.",
  fuerza_apoyo_core:
    "Potencia en el tren inferior para pivotar, aguantar la carga física del rival de espalda al arco y mantener el equilibrio en giros bruscos.",
  velocidad_reaccion:
    "Agilidad para cambiar de dirección en un metro cuadrado y reaccionar a rebotes inesperados.",
  colaboracion_colectiva:
    "Priorización del éxito del bloque sobre el lucimiento individual. Disposición para el sacrificio físico en beneficio del compañero.",
  comunicacion_asertiva:
    "Capacidad para guiar a los compañeros mediante órdenes claras durante el juego («solo», «marca», «atrás», «gira»).",
  control_emocional:
    "Mantener la calma ante la presión del resultado, errores propios o la fricción física del partido para evitar amonestaciones o desconcentraciones.",
};

export const F5_SECTIONS: {
  id: string;
  title: string;
  keys: F5Dimension[];
}[] = [
  {
    id: "tactica",
    title: "1. Capacidad táctica y posicionamiento",
    keys: ["inteligencia_espacial", "transicion_def_of", "lectura_juego_coberturas"],
  },
  {
    id: "tecnica",
    title: "2. Cualidades técnicas",
    keys: ["retencion_bal_pausa", "eficacia_pase_apoyo", "resolucion_espacios_reducidos"],
  },
  {
    id: "fisica",
    title: "3. Aptitud física",
    keys: ["resistencia_intermitente", "fuerza_apoyo_core", "velocidad_reaccion"],
  },
  {
    id: "mental",
    title: "4. Aspecto mental",
    keys: ["colaboracion_colectiva", "comunicacion_asertiva", "control_emocional"],
  },
];

export function defaultF5Scores(): F5ProfileScores {
  const o = {} as Record<F5Dimension, number>;
  for (const k of F5_DIMENSION_ORDER) o[k] = 3;
  return o as F5ProfileScores;
}

export const F5_SCALE_LABELS = ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"] as const;
