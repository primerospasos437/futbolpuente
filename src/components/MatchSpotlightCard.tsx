import type { ReactNode } from "react";
import type { PartidoJugadorNombre } from "../lib/partidoEquipos";
import { difficultyLabel, type MatchDifficulty } from "../lib/partidoStats";
import { TEAM_LABEL_CLAROS, TEAM_LABEL_OSCUROS } from "../lib/teamsBalance";

export type SpotlightPlayerExtra = {
  posicionLabel?: string;
  /** Más reciente primero (máx. 3). */
  lastResults?: Array<{ letter: "G" | "E" | "P"; score?: string }>;
};

type Props = {
  fecha: string;
  hora?: string | null;
  claros: PartidoJugadorNombre[];
  oscuros: PartidoJugadorNombre[];
  golesClaros?: number | null;
  golesOscuros?: number | null;
  mvpApodo?: string | null;
  dificultad?: MatchDifficulty | null;
  miEquipo?: "claros" | "oscuros" | null;
  title?: string;
  showScore?: boolean;
  playerExtras?: Record<string, SpotlightPlayerExtra>;
  /** Acciones bajo la tarjeta (ej. darse de baja). */
  footer?: ReactNode;
};

function formatFechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  if (!y || !m || !d) return fecha;
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function winnerLabel(golesClaros?: number | null, golesOscuros?: number | null): string | null {
  if (golesClaros == null || golesOscuros == null) return null;
  if (golesClaros === golesOscuros) return "EMPATE";
  return golesClaros > golesOscuros ? TEAM_LABEL_CLAROS.toUpperCase() : TEAM_LABEL_OSCUROS.toUpperCase();
}

function initials(apodo: string): string {
  const parts = apodo.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return apodo.slice(0, 2).toUpperCase();
}

function PlayerRow({
  player,
  extra,
}: {
  player: PartidoJugadorNombre;
  extra?: SpotlightPlayerExtra;
}) {
  const results = (extra?.lastResults ?? []).slice(0, 3);
  const hasResults = results.length > 0;

  return (
    <li className="match-spotlight__player">
      <div className="match-spotlight__player-left">
        <span className="match-spotlight__avatar" aria-hidden>
          {initials(player.apodo)}
        </span>
        <div className="match-spotlight__name-row">
          <span className="match-spotlight__name">{player.apodo}</span>
          {extra?.posicionLabel ? (
            <span className="match-spotlight__pos">{extra.posicionLabel}</span>
          ) : null}
        </div>
      </div>
      <div className="match-spotlight__form">
        <span className="match-spotlight__form-label">Últimos 3</span>
        {hasResults ? (
          <div className="match-spotlight__form-grid" aria-label="Últimos 3 partidos">
            {results.map((r, i) => (
              <span
                key={`${r.letter}-${i}`}
                className={`match-spotlight__ball match-spotlight__ball--${r.letter.toLowerCase()}`}
                title={r.letter === "G" ? "Ganado" : r.letter === "E" ? "Empatado" : "Perdido"}
              >
                <span className="match-spotlight__ball-emoji" aria-hidden>
                  ⚽
                </span>
                <strong>{r.letter}</strong>
              </span>
            ))}
            {Array.from({ length: Math.max(0, 3 - results.length) }).map((_, i) => (
              <span key={`empty-${i}`} className="match-spotlight__ball match-spotlight__ball--empty" aria-hidden>
                —
              </span>
            ))}
          </div>
        ) : (
          <span className="match-spotlight__form-empty">Sin partidos</span>
        )}
      </div>
    </li>
  );
}

function TeamColumn({
  label,
  players,
  tone,
  mine,
  playerExtras,
}: {
  label: string;
  players: PartidoJugadorNombre[];
  tone: "claros" | "oscuros";
  mine: boolean;
  playerExtras?: Record<string, SpotlightPlayerExtra>;
}) {
  return (
    <div className={`match-spotlight__team match-spotlight__team--${tone}${mine ? " match-spotlight__team--mine" : ""}`}>
      <p className="match-spotlight__team-label">
        {label}
        {mine ? <span className="match-spotlight__mine-tag"> · tu equipo</span> : null}
      </p>
      <ul className="match-spotlight__roster">
        {players.length === 0 ? (
          <li className="match-spotlight__player match-spotlight__player--empty">Sin jugadores</li>
        ) : (
          players.map((j) => <PlayerRow key={j.id} player={j} extra={playerExtras?.[j.id]} />)
        )}
      </ul>
    </div>
  );
}

export default function MatchSpotlightCard({
  fecha,
  hora,
  claros,
  oscuros,
  golesClaros,
  golesOscuros,
  mvpApodo,
  dificultad,
  miEquipo,
  title = "Partido del día",
  showScore = true,
  playerExtras,
  footer,
}: Props) {
  const winner = winnerLabel(golesClaros, golesOscuros);
  const hasScore = golesClaros != null && golesOscuros != null;

  return (
    <article className="match-spotlight">
      <div className="match-spotlight__head">
        <div className="match-spotlight__meta">
          <p className="match-spotlight__kicker">{title}</p>
          <p className="match-spotlight__fecha">
            <span aria-hidden>📅</span> {formatFechaCorta(fecha)}
            {hora ? ` · ${hora} hs` : ""}
          </p>
          {showScore && hasScore ? (
            <p className="match-spotlight__scoreline">
              <span className="c">{TEAM_LABEL_CLAROS}</span> {golesClaros} – {golesOscuros}{" "}
              <span className="o">{TEAM_LABEL_OSCUROS}</span>
            </p>
          ) : null}
          {winner ? (
            <p className="match-spotlight__winner">
              <span aria-hidden>⭐</span> Ganador: <strong>{winner}</strong>
            </p>
          ) : null}
          {dificultad ? (
            <span className={`match-spotlight__diff match-spotlight__diff--${dificultad}`}>
              {difficultyLabel(dificultad)}
            </span>
          ) : null}
        </div>
        {mvpApodo ? (
          <div className="match-spotlight__mvp">
            <span className="match-spotlight__mvp-badge">MVP</span>
            <span className="match-spotlight__mvp-avatar" aria-hidden>
              {initials(mvpApodo)}
            </span>
            <strong>{mvpApodo}</strong>
          </div>
        ) : null}
      </div>

      <div className="match-spotlight__vs-grid">
        <TeamColumn
          label={TEAM_LABEL_CLAROS}
          players={claros}
          tone="claros"
          mine={miEquipo === "claros"}
          playerExtras={playerExtras}
        />
        <div className="match-spotlight__vs" aria-hidden>
          VS
        </div>
        <TeamColumn
          label={TEAM_LABEL_OSCUROS}
          players={oscuros}
          tone="oscuros"
          mine={miEquipo === "oscuros"}
          playerExtras={playerExtras}
        />
      </div>

      {footer ? <div className="match-spotlight__footer">{footer}</div> : null}
    </article>
  );
}
