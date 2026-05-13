import { useEffect, useMemo, useState } from "react";
import { api, apiPartidos, isAdminFromPlayersList, type PartidoRow } from "../api";
import type { BalanceResponse, PlayerSummary } from "../types";

export default function TeamsPage() {
  const [players, setPlayers] = useState<PlayerSummary[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<BalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [fechaPartido, setFechaPartido] = useState(() => new Date().toISOString().slice(0, 10));
  const [partidos, setPartidos] = useState<PartidoRow[]>([]);
  const [lastBorradorId, setLastBorradorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { jugadores: list } = await api.players();
        if (cancelled) return;
        setPlayers(list);
        setAdmin(isAdminFromPlayersList(list));
        const init: Record<string, boolean> = {};
        for (const p of list) init[p.id] = true;
        setSelected(init);
        const pl = await apiPartidos.list();
        if (!cancelled) setPartidos(Array.isArray(pl) ? pl : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const chosenIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([id]) => id), [selected]);

  const borradores = useMemo(
    () => partidos.filter((p) => p.confirmado_admin === false).sort((a, b) => (b.fecha > a.fecha ? 1 : -1)),
    [partidos],
  );

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

  async function guardarBorrador() {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await apiPartidos.crearBorrador(fechaPartido, result.teamA, result.teamB);
      setLastBorradorId(id);
      const pl = await apiPartidos.list();
      setPartidos(Array.isArray(pl) ? pl : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmar(partidoId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiPartidos.confirmar(partidoId);
      const pl = await apiPartidos.list();
      setPartidos(Array.isArray(pl) ? pl : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function rearmar(partidoId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiPartidos.rearmar(partidoId);
      const pl = await apiPartidos.list();
      setPartidos(Array.isArray(pl) ? pl : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (error && !players) return <div className="error">{error}</div>;
  if (!players) return <p className="muted">Cargando…</p>;

  return (
    <div>
      <h1>Armar equipos</h1>
      <p className="sub">
        Elegí quién juega. El algoritmo reparte en dos equipos parejos según la nota final. Guardá como borrador: no se
        notifica a nadie. Cuando esté listo, confirmá el partido como administrador para avisar a los convocados.
      </p>

      {admin && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Administración</h2>
          <div className="row">
            <label>Fecha del partido (para guardar borrador)</label>
            <input type="date" value={fechaPartido} onChange={(e) => setFechaPartido(e.target.value)} />
          </div>
          {borradores.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <p className="muted" style={{ marginTop: 0 }}>
                Partidos en borrador (sin notificar):
              </p>
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {borradores.map((p) => (
                  <li key={p.id} style={{ marginBottom: "0.5rem" }}>
                    <strong>{p.fecha}</strong> · {p.id.slice(0, 8)}…{" "}
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => confirmar(p.id)}>
                      Confirmar y notificar
                    </button>{" "}
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => rearmar(p.id)}>
                      Rearmar (borrador)
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {lastBorradorId && (
            <p className="muted" style={{ marginBottom: 0, marginTop: "0.75rem" }}>
              Último borrador guardado: {lastBorradorId.slice(0, 8)}… — confirmalo desde la lista cuando quieras
              notificar.
            </p>
          )}
        </div>
      )}

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
        <>
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

          {admin && (
            <div style={{ marginTop: "1rem" }}>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={guardarBorrador}>
                {busy ? "Guardando…" : "Guardar como borrador (no notifica)"}
              </button>
            </div>
          )}

          <p className="muted" style={{ marginTop: "1rem" }}>
            Diferencia entre equipos (suma de notas): {result.difference.toFixed(3)} · Generado{" "}
            {new Date(result.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
