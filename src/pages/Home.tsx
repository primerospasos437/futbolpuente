import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiEncuesta, apiPartidos } from "../api";
import { Users, Trophy, Check } from "lucide-react";
import { formatRating } from "../lib/formatRating";
import type { EncuestaPendiente } from "../lib/encuestaPostPartido";
import { buildPlayerListSnippets, type PlayerListSnippet } from "../lib/partidoStats";
import { personAvatarUrl } from "../lib/avatarImage";
import type { PlayerSummary, PlayersListPayload } from "../types";

const posLabel: Record<string, string> = {
  portero: "ARQ",
  defensa: "DEF",
  medio: "MED",
  delantero: "DEL",
};

const ROW_TONES = ["green", "blue", "red", "lilac", "yellow"] as const;
type RowTone = (typeof ROW_TONES)[number];

function ProfileBadge({ label, done, to }: { label: string; done: boolean; to: string }) {
  if (done) {
    return (
      <Link
        to={to}
        className="pb-badge pb-badge--done"
        title={`${label}: perfil completo`}
        aria-label={`${label} completo`}
      >
        <Check size={11} strokeWidth={3} />
        {label}
      </Link>
    );
  }
  return (
    <Link
      to={to}
      className="pb-badge pb-badge--pending"
      title={`Falta completar ${label}`}
      aria-label={`Completar ${label}`}
    >
      {label}
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
    <div className={`player-card player-card--tone-${tone}${p.isSelf ? " player-card--self" : ""}`}>
      <div className="player-card-inner">
        <img
          className={`pc-avatar pc-avatar--${tone}`}
          src={personAvatarUrl(p.id)}
          alt={p.apodo}
          loading="lazy"
        />
        {/* Izquierda: nombre + posición + estado de perfil */}
        <div className="pc-left">
          <Link to={`/jugador/${p.id}`} className="p-name-link">
            <span className="p-name">
              {p.apodo}
              {p.isSelf ? <span className="muted pc-self-tag">(vos)</span> : null}
            </span>
          </Link>
          <span className="pc-pos">{posLabel[p.posicionPreferida] ?? p.posicionPreferida}</span>
          {!p.isSelf ? (
            <div className="pc-badges">
              <ProfileBadge label="F11" done={p.ratedByMe} to={`/jugador/${p.id}#perfil-completo-valoracion`} />
              <ProfileBadge label="F5" done={p.ratedF5PerfilByMe} to={`/jugador/${p.id}#f5-valoracion`} />
            </div>
          ) : (
            <Link to="/mis-perfiles" className="pr-self-link">Mis perfiles</Link>
          )}
        </div>

        {/* Centro: últimos 3 (solo G/E/P) */}
        <div className="pc-form">
          <span className="pc-form__title">Últimos 3</span>
          <div className="pc-form__dots">
            {hasMatches && snippet ? (
              snippet.lastChips.slice(0, 3).map((c, i) => (
                <span
                  key={`${c.letter}-${i}`}
                  className={`pc-form-dot pc-form-dot--${c.letter.toLowerCase()}`}
                >
                  {c.letter}
                </span>
              ))
            ) : (
              <span className="muted pc-form-empty">—</span>
            )}
          </div>
        </div>

        {/* Derecha: promedios grandes */}
        <Link to={`/jugador/${p.id}`} className="pc-scores">
          <span className="pc-score pc-score--f11">
            <em>{formatRating(p.finalScore)}</em>
            <small>F11</small>
          </span>
          <span className="pc-score pc-score--f5">
            <em>{formatRating(p.f5FinalScore)}</em>
            <small>F5</small>
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
      <header className="page-hero">
        <img className="page-hero__decor" src="/decor/side-ball-neon.png" alt="" aria-hidden="true" />
        <h1><Users size={24} className="neon-icon" /> Jugadores</h1>
        <p className="sub">
          Las insignias verdes <strong>F11</strong> / <strong>F5</strong> indican que ya valoraste a ese jugador. Tocalas para valorar.
        </p>
      </header>

      {encuestaPendientes.length > 0 ? (
        <div className="card card--purple home-alert encuesta-banner" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}><Trophy size={16} className="neon-icon" /> Votación pendiente</h2>
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
