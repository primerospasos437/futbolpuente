import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import F5ProfileScorePickers from "./F5ProfileScorePickers";
import ProfileScoreSliders from "./ProfileScoreSliders";
import type { MatchResult } from "../lib/mundialito";
import {
  emptyPersonalMatchInput,
  skillFamilyForFormato,
  type PersonalMatchInput,
} from "../lib/personalMatches";
import { FUTBOL_FORMATOS, type FutbolFormato } from "../lib/personalCalendar";
import { defaultF5Scores } from "../dimensions-f5";
import { defaultScores } from "../dimensions";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (input: PersonalMatchInput) => void;
  /** Prefill: marcar el switch de Mundialito al abrir desde ese panel. */
  defaultMundialito?: boolean;
  /** Prefill formato (ej. desde recordatorio de calendario). */
  defaultTipo?: FutbolFormato;
};

/**
 * Modal FUT: carga de partido + autoevaluación por formato (F5/F7/F8 vs F9/F11).
 */
export default function CargarPartidoModal({
  open,
  onClose,
  onSave,
  defaultMundialito = false,
  defaultTipo = "F5",
}: Props) {
  const titleId = useId();
  const [form, setForm] = useState<PersonalMatchInput>(() =>
    emptyPersonalMatchInput(defaultMundialito, defaultTipo),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyPersonalMatchInput(defaultMundialito, defaultTipo));
    setError(null);
  }, [open, defaultMundialito, defaultTipo]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const family = skillFamilyForFormato(form.tipo);

  function setTipo(tipo: FutbolFormato) {
    const nextFamily = skillFamilyForFormato(tipo);
    setForm((p) => ({
      ...p,
      tipo,
      skillsF5: nextFamily === "f5" ? p.skillsF5 ?? defaultF5Scores() : undefined,
      skillsF11: nextFamily === "f11" ? p.skillsF11 ?? defaultScores() : undefined,
    }));
  }

  function setNum(key: "goles" | "asistencias" | "quites" | "atajadas", raw: string) {
    const n = Math.max(0, Math.min(99, Number(raw.replace(/\D/g, "")) || 0));
    setForm((prev) => ({ ...prev, [key]: n }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (family === "f5" && !form.skillsF5) {
      setError("Completá las 5 métricas del partido.");
      return;
    }
    if (family === "f11" && !form.skillsF11) {
      setError("Completá las características del partido.");
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

  return createPortal(
    <div className="psb-match-modal psb-cal-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="psb-match-modal__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="psb-match-modal__panel">
        <div className="psb-match-modal__head">
          <h2 id={titleId}>➕ Cargar nuevo partido</h2>
          <button type="button" className="psb-sport-modal__close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="psb-match-modal__sub">
          Autoevaluá todas las características según el formato. F5/F7/F8 usan métricas chicas · F9/F11 las de once.
        </p>

        <form className="psb-match-form" onSubmit={submit}>
          <fieldset className="psb-match-fieldset">
            <legend>Tipo de fútbol</legend>
            <div className="psb-tipo-toggle psb-tipo-toggle--5" role="group" aria-label="Tipo de partido">
              {FUTBOL_FORMATOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`psb-tipo-btn${form.tipo === t ? " is-active" : ""}`}
                  aria-pressed={form.tipo === t}
                  onClick={() => setTipo(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="muted" style={{ margin: "0.45rem 0 0", fontSize: "0.78rem" }}>
              {family === "f5"
                ? "Métricas F5: pulmón, pegada, pase, quite, compromiso."
                : "Métricas F11: técnico, táctico, físico y psico (18 ítems)."}
            </p>
          </fieldset>

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

          <fieldset className="psb-match-fieldset">
            <legend>Rendimiento del partido ({family === "f5" ? "formato chico" : "formato grande"})</legend>
            <div className="psb-match-skills">
              {family === "f5" && form.skillsF5 ? (
                <F5ProfileScorePickers
                  scores={form.skillsF5}
                  onChange={(skillsF5) => setForm((p) => ({ ...p, skillsF5 }))}
                />
              ) : null}
              {family === "f11" && form.skillsF11 ? (
                <ProfileScoreSliders
                  scores={form.skillsF11}
                  onChange={(skillsF11) => setForm((p) => ({ ...p, skillsF11 }))}
                />
              ) : null}
            </div>
          </fieldset>

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
    </div>,
    document.body,
  );
}
