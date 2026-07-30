import { DIMENSION_ORDER } from "../dimensions";
import { defaultF5ScoresZeros } from "../dimensions-f5";
import { defaultScoresZeros } from "../dimensions";
import type {
  ConvocatoriaRow,
  F5ProfileScores,
  MisDatosPrivados,
  NotificacionRow,
  PartidoRow,
  Pie,
  PlayerDetail,
  PlayerSummary,
  PlayersListPayload,
  Posicion,
  PresenciaRow,
  ProfileScores,
} from "../types";
import { DEMO_GUEST_APODO, DEMO_GUEST_EMAIL, DEMO_GUEST_ID } from "./demoMode";

type SeedPlayer = {
  id: string;
  apodo: string;
  nombreCompleto: string;
  posicion: Posicion;
  alt?: Posicion;
  pie?: Pie;
  finalScore: number;
  f5FinalScore: number;
  peerAvg: number;
  peerCount: number;
  esAdmin?: boolean;
  alturaCm?: number;
};

const SEED_PLAYERS: SeedPlayer[] = [
  { id: DEMO_GUEST_ID, apodo: DEMO_GUEST_APODO, nombreCompleto: "Usuario Demo", posicion: "medio", finalScore: 3.6, f5FinalScore: 3.9, peerAvg: 3.4, peerCount: 4, esAdmin: true, alturaCm: 175 },
  { id: "demo-p002", apodo: "Chino", nombreCompleto: "Martín López", posicion: "delantero", alt: "medio", finalScore: 4.1, f5FinalScore: 4.25, peerAvg: 3.9, peerCount: 8 },
  { id: "demo-p003", apodo: "Negro", nombreCompleto: "Diego Ruiz", posicion: "defensa", finalScore: 3.85, f5FinalScore: 4.05, peerAvg: 3.7, peerCount: 7 },
  { id: "demo-p004", apodo: "Pato", nombreCompleto: "Lucas Ferreyra", posicion: "medio", finalScore: 3.7, f5FinalScore: 3.88, peerAvg: 3.55, peerCount: 6 },
  { id: "demo-p005", apodo: "Turco", nombreCompleto: "Nicolás Gómez", posicion: "portero", finalScore: 3.45, f5FinalScore: 3.75, peerAvg: 3.3, peerCount: 5 },
  { id: "demo-p006", apodo: "Colo", nombreCompleto: "Facundo Díaz", posicion: "defensa", alt: "medio", finalScore: 3.95, f5FinalScore: 4.12, peerAvg: 3.8, peerCount: 9 },
  { id: "demo-p007", apodo: "Mono", nombreCompleto: "Sebastián Álvarez", posicion: "delantero", finalScore: 4.25, f5FinalScore: 4.35, peerAvg: 4.1, peerCount: 10 },
  { id: "demo-p008", apodo: "Lucho", nombreCompleto: "Hernán Castro", posicion: "medio", finalScore: 3.5, f5FinalScore: 3.85, peerAvg: 3.35, peerCount: 4 },
  { id: "demo-p009", apodo: "Tano", nombreCompleto: "Gustavo Morales", posicion: "defensa", finalScore: 3.65, f5FinalScore: 3.95, peerAvg: 3.5, peerCount: 6 },
  { id: "demo-p010", apodo: "Cabeza", nombreCompleto: "Ramiro Sosa", posicion: "delantero", alt: "medio", finalScore: 3.8, f5FinalScore: 4.0, peerAvg: 3.65, peerCount: 7 },
  { id: "demo-p011", apodo: "Rulo", nombreCompleto: "Emiliano Vega", posicion: "medio", finalScore: 3.4, f5FinalScore: 3.7, peerAvg: 3.25, peerCount: 3 },
  { id: "demo-p012", apodo: "Fede", nombreCompleto: "Tomás Herrera", posicion: "defensa", finalScore: 3.9, f5FinalScore: 4.08, peerAvg: 3.75, peerCount: 8 },
];

function mkProfile(base: number): ProfileScores {
  const s = defaultScoresZeros();
  DIMENSION_ORDER.forEach((k, i) => {
    s[k] = Math.min(5, Math.max(1, Math.round(base + ((i % 3) - 1) * 0.35)));
  });
  return s;
}

function mkF5(base: number): F5ProfileScores {
  const s = defaultF5ScoresZeros();
  const keys = Object.keys(s) as (keyof F5ProfileScores)[];
  keys.forEach((k, i) => {
    s[k] = Math.min(5, Math.max(1, Math.round(base + ((i % 2) - 0.5) * 0.4)));
  });
  return s;
}

function seedToSummary(p: SeedPlayer, viewerId: string, ratedCompleto: Set<string>, ratedF5: Set<string>): PlayerSummary {
  const isSelf = p.id === viewerId;
  const selfAvg = p.finalScore - 0.3;
  const f5Self = p.f5FinalScore - 0.2;
  return {
    id: p.id,
    nombreCompleto: p.nombreCompleto,
    apodo: p.apodo,
    posicionPreferida: p.posicion,
    posicionAlternativa: p.alt ?? p.posicion,
    pieDominante: p.pie ?? "derecho",
    modalidadPreferida: "ambas",
    profile: mkProfile(selfAvg),
    f5Profile: mkF5(f5Self),
    ficha: {
      fechaNacimiento: "1990-05-15",
      contacto: isSelf ? "demo@local" : "",
      posicionAlternativa: p.alt ?? p.posicion,
      alturaCm: p.alturaCm ?? 178,
      pesoKg: 76,
      historialLesiones: isSelf ? "Modo demo: sin datos reales." : null,
    },
    profileAverage: selfAvg,
    peerAverage: p.peerAvg,
    peerCount: p.peerCount,
    finalScore: p.finalScore,
    finalBreakdown: { selfAvg, peerAvg: p.peerAvg, peerCount: p.peerCount },
    f5FinalScore: p.f5FinalScore,
    f5FinalBreakdown: { selfAvg: f5Self, peerAvg: p.f5FinalScore - 0.15, peerCount: Math.max(1, p.peerCount - 1) },
    esAdmin: Boolean(p.esAdmin),
    createdAt: new Date().toISOString(),
    perfilCompletoCargado: true,
    perfilF5Cargado: true,
    ...(isSelf ? { miValoracionesPerfilOtros: ratedCompleto.size } : {}),
    isSelf,
    ratedByMe: ratedCompleto.has(p.id),
    ratedF5PerfilByMe: ratedF5.has(p.id),
  };
}

export type DemoState = {
  misDatos: MisDatosPrivados;
  ratedCompleto: Set<string>;
  ratedF5: Set<string>;
  convocatorias: ConvocatoriaRow[];
  partidos: PartidoRow[];
  presencias: PresenciaRow[];
  notificaciones: NotificacionRow[];
  evitaCompaneros: { id: string; apodo: string }[];
  myRatings: Map<string, ProfileScores>;
  myF5Ratings: Map<string, F5ProfileScores>;
};

function nextMartesIso(): string {
  const d = new Date();
  const day = d.getDay();
  const add = day <= 2 ? 2 - day : 9 - day;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

function isoDaysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function pushLineupPresencias(
  out: PresenciaRow[],
  partidoId: string,
  clarosIds: string[],
  oscurosIds: string[],
) {
  for (const id of clarosIds) {
    out.push({ partido_id: partidoId, jugador_id: id, equipo: "claros", estado: "convocado" });
  }
  for (const id of oscurosIds) {
    out.push({ partido_id: partidoId, jugador_id: id, equipo: "oscuros", estado: "convocado" });
  }
}

function createInitialState(): DemoState {
  const fecha = nextMartesIso();
  const fecha2 = isoDaysBefore(fecha, 7);
  const fecha3 = isoDaysBefore(fecha, 14);
  const convocatorias: ConvocatoriaRow[] = SEED_PLAYERS.slice(0, 8).map((p, i) => ({
    id: `demo-conv-${p.id}`,
    dia: "martes" as const,
    fecha_partido: fecha,
    jugador_id: p.id,
    orden_inscripcion: i + 1,
  }));

  const claros = [
    { id: DEMO_GUEST_ID, apodo: DEMO_GUEST_APODO, posicionPreferida: "medio", score: 3.6 },
    { id: "demo-p002", apodo: "Chino", posicionPreferida: "delantero", score: 4.1 },
    { id: "demo-p003", apodo: "Negro", posicionPreferida: "defensa", score: 3.85 },
    { id: "demo-p004", apodo: "Pato", posicionPreferida: "medio", score: 3.7 },
    { id: "demo-p005", apodo: "Turco", posicionPreferida: "portero", score: 3.45 },
  ];
  const oscuros = [
    { id: "demo-p006", apodo: "Colo", posicionPreferida: "defensa", score: 3.95 },
    { id: "demo-p007", apodo: "Mono", posicionPreferida: "delantero", score: 4.25 },
    { id: "demo-p008", apodo: "Lucho", posicionPreferida: "medio", score: 3.5 },
    { id: "demo-p009", apodo: "Tano", posicionPreferida: "defensa", score: 3.65 },
    { id: "demo-p010", apodo: "Cabeza", posicionPreferida: "delantero", score: 3.8 },
  ];

  const partido1: PartidoRow = {
    id: "demo-partido-1",
    fecha: fecha3,
    equipo_claros: [
      { id: DEMO_GUEST_ID, apodo: DEMO_GUEST_APODO },
      { id: "demo-p002", apodo: "Chino" },
      { id: "demo-p003", apodo: "Negro" },
      { id: "demo-p006", apodo: "Colo" },
      { id: "demo-p008", apodo: "Lucho" },
    ],
    equipo_oscuros: [
      { id: "demo-p004", apodo: "Pato" },
      { id: "demo-p005", apodo: "Turco" },
      { id: "demo-p007", apodo: "Mono" },
      { id: "demo-p009", apodo: "Tano" },
      { id: "demo-p010", apodo: "Cabeza" },
    ],
    estado: "finalizado",
    confirmado_admin: true,
    hora_partido: "21:30",
    goles_claros: 2,
    goles_oscuros: 4,
    mvp_jugador_id: "demo-p007",
    comentario_partido: "Oscuros volaron. Mono imparable.",
    resultado_cargado_at: new Date().toISOString(),
  };

  const partido2: PartidoRow = {
    id: "demo-partido-2",
    fecha: fecha2,
    equipo_claros: [
      { id: DEMO_GUEST_ID, apodo: DEMO_GUEST_APODO },
      { id: "demo-p002", apodo: "Chino" },
      { id: "demo-p004", apodo: "Pato" },
      { id: "demo-p007", apodo: "Mono" },
      { id: "demo-p009", apodo: "Tano" },
    ],
    equipo_oscuros: [
      { id: "demo-p003", apodo: "Negro" },
      { id: "demo-p005", apodo: "Turco" },
      { id: "demo-p006", apodo: "Colo" },
      { id: "demo-p008", apodo: "Lucho" },
      { id: "demo-p010", apodo: "Cabeza" },
    ],
    estado: "finalizado",
    confirmado_admin: true,
    hora_partido: "21:30",
    goles_claros: 1,
    goles_oscuros: 1,
    mvp_jugador_id: DEMO_GUEST_ID,
    comentario_partido: "Empate peleado. Invitado se sacó un tapón.",
    resultado_cargado_at: new Date().toISOString(),
  };

  const partidoConfirmado: PartidoRow = {
    id: "demo-partido-confirmado",
    fecha: fecha2,
    equipo_claros: claros,
    equipo_oscuros: oscuros,
    estado: "finalizado",
    confirmado_admin: true,
    hora_partido: "21:30",
    suplentes: [
      { id: "demo-p011", apodo: "Rulo" },
      { id: "demo-p012", apodo: "Fede" },
    ],
    goles_claros: 3,
    goles_oscuros: 1,
    mvp_jugador_id: "demo-p002",
    comentario_partido: "Demo: Claros ganaron 3-1. Chino MVP.",
    resultado_cargado_at: new Date().toISOString(),
  };

  /** Partido confirmado sin resultado: el admin demo puede cargarlo en Stats.
   *  También sirve para ver «Próxima fecha · datos» en Próximos partidos. */
  const partidoPendienteResultado: PartidoRow = {
    id: "demo-partido-sin-resultado",
    fecha: fecha,
    equipo_claros: [
      { id: DEMO_GUEST_ID, apodo: DEMO_GUEST_APODO },
      { id: "demo-p006", apodo: "Colo" },
      { id: "demo-p007", apodo: "Mono" },
      { id: "demo-p008", apodo: "Lucho" },
      { id: "demo-p009", apodo: "Tano" },
    ],
    equipo_oscuros: [
      { id: "demo-p002", apodo: "Chino" },
      { id: "demo-p003", apodo: "Negro" },
      { id: "demo-p004", apodo: "Pato" },
      { id: "demo-p005", apodo: "Turco" },
      { id: "demo-p010", apodo: "Cabeza" },
    ],
    estado: "pendiente",
    confirmado_admin: true,
    hora_partido: "21:30",
    goles_claros: null,
    goles_oscuros: null,
    comentario_partido: "Demo previa — sin resultado aún",
  };

  const presencias: PresenciaRow[] = [];
  pushLineupPresencias(
    presencias,
    partido1.id,
    (partido1.equipo_claros as { id: string }[]).map((x) => x.id),
    (partido1.equipo_oscuros as { id: string }[]).map((x) => x.id),
  );
  pushLineupPresencias(
    presencias,
    partido2.id,
    (partido2.equipo_claros as { id: string }[]).map((x) => x.id),
    (partido2.equipo_oscuros as { id: string }[]).map((x) => x.id),
  );
  for (const slot of [...claros, ...oscuros]) {
    presencias.push({
      partido_id: partidoConfirmado.id,
      jugador_id: slot.id,
      equipo: claros.some((x) => x.id === slot.id) ? "claros" : "oscuros",
      estado: "convocado",
    });
  }
  for (const slot of partidoPendienteResultado.equipo_claros as { id: string }[]) {
    presencias.push({
      partido_id: partidoPendienteResultado.id,
      jugador_id: slot.id,
      equipo: "claros",
      estado: "convocado",
    });
  }
  for (const slot of partidoPendienteResultado.equipo_oscuros as { id: string }[]) {
    presencias.push({
      partido_id: partidoPendienteResultado.id,
      jugador_id: slot.id,
      equipo: "oscuros",
      estado: "convocado",
    });
  }

  return {
    misDatos: {
      email: DEMO_GUEST_EMAIL,
      apodo: DEMO_GUEST_APODO,
      nombre: "Usuario",
      apellido: "Demo",
      telefono: "+54 11 5555-0000",
    },
    ratedCompleto: new Set(["demo-p002", "demo-p003"]),
    ratedF5: new Set(["demo-p004"]),
    convocatorias,
    partidos: [
      partidoConfirmado,
      partido2,
      partido1,
      partidoPendienteResultado,
      {
        id: "demo-partido-borrador",
        fecha,
        equipo_claros: [],
        equipo_oscuros: [],
        estado: "borrador",
        confirmado_admin: false,
      },
    ],
    presencias,
    notificaciones: [
      {
        id: "demo-notif-1",
        tipo: "partido_confirmado",
        titulo: "Partido confirmado (demo)",
        cuerpo: "Martes 21:30 — Equipo Claros. Sos titular en el modo demostración.",
        datos: { partido_id: partidoConfirmado.id },
        leida: false,
        created_at: new Date().toISOString(),
      },
    ],
    evitaCompaneros: [],
    myRatings: new Map(),
    myF5Ratings: new Map(),
  };
}

let state: DemoState = createInitialState();

export function resetDemoStore(): void {
  state = createInitialState();
}

export function getDemoState(): DemoState {
  return state;
}

export function buildPlayersList(viewerId: string): PlayersListPayload {
  const jugadores = SEED_PLAYERS.map((p) =>
    seedToSummary(p, viewerId, state.ratedCompleto, state.ratedF5),
  ).sort((a, b) => a.apodo.localeCompare(b.apodo, "es"));
  const otros = jugadores.filter((p) => !p.isSelf);
  return {
    jugadores,
    faltanCalificar: otros.filter((p) => !p.ratedByMe),
    yaCalificados: otros.filter((p) => p.ratedByMe),
    faltanCalificarF5: otros.filter((p) => !p.ratedF5PerfilByMe),
    yaCalificadosF5: otros.filter((p) => p.ratedF5PerfilByMe),
  };
}

export function buildPlayerDetail(id: string, viewerId: string): PlayerDetail {
  const list = buildPlayersList(viewerId);
  const base = list.jugadores.find((p) => p.id === id);
  if (!base) throw new Error("No encontrado");
  const myRating = state.myRatings.get(id);
  const myF5 = state.myF5Ratings.get(id);
  return {
    ...base,
    dimensions: DIMENSION_ORDER,
    peerByDimension: {},
    myRating: myRating ? { scores: myRating, updatedAt: new Date().toISOString() } : null,
    viewerIsAdmin: list.jugadores.some((p) => p.isSelf && p.esAdmin),
    peerF5ByDimension: {},
    myF5PerfilRating: myF5 ? { scores: myF5, updatedAt: new Date().toISOString() } : null,
  };
}

export function getMeSummary(viewerId: string): PlayerSummary {
  const p = SEED_PLAYERS.find((x) => x.id === viewerId);
  if (!p) throw new Error("Jugador demo no encontrado");
  return seedToSummary(p, viewerId, state.ratedCompleto, state.ratedF5);
}
