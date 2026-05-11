import { useEffect, useMemo, useState } from "react";
import { api, apiPartidos, getToken, isAdmin as checkAdmin } from "../api";
import { getSupabase } from "../lib/supabase";
import type { BalanceResponse, PlayerSummary } from "../types";

interface Convocatoria {
  dia: string;
  fecha_partido: string;
  jugador_id: string;
}

function getNextMatchDate(targetDay: number): string {
  const now = new Date();
  const today = now.getDay();
  let diff = targetDay - today;
  if (diff < 0) diff += 7;
  if (diff === 0) {
    const hour = now.getHours();
    if (hour >= 21) diff = 7;
  }
  const d = new Date(now);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const DAY_MARTES = 2;
const DAY_JUEVES = 4;
const MAX_TITULARES = 10;

export default function TeamsPage() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [result, setResult] = useState<BalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedDia, setSelectedDia] = useState<"martes" | "jueves">("martes");
  const [admin, setAdmin] = useState(false);

  const fechaMartes = getNextMatchDate(DAY_MARTES);
  const fechaJueves = getNextMatchDate(DAY_JUEVES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.players();
        if (cancelled) return;
        setPlayers(Array.isArray(list) ? list : []);
        const token = getToken();
        if (token) {
          const sb = getSupabase();
          const { data: conv } = await sb.rpc("futbol_list_convocatorias", { p_token: token });
          if (!cancelled && conv) setConvocatorias(Array.isArray(conv) ? conv : []);
          const { data: jData } = await sb.rpc("futbol_list_jugadores", { p_token: token });
          if (jData) setAdmin(checkAdmin(Array.isArray(jData) ? jData : []));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoadingPlayers(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fecha = selectedDia === "martes" ? fechaMartes : fechaJueves;

  const anotadosMartes = useMemo(() =>
    convocatorias.filter((c) => c.dia === "martes" && c.fecha_partido === fechaMartes),
  [convocatorias, fechaMartes]);

  const anotadosJueves = useMemo(() =>
    convocatorias.filter((c) => c.dia === "jueves" && c.fecha_partido === fechaJueves),
  [convocatorias, fechaJueves]);

  const anotadosActual = selectedDia === "martes" ? anotadosMartes : anotadosJueves;

  const jugadoresAnotados = useMemo(() => {
    const ids = anotadosActual.map((c) => c.jugador_id);
    return players.filter((p) => ids.includes(p.id));
  }, [anotadosActual, players]);

  const titulares = jugadoresAnotados.slice(0, MAX_TITULARES);

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const ids = titulares.map((p) => p.id);
      const r = await api.balanceTeams(ids);
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
    const diaLabel = selectedDia === "martes" ? "Martes" : "Jueves";
    const lines: string[] = [];
    lines.push(`⚽ *Fútbol Puente Club — ${diaLabel} ${fecha} · 21:00 hs*`);
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
    const suplentes = jugadoresAnotados.slice(MAX_TITULARES);
    if (suplentes.length) {
      lines.push("");
      lines.push("🪑 *SUPLENTES:*");
      suplentes.forEach((p, i) => lines.push(`  S${i + 1}. ${p.apodo}`));
    }
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  if (error && !players.length) return <div className="error">{error}</div>;
  if (loadingPlayers) return <p className="muted">Cargando…</p>;
  if (!admin) return <p className="muted">Solo los administradores pueden armar equipos.</p>;

  return (
    <div>
      <h1>Armar equipos</h1>
      <p className="sub">
        Los equipos se arman con los jugadores que se anotaron. Elegí el día y generá Claros vs Oscuros.
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <button
            type="button"
            className={`btn ${selectedDia === "martes" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => { setSelectedDia("martes"); setResult(null); }}
          >
            Martes ({fechaMartes}) · {anotadosMartes.length} anotados
          </button>
          <button
            type="button"
            className={`btn ${selectedDia === "jueves" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => { setSelectedDia("jueves"); setResult(null); }}
          >
            Jueves ({fechaJueves}) · {anotadosJueves.length} anotados
          </button>
        </div>

        {jugadoresAnotados.length === 0 ? (
          <p className="muted">No hay jugadores anotados para este día todavía.</p>
        ) : (
          <>
            <h3 style={{ margin: "0 0 0.5rem" }}>
              Anotados para {selectedDia} {fecha} ({jugadoresAnotados.length})
            </h3>
            <div className="list">
              {jugadoresAnotados.map((p, i) => {
                const esTitular = i < MAX_TITULARES;
                return (
                  <div key={p.id} className="player-row" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.75rem", fontWeight: 700, color: "#fff", flexShrink: 0,
                      background: esTitular ? "var(--accent)" : "#e74c3c",
                    }}>
                      {esTitular ? i + 1 : `S${i - MAX_TITULARES + 1}`}
                    </span>
                    <span style={{ flex: 1 }}>
                      <strong>{p.apodo}</strong>{" "}
                      <span className="muted">({p.posicionPreferida}) · {p.finalScore.toFixed(2)}</span>
                    </span>
                    {!esTitular && (
                      <span style={{ fontSize: "0.8rem", color: "#e74c3c", fontWeight: 500 }}>Suplente</span>
                    )}
                  </div>
                );
              })}
            </div>

            {titulares.length >= 4 && (
              <button className="btn btn-primary" type="button" style={{ marginTop: "1rem" }} onClick={generate} disabled={loading}>
                {loading ? "Calculando…" : `Generar Claros vs Oscuros (${titulares.length} titulares)`}
              </button>
            )}
            {titulares.length < 4 && (
              <p className="muted" style={{ marginTop: "0.75rem" }}>
                Se necesitan al menos 4 titulares anotados para armar equipos.
              </p>
            )}
          </>
        )}

        {error && <div className="error" style={{ marginTop: "1rem" }}>{error}</div>}
      </div>

      {result && (
        <>
          <div className="team-grid">
            <div className="card team-card">
              <h3>⬜ Claros · suma {result.sumA.toFixed(2)}</h3>
              <ul>
                {result.teamA.map((x) => (
                  <li key={x.id}>{x.apodo} · {x.posicionPreferida} · {x.score.toFixed(2)}</li>
                ))}
              </ul>
            </div>
            <div className="card team-card">
              <h3>⬛ Oscuros · suma {result.sumB.toFixed(2)}</h3>
              <ul>
                {result.teamB.map((x) => (
                  <li key={x.id}>{x.apodo} · {x.posicionPreferida} · {x.score.toFixed(2)}</li>
                ))}
              </ul>
            </div>
          </div>

          {jugadoresAnotados.length > MAX_TITULARES && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <h3 style={{ margin: "0 0 0.5rem" }}>🪑 Suplentes</h3>
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {jugadoresAnotados.slice(MAX_TITULARES).map((p, i) => (
                  <li key={p.id}>S{i + 1}. {p.apodo} ({p.posicionPreferida})</li>
                ))}
              </ul>
            </div>
          )}

          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Diferencia entre equipos: {result.difference.toFixed(3)}
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <button type="button" className="btn btn-primary" onClick={shareWhatsApp}>
              📱 Compartir por WhatsApp
            </button>
            {!saved && (
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
