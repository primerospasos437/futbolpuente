export type Posicion = "portero" | "defensa" | "medio" | "delantero";
export type Pie = "derecho" | "izquierdo" | "ambos";

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
  ficha: PlayerFicha;
  fotoUrl: string | null;
  arcoScores: { valor: number; comunicacion: number; manos: number } | null;
  profileAverage: number;
  peerAverage: number | null;
  peerCount: number;
  finalScore: number;
  finalBreakdown: {
    selfAvg: number;
    peerAvg: number | null;
    peerCount: number;
  };
  createdAt: string;
  isSelf: boolean;
  /** Fecha ISO de tu última valoración hacia este jugador, si existe */
  lastRatedByMeAt: string | null;
  /** Podés enviar o renovar valoración (no vos, y sin bloqueo de 30 días) */
  needsMyRating: boolean;
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
