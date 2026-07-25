import { DIMENSION_LABELS, DIMENSION_SECTIONS } from "../dimensions";
import type { ProfileScores } from "../types";
import StarRating from "./StarRating";

const SECTION_ICON: Record<string, string> = {
  tecnico: "⚽",
  tactico: "🧠",
  fisico: "💨",
  psico: "❤️",
};

export default function ProfileScoreSliders({
  scores,
  onChange,
}: {
  scores: ProfileScores;
  onChange: (next: ProfileScores) => void;
}) {
  return (
    <>
      <p className="muted profile-score-intro">
        Tocá las estrellas doradas (1–5) en cada ítem. Cada bloque tiene su color para ubicarte más fácil.
      </p>
      {DIMENSION_SECTIONS.map((sec) => (
        <section key={sec.id} className={`profile-section profile-section--${sec.id}`}>
          <h3 className="profile-section-title">
            <span className="profile-section-icon" aria-hidden>
              {SECTION_ICON[sec.id] ?? "⚽"}
            </span>{" "}
            {sec.title}
          </h3>
          <p className="profile-section-desc">{sec.description}</p>
          <div className="dim-grid dim-grid--stars">
            {sec.keys.map((key, i) => (
              <div key={key} className={`star-metric-row star-metric-row--tone${(i % 4) + 1}`}>
                <label className="star-metric-title">{DIMENSION_LABELS[key]}</label>
                <StarRating
                  value={scores[key]}
                  onChange={(v) =>
                    onChange({
                      ...scores,
                      [key]: v,
                    })
                  }
                  aria-label={DIMENSION_LABELS[key]}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
