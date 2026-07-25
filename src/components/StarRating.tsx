import { F5_SCALE_LABELS } from "../dimensions-f5";

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** Si true, no permite 0 (mínimo 1). */
  min?: 0 | 1;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
};

/**
 * Selector rápido 1–5 estrellas (tap).
 * value 0 = sin elegir (solo si min=0).
 */
export default function StarRating({
  value,
  onChange,
  min = 1,
  disabled = false,
  id,
  "aria-label": ariaLabel = "Calificación",
}: Props) {
  const shown = value >= 1 && value <= 5 ? value : 0;
  const label = shown > 0 ? F5_SCALE_LABELS[shown] : "Elegí una nota";

  return (
    <div className="star-rating" id={id}>
      <div className="star-rating-row" role="group" aria-label={ariaLabel}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = shown >= n;
          return (
            <button
              key={n}
              type="button"
              className={`star-btn ${filled ? "star-btn--on" : ""}`}
              disabled={disabled}
              aria-label={`${n} estrella${n > 1 ? "s" : ""}${filled ? " (seleccionado)" : ""}`}
              aria-pressed={shown === n}
              onClick={() => onChange(min === 0 && shown === n ? 0 : n)}
            >
              {filled ? "★" : "☆"}
            </button>
          );
        })}
      </div>
      <span className="star-rating-label muted">{label}</span>
    </div>
  );
}
