import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import F5ProfileScorePickers from "../components/F5ProfileScorePickers";
import ProfileScoreSliders from "../components/ProfileScoreSliders";
import { defaultF5ScoresZeros } from "../dimensions-f5";
import { defaultScoresZeros } from "../dimensions";
import { parseGuestShareToken, submitGuestRating } from "../lib/guestRateShare";
import type { F5ProfileScores, ProfileScores } from "../types";
import "../dashboard.css";
import "../landing.css";

/**
 * Página pública (sin login): un desconocido califica al jugador vía link/QR.
 */
export default function ValorarInvitadoPage() {
  const { token = "" } = useParams();
  const share = useMemo(() => parseGuestShareToken(token), [token]);
  const [f5, setF5] = useState<F5ProfileScores>(() => defaultF5ScoresZeros());
  const [f11, setF11] = useState<ProfileScores>(() => defaultScoresZeros());
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = share
      ? `Calificá a ${share.apodo} · PlaySportBridge`
      : "PlaySportBridge · Calificar";
  }, [share]);

  if (!share) {
    return (
      <div className="psb-landing" style={{ minHeight: "100vh", padding: "2rem 1rem" }}>
        <div className="page-shell" style={{ maxWidth: 520, margin: "0 auto" }}>
          <h1>Link inválido</h1>
          <p className="muted">Este enlace de calificación no es válido o expiró.</p>
          <Link to="/" className="btn btn-primary">
            Conocer PlaySportBridge
          </Link>
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const scores = share!.formato === "f5" ? f5 : f11;
    const vals = Object.values(scores);
    if (vals.some((v) => !v || v < 1)) {
      setError("Completá todas las estrellas (1 a 5).");
      return;
    }
    setSaving(true);
    try {
      const res = await submitGuestRating({
        share: share!,
        scores,
        autorNombre: nombre,
      });
      setWarning(res.warning ?? null);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="psb-landing" style={{ minHeight: "100vh", padding: "2rem 1rem" }}>
        <div className="page-shell" style={{ maxWidth: 520, margin: "0 auto" }}>
          <h1>¡Gracias!</h1>
          <p>
            Tu calificación para <strong>{share.apodo}</strong> quedó registrada.
          </p>
          {warning ? <p className="muted">{warning}</p> : null}
          <p className="muted">PlaySportBridge — tu puente al deporte.</p>
          <Link to="/" className="btn btn-primary">
            Conocer la app
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="psb-landing" style={{ minHeight: "100vh", padding: "1.25rem 1rem 2.5rem" }}>
      <div className="page-shell" style={{ maxWidth: 640, margin: "0 auto" }}>
        <p className="psb-guest-brand">PLAYSPORTBRIDGE</p>
        <h1 style={{ marginTop: "0.35rem" }}>Calificá a {share.apodo}</h1>
        <p className="sub">
          No hace falta cuenta. Ayudalo con tu nota de{" "}
          <strong>{share.formato === "f5" ? "F5 / F7 / F8" : "F9 / F11"}</strong> para su historial.
        </p>

        <form onSubmit={onSubmit} className="psb-guest-rate-form">
          <label className="psb-cal-field">
            <span>Tu nombre (opcional)</span>
            <input
              type="text"
              value={nombre}
              maxLength={40}
              placeholder="Ej: Juan del predio"
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>

          {share.formato === "f5" ? (
            <F5ProfileScorePickers scores={f5} onChange={setF5} allowEmpty />
          ) : (
            <ProfileScoreSliders scores={f11} onChange={setF11} allowEmpty />
          )}

          {error ? <div className="error">{error}</div> : null}

          <button type="submit" className="psb-match-save" disabled={saving}>
            {saving ? "Enviando…" : "Enviar calificación"}
          </button>
        </form>
      </div>
    </div>
  );
}
