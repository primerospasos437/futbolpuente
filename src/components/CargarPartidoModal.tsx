import { useEffect, useId, useState } from "react";
import StarRating from "./StarRating";
import type { MatchResult } from "../lib/mundialito";
import type { PersonalMatchInput, PersonalMatchTipo } from "../lib/personalMatches";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (input: PersonalMatchInput) => void;
  /** Prefill: marcar el switch de Mundialito al abrir desde ese panel. */
  defaultMundialito?: boolean;
};

const emptyForm = (mundialito: boolean): PersonalMatchInput => ({
  tipo: "f5",
  resultado: "ganamos",
  goles: 0,
  asistencias: 0,
  quites: 0,
  atajadas: 0,
  rendimiento: 3,
  esMundialito: mundialito,
});

/**
 * Modal FUT: carga de rendimiento individual + flag Mundialito.
 */
export default function CargarPartidoModal({
  open,
  onClose,
  onSave,
  defaultMundialito = false,
}: Props) {
  const titleId = useId();
  const [form, setForm] = useState<PersonalMatchInput>(() => emptyForm(defaultMundialito));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(defaultMundialito));
    setError(null);
  }, [open, defaultMundialito]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function setNum(key: "goles" | "asistencias" | "quites" | "atajadas", raw: string) {
    const n = Math.max(0, Math.min(99, Number(raw.replace(/\D/g, "")) || 0));
    setForm((prev) => ({ ...prev, [key]: n }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.rendimiento < 1 || form.rendimiento > 5) {
      setError("Elegí tu rendimiento con las estrellas (1 a 5).");
      return;
    }
    onSave(form);
    onClose();
  }

  const resultBtns: { id: MatchResult; label: string; cls: string }[] = [
    { id: "ganamos", label: "Ganamos", cls: "psb-result-btn--win" },
    { id: "empatamos", label: "Empatamos", cls: "psb-result-btn--draw" },
    { id: "perdimos", label: "Perdimos", cls: "psb-result-btn--loss" },
  ];

  return (
    <div className="psb-match-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="psb-match-modal__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="psb-match-modal__panel">
        <div className="psb-match-modal__head">
          <h2 id={titleId}>➕ Cargar nuevo partido</h2>
          <button type="button" className="psb-sport-modal__close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="psb-match-modal__sub">Registrá tu rendimiento individual. Estilo FUT · dark neón.</p>

        <form className="psb-match-form" onSubmit={submit}>
          {/* Tipo F5 / F11 */}
          <fieldset className="psb-match-fieldset">
            <legend>Tipo de partido</legend>
            <div className="psb-tipo-toggle" role="group" aria-label="Tipo de partido">
              {(["f5", "f11"] as PersonalMatchTipo[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`psb-tipo-btn${form.tipo === t ? " is-active" : ""}`}
                  aria-pressed={form.tipo === t}
                  onClick={() => setForm((p) => ({ ...p, tipo: t }))}
                >
                  {t === "f5" ? "Fútbol 5" : "Fútbol 11"}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Resultado */}
          <fieldset className="psb-match-fieldset">
            <legend>Resultado del equipo</legend>
            <div className="psb-result-grid" role="group" aria-label="Resultado">
              {resultBtns.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`psb-result-btn ${b.cls}${form.resultado === b.id ? " is-active" : ""}`}
                  aria-pressed={form.resultado === b.id}
                  onClick={() => setForm((p) => ({ ...p, resultado: b.id }))}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Stats personales */}
          <fieldset className="psb-match-fieldset">
            <legend>Estadísticas personales</legend>
            <div className="psb-stat-grid">
              {(
                [
                  ["goles", "Goles", form.goles],
                  ["asistencias", "Asistencias", form.asistencias],
                  ["quites", "Quites / Recup.", form.quites],
                  ["atajadas", "Atajadas", form.atajadas],
                ] as const
              ).map(([key, label, val]) => (
                <label key={key} className="psb-stat-field">
                  <span>{label}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    value={val}
                    onChange={(e) => setNum(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          {/* Rendimiento estrellas */}
          <fieldset className="psb-match-fieldset">
            <legend>Mi rendimiento</legend>
            <div className="psb-match-stars">
              <StarRating
                value={form.rendimiento}
                onChange={(n) => setForm((p) => ({ ...p, rendimiento: n }))}
                min={1}
                aria-label="Autoevaluación del partido"
              />
            </div>
          </fieldset>

          {/* Switch Mundialito */}
          <label className={`psb-mundi-switch${form.esMundialito ? " is-on" : ""}`}>
            <span className="psb-mundi-switch__text">
              <strong>🏆 Partido de Mundialito</strong>
              <span className="muted">Si lo activás, este resultado mueve tu torneo personal.</span>
            </span>
            <input
              type="checkbox"
              checked={form.esMundialito}
              onChange={(e) => setForm((p) => ({ ...p, esMundialito: e.target.checked }))}
            />
            <span className="psb-mundi-switch__track" aria-hidden>
              <span className="psb-mundi-switch__thumb" />
            </span>
          </label>

          {error ? <div className="error" style={{ marginTop: "0.75rem" }}>{error}</div> : null}

          <button type="submit" className="psb-match-save">
            Guardar estadísticas
          </button>
        </form>
      </div>
    </div>
  );
}
