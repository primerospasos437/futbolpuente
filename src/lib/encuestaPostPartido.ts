export type EncuestaCategoria = "messi" | "cuti" | "julian" | "dibu";

export type EncuestaDificultad = "parejo" | "disparejo";

export const ENCUESTA_CATEGORIAS: EncuestaCategoria[] = ["messi", "cuti", "julian", "dibu"];

export const ENCUESTA_META: Record<
  EncuestaCategoria,
  { titulo: string; subtitulo: string; emoji: string }
> = {
  messi: {
    titulo: "El Messi del partido",
    subtitulo: "Mejor jugador / MVP",
    emoji: "🐐",
  },
  cuti: {
    titulo: "El Cuti del partido",
    subtitulo: "Mejor defensor · el que más trabó",
    emoji: "🛡️",
  },
  julian: {
    titulo: "El Julián del partido",
    subtitulo: "Mejor pulmón · el que más corrió",
    emoji: "🫁",
  },
  dibu: {
    titulo: "El Dibu del partido",
    subtitulo: "Mejor atajada / arquero",
    emoji: "🧤",
  },
};

export type EncuestaPendiente = {
  partidoId: string;
  fecha: string;
  hora: string | null;
  golesClaros: number;
  golesOscuros: number;
};

export type EncuestaCandidato = {
  id: string;
  apodo: string;
  equipo: "claros" | "oscuros" | string;
};

export type EncuestaPartidoPayload = {
  partidoId: string;
  fecha: string;
  hora: string | null;
  golesClaros: number;
  golesOscuros: number;
  yaVoto: boolean;
  candidatos: EncuestaCandidato[];
  misVotos: Partial<Record<EncuestaCategoria, string>>;
  miDificultad?: EncuestaDificultad | null;
};

export type EncuestaTrofeoRow = {
  jugadorId: string;
  apodo: string;
  messi: number;
  cuti: number;
  julian: number;
  dibu: number;
  total: number;
};

export type EncuestaVotosPayload = Record<EncuestaCategoria, string>;
