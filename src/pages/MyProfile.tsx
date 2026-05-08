import { useEffect, useState } from "react";
import { api } from "../api";
import ProfileScoreSliders from "../components/ProfileScoreSliders";
import type { Pie, PlayerSummary, Posicion, ProfileScores } from "../types";

export default function MyProfilePage() {
  const [me, setMe] = useState<PlayerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [posicion, setPosicion] = useState<Posicion>("medio");
  const [posicionAlternativa, setPosicionAlternativa] = useState<Posicion>("medio");
  const [pie, setPie] = useState<Pie>("derecho");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [contacto, setContacto] = useState("");
  const [alturaStr, setAlturaStr] = useState("");
  const [pesoStr, setPesoStr] = useState("");
  const [historialLesiones, setHistorialLesiones] = useState("");
  const [profile, setProfile] = useState<ProfileScores | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await api.me();
        if (cancelled) return;
        setMe(p);
        setNombreCompleto(p.nombreCompleto);
        setPosicion(p.posicionPreferida);
        setPosicionAlternativa(p.posicionAlternativa ?? p.posicionPreferida);
        setPie(p.pieDominante);
        setFechaNacimiento(p.ficha.fechaNacimiento ?? "");
        setContacto(p.ficha.contacto ?? "");
        setAlturaStr(p.ficha.alturaCm != null ? String(p.ficha.alturaCm) : "");
        setPesoStr(p.ficha.pesoKg != null ? String(p.ficha.pesoKg) : "");
        setHistorialLesiones(p.ficha.historialLesiones ?? "");
        setProfile({ ...p.profile });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        nombreCompleto,
        posicionPreferida: posicion,
        posicionAlternativa,
        pieDominante: pie,
        fechaNacimiento,
        contacto,
        historialLesiones,
        profile,
      };
      body.alturaCm = alturaStr.trim() === "" ? null : Number(alturaStr.replace(",", "."));
      body.pesoKg = pesoStr.trim() === "" ? null : Number(pesoStr.replace(",", "."));

      const p = await api.updateMe(body);
      setMe(p);
      setHistorialLesiones(p.ficha.historialLesiones ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (error && !me) return <div className="error">{error}</div>;
  if (!me || !profile) return <p className="muted">Cargando…</p>;

  return (
    <div>
      <h1>Mi perfil</h1>
      <p className="sub">
        @{me.apodo}. La nota final mezcla tu autopercepción (35%) con el promedio del grupo (65%). El historial de
        lesiones es privado: solo vos lo ves.
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <div className="score-pill">Final: {me.finalScore.toFixed(2)}</div>
          <div className="score-pill">Autopercepción: {me.finalBreakdown.selfAvg.toFixed(2)}</div>
          <div className="score-pill">
            Grupo: {me.finalBreakdown.peerAvg != null ? me.finalBreakdown.peerAvg.toFixed(2) : "—"}
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <form className="card" onSubmit={onSave}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Datos personales y ficha técnica</h2>
        <p className="profile-section-desc" style={{ marginTop: 0 }}>
          Datos estructurales: identificación, contacto y biotipo. Podés actualizarlos cuando cambien.
        </p>

        <div className="row">
          <label>Nombre completo</label>
          <input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} required />
        </div>

        <div className="grid2">
          <div className="row">
            <label>Posición principal</label>
            <select value={posicion} onChange={(e) => setPosicion(e.target.value as Posicion)}>
              <option value="portero">Portero</option>
              <option value="defensa">Defensa</option>
              <option value="medio">Mediocampo</option>
              <option value="delantero">Delantero</option>
            </select>
          </div>
          <div className="row">
            <label>Posición alternativa</label>
            <select
              value={posicionAlternativa}
              onChange={(e) => setPosicionAlternativa(e.target.value as Posicion)}
            >
              <option value="portero">Portero</option>
              <option value="defensa">Defensa</option>
              <option value="medio">Mediocampo</option>
              <option value="delantero">Delantero</option>
            </select>
          </div>
        </div>

        <div className="grid2">
          <div className="row">
            <label>Pie dominante</label>
            <select value={pie} onChange={(e) => setPie(e.target.value as Pie)}>
              <option value="derecho">Derecho</option>
              <option value="izquierdo">Izquierdo</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
          <div className="row">
            <label>Fecha de nacimiento</label>
            <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
          </div>
        </div>

        <div className="row">
          <label>Contacto</label>
          <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Teléfono, mail, WhatsApp…" />
        </div>

        <div className="grid2">
          <div className="row">
            <label>Altura (cm)</label>
            <input
              inputMode="decimal"
              value={alturaStr}
              onChange={(e) => setAlturaStr(e.target.value)}
              placeholder="Ej. 178"
            />
          </div>
          <div className="row">
            <label>Peso (kg)</label>
            <input
              inputMode="decimal"
              value={pesoStr}
              onChange={(e) => setPesoStr(e.target.value)}
              placeholder="Ej. 72"
            />
          </div>
        </div>

        <div className="row">
          <label>Historial de lesiones (solo vos lo ves)</label>
          <textarea
            value={historialLesiones}
            onChange={(e) => setHistorialLesiones(e.target.value)}
            placeholder="Ej.: esguince tobillo derecho 03/2024 — recuperado; molestia isquios…"
          />
        </div>

        <h2 style={{ fontSize: "1.15rem", marginTop: "1.5rem" }}>Autopercepción (1 a 10)</h2>
        <p className="profile-section-desc">
          Valorá cómo te ves en cada aspecto. Tus compañeros harán su valoración por separado desde tu perfil público.
        </p>

        <ProfileScoreSliders scores={profile} onChange={setProfile} />

        <button className="btn btn-primary" type="submit" style={{ marginTop: "1.25rem" }} disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
