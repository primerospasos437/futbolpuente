export type Posicion = "portero" | "defensa" | "medio" | "delantero";
export type Pie = "derecho" | "izquierdo" | "ambos";

import type { F5ProfileScores } from "./dimensions-f5";

export type { F5ProfileScores } from "./dimensions-f5";

/** Dimensiones 1–10 (autopercepción y valoraciones entre compañeros) */
export type Dimension =
  | "controlPrimerToque"
  | "pase"
  | "regate1v1"
  | "remateFinalizacion"
  | "juegoAereo"
  | "posicionamiento"
  | "visionJuego"
  | "movimientosSinBalon"
  | "tomaDecisiones"
  | "comprensionTactica"
  | "velocidadAceleracion"
  | "resistencia"
  | "fuerzaPotencia"
  | "agilidadCoordinacion"
  | "fortalezaMental"
  | "actitudDisciplina"
  | "espirituEquipo"
  | "motivacion";

export type ProfileScores = Record<Dimension, number>;

/** Ficha técnica e información personal */
export interface PlayerFicha {
  fechaNacimiento: string;
  contacto: string;
  posicionAlternativa: Posicion;
  alturaCm: number | null;
  pesoKg: number | null;
  /** Solo visible para el propio jugador; para otros viene `null` */
  historialLesiones: string | null;
}

export interface PlayerSummary {
  id: string;
  nombreCompleto: string;
  apodo: string;
  posicionPreferida: Posicion;
  posicionAlternativa: Posicion;
  pieDominante: Pie;
  profile: ProfileScores;
  /** Perfil F5 (autopercepción 1–5); en listados puede ir sin promedio de grupo. */
  f5Profile: F5ProfileScores;
  ficha: PlayerFicha;
  profileAverage: number;
  peerAverage: number | null;
  peerCount: number;
  finalScore: number;
  finalBreakdown: {
    selfAvg: number;
    peerAvg: number | null;
    peerCount: number;
  };
  f5FinalScore: number | null;
  f5FinalBreakdown: {
    selfAvg: number;
    peerAvg: number | null;
    peerCount: number;
  } | null;
  esAdmin: boolean;
  createdAt: string;
  isSelf: boolean;
  /** Si el usuario actual ya envió una valoración a este jugador (siempre `false` para vos mismo). */
  ratedByMe: boolean;
}

/** Respuesta de listado de jugadores con bloques para la vista (pendientes vs ya valorados). */
export interface PlayersListPayload {
  /** Todos los jugadores (orden por apodo), cada uno con `ratedByMe`. */
  jugadores: PlayerSummary[];
  /** Compañeros que aún no valoraste. */
  faltanCalificar: PlayerSummary[];
  /** Compañeros que ya valoraste (p. ej. indicador en verde en la lista). */
  yaCalificados: PlayerSummary[];
}

export interface PlayerDetail extends PlayerSummary {
  dimensions: Dimension[];
  peerByDimension: Partial<Record<Dimension, number | null>>;
  myRating: { scores: ProfileScores; updatedAt: string } | null;
}

export interface TeamSlot {
  id: string;
  apodo: string;
  posicionPreferida: Posicion;
  score: number;
}

export interface BalanceResponse {
  teamA: TeamSlot[];
  teamB: TeamSlot[];
  sumA: number;
  sumB: number;
  difference: number;
  pickedBy: string;
  generatedAt: string;
}
