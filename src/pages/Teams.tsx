import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { BalanceResponse, PlayerSummary } from "../types";

export default function TeamsPage() {
  const [players, setPlayers] = useState<PlayerSummary[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<BalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { jugadores: list } = await api.players();
        if (cancelled) return;
        setPlayers(list);
        const init: Record<string, boolean> = {};
        for (const p of list) init[p.id] = true;
        setSelected(init);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const chosenIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([id]) => id), [selected]);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.balanceTeams(chosenIds.length ? chosenIds : undefined);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function toggleAll(on: boolean) {
    if (!players) return;
    const next: Record<string, boolean> = {};
    for (const p of players) next[p.id] = on;
    setSelected(next);
  }

  if (error && !players) return <div className="error">{error}</div>;
  if (!players) return <p className="muted">Cargando…</p>;

  return (
    <div>
      <h1>Armar equipos</h1>
      <p className="sub">
        Elegí quién juega hoy. El algoritmo reparte jugadores en dos equipos tratando de igualar la suma de la{" "}
        <strong>nota final</strong> de cada uno (mejor reparto que elegir a mano cuando hay muchas diferencias de nivel).
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <button type="button" className="btn btn-ghost" onClick={() => toggleAll(true)}>
            Marcar todos
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => toggleAll(false)}>
            Desmarcar todos
          </button>
        </div>
        <div className="list">
          {players.map((p) => (
            <label key={p.id} className="checkbox-row player-row" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={selected[p.id] ?? false}
                onChange={(e) => setSelected((s) => ({ ...s, [p.id]: e.target.checked }))}
              />
              <span>
                <strong>{p.apodo}</strong>{" "}
                <span className="muted">
                  ({p.posicionPreferida}) · final {p.finalScore.toFixed(2)}
                </span>
              </span>
            </label>
          ))}
        </div>
        <button className="btn btn-primary" type="button" style={{ marginTop: "1rem" }} onClick={generate} disabled={loading}>
          {loading ? "Calculando…" : "Generar dos equipos parejos"}
        </button>
        {error && (
          <div className="error" style={{ marginTop: "1rem" }}>
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="team-grid">
          <div className="card team-card">
            <h3>Equipo A · suma {result.sumA.toFixed(2)}</h3>
            <ul>
              {result.teamA.map((x) => (
                <li key={x.id}>
                  {x.apodo} · {x.posicionPreferida} · {x.score.toFixed(2)}
                </li>
              ))}
            </ul>
          </div>
          <div className="card team-card">
            <h3>Equipo B · suma {result.sumB.toFixed(2)}</h3>
            <ul>
              {result.teamB.map((x) => (
                <li key={x.id}>
                  {x.apodo} · {x.posicionPreferida} · {x.score.toFixed(2)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {result && (
        <p className="muted" style={{ marginTop: "1rem" }}>
          Diferencia entre equipos (suma de notas): {result.difference.toFixed(3)} · Generado{" "}
          {new Date(result.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
