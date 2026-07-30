import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api, apiPartidos, type PartidoRow, type PresenciaRow } from "../api";
import MatchPreviewDatos from "../components/MatchPreviewDatos";
import MatchSpotlightCard, { type SpotlightPlayerExtra } from "../components/MatchSpotlightCard";
import {
  collectApodosFromPartidos,
  miEquipoEnPartido,
  parseEquipoNombres,
  partidoTieneEquiposPublicados,
} from "../lib/partidoEquipos";
import {
  buildMatchPreviewInsights,
  buildPlayerListSnippets,
} from "../lib/partidoStats";
import type { PlayerSummary } from "../types";

const POS_LABEL: Record<string, string> = {
  portero: "POR",
  defensa: "DEF",
  medio: "MED",
  delantero: "DEL",
};

/**
 * Planilla completa «Próxima fecha · datos» (previa con insights numerados).
 */
export default function PreviaPartidoPage() {
  const { partidoId } = useParams<{ partidoId: string }>();
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [partidos, setPartidos] = useState<PartidoRow[]>([]);
  const [presencias, setPresencias] = useState<PresenciaRow[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pl, prt, pres, me] = await Promise.all([
          api.players().catch(() => ({ jugadores: [] as PlayerSummary[] })),
          apiPartidos.list(),
          apiPartidos.listPresencias(),
          api.me().catch(() => null),
        ]);
        if (cancelled) return;
        setPlayers(pl.jugadores ?? []);
        setPartidos(Array.isArray(prt) ? prt : []);
        setPresencias(Array.isArray(pres) ? pres : []);
        setMeId(me?.id ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const partido = useMemo(
    () => partidos.find((p) => p.id === partidoId) ?? null,
    [partidos, partidoId],
  );

  const apodoById = useMemo(() => {
    const m = collectApodosFromPartidos(partidos);
    for (const p of players) m.set(p.id, p.apodo);
    return m;
  }, [players, partidos]);

  const playerExtras = useMemo(() => {
    const snippets = buildPlayerListSnippets(partidos, presencias, apodoById);
    const out: Record<string, SpotlightPlayerExtra> = {};
    for (const p of players) {
      const sn = snippets.get(p.id);
      out[p.id] = {
        posicionLabel: POS_LABEL[p.posicionPreferida] ?? p.posicionPreferida?.slice(0, 3).toUpperCase(),
        lastResults: (sn?.lastChips ?? []).slice(0, 3).map((c) => ({
          letter: c.letter,
          score: c.score,
        })),
      };
    }
    return out;
  }, [players, partidos, presencias, apodoById]);

  const claros = useMemo(
    () => (partido ? parseEquipoNombres(partido.equipo_claros, apodoById) : []),
    [partido, apodoById],
  );
  const oscuros = useMemo(
    () => (partido ? parseEquipoNombres(partido.equipo_oscuros, apodoById) : []),
    [partido, apodoById],
  );

  const insights = useMemo(() => {
    if (!partido) return [];
    return buildMatchPreviewInsights(claros, oscuros, partidos, presencias, apodoById);
  }, [partido, claros, oscuros, partidos, presencias, apodoById]);

  if (loading) return <p className="muted">Cargando previa…</p>;
  if (error) return <div className="error">{error}</div>;
  if (!partidoId) return <Navigate to="/proximos-partidos" replace />;
  if (!partido || !partidoTieneEquiposPublicados(partido)) {
    return (
      <div className="page-shell">
        <p className="muted">No encontré ese partido con equipos publicados.</p>
        <Link to="/proximos-partidos">← Volver a Próximos partidos</Link>
      </div>
    );
  }

  return (
    <div className="page-shell previa-partido-page">
      <p style={{ marginBottom: "0.75rem" }}>
        <Link to="/proximos-partidos">← Volver a Próximos partidos</Link>
      </p>

      <header className="page-hero previa-partido-page__hero">
        <h1>Previa del partido</h1>
        <p className="sub">
          {insights.length
            ? `${insights.length} dato${insights.length === 1 ? "" : "s"} armados con el historial del grupo.`
            : "Todavía no hay historial suficiente para armar la previa."}
        </p>
      </header>

      <MatchSpotlightCard
        title="Próximo partido"
        fecha={partido.fecha}
        hora={partido.hora_partido}
        claros={claros}
        oscuros={oscuros}
        golesClaros={partido.goles_claros}
        golesOscuros={partido.goles_oscuros}
        miEquipo={meId ? miEquipoEnPartido(partido.id, meId, presencias) : null}
        showScore={partido.goles_claros != null && partido.goles_oscuros != null}
        playerExtras={playerExtras}
      />

      <MatchPreviewDatos insights={insights} />
    </div>
  );
}
