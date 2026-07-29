import { useMemo } from "react";
import {
  F5_DIMENSION_ORDER,
  F5_HELP,
  F5_ICONS,
  F5_LABELS,
  F5_SHORT,
} from "../dimensions-f5";
import type { F5ProfileScores } from "../types";
import StarRating from "./StarRating";

export default function F5ProfileScorePickers({
  scores,
  onChange,
  allowEmpty = false,
}: {
  scores: F5ProfileScores;
  onChange: (next: F5ProfileScores) => void;
  allowEmpty?: boolean;
}) {
  function setDim(k: keyof F5ProfileScores, v: number) {
    onChange({ ...scores, [k]: v });
  }

  const avg = useMemo(() => {
    const vals = F5_DIMENSION_ORDER.map((k) => scores[k]).filter((v) => v > 0);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [scores]);

  return (
    <div className="f5-pickers">
      <p className="muted profile-score-intro">
        Tocá las estrellas doradas (1–5). Carga ultrarrápida: solo cinco métricas.
        {allowEmpty ? " Ninguna viene marcada: elegí vos cada nota." : null}
      </p>

      <div className="f5-avg-pill" aria-live="polite">
        <span className="f5-avg-pill__label">Promedio F5</span>
        <span className="f5-avg-pill__value">{avg > 0 ? avg.toFixed(1) : "—"}</span>
      </div>

      {F5_DIMENSION_ORDER.map((dim, i) => (
        <div key={dim} className={`star-metric-row star-metric-row--tone${(i % 4) + 1}`}>
          <div className="star-metric-head">
            <span className="star-metric-title">
              <span aria-hidden>{F5_ICONS[dim]}</span> {F5_LABELS[dim]}
            </span>
            <span className="muted star-metric-short">{F5_SHORT[dim]}</span>
            <details className="f5-help-details">
              <summary className="f5-help-summary" aria-label={`Qué significa: ${F5_LABELS[dim]}`}>
                ?
              </summary>
              <p className="f5-help-body">{F5_HELP[dim]}</p>
            </details>
          </div>
          <StarRating
            value={scores[dim]}
            min={allowEmpty ? 0 : 1}
            onChange={(v) => setDim(dim, v)}
            aria-label={`${F5_LABELS[dim]}`}
          />
        </div>
      ))}
    </div>
  );
}
