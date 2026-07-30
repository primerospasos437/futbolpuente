import type { MatchPreviewInsight, MatchPreviewSheet, ResultLetter } from "../lib/partidoStats";
import { difficultyLabel } from "../lib/partidoStats";
import { TEAM_LABEL_CLAROS, TEAM_LABEL_OSCUROS } from "../lib/teamsBalance";
import { personAvatarUrl } from "../lib/avatarImage";

function formatFechaLarga(fecha: string, hora?: string | null): string {
  const [y, m, d] = fecha.split("-").map(Number);
  if (!y || !m || !d) return fecha;
  const label = new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  const cap = label.charAt(0).toUpperCase() + label.slice(1);
  return hora ? `${cap} · ${hora} hs` : cap;
}

function formatFechaCorta(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  if (!y || !m || !d) return fecha;
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type Player = { id: string; apodo: string };

type Props = {
  fecha: string;
  hora?: string | null;
  claros: Player[];
  oscuros: Player[];
  miEquipo?: "claros" | "oscuros" | null;
  sheet: MatchPreviewSheet;
  lastChipsById?: Record<string, ResultLetter[]>;
};

function Avatar({
  name,
  seed,
  tone,
  debut,
}: {
  name: string;
  seed: string;
  tone: "claros" | "oscuros";
  debut?: boolean;
}) {
  return (
    <div className={`previa-sheet__avatar-wrap previa-sheet__avatar-wrap--${tone}`}>
      <img
        className={`previa-sheet__avatar previa-sheet__avatar--${tone}`}
        src={personAvatarUrl(seed)}
        alt={name}
        title={name}
        loading="lazy"
      />
      <span className="previa-sheet__avatar-name">{name}</span>
      {debut ? <span className="previa-sheet__debut-badge">DEBUT</span> : null}
    </div>
  );
}

function MiniPerson({ name, tone }: { name: string; tone?: "claros" | "oscuros" }) {
  return (
    <span className="previa-card__person">
      <img
        className={`previa-card__person-avatar${tone ? ` previa-card__person-avatar--${tone}` : ""}`}
        src={personAvatarUrl(name)}
        alt={name}
        loading="lazy"
      />
      <span className="previa-card__person-name">{name}</span>
    </span>
  );
}

function InsightCard({
  card,
  index,
  toneByName,
}: {
  card: MatchPreviewInsight;
  index: number;
  toneByName: Map<string, "claros" | "oscuros">;
}) {
  const pct = card.metric?.endsWith("%") ? Number(card.metric.replace("%", "")) : null;
  const badgeText = card.id === "debuts" ? "DEBUT" : pct == null ? card.metric : undefined;
  const names = card.names ?? [];

  return (
    <li className={`previa-card${card.tone ? ` previa-card--${card.tone}` : ""}`}>
      <div className="previa-card__head">
        <span className="previa-card__num" aria-hidden>
          {index + 1}
        </span>
        <span className="previa-card__icon" aria-hidden>
          {card.icon}
        </span>
        <p className="previa-card__title">{card.title}</p>
      </div>
      <div className="previa-card__content">
        <p className="previa-card__body">{card.body}</p>
        <div className="previa-card__rail">
          {names.length ? (
            <div className="previa-card__people">
              <MiniPerson name={names[0]} tone={toneByName.get(names[0])} />
              {names.length >= 2 ? (
                <>
                  <span className="previa-card__vs" aria-hidden>
                    vs
                  </span>
                  <MiniPerson name={names[1]} tone={toneByName.get(names[1])} />
                </>
              ) : null}
            </div>
          ) : null}
          {card.chips?.length ? (
            <div className="previa-card__chips">
              {card.chips.map((c, i) => (
                <span key={`${c}-${i}`} className={`previa-chip previa-chip--${c.toLowerCase()}`}>
                  {c}
                </span>
              ))}
            </div>
          ) : null}
          {card.badges?.length ? (
            <div className="previa-card__badges">
              {card.badges.map((b) => (
                <span key={b.text} className={`previa-card__pill previa-card__pill--${b.tone}`}>
                  {b.text}
                </span>
              ))}
            </div>
          ) : null}
          {pct != null && !Number.isNaN(pct) ? (
            <div
              className="previa-card__gauge"
              style={{ background: `conic-gradient(var(--accent) ${pct * 3.6}deg, rgba(255,255,255,0.08) 0)` }}
              aria-label={`${pct}%`}
            >
              <span>{pct}%</span>
            </div>
          ) : badgeText ? (
            <span className="previa-card__badge">{badgeText}</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * Planilla visual tipo infografía «PREVIA DEL PARTIDO».
 */
export default function MatchPreviewDatos({
  fecha,
  hora,
  claros,
  oscuros,
  miEquipo,
  sheet,
}: Props) {
  const debutIds = new Set(sheet.debuts.map((d) => d.id));
  const toneByName = new Map<string, "claros" | "oscuros">();
  for (const p of claros) toneByName.set(p.apodo, "claros");
  for (const p of oscuros) toneByName.set(p.apodo, "oscuros");

  return (
    <article className="previa-sheet" aria-label="Previa del partido">
      <header className="previa-sheet__top">
        <div className="previa-sheet__brand">
          <span className="previa-sheet__logo">
            <span aria-hidden>⚽</span> Fútbol Stats <span aria-hidden>⚡</span>
          </span>
          <h1 className="previa-sheet__title">Previa del partido</h1>
          <p className="previa-sheet__when">{formatFechaLarga(fecha, hora)}</p>
        </div>
        <div className="previa-sheet__meta-box">
          <span className="previa-sheet__meta-kicker">
            <span aria-hidden>📅</span> Próximo partido
          </span>
          <strong>Fecha {sheet.temporada.fechaNumero}</strong>
          <span className="muted">de la temporada</span>
        </div>
      </header>

      <section className="previa-sheet__teams">
        <div
          className={`previa-sheet__team previa-sheet__team--claros${miEquipo === "claros" ? " previa-sheet__team--mine" : ""}`}
        >
          <h2>Equipo {TEAM_LABEL_CLAROS}</h2>
          <div className="previa-sheet__roster">
            {claros.map((p) => (
              <Avatar key={p.id} name={p.apodo} seed={p.id} tone="claros" debut={debutIds.has(p.id)} />
            ))}
          </div>
        </div>

        <div className="previa-sheet__vs" aria-hidden>
          VS
        </div>

        <div
          className={`previa-sheet__team previa-sheet__team--oscuros${miEquipo === "oscuros" ? " previa-sheet__team--mine" : ""}`}
        >
          <h2>Equipo {TEAM_LABEL_OSCUROS}</h2>
          <div className="previa-sheet__roster">
            {oscuros.map((p) => (
              <Avatar key={p.id} name={p.apodo} seed={p.id} tone="oscuros" debut={debutIds.has(p.id)} />
            ))}
          </div>
        </div>

        {sheet.debuts.length ? (
          <aside className="previa-sheet__debut-note">
            <p className="previa-sheet__debut-note-title">
              <span aria-hidden>👋</span> {sheet.debuts.length === 1 ? "Hay debut" : "Hay debutantes"}
            </p>
            <div className="previa-sheet__debut-list">
              {sheet.debuts.map((d) => (
                <span key={d.id} className={`previa-sheet__debut-pill previa-sheet__debut-pill--${d.team}`}>
                  {d.apodo}
                </span>
              ))}
            </div>
            <p className="previa-sheet__debut-note-text">
              Todavía no tienen victorias registradas. Hoy arranca el ranking de verdad.
            </p>
          </aside>
        ) : null}
      </section>

      {sheet.cards.length ? (
        <ol className="previa-sheet__grid">
          {sheet.cards.map((card, i) => (
            <InsightCard key={card.id} card={card} index={i} toneByName={toneByName} />
          ))}
        </ol>
      ) : (
        <p className="muted" style={{ textAlign: "center", margin: "1rem 0" }}>
          Todavía no hay historial suficiente para armar la previa.
        </p>
      )}

      <section className="previa-sheet__bonus">
        <h3>
          <span aria-hidden>⭐</span> Bonus de mesa
        </h3>
        <p>{sheet.bonusMesa}</p>
      </section>

      <section className="previa-sheet__mid">
        <div className="previa-sheet__serie">
          <h3>Serie de color</h3>
          <div className="previa-sheet__serie-score">
            <div className="previa-sheet__serie-side previa-sheet__serie-side--c">
              <span className="previa-sheet__jersey previa-sheet__jersey--c" aria-hidden>
                👕
              </span>
              <strong>{sheet.serie.clarosWins}</strong>
              <span>{TEAM_LABEL_CLAROS}</span>
            </div>
            <span className="previa-sheet__serie-sep">—</span>
            <div className="previa-sheet__serie-side previa-sheet__serie-side--o">
              <strong>{sheet.serie.oscurosWins}</strong>
              <span>{TEAM_LABEL_OSCUROS}</span>
              <span className="previa-sheet__jersey previa-sheet__jersey--o" aria-hidden>
                👕
              </span>
            </div>
          </div>
          {sheet.serie.empates ? (
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", textAlign: "center" }}>
              {sheet.serie.empates} empate{sheet.serie.empates === 1 ? "" : "s"} · {sheet.serie.total}{" "}
              partidos
            </p>
          ) : (
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", textAlign: "center" }}>
              {sheet.serie.total} partidos con resultado
            </p>
          )}
        </div>

        <div className={`previa-sheet__favor previa-sheet__favor--${sheet.factores.side}`}>
          <h3>{sheet.factores.label}</h3>
          {sheet.factores.items.length ? (
            <ul>
              {sheet.factores.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Todavía no hay factores claros.
            </p>
          )}
        </div>
      </section>

      <footer className="previa-sheet__foot">
        {sheet.ultimo ? (
          <div className="previa-sheet__foot-card">
            <h4>
              <span aria-hidden>🕑</span> Último partido
            </h4>
            <p className="previa-sheet__foot-score">
              <span className="c">{TEAM_LABEL_CLAROS}</span> {sheet.ultimo.golesClaros}–
              {sheet.ultimo.golesOscuros} <span className="o">{TEAM_LABEL_OSCUROS}</span>
            </p>
            <span className={`previa-sheet__diff previa-sheet__diff--${sheet.ultimo.dificultad}`}>
              {difficultyLabel(sheet.ultimo.dificultad)}
            </span>
            <p className="previa-sheet__foot-line">
              <span className="c">C:</span> {sheet.ultimo.claros.join(", ") || "—"}
            </p>
            <p className="previa-sheet__foot-line">
              <span className="o">O:</span> {sheet.ultimo.oscuros.join(", ") || "—"}
            </p>
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.72rem" }}>
              {formatFechaCorta(sheet.ultimo.fecha)}
            </p>
          </div>
        ) : null}

        <div className="previa-sheet__foot-card">
          <h4>
            <span aria-hidden>📆</span> Próxima cita
          </h4>
          <p className="previa-sheet__foot-big">{formatFechaLarga(fecha, hora)}</p>
          <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8rem" }}>
            Cancha de siempre
          </p>
        </div>

        <div className="previa-sheet__foot-card">
          <h4>
            <span aria-hidden>🏆</span> Temporada
          </h4>
          <p className="previa-sheet__foot-big">{sheet.temporada.partidos} partidos</p>
          {sheet.temporada.inicio ? (
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.8rem" }}>
              Arranque: {formatFechaCorta(sheet.temporada.inicio)}
            </p>
          ) : null}
        </div>

        <div className="previa-sheet__foot-card previa-sheet__foot-card--brand">
          <div className="previa-sheet__stars" aria-hidden>
            ⭐⭐⭐
          </div>
          <div className="previa-sheet__shield" aria-hidden>
            🛡️
          </div>
          <p className="previa-sheet__motto">La verdad no miente</p>
        </div>
      </footer>

      <p className="previa-sheet__quote">
        <span aria-hidden>⚽</span> No es solo ganar, es hacerlo con <em>estilo</em>. <span aria-hidden>⚽</span>
      </p>
    </article>
  );
}
