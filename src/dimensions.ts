import type { Dimension, ProfileScores } from "./types";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  controlPrimerToque: "Control y primer toque",
  pase: "Pase (cortos y largos)",
  regate1v1: "Regate y duelos 1v1",
  remateFinalizacion: "Remate / finalización (ambas piernas)",
  juegoAereo: "Juego aéreo / cabeceo",
  posicionamiento: "Posicionamiento (ataque y defensa)",
  visionJuego: "Visión de juego",
  movimientosSinBalon: "Movimientos sin balón / desmarques",
  tomaDecisiones: "Toma de decisiones bajo presión",
  comprensionTactica: "Comprensión táctica / sistema del equipo",
  velocidadAceleracion: "Velocidad y aceleración",
  resistencia: "Resistencia / capacidad aeróbica (90′)",
  fuerzaPotencia: "Fuerza y potencia (duelos, salto)",
  agilidadCoordinacion: "Agilidad y coordinación",
  fortalezaMental: "Fortaleza mental / resiliencia",
  actitudDisciplina: "Actitud y disciplina",
  espirituEquipo: "Espíritu de equipo / comunicación",
  motivacion: "Motivación / mejora continua",
};

/** Orden plano (todas las dimensiones) */
export const DIMENSION_ORDER: Dimension[] = [
  "controlPrimerToque",
  "pase",
  "regate1v1",
  "remateFinalizacion",
  "juegoAereo",
  "posicionamiento",
  "visionJuego",
  "movimientosSinBalon",
  "tomaDecisiones",
  "comprensionTactica",
  "velocidadAceleracion",
  "resistencia",
  "fuerzaPotencia",
  "agilidadCoordinacion",
  "fortalezaMental",
  "actitudDisciplina",
  "espirituEquipo",
  "motivacion",
];

export type DimensionSection = {
  id: string;
  title: string;
  description: string;
  keys: Dimension[];
};

export const DIMENSION_SECTIONS: DimensionSection[] = [
  {
    id: "tecnico",
    title: "1. Capacidades técnicas (manejo del balón)",
    description:
      "Relación directa con el balón: control bajo presión, precisión de pase, regate, definición con ambas piernas y juego aéreo.",
    keys: ["controlPrimerToque", "pase", "regate1v1", "remateFinalizacion", "juegoAereo"],
  },
  {
    id: "tactico",
    title: "2. Capacidades tácticas (inteligencia de juego)",
    description:
      "Lectura del partido, ubicación, movimiento sin balón, decisiones bajo presión y adaptación al sistema.",
    keys: ["posicionamiento", "visionJuego", "movimientosSinBalon", "tomaDecisiones", "comprensionTactica"],
  },
  {
    id: "fisico",
    title: "3. Capacidades físicas",
    description:
      "Explosividad y ritmo, resistencia para el partido completo, fuerza en duelos y cambios de dirección. El historial de lesiones lo registrás aparte en texto (solo vos lo ves).",
    keys: ["velocidadAceleracion", "resistencia", "fuerzaPotencia", "agilidadCoordinacion"],
  },
  {
    id: "psico",
    title: "4. Capacidades psicológicas y personales",
    description: "Mentalidad competitiva, hábitos de entrenamiento, cooperación y motivación por mejorar.",
    keys: ["fortalezaMental", "actitudDisciplina", "espirituEquipo", "motivacion"],
  },
];

export function defaultScores(): ProfileScores {
  return Object.fromEntries(DIMENSION_ORDER.map((k) => [k, 5])) as ProfileScores;
}
