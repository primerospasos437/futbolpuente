import { useEffect, useMemo, useState } from "react";
import { api, apiPartidos, isAdmin as checkAdmin } from "../api";
import type { BalanceResponse, PlayerSummary } from "../types";

export default function TeamsPage() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<BalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.players();
        if (cancelled) return;
        const safe = Array.isArray(list) ? list : [];
        setPlayers(safe);
        const init: Record<string, boolean> = {};
        for (const p of safe) init[p.id] = true;
        setSelected(init);
        // Check admin from raw data
        try {
          const token = localStorage.getItem("futbol_grupo_token") ?? "";
          const { getSupabase } = await import("../lib/supabase");
          const sb = getSupabase();
          const { data } = await sb.rpc("futbol_list_jugadores", { p_token: token });
          if (data) setAdmin(checkAdmin(Array.isArray(data) ? data : []));
        } catch {}
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoadingPlayers(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const chosenIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([id]) => id), [selected]);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const r = await api.balanceTeams(chosenIds.length ? chosenIds : undefined);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function saveMatch() {
    if (!result) return;
    try {
      await apiPartidos.crear(fecha, result.teamA as any, result.teamB as any);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    }
  }

  function shareWhatsApp() {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`⚽ *Fútbol Grupo — ${fecha}*`);
    lines.push("");
    lines.push("⬜ *CLAROS:*");
    result.teamA.forEach((p) => lines.push(`  • ${p.apodo} (${p.posicionPreferida})`));
    lines.push(`  _Suma: ${result.sumA.toFixed(1)}_`);
    lines.push("");
    lines.push("⬛ *OSCUROS:*");
    result.teamB.forEach((p) => lines.push(`  • ${p.apodo} (${p.posicionPreferida})`));
    lines.push(`  _Suma: ${result.sumB.toFixed(1)}_`);
    lines.push("");
    lines.push(`Diferencia: ${result.difference.toFixed(2)}`);
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    for (const p of players) next[p.id] = on;
    setSelected(next);
  }

  if (error && !players.length) return <div className="error">{error}</div>;
  if (loadingPlayers) return <p className="muted">Cargando…</p>;
  if (!players.length) return <p className="muted">No hay jugadores registrados todavía. Registrá al menos 4 para armar equipos.</p>;

  return (
    <div>
      <h1>Armar equipos</h1>
      <p className="sub">
        Seleccioná quién juega hoy. El algoritmo reparte en <strong>Claros</strong> y <strong>Oscuros</strong> lo más
        parejo posible según la nota final de cada jugador.
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="row" style={{ marginBottom: "0.75rem" }}>
          <label>Fecha del partido</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <button type="button" className="btn btn-ghost" onClick={() => toggleAll(true)}>
            Marcar todos
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => toggleAll(false)}>
            Desmarcar todos
          </button>
          <span className="muted" style={{ alignSelf: "center" }}>
            {chosenIds.length} seleccionados
          </span>
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
          {loading ? "Calculando…" : "Generar Claros vs Oscuros"}
        </button>
        {error && (
          <div className="error" style={{ marginTop: "1rem" }}>{error}</div>
        )}
      </div>

      {result && (
        <>
          <div className="team-grid">
            <div className="card team-card">
              <h3>⬜ Claros · suma {result.sumA.toFixed(2)}</h3>
              <ul>
                {result.teamA.map((x) => (
                  <li key={x.id}>
                    {x.apodo} · {x.posicionPreferida} · {x.score.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card team-card">
              <h3>⬛ Oscuros · suma {result.sumB.toFixed(2)}</h3>
              <ul>
                {result.teamB.map((x) => (
                  <li key={x.id}>
                    {x.apodo} · {x.posicionPreferida} · {x.score.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Diferencia entre equipos: {result.difference.toFixed(3)}
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <button type="button" className="btn btn-primary" onClick={shareWhatsApp}>
              📱 Compartir por WhatsApp
            </button>
            {admin && !saved && (
              <button type="button" className="btn btn-ghost" onClick={saveMatch}>
                💾 Guardar partido
              </button>
            )}
            {saved && <span className="muted" style={{ alignSelf: "center" }}>✓ Partido guardado</span>}
          </div>
        </>
      )}
    </div>
  );
}
