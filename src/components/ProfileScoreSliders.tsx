import { DIMENSION_LABELS, DIMENSION_SECTIONS } from "../dimensions";
import type { ProfileScores } from "../types";

export default function ProfileScoreSliders({
  scores,
  onChange,
}: {
  scores: ProfileScores;
  onChange: (next: ProfileScores) => void;
}) {
  return (
    <>
      {DIMENSION_SECTIONS.map((sec) => (
        <section key={sec.id} className="profile-section">
          <h3 className="profile-section-title">{sec.title}</h3>
          <p className="profile-section-desc">{sec.description}</p>
          <div className="dim-grid">
            {sec.keys.map((key) => (
              <div key={key} className="dim-field">
                <label>{DIMENSION_LABELS[key]}</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={scores[key]}
                  onChange={(e) =>
                    onChange({
                      ...scores,
                      [key]: Number(e.target.value),
                    })
                  }
                />
                <div className="muted dim-value">{scores[key]}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
