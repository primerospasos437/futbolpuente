import { useEffect, useState } from "react";
import { api } from "../api";
import { formatRating } from "../lib/formatRating";
import ProfileScoreSliders from "../components/ProfileScoreSliders";
import F5ProfileScorePickers from "../components/F5ProfileScorePickers";
import { normalizeProfileF5ScoresRpc } from "../lib/futbolRegistration";
import type { F5ProfileScores, ModalidadPreferida, Pie, PlayerSummary, Posicion, ProfileScores } from "../types";

type TabId = "datos" | "f11" | "f5";

const TABS: { id: TabId; label: string; short: string }[] = [
  { id: "datos", label: "Datos personales", short: "Datos" },
  { id: "f11", label: "Autopercepción Fútbol 11", short: "Fútbol 11" },
  { id: "f5", label: "Autopercepción Fútbol 5", short: "Fútbol 5" },
];

export default function MisPerfilesPage() {
  const [tab, setTab] = useState<TabId>("datos");
  const [me, setMe] = useState<PlayerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
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
  const [savingTab, setSavingTab] = useState<TabId | null>(null);

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

  function applyMe(p: PlayerSummary) {
    setMe(p);
    setHistorialLesiones(p.ficha.historialLesiones ?? "");
    setProfile({ ...p.profile });
    setF5({ ...p.f5Profile });
    setModalidad(p.modalidadPreferida ?? "ambas");
  }

  async function onSaveDatos(e: React.FormEvent) {
    e.preventDefault();
    setSavingTab("datos");
    setError(null);
    setOkMsg(null);
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
      };
      body.alturaCm = alturaStr.trim() === "" ? null : Number(alturaStr.replace(",", "."));
      body.pesoKg = pesoStr.trim() === "" ? null : Number(pesoStr.replace(",", "."));

      const p = await api.updateMe(body);
      applyMe(p);
      setOkMsg("Datos personales guardados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingTab(null);
    }
  }

  async function onSaveF11(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingTab("f11");
    setError(null);
    setOkMsg(null);
    try {
      const p = await api.updateMe({ profile });
      applyMe(p);
      setOkMsg("Autopercepción Fútbol 11 guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingTab(null);
    }
  }

  async function onSaveF5(e: React.FormEvent) {
    e.preventDefault();
    if (!f5) return;
    setSavingTab("f5");
    setError(null);
    setOkMsg(null);
    try {
      const profileF5 = normalizeProfileF5ScoresRpc(f5);
      const p = await api.updateMe({ profileF5 });
      applyMe(p);
      setOkMsg("Autopercepción Fútbol 5 guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingTab(null);
    }
  }

  if (error && !me) return <div className="error">{error}</div>;
  if (!me || !profile || !f5) return <p className="muted">Cargando…</p>;

  return (
    <div className="page-shell mis-perfiles-page">
      <header className="page-hero">
        <h1>Mis perfiles</h1>
        <p className="sub">
          @{me.apodo}. Completá cada pestaña por separado: datos de ficha, autopercepción F11 y F5. El historial de
          lesiones es privado.
        </p>
      </header>

      {(!me.perfilCompletoCargado || !me.perfilF5Cargado) && (
        <p className="muted mis-perfiles-hint">
          {me.modalidadPreferida === "f5"
            ? "Priorizá la pestaña Fútbol 5 según tu modalidad. "
            : me.modalidadPreferida === "f11"
              ? "Priorizá Autopercepción Fútbol 11. "
              : "Completá ambas autopercepciones (Fútbol 11 y Fútbol 5). "}
          Hasta que guardes cada autopercepción por primera vez, las notas se muestran en <strong>0</strong>. Para
          anotarte en «Próximos partidos» también necesitás haber valorado el perfil completo de al menos 4 compañeros.
        </p>
      )}

      <div className="card card--ok mis-perfiles-scores">
        <div className="profile-hero-score">
          <div className="score-pill">F11 · final {formatRating(me.finalScore)}</div>
          {me.f5FinalScore != null ? (
            <div className="score-pill">F5 · final {formatRating(me.f5FinalScore)}</div>
          ) : (
            <div className="score-pill muted">F5 · sin datos de grupo aún</div>
          )}
        </div>
      </div>

      <div className="tabs mis-perfiles-tabs" role="tablist" aria-label="Secciones de Mis perfiles">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={`btn btn-ghost ${tab === t.id ? "active" : ""}`}
            onClick={() => {
              setTab(t.id);
              setOkMsg(null);
            }}
          >
            <span className="mis-perfiles-tab-full">{t.label}</span>
            <span className="mis-perfiles-tab-short">{t.short}</span>
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}
      {okMsg && <p className="muted mis-perfiles-ok">{okMsg}</p>}

      {tab === "datos" ? (
        <form
          className="card mis-perfiles-panel"
          id="panel-datos"
          role="tabpanel"
          aria-labelledby="tab-datos"
          onSubmit={onSaveDatos}
        >
          <h2 className="mis-perfiles-panel-title">Datos personales y ficha</h2>
          <p className="profile-section-desc">
            Datos biotipológicos e identificación: nombre, contacto, posiciones, pie, medidas e historial.
          </p>

          <div className="grid2">
            <div className="row">
              <label htmlFor="mp-nombre">Nombre completo</label>
              <input
                id="mp-nombre"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                required
              />
            </div>
            <div className="row">
              <label htmlFor="mp-contacto">Contacto</label>
              <input
                id="mp-contacto"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="Teléfono, mail, WhatsApp…"
              />
            </div>
          </div>

          <div className="grid3">
            <div className="row">
              <label htmlFor="mp-pos">Posición principal</label>
              <select id="mp-pos" value={posicion} onChange={(e) => setPosicion(e.target.value as Posicion)}>
                <option value="portero">Portero</option>
                <option value="defensa">Defensa</option>
                <option value="medio">Mediocampo</option>
                <option value="delantero">Delantero</option>
              </select>
            </div>
            <div className="row">
              <label htmlFor="mp-pos-alt">Posición alternativa</label>
              <select
                id="mp-pos-alt"
                value={posicionAlternativa}
                onChange={(e) => setPosicionAlternativa(e.target.value as Posicion)}
              >
                <option value="portero">Portero</option>
                <option value="defensa">Defensa</option>
                <option value="medio">Mediocampo</option>
                <option value="delantero">Delantero</option>
              </select>
            </div>
            <div className="row">
              <label htmlFor="mp-pie">Pie dominante</label>
              <select id="mp-pie" value={pie} onChange={(e) => setPie(e.target.value as Pie)}>
                <option value="derecho">Derecho</option>
                <option value="izquierdo">Izquierdo</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
          </div>

          <div className="grid3">
            <div className="row">
              <label htmlFor="mp-modalidad">Modalidad preferida</label>
              <select
                id="mp-modalidad"
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as ModalidadPreferida)}
              >
                <option value="ambas">Fútbol 5 y Fútbol 11</option>
                <option value="f5">Fútbol 5</option>
                <option value="f11">Fútbol 11</option>
              </select>
            </div>
            <div className="row">
              <label htmlFor="mp-nac">Fecha de nacimiento</label>
              <input
                id="mp-nac"
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
              />
            </div>
            <div className="row">
              <label htmlFor="mp-altura">Altura (cm)</label>
              <input
                id="mp-altura"
                inputMode="decimal"
                value={alturaStr}
                onChange={(e) => setAlturaStr(e.target.value)}
                placeholder="Ej. 178"
              />
            </div>
          </div>

          <div className="grid2">
            <div className="row">
              <label htmlFor="mp-peso">Peso (kg)</label>
              <input
                id="mp-peso"
                inputMode="decimal"
                value={pesoStr}
                onChange={(e) => setPesoStr(e.target.value)}
                placeholder="Ej. 72"
              />
            </div>
          </div>

          <div className="row">
            <label htmlFor="mp-lesiones">Historial de lesiones (solo vos lo ves)</label>
            <textarea
              id="mp-lesiones"
              value={historialLesiones}
              onChange={(e) => setHistorialLesiones(e.target.value)}
              placeholder="Ej.: esguince tobillo derecho 03/2024 — recuperado; molestia isquios…"
              rows={4}
            />
          </div>

          <div className="mis-perfiles-actions">
            <button className="btn btn-primary" type="submit" disabled={savingTab !== null}>
              {savingTab === "datos" ? "Guardando…" : "Guardar datos personales"}
            </button>
          </div>
        </form>
      ) : null}

      {tab === "f11" ? (
        <form
          className="card mis-perfiles-panel"
          id="panel-f11"
          role="tabpanel"
          aria-labelledby="tab-f11"
          onSubmit={onSaveF11}
        >
          <h2 className="mis-perfiles-panel-title">Autopercepción Fútbol 11</h2>
          <p className="profile-section-desc">
            Valorá cómo te ves en cada aspecto (1 a 5 estrellas). Tus compañeros valoran por separado desde tu perfil
            público.
          </p>

          <ProfileScoreSliders scores={profile} onChange={setProfile} />

          <div className="mis-perfiles-actions">
            <button className="btn btn-primary" type="submit" disabled={savingTab !== null}>
              {savingTab === "f11" ? "Guardando…" : "Guardar autopercepción F11"}
            </button>
          </div>
        </form>
      ) : null}

      {tab === "f5" ? (
        <form
          className="card mis-perfiles-panel"
          id="panel-f5"
          role="tabpanel"
          aria-labelledby="tab-f5"
          onSubmit={onSaveF5}
        >
          <h2 className="mis-perfiles-panel-title">Autopercepción Fútbol 5</h2>
          <p className="profile-section-desc">
            Escala: malo, regular, bueno, muy bueno, excelente. El «?» muestra la descripción de cada característica. Si te
            autopercibís «excelente» en alguna dimensión, el promedio final da más peso a la mirada del grupo.
          </p>

          <F5ProfileScorePickers scores={f5} onChange={setF5} />

          <div className="mis-perfiles-actions">
            <button className="btn btn-primary" type="submit" disabled={savingTab !== null}>
              {savingTab === "f5" ? "Guardando…" : "Guardar autopercepción F5"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
