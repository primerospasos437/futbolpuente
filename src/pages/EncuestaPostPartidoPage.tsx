import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiEncuesta } from "../api";
import { FootballStrip, PageCheer } from "../components/FunDecor";
import {
  ENCUESTA_CATEGORIAS,
  ENCUESTA_META,
  type EncuestaCategoria,
  type EncuestaDificultad,
  type EncuestaPartidoPayload,
  type EncuestaVotosPayload,
} from "../lib/encuestaPostPartido";
import { TEAM_LABEL_CLAROS, TEAM_LABEL_OSCUROS } from "../lib/teamsBalance";

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  if (!y || !m || !d) return fecha;
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function EncuestaPostPartidoPage() {
  const { partidoId } = useParams<{ partidoId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<EncuestaPartidoPayload | null>(null);
  const [votes, setVotes] = useState<Partial<Record<EncuestaCategoria, string>>>({});
  const [dificultad, setDificultad] = useState<EncuestaDificultad | "">("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!partidoId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await apiEncuesta.partido(partidoId);
        if (cancelled) return;
        setData(payload);
        if (payload.yaVoto) {
          setVotes(payload.misVotos);
          setDificultad(payload.miDificultad ?? "");
        }
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

  const completo = useMemo(
    () => ENCUESTA_CATEGORIAS.every((c) => Boolean(votes[c])) && (dificultad === "parejo" || dificultad === "disparejo"),
    [votes, dificultad],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!partidoId || !completo || data?.yaVoto || (dificultad !== "parejo" && dificultad !== "disparejo")) return;
    setBusy(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        ENCUESTA_CATEGORIAS.map((c) => [c, votes[c]!]),
      ) as EncuestaVotosPayload;
      await apiEncuesta.votar(partidoId, payload, dificultad);
      setOk(true);
      setData((prev) =>
        prev ? { ...prev, yaVoto: true, misVotos: votes, miDificultad: dificultad } : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Cargando encuesta…</p>;
  if (!partidoId) return <div className="error">Partido inválido.</div>;
  if (error && !data) {
    return (
      <div className="page-shell">
        <div className="error">{error}</div>
        <Link to="/" className="btn btn-ghost" style={{ marginTop: "1rem", display: "inline-flex" }}>
          Volver
        </Link>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="page-shell">
      <PageCheer quote="Scaloneta awards: votá con onda." icon="🏆" />
      <FootballStrip items={["🏆", "🐐", "🛡️", "🫁", "🧤", "⚽"]} />
      <header className="page-hero">
        <h1>🏆 Encuesta post-partido</h1>
        <p className="sub">
          {formatFecha(data.fecha)}
          {data.hora ? ` · ${data.hora} hs` : ""} · {data.golesClaros}–{data.golesOscuros}
        </p>
      </header>

      {error ? <div className="error">{error}</div> : null}
      {ok || data.yaVoto ? (
        <div className="card card--ok" style={{ marginBottom: "1rem" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>
            {ok ? "✅ ¡Votos enviados! Gracias, campeón." : "✅ Ya votaste en este partido."}
          </p>
        </div>
      ) : null}

      <form className="card encuesta-card" onSubmit={(e) => void onSubmit(e)}>
        <p className="muted" style={{ marginTop: 0 }}>
          Elegí un jugador por trofeo y si el partido fue parejo o disparejo. Solo figuran quienes jugaron. Una sola
          votación por encuentro.
        </p>

        {ENCUESTA_CATEGORIAS.map((cat) => {
          const meta = ENCUESTA_META[cat];
          return (
            <div className="row encuesta-row" key={cat}>
              <label htmlFor={`encuesta-${cat}`}>
                <span className="encuesta-label">
                  {meta.emoji} {meta.titulo}
                </span>
                <span className="encuesta-sub muted">{meta.subtitulo}</span>
              </label>
              <select
                id={`encuesta-${cat}`}
                value={votes[cat] ?? ""}
                disabled={data.yaVoto || busy}
                onChange={(e) => setVotes((prev) => ({ ...prev, [cat]: e.target.value }))}
                required
              >
                <option value="">— Elegí —</option>
                {data.candidatos.map((c) => (
                  <option key={`${cat}-${c.id}`} value={c.id}>
                    {c.apodo} · {c.equipo === "claros" ? TEAM_LABEL_CLAROS : TEAM_LABEL_OSCUROS}
                  </option>
                ))}
              </select>
            </div>
          );
        })}

        <div className="row encuesta-row">
          <label htmlFor="encuesta-dificultad">
            <span className="encuesta-label">⚖️ ¿Cómo se vivió el partido?</span>
            <span className="encuesta-sub muted">
              Parejo o disparejo — sirve para mejorar el armado de equipos más adelante
            </span>
          </label>
          <select
            id="encuesta-dificultad"
            value={dificultad}
            disabled={data.yaVoto || busy}
            onChange={(e) => setDificultad(e.target.value as EncuestaDificultad | "")}
            required
          >
            <option value="">— Elegí —</option>
            <option value="parejo">Parejo (muy pareja la cosa)</option>
            <option value="disparejo">Disparejo (un lado se impuso)</option>
          </select>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
          {!data.yaVoto ? (
            <button type="submit" className="btn btn-primary" disabled={busy || !completo}>
              {busy ? "Enviando…" : "Enviar votos"}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/")}>
            Volver a jugadores
          </button>
          <Link to="/stats" className="btn btn-ghost">
            Ver Stats
          </Link>
        </div>
      </form>
    </div>
  );
}
