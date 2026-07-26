import { useEffect, useState } from "react";
import { api } from "../api";
import { FootballStrip, PageCheer } from "../components/FunDecor";
import { formatRating } from "../lib/formatRating";
import ProfileScoreSliders from "../components/ProfileScoreSliders";
import F5ProfileScorePickers from "../components/F5ProfileScorePickers";
import { normalizeProfileF5ScoresRpc } from "../lib/futbolRegistration";
import type { F5ProfileScores, ModalidadPreferida, Pie, PlayerSummary, Posicion, ProfileScores } from "../types";

type TabId = "completo" | "f5";

export default function MisPerfilesPage() {
  const [tab, setTab] = useState<TabId>("completo");
  const [me, setMe] = useState<PlayerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [posicion, setPosicion] = useState<Posicion>("medio");
  const [posicionAlternativa, setPosicionAlternativa] = useState<Posicion>("medio");
  const [pie, setPie] = useState<Pie>("derecho");
  const [modalidad, setModalidad] = useState<ModalidadPreferida>("ambas");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [contacto, setContacto] = useState("");
  const [alturaStr, setAlturaStr] = useState("");
  const [pesoStr, setPesoStr] = useState("");
  const [historialLesiones, setHistorialLesiones] = useState("");
  const [profile, setProfile] = useState<ProfileScores | null>(null);
  const [f5, setF5] = useState<F5ProfileScores | null>(null);
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
        setModalidad(p.modalidadPreferida ?? "ambas");
        setFechaNacimiento(p.ficha.fechaNacimiento ?? "");
        setContacto(p.ficha.contacto ?? "");
        setAlturaStr(p.ficha.alturaCm != null ? String(p.ficha.alturaCm) : "");
        setPesoStr(p.ficha.pesoKg != null ? String(p.ficha.pesoKg) : "");
        setHistorialLesiones(p.ficha.historialLesiones ?? "");
        setProfile({ ...p.profile });
        setF5({ ...p.f5Profile });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSaveCompleto(e: React.FormEvent) {
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
        modalidadPreferida: modalidad,
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
      setProfile({ ...p.profile });
      setF5({ ...p.f5Profile });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveF5(e: React.FormEvent) {
    e.preventDefault();
    if (!f5) return;
    setSaving(true);
    setError(null);
    try {
      const profileF5 = normalizeProfileF5ScoresRpc(f5);
      const p = await api.updateMe({ profileF5 });
      setMe(p);
      setF5({ ...p.f5Profile });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (error && !me) return <div className="error">{error}</div>;
  if (!me || !profile || !f5) return <p className="muted">Cargando…</p>;

  return (
    <div className="page-shell">
      <PageCheer quote="Tu ficha, tus estrellas, tu estilo." icon="🌟" />
      <FootballStrip items={["🌟", "⚽", "🧠", "💨", "❤️", "⭐"]} />
      <header className="page-hero">
        <h1>🌟 Mis perfiles</h1>
        <p className="sub">
          @{me.apodo}. Elegí tu modalidad (F5 / F11) y completá las solapas con estrellas 1–5. El historial de lesiones es
          privado.
        </p>
      </header>

      {(!me.perfilCompletoCargado || !me.perfilF5Cargado) && (
        <p className="muted" style={{ marginBottom: "1rem" }}>
          {me.modalidadPreferida === "f5"
            ? "Priorizá la solapa F5 según tu modalidad. "
            : me.modalidadPreferida === "f11"
              ? "Priorizá el perfil completo (orientado a Fútbol 11). "
              : "Completá ambas solapas (Fútbol 11 y Fútbol 5). "}
          Hasta que guardes cada solapa por primera vez, las notas se muestran en <strong>0</strong>. Para anotarte en
          «Próximos partidos» también necesitás haber valorado el perfil completo de al menos 4 compañeros.
        </p>
      )}

      <div className="tabs" style={{ marginBottom: "1.25rem" }}>
        <button
          type="button"
          className={`btn btn-ghost ${tab === "completo" ? "active" : ""}`}
          onClick={() => setTab("completo")}
        >
          Perfil completo (F11)
        </button>
        <button type="button" className={`btn btn-ghost ${tab === "f5" ? "active" : ""}`} onClick={() => setTab("f5")}>
          Fútbol 5
        </button>
      </div>

      <div className="card card--ok" style={{ marginBottom: "1rem" }}>
        <div className="profile-hero-score">
          <div className="score-pill">Completo · final {formatRating(me.finalScore)}</div>
          {me.f5FinalScore != null ? (
            <div className="score-pill">F5 · final {formatRating(me.f5FinalScore)}</div>
          ) : (
            <div className="score-pill muted">F5 · sin datos de grupo aún</div>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {tab === "completo" ? (
        <form className="card" onSubmit={onSaveCompleto}>
          <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Datos personales y ficha técnica</h2>
          <p className="profile-section-desc" style={{ marginTop: 0 }}>
            Datos estructurales: identificación, contacto y biotipo.
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
              <label>Modalidad preferida</label>
              <select value={modalidad} onChange={(e) => setModalidad(e.target.value as ModalidadPreferida)}>
                <option value="ambas">Fútbol 5 y Fútbol 11</option>
                <option value="f5">Fútbol 5</option>
                <option value="f11">Fútbol 11</option>
              </select>
            </div>
          </div>

          <div className="grid2">
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
            Valorá cómo te ves en cada aspecto. Tus compañeros valoran por separado desde tu perfil público.
          </p>

          <ProfileScoreSliders scores={profile} onChange={setProfile} />

          <button className="btn btn-primary" type="submit" style={{ marginTop: "1.25rem" }} disabled={saving}>
            {saving ? "Guardando…" : "Guardar perfil completo"}
          </button>
        </form>
      ) : (
        <form className="card" onSubmit={onSaveF5}>
          <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Perfil F5 (1 a 5)</h2>
          <p className="profile-section-desc">
            Escala: malo, regular, bueno, muy bueno, excelente. El ícono «?» muestra la descripción de cada característica.
            Si te autopercibís «excelente» en alguna dimensión, el promedio final da mucho más peso a la mirada del grupo.
          </p>
          <F5ProfileScorePickers scores={f5} onChange={setF5} />
          <button className="btn btn-primary" type="submit" style={{ marginTop: "1.25rem" }} disabled={saving}>
            {saving ? "Guardando…" : "Guardar perfil F5"}
          </button>
        </form>
      )}
    </div>
  );
}
