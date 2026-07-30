import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api, apiPartidos, type PartidoRow, type PresenciaRow } from "../api";
import MatchPreviewDatos from "../components/MatchPreviewDatos";
import {
  collectApodosFromPartidos,
  miEquipoEnPartido,
  parseEquipoNombres,
  partidoTieneEquiposPublicados,
} from "../lib/partidoEquipos";
import { buildMatchPreviewSheet } from "../lib/partidoStats";
import type { PlayerSummary } from "../types";

/**
 * Planilla completa «PREVIA DEL PARTIDO» (formato infografía).
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

  const claros = useMemo(
    () => (partido ? parseEquipoNombres(partido.equipo_claros, apodoById) : []),
    [partido, apodoById],
  );
  const oscuros = useMemo(
    () => (partido ? parseEquipoNombres(partido.equipo_oscuros, apodoById) : []),
    [partido, apodoById],
  );

  const sheet = useMemo(() => {
    if (!partido) return null;
    return buildMatchPreviewSheet(claros, oscuros, partidos, presencias, apodoById);
  }, [partido, claros, oscuros, partidos, presencias, apodoById]);

  if (loading) return <p className="muted">Cargando previa…</p>;
  if (error) return <div className="error">{error}</div>;
  if (!partidoId) return <Navigate to="/proximos-partidos" replace />;
  if (!partido || !partidoTieneEquiposPublicados(partido) || !sheet) {
    return (
      <div className="page-shell">
        <p className="muted">No encontré ese partido con equipos publicados.</p>
        <Link to="/proximos-partidos">← Volver a Próximos partidos</Link>
      </div>
    );
  }

  return (
    <div className="page-shell previa-partido-page">
      <p className="previa-partido-page__back">
        <Link to="/proximos-partidos">← Volver a Próximos partidos</Link>
      </p>
      <MatchPreviewDatos
        fecha={partido.fecha}
        hora={partido.hora_partido}
        claros={claros}
        oscuros={oscuros}
        miEquipo={meId ? miEquipoEnPartido(partido.id, meId, presencias) : null}
        sheet={sheet}
      />
    </div>
  );
}
