import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiPartidos, type PartidoRow, type PresenciaRow } from "../api";
import F5ProfileScorePickers from "../components/F5ProfileScorePickers";
import { defaultF5Scores } from "../dimensions-f5";
import { getSupabase } from "../lib/supabase";
import { normalizeProfileF5ScoresRpc } from "../lib/futbolRegistration";
import type { F5ProfileScores } from "../types";

type Mate = { id: string; apodo: string };

export default function ValorarF5PartidoPage() {
  const { partidoId } = useParams();
  const [partido, setPartido] = useState<PartidoRow | null>(null);
  const [mates, setMates] = useState<Mate[]>([]);
  const [scoresById, setScoresById] = useState<Record<string, F5ProfileScores>>({});
  const [msg, setMsg] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!partidoId) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        const [partidos, presencias] = await Promise.all([apiPartidos.list(), apiPartidos.listPresencias()]);
        if (cancelled) return;
        const p = partidos.find((x) => x.id === partidoId) ?? null;
        setPartido(p);
        if (!p?.confirmado_admin) {
          setError("Este partido no está confirmado o no existe.");
          setLoading(false);
          return;
        }
        const mine = (presencias as PresenciaRow[]).filter((pr) => pr.partido_id === partidoId && pr.jugador_id === me.id);
        if (!mine.length) {
          setError("No figurás como convocado en este partido.");
          setLoading(false);
          return;
        }
        const others = (presencias as PresenciaRow[]).filter((pr) => pr.partido_id === partidoId && pr.jugador_id !== me.id);
        const ids = [...new Set(others.map((o) => o.jugador_id))];
        const sb = getSupabase();
        const { data: rows } = await sb.from("jugadores_publico").select("id,apodo").in("id", ids);
        const list: Mate[] = (rows ?? []).map((r: { id: string; apodo: string }) => ({ id: String(r.id), apodo: String(r.apodo) }));
        list.sort((a, b) => a.apodo.localeCompare(b.apodo));
        const init: Record<string, F5ProfileScores> = {};
        for (const m of list) init[m.id] = defaultF5Scores();
        setMates(list);
        setScoresById(init);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partidoId]);

  async function saveOne(mateId: string) {
    if (!partidoId) return;
    const raw = scoresById[mateId];
    if (!raw) return;
    setMsg((m) => ({ ...m, [mateId]: null }));
    try {
      const scores = normalizeProfileF5ScoresRpc(raw);
      await api.ratePlayerF5Partido(partidoId, mateId, scores);
      setMsg((m) => ({ ...m, [mateId]: "Guardado." }));
    } catch (e) {
      setMsg((m) => ({ ...m, [mateId]: e instanceof Error ? e.message : "Error" }));
    }
  }

  if (loading) return <p className="muted">Cargando…</p>;
  if (error) return <div className="error">{error}</div>;
  if (!partidoId || !partido) return <div className="error">Partido no encontrado.</div>;

  return (
    <div>
      <p style={{ marginBottom: "1rem" }}>
        <Link to="/">← Inicio</Link>
      </p>
      <h1>Valoración F5 del partido</h1>
      <p className="sub">
        Fecha {partido.fecha}. Valorá a cada compañero de esa noche (1 a 5 por característica). Podés volver acá para
        actualizar.
      </p>

      {mates.length === 0 ? (
        <p className="muted">No hay otros convocados para valorar.</p>
      ) : (
        mates.map((m) => (
          <div key={m.id} className="card" style={{ marginBottom: "1rem" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>{m.apodo}</h2>
            <F5ProfileScorePickers scores={scoresById[m.id] ?? defaultF5Scores()} onChange={(next) => setScoresById((s) => ({ ...s, [m.id]: next }))} />
            <button type="button" className="btn btn-primary" style={{ marginTop: "0.75rem" }} onClick={() => saveOne(m.id)}>
              Guardar valoración F5
            </button>
            {msg[m.id] && (
              <p className={msg[m.id]?.includes("Guardado") ? "muted" : "error"} style={{ marginTop: "0.5rem", marginBottom: 0 }}>
                {msg[m.id]}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
