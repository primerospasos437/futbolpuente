import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  FUTBOL_FORMATOS,
  type FutbolFormato,
  type PersonalEncuentroInput,
} from "../lib/personalCalendar";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (input: PersonalEncuentroInput) => void;
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyForm(): PersonalEncuentroInput {
  return {
    fecha: todayISO(),
    hora: "20:00",
    lugar: "",
    tipo: "F5",
    notificar: true,
    camiseta: "claros",
  };
}

/** Modal para agendar un encuentro personal (Mi Calendario). */
export default function AgendarEncuentroModal({ open, onClose, onSave }: Props) {
  const titleId = useId();
  const [form, setForm] = useState<PersonalEncuentroInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setError(null);
  }, [open]);

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fecha) {
      setError("Elegí una fecha.");
      return;
    }
    if (!form.hora) {
      setError("Elegí una hora.");
      return;
    }
    if (!form.lugar.trim()) {
      setError("Indicá el lugar o predio.");
      return;
    }
    onSave({ ...form, lugar: form.lugar.trim() });
    onClose();
  }

  return createPortal(
    <div className="psb-match-modal psb-cal-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="psb-match-modal__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="psb-match-modal__panel">
        <div className="psb-match-modal__head">
          <h2 id={titleId}>🗓️ Agendar encuentro</h2>
          <button type="button" className="psb-sport-modal__close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="psb-match-modal__sub">Tu agenda personal · sin lógica de grupos.</p>

        <form className="psb-match-form" onSubmit={submit}>
          <div className="psb-cal-form-row">
            <label className="psb-cal-field">
              <span>Fecha</span>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
              />
            </label>
            <label className="psb-cal-field">
              <span>Hora</span>
              <input
                type="time"
                required
                value={form.hora}
                onChange={(e) => setForm((p) => ({ ...p, hora: e.target.value }))}
              />
            </label>
          </div>

          <label className="psb-cal-field">
            <span>Lugar / Predio</span>
            <input
              type="text"
              required
              placeholder="Ej: Predio Norte, cancha 3"
              value={form.lugar}
              maxLength={120}
              onChange={(e) => setForm((p) => ({ ...p, lugar: e.target.value }))}
            />
          </label>

          <label className="psb-cal-field">
            <span>Tipo de fútbol</span>
            <select
              value={form.tipo}
              onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as FutbolFormato }))}
            >
              {FUTBOL_FORMATOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="psb-match-fieldset">
            <legend>Color de camiseta</legend>
            <div className="psb-camiseta-toggle" role="group" aria-label="Color de camiseta">
              <button
                type="button"
                className={`psb-camiseta-btn psb-camiseta-btn--claros${form.camiseta === "claros" ? " is-active" : ""}`}
                aria-pressed={form.camiseta === "claros"}
                onClick={() => setForm((p) => ({ ...p, camiseta: "claros" }))}
              >
                Claros
              </button>
              <button
                type="button"
                className={`psb-camiseta-btn psb-camiseta-btn--oscuros${form.camiseta === "oscuros" ? " is-active" : ""}`}
                aria-pressed={form.camiseta === "oscuros"}
                onClick={() => setForm((p) => ({ ...p, camiseta: "oscuros" }))}
              >
                Oscuros
              </button>
            </div>
          </fieldset>

          <label className={`psb-mundi-switch psb-notify-switch${form.notificar ? " is-on" : ""}`}>
            <span className="psb-mundi-switch__text">
              <strong>🔔 Activar notificación</strong>
              <span className="muted">Te avisamos después del partido para cargarlo y calificarte.</span>
            </span>
            <input
              type="checkbox"
              checked={form.notificar}
              onChange={(e) => setForm((p) => ({ ...p, notificar: e.target.checked }))}
            />
            <span className="psb-mundi-switch__track" aria-hidden>
              <span className="psb-mundi-switch__thumb" />
            </span>
          </label>

          {error ? <div className="error" style={{ marginTop: "0.5rem" }}>{error}</div> : null}

          <button type="submit" className="psb-match-save">
            Guardar en Mi Calendario
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
