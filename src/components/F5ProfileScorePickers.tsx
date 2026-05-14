import { F5_DIMENSION_ORDER, F5_HELP, F5_LABELS, F5_SCALE_LABELS } from "../dimensions-f5";
import type { F5ProfileScores } from "../types";

export default function F5ProfileScorePickers({
  scores,
  onChange,
}: {
  scores: F5ProfileScores;
  onChange: (next: F5ProfileScores) => void;
}) {
  function setDim(k: keyof F5ProfileScores, v: number) {
    onChange({ ...scores, [k]: v });
  }

  return (
    <div className="f5-pickers">
      {F5_DIMENSION_ORDER.map((dim) => (
        <div key={dim} className="row" style={{ marginBottom: "0.85rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
            {F5_LABELS[dim]}
            <details className="f5-help-details">
              <summary className="f5-help-summary" aria-label={`Qué significa: ${F5_LABELS[dim]}`}>
                ?
              </summary>
              <p className="f5-help-body">{F5_HELP[dim]}</p>
            </details>
          </label>
          <select
            value={scores[dim]}
            onChange={(e) => setDim(dim, Number(e.target.value))}
            style={{ width: "100%", maxWidth: "320px" }}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {F5_SCALE_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
