import type {
  BalanceResponse,
  ConvocatoriaRow,
  F5ProfileScores,
  MisDatosPrivados,
  NotificacionRow,
  PartidoRow,
  PlayerDetail,
  PlayerSummary,
  PlayersListPayload,
  PresenciaRow,
  ProfileScores,
  TeamSlot,
} from "../types";
import { balanceTwoTeamsWithAvoid, playerToBalanceInput, teamAverageScore } from "./teamsBalance";
import { DEMO_GUEST_ID } from "./demoMode";
import {
  buildPlayerDetail,
  buildPlayersList,
  getDemoState,
  getMeSummary,
  resetDemoStore,
} from "./demoStore";

function viewerId(): string {
  return DEMO_GUEST_ID;
}

function delay<T>(v: T, ms = 80): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(v), ms));
}

export function initDemoSession(): void {
  resetDemoStore();
}

export const demoApi = {
  me: async (): Promise<PlayerSummary> => delay(getMeSummary(viewerId())),

  players: async (): Promise<PlayersListPayload> => delay(buildPlayersList(viewerId())),

  player: async (id: string): Promise<PlayerDetail> => delay(buildPlayerDetail(id, viewerId())),

  updateMe: async (body: Record<string, unknown>): Promise<PlayerSummary> => {
    const st = getDemoState();
    if (typeof body.nombreCompleto === "string") {
      const parts = String(body.nombreCompleto).trim().split(/\s+/);
      st.misDatos.nombre = parts[0] ?? st.misDatos.nombre;
      st.misDatos.apellido = parts.slice(1).join(" ") || st.misDatos.apellido;
    }
    if (typeof body.contacto === "string") st.misDatos.telefono = body.contacto;
    return delay(getMeSummary(viewerId()));
  },

  ratePlayer: async (id: string, scores: ProfileScores) => {
    const st = getDemoState();
    st.ratedCompleto.add(id);
    st.myRatings.set(id, scores);
    return delay({ saved: true, target: buildPlayerDetail(id, viewerId()) });
  },

  ratePlayerF5Perfil: async (id: string, scores: F5ProfileScores): Promise<void> => {
    const st = getDemoState();
    st.ratedF5.add(id);
    st.myF5Ratings.set(id, scores);
    await delay(undefined);
  },

  ratePlayerF5Partido: async (_partidoId: string, paraId: string, scores: F5ProfileScores): Promise<void> => {
    getDemoState().myF5Ratings.set(paraId, scores);
    await delay(undefined);
  },

  pendientesValoracionF5Partidos: async () => {
    const st = getDemoState();
    const partido = st.partidos.find((p) => p.confirmado_admin);
    if (!partido) return delay([]);
    return delay([
      {
        partido,
        companeros: [
          { id: "demo-p006", apodo: "Colo" },
          { id: "demo-p007", apodo: "Mono" },
        ],
      },
    ]);
  },

  balanceTeams: async (playerIds?: string[], opts?: { useF5Scores?: boolean }): Promise<BalanceResponse> => {
    const { jugadores } = buildPlayersList(viewerId());
    const selected = playerIds?.length ? jugadores.filter((p) => playerIds.includes(p.id)) : [...jugadores];
    const useF5 = Boolean(opts?.useF5Scores);
    const inputs = selected.map((p) => playerToBalanceInput(p, useF5));
    const { teamA, teamB, diff } = balanceTwoTeamsWithAvoid(inputs, []);
    const toSlots = (arr: typeof teamA): TeamSlot[] =>
      arr.map((p) => ({
        id: p.id,
        apodo: p.apodo,
        posicionPreferida: p.posicionPreferida,
        score: p.score,
      }));
    return delay({
      teamA: toSlots(teamA),
      teamB: toSlots(teamB),
      sumA: teamAverageScore(teamA),
      sumB: teamAverageScore(teamB),
      difference: diff,
      pickedBy: viewerId(),
      generatedAt: new Date().toISOString(),
      usingF5Scores: useF5,
      avoidPairsApplied: 0,
    });
  },

  misDatosPrivados: async (): Promise<MisDatosPrivados> => delay({ ...getDemoState().misDatos }),

  setMisDatosPrivados: async (p: {
    nombre: string;
    apellido: string;
    telefono: string;
    apodo: string;
    email?: string;
    pin?: string;
  }): Promise<MisDatosPrivados> => {
    const st = getDemoState();
    st.misDatos = {
      email: p.email?.trim().toLowerCase() || st.misDatos.email,
      apodo: p.apodo.trim(),
      nombre: p.nombre,
      apellido: p.apellido,
      telefono: p.telefono,
    };
    return delay({ ...st.misDatos });
  },

  cambiarPin: async (): Promise<void> => {
    await delay(undefined);
  },

  evitaCompanerosGet: async () => delay([...getDemoState().evitaCompaneros]),

  evitaCompanerosSet: async (evitaIds: string[]) => {
    const list = buildPlayersList(viewerId()).jugadores;
    const uniq = [...new Set(evitaIds)].slice(0, 2);
    getDemoState().evitaCompaneros = uniq.map((id) => {
      const p = list.find((x) => x.id === id);
      return { id, apodo: p?.apodo ?? id.slice(0, 8) };
    });
    return delay([...getDemoState().evitaCompaneros]);
  },
};

export const demoPartidos = {
  list: async (): Promise<PartidoRow[]> => delay([...getDemoState().partidos]),

  listPresencias: async (): Promise<PresenciaRow[]> => delay([...getDemoState().presencias]),

  marcarPresencia: async (partidoId: string, jugadorId: string, estado: string): Promise<void> => {
    const row = getDemoState().presencias.find((p) => p.partido_id === partidoId && p.jugador_id === jugadorId);
    if (row) row.estado = estado as PresenciaRow["estado"];
    await delay(undefined);
  },

  crearBorrador: async (
    fecha: string,
    claros: TeamSlot[],
    oscuros: TeamSlot[],
    opts?: { suplentes?: { id: string; apodo: string }[]; horaPartido?: string; textoEquipamiento?: string },
  ): Promise<{ id: string }> => {
    const id = `demo-partido-${Date.now()}`;
    getDemoState().partidos.push({
      id,
      fecha,
      equipo_claros: claros,
      equipo_oscuros: oscuros,
      estado: "borrador",
      confirmado_admin: false,
      suplentes: opts?.suplentes ?? [],
      hora_partido: opts?.horaPartido,
      texto_equipamiento: opts?.textoEquipamiento,
    });
    return delay({ id });
  },

  bajaTitularPartidoConfirmado: async (partidoId: string, jugadorId?: string | null): Promise<void> => {
    const pid = jugadorId ?? viewerId();
    const row = getDemoState().presencias.find((p) => p.partido_id === partidoId && p.jugador_id === pid);
    if (row) row.estado = "ausente";
    await delay(undefined);
  },

  confirmar: async (partidoId: string): Promise<void> => {
    const p = getDemoState().partidos.find((x) => x.id === partidoId);
    if (p) {
      p.confirmado_admin = true;
      p.estado = "confirmado";
    }
    await delay(undefined);
  },

  rearmar: async (partidoId: string): Promise<void> => {
    const p = getDemoState().partidos.find((x) => x.id === partidoId);
    if (p) {
      p.equipo_claros = [];
      p.equipo_oscuros = [];
      p.confirmado_admin = false;
      p.estado = "borrador";
    }
    await delay(undefined);
  },
};

export const demoConvocatorias = {
  list: async (): Promise<ConvocatoriaRow[]> => delay([...getDemoState().convocatorias]),

  anotarse: async (dia: "martes" | "jueves", fechaPartido: string): Promise<void> => {
    const st = getDemoState();
    if (
      !st.convocatorias.some(
        (c) => c.jugador_id === viewerId() && c.dia === dia && c.fecha_partido === fechaPartido,
      )
    ) {
      st.convocatorias.push({
        id: `demo-conv-${viewerId()}-${Date.now()}`,
        dia,
        fecha_partido: fechaPartido,
        jugador_id: viewerId(),
        orden_inscripcion: st.convocatorias.length + 1,
      });
    }
    await delay(undefined);
  },

  desanotarse: async (dia: "martes" | "jueves", fechaPartido: string): Promise<void> => {
    const st = getDemoState();
    st.convocatorias = st.convocatorias.filter(
      (c) => !(c.jugador_id === viewerId() && c.dia === dia && c.fecha_partido === fechaPartido),
    );
    await delay(undefined);
  },
};

export const demoNotificaciones = {
  list: async (): Promise<NotificacionRow[]> => delay([...getDemoState().notificaciones]),

  marcarLeida: async (id: string): Promise<void> => {
    const n = getDemoState().notificaciones.find((x) => x.id === id);
    if (n) n.leida = true;
    await delay(undefined);
  },
};
