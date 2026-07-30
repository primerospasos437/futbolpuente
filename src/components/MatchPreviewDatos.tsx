import type { MatchPreviewInsight } from "../lib/partidoStats";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type Props = {
  insights: MatchPreviewInsight[];
};

/**
 * Bloque "Próxima fecha · datos": tarjetas narrativas debajo del Claros vs Oscuros.
 */
export default function MatchPreviewDatos({ insights }: Props) {
  if (!insights.length) return null;

  return (
    <section className="match-preview-datos" aria-label="Próxima fecha datos">
      <header className="match-preview-datos__head">
        <h3 className="match-preview-datos__title">Próxima fecha · datos</h3>
        <p className="match-preview-datos__sub">La previa con números: rachas, enfrentamientos y duplas de este partido.</p>
      </header>
      <ol className="match-preview-datos__grid">
        {insights.map((card, i) => (
          <li
            key={card.id}
            className={`match-preview-card${card.tone ? ` match-preview-card--${card.tone}` : ""}`}
          >
            <span className="match-preview-card__num" aria-hidden>
              {i + 1}
            </span>
            <div className="match-preview-card__body">
              <p className="match-preview-card__title">
                <span aria-hidden>{card.icon}</span> {card.title}
              </p>
              <p className="match-preview-card__text">{card.body}</p>
              <div className="match-preview-card__meta">
                {card.names?.length ? (
                  <div className="match-preview-card__avatars">
                    {card.names.map((n) => (
                      <span key={n} className="match-preview-card__avatar" title={n}>
                        {initials(n)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {card.chips?.length ? (
                  <div className="match-preview-card__chips">
                    {card.chips.map((c, idx) => (
                      <span key={`${c}-${idx}`} className={`match-preview-chip match-preview-chip--${c.toLowerCase()}`}>
                        {c}
                      </span>
                    ))}
                  </div>
                ) : null}
                {card.metric ? <span className="match-preview-card__metric">{card.metric}</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
