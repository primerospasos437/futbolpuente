import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiEncuesta, apiPartidos } from "../api";
import { FootballStrip, PageCheer } from "../components/FunDecor";
import { formatRating } from "../lib/formatRating";
import type { EncuestaPendiente } from "../lib/encuestaPostPartido";
import { buildPlayerListSnippets, type PlayerListSnippet } from "../lib/partidoStats";
import type { PlayerSummary, PlayersListPayload } from "../types";

const posLabel: Record<string, string> = {
  portero: "ARQ",
  defensa: "DEF",
  medio: "MED",
  delantero: "DEL",
};

const ROW_TONES = ["green", "blue", "red", "lilac", "yellow"] as const;
type RowTone = (typeof ROW_TONES)[number];

function RateBadge({
  label,
  done,
  to,
}: {
  label: string;
  done: boolean;
  to: string;
}) {
  const short = label === "F11" ? "11" : "5";
  return (
    <Link
      to={to}
      className={`rate-ball ${done ? "rate-ball--ok" : "rate-ball--miss"}`}
      title={done ? `${label}: ya valoraste` : `${label}: tocar para valorar`}
      aria-label={done ? `${label} valorado` : `Valorar ${label}`}
    >
      <span className="rate-ball-emoji" aria-hidden>
        ⚽
      </span>
      <span className="rate-ball-num">{short}</span>
    </Link>
  );
}

function PlayerRow({
  p,
  tone,
  snippet,
}: {
  p: PlayerSummary;
  tone: RowTone;
  snippet?: PlayerListSnippet;
}) {
  const pj = snippet ? snippet.wins + snippet.draws + snippet.losses : 0;
  const hasMatches = pj > 0;

  return (
    <div className={`player-row player-row--tone-${tone}${p.isSelf ? " player-row--self" : ""}`}>
      <div className="player-row-grid">
        <div className="pr-col pr-col--id">
          <Link to={`/jugador/${p.id}`} className="p-name-link">
            <span className="p-name">
              {p.apodo}
              {p.isSelf ? (
                <span className="muted" style={{ marginLeft: 6, fontWeight: 500, fontSize: "0.8em" }}>
                  (vos)
                </span>
              ) : null}
            </span>
          </Link>
          {!p.isSelf ? (
            <div className="profile-badge-row">
              <RateBadge
                label="F11"
                done={p.ratedByMe}
                to={`/jugador/${p.id}#perfil-completo-valoracion`}
              />
              <RateBadge label="F5" done={p.ratedF5PerfilByMe} to={`/jugador/${p.id}#f5-valoracion`} />
            </div>
          ) : (
            <Link to="/mis-perfiles" className="pr-self-link">
              Mis perfiles
            </Link>
          )}
        </div>

        <div className="pr-col pr-col--pos">
          <span className="pr-col-label">Posición</span>
          <span className="pr-pos-badge">{posLabel[p.posicionPreferida] ?? p.posicionPreferida}</span>
        </div>

        <div className="pr-col pr-col--form">
          <span className="pr-col-label">Últimos</span>
          {hasMatches && snippet ? (
            <div className="pr-form-chips">
              {snippet.lastChips.map((c, i) => (
                <span
                  key={`${c.letter}-${c.score}-${i}`}
                  className={`pr-form-chip pr-form-chip--${c.letter.toLowerCase()}`}
                  title={c.letter === "G" ? "Ganó" : c.letter === "P" ? "Perdió" : "Empató"}
                >
                  <strong>{c.letter}</strong>
                  <span>{c.score}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="pr-empty muted">Sin partidos</span>
          )}
        </div>

        <div className="pr-col pr-col--record">
          <span className="pr-col-label">Balance</span>
          {hasMatches && snippet ? (
            <div className="pr-record">
              <span className="pr-record-item pr-record-item--g">
                <em>{snippet.wins}</em> G
              </span>
              <span className="pr-record-item pr-record-item--e">
                <em>{snippet.draws}</em> E
              </span>
              <span className="pr-record-item pr-record-item--p">
                <em>{snippet.losses}</em> P
              </span>
            </div>
          ) : (
            <span className="pr-empty muted">—</span>
          )}
          {snippet?.frequentMate ? (
            <span className="pr-mate muted" title={`Jugó ${snippet.frequentMateCount} veces juntos`}>
              c/ {snippet.frequentMate} ×{snippet.frequentMateCount}
            </span>
          ) : null}
        </div>

        <Link to={`/jugador/${p.id}`} className="pr-col pr-col--scores">
          <span className="score-pill score-pill--f11" title="Nota final F11">
            F11 {formatRating(p.finalScore)}
          </span>
          <span className="score-pill score-pill--f5" title="Nota final F5">
            F5 {formatRating(p.f5FinalScore)}
          </span>
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [data, setData] = useState<PlayersListPayload | null>(null);
  const [snippets, setSnippets] = useState<Map<string, PlayerListSnippet>>(new Map());
  const [f5Pendientes, setF5Pendientes] = useState<{ partidoId: string; fecha: string; companeros: { id: string; apodo: string }[] }[]>(
    [],
  );
  const [encuestaPendientes, setEncuestaPendientes] = useState<EncuestaPendiente[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [payload, partidos, presencias] = await Promise.all([
          api.players(),
          apiPartidos.list().catch(() => []),
          apiPartidos.listPresencias().catch(() => []),
        ]);
        if (cancelled) return;
        setData(payload);
        const apodoById = new Map(payload.jugadores.map((p) => [p.id, p.apodo]));
        setSnippets(buildPlayerListSnippets(partidos, presencias, apodoById));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
      void api
        .pendientesValoracionF5Partidos()
        .then((pend) => {
          if (cancelled) return;
          setF5Pendientes(
            pend.map((x) => ({
              partidoId: x.partido.id,
              fecha: x.partido.fecha,
              companeros: x.companeros,
            })),
          );
        })
        .catch(() => {
          /* opcional */
        });
      void apiEncuesta
        .pendientes()
        .then((pend) => {
          if (!cancelled) setEncuestaPendientes(pend);
        })
        .catch(() => {
          /* opcional hasta aplicar migración 38 */
        });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const list = data?.jugadores ?? [];
  const otros = useMemo(() => list.filter((p) => !p.isSelf), [list]);
  const f5Hechos = otros.filter((p) => p.ratedF5PerfilByMe).length;
  const f11Hechos = otros.filter((p) => p.ratedByMe).length;

  if (error) return <div className="error">{error}</div>;
  if (!data) return <p className="muted">Cargando jugadores…</p>;

  return (
    <div className="page-shell">
      <PageCheer quote="Calificá con onda: el grupo se mide entre todos." icon="⚽" />
      <FootballStrip />
      <header className="page-hero">
        <h1>⚽ Jugadores</h1>
        <p className="sub">
          Tocá las pelotas <strong>11</strong> / <strong>5</strong> para valorar. A la derecha, notas F11 y F5 del
          grupo. En el medio: posición, últimos resultados y balance.
        </p>
      </header>

      {encuestaPendientes.length > 0 ? (
        <div className="card card--purple home-alert encuesta-banner" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>🏆 Votación pendiente</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            El partido ya tiene resultado. Elegí al Messi, Cuti, Julián y Dibu del encuentro.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.8 }}>
            {encuestaPendientes.map((b) => (
              <li key={b.partidoId}>
                <Link to={`/partido/${b.partidoId}/encuesta`}>
                  Tenés una votación pendiente del partido <strong>{b.fecha}</strong>
                  {b.hora ? ` · ${b.hora} hs` : ""} ({b.golesClaros}–{b.golesOscuros})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {f5Pendientes.length > 0 ? (
        <div className="card card--warn home-alert" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Valorar F5 del partido jugado</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Solo después de jugado (desde las 22:30 del día del partido).
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.8 }}>
            {f5Pendientes.map((b) => (
              <li key={b.partidoId}>
                <strong>{b.fecha}</strong>:{" "}
                {b.companeros.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 ? ", " : null}
                    <Link to={`/partido/${b.partidoId}/valorar-f5?para=${encodeURIComponent(c.id)}`}>{c.apodo}</Link>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {otros.length > 0 ? (
        <p className="home-progress muted">
          Tus valoraciones: F5 <strong>{f5Hechos}</strong>/{otros.length} · F11 <strong>{f11Hechos}</strong>/
          {otros.length}
        </p>
      ) : null}

      {list.length === 0 ? (
        <p className="muted">No hay jugadores registrados todavía.</p>
      ) : (
        <div className="list">
          {list.map((p, i) => (
            <PlayerRow
              key={p.id}
              p={p}
              tone={ROW_TONES[i % ROW_TONES.length]}
              snippet={snippets.get(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
