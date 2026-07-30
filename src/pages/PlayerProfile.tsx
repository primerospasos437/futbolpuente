import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { formatRating } from "../lib/formatRating";
import { personAvatarUrl } from "../lib/avatarImage";
import F5ProfileScorePickers from "../components/F5ProfileScorePickers";
import ProfileImprovementSummary from "../components/ProfileImprovementSummary";
import ProfileScoreSliders from "../components/ProfileScoreSliders";
import { DIMENSION_LABELS, DIMENSION_ORDER, DIMENSION_SECTIONS, defaultScoresZeros } from "../dimensions";
import { F5_DIMENSION_ORDER, F5_ICONS, F5_LABELS, F5_SECTIONS, defaultF5ScoresZeros } from "../dimensions-f5";
import type { F5Dimension, F5ProfileScores, PlayerDetail, Posicion, ProfileScores } from "../types";
import "../profile-dashboard.css";

const SECTION_ICON: Record<string, string> = {
  tecnico: "⚽",
  tactico: "🧠",
  fisico: "💨",
  psico: "❤️",
};

const POSICION_LABEL: Record<Posicion, string> = {
  portero: "Arquero",
  defensa: "Defensa",
  medio: "Mediocampista",
  delantero: "Delantero",
};

const MODALIDAD_LABEL: Record<string, string> = {
  f5: "Fútbol 5",
  f11: "Fútbol 11",
  ambas: "Fútbol 5 y 11",
};

function DimBarSection<K extends string>({
  title,
  description,
  icon,
  tone,
  keys,
  values,
  labels,
  iconByKey,
}: {
  title: string;
  description?: string;
  icon?: string;
  tone: "tecnico" | "tactico" | "fisico" | "psico" | "peer" | "cycle";
  keys: K[];
  values: Partial<Record<K, number | null | undefined>>;
  labels: Record<K, string>;
  iconByKey?: Partial<Record<K, string>>;
}) {
  return (
    <div className="pd-dim-section">
      <h3 className="pd-dim-section__title">
        {icon ? <span aria-hidden>{icon}</span> : null} {title}
      </h3>
      {description ? <p className="pd-dim-section__desc">{description}</p> : null}
      <div className="pd-dim-grid">
        {keys.map((k, i) => {
          const raw = values[k];
          const v = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
          const pct = v == null ? 0 : Math.max(0, Math.min(100, (v / 5) * 100));
          const rowTone = tone === "cycle" ? `tone${(i % 5) + 1}` : tone;
          return (
            <div key={k} className={`pd-dim-row pd-dim-row--${rowTone}`}>
              <div className="pd-dim-row__head">
                <span className="pd-dim-row__label">
                  {iconByKey?.[k] ? <span aria-hidden>{iconByKey[k]} </span> : null}
                  {labels[k]}
                </span>
                <span className="pd-dim-row__value">{v == null ? "—" : formatRating(v)}</span>
              </div>
              <div className="pd-dim-row__track">
                <div className="pd-dim-row__fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PlayerProfilePage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<PlayerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<ProfileScores | null>(null);
  const [f5Scores, setF5Scores] = useState<F5ProfileScores | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingF5, setSavingF5] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgF5, setMsgF5] = useState<string | null>(null);
  const [valoracionTab, setValoracionTab] = useState<"completo" | "f5">("completo");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await api.player(id);
        if (cancelled) return;
        setData(p);
        setScores(p.myRating?.scores ?? defaultScoresZeros());
        setF5Scores(p.myF5PerfilRating?.scores ?? defaultF5ScoresZeros());
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (location.hash === "#f5-valoracion") setValoracionTab("f5");
    else if (location.hash === "#perfil-completo-valoracion") setValoracionTab("completo");
  }, [id, location.hash]);

  const canRate = useMemo(() => data && !data.isSelf, [data]);

  const valoracionFormVisible = useMemo(
    () => location.hash === "#f5-valoracion" || location.hash === "#perfil-completo-valoracion",
    [location.hash],
  );

  useLayoutEffect(() => {
    if (!canRate || !valoracionFormVisible) return;
    requestAnimationFrame(() => {
      document.getElementById("valoracion-formulario")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [canRate, valoracionFormVisible, id]);

  function setValoracionTabNav(t: "completo" | "f5") {
    setValoracionTab(t);
    const hash = t === "f5" ? "f5-valoracion" : "perfil-completo-valoracion";
    navigate({ pathname: location.pathname, hash }, { replace: true });
    requestAnimationFrame(() => {
      document.getElementById("valoracion-formulario")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const showDetalleGrupo = Boolean(data && (data.isSelf || data.viewerIsAdmin));
  const showAutopercepcionAjenaAdmin = Boolean(data && !data.isSelf && data.viewerIsAdmin);

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !scores || !canRate) return;
    const incomplete = DIMENSION_ORDER.some((k) => !scores[k] || scores[k] < 1);
    if (incomplete) {
      setMsg("Marcá las estrellas en cada ítem (nada debe quedar vacío).");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api.ratePlayer(id, scores);
      const p = await api.player(id);
      setData(p);
      setScores(p.myRating?.scores ?? defaultScoresZeros());
      setMsg("Valoración guardada.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function submitF5Perfil(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !f5Scores || !canRate) return;
    const incomplete = F5_DIMENSION_ORDER.some((k) => !f5Scores[k] || f5Scores[k] < 1);
    if (incomplete) {
      setMsgF5("Marcá las estrellas en cada métrica F5 (nada debe quedar vacío).");
      return;
    }
    setSavingF5(true);
    setMsgF5(null);
    try {
      await api.ratePlayerF5Perfil(id, f5Scores);
      const p = await api.player(id);
      setData(p);
      setF5Scores(p.myF5PerfilRating?.scores ?? defaultF5ScoresZeros());
      setMsgF5("Valoración F5 guardada.");
    } catch (err) {
      setMsgF5(err instanceof Error ? err.message : "Error");
    } finally {
      setSavingF5(false);
    }
  }

  if (error) return <div className="error">{error}</div>;
  if (!data || !scores || !f5Scores) return <p className="muted">Cargando perfil…</p>;

  const { ficha } = data;
  const altPeso =
    ficha.alturaCm != null || ficha.pesoKg != null
      ? `${ficha.alturaCm != null ? `${ficha.alturaCm} cm` : "—"} · ${ficha.pesoKg != null ? `${ficha.pesoKg} kg` : "—"}`
      : null;

  const f5PeerN = data.f5FinalBreakdown?.peerCount ?? 0;
  const f5IconByKey = F5_ICONS as Partial<Record<F5Dimension, string>>;

  return (
    <div className="profile-dash">
      <div className="profile-float">
        <Link className="pd-back" to="/">
          ← Volver al listado
        </Link>

        <div className="pd-hero">
          <img className="pd-hero__avatar" src={personAvatarUrl(data.id)} alt={data.apodo} loading="lazy" />
          <div className="pd-hero__info">
            <h1 className="pd-hero__name">{data.apodo}</h1>
            <p className="pd-hero__meta">
              <strong>{data.nombreCompleto}</strong> · {POSICION_LABEL[data.posicionPreferida]}
              {ficha.posicionAlternativa && ficha.posicionAlternativa !== data.posicionPreferida
                ? ` / ${POSICION_LABEL[ficha.posicionAlternativa]}`
                : ""}{" "}
              · Pie {data.pieDominante}
            </p>
          </div>
        </div>

        <div className="pd-kpis">
          <div className="pd-kpi pd-kpi--gold">
            <span className="pd-kpi__icon" aria-hidden>⚽</span>
            <p className="pd-kpi__label">Final F11</p>
            <p className="pd-kpi__value">{formatRating(data.finalScore)}</p>
          </div>
          {data.f5FinalScore != null ? (
            <div className="pd-kpi pd-kpi--blue">
              <span className="pd-kpi__icon" aria-hidden>🏐</span>
              <p className="pd-kpi__label">Final F5</p>
              <p className="pd-kpi__value">{formatRating(data.f5FinalScore)}</p>
            </div>
          ) : null}
          {data.isSelf ? (
            <>
              <div className="pd-kpi pd-kpi--neutral">
                <span className="pd-kpi__icon" aria-hidden>🪞</span>
                <p className="pd-kpi__label">Autopercepción</p>
                <p className="pd-kpi__value">{formatRating(data.finalBreakdown.selfAvg)}</p>
              </div>
              <div className="pd-kpi pd-kpi--green">
                <span className="pd-kpi__icon" aria-hidden>👥</span>
                <p className="pd-kpi__label">Grupo (F11)</p>
                <p className="pd-kpi__value">{formatRating(data.finalBreakdown.peerAvg)}</p>
                <p className="pd-kpi__sub">{data.peerCount} votos</p>
              </div>
              {data.f5FinalBreakdown ? (
                <div className="pd-kpi pd-kpi--purple">
                  <span className="pd-kpi__icon" aria-hidden>👥</span>
                  <p className="pd-kpi__label">Grupo (F5)</p>
                  <p className="pd-kpi__value">{formatRating(data.f5FinalBreakdown.peerAvg)}</p>
                  <p className="pd-kpi__sub">{data.f5FinalBreakdown.peerCount} votos</p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="pd-panel">
          <h2 className="pd-panel__title">
            <span aria-hidden>🪪</span> Ficha técnica y contacto
          </h2>
          <div className="pd-info-grid">
            <div className="pd-info-item">
              <span className="pd-info-item__icon" aria-hidden>⚽</span>
              <div>
                <span className="pd-info-item__label">Posición principal</span>
                <p className="pd-info-item__value">{POSICION_LABEL[data.posicionPreferida]}</p>
              </div>
            </div>
            <div className="pd-info-item">
              <span className="pd-info-item__icon" aria-hidden>🔄</span>
              <div>
                <span className="pd-info-item__label">Posición alternativa</span>
                <p className="pd-info-item__value">
                  {POSICION_LABEL[ficha.posicionAlternativa ?? data.posicionPreferida]}
                </p>
              </div>
            </div>
            <div className="pd-info-item">
              <span className="pd-info-item__icon" aria-hidden>🦶</span>
              <div>
                <span className="pd-info-item__label">Pie dominante</span>
                <p className="pd-info-item__value" style={{ textTransform: "capitalize" }}>{data.pieDominante}</p>
              </div>
            </div>
            <div className="pd-info-item">
              <span className="pd-info-item__icon" aria-hidden>🏟️</span>
              <div>
                <span className="pd-info-item__label">Modalidad preferida</span>
                <p className="pd-info-item__value">{MODALIDAD_LABEL[data.modalidadPreferida] ?? data.modalidadPreferida}</p>
              </div>
            </div>
            <div className={`pd-info-item${ficha.fechaNacimiento ? "" : " pd-info-item--empty"}`}>
              <span className="pd-info-item__icon" aria-hidden>🎂</span>
              <div>
                <span className="pd-info-item__label">Fecha de nacimiento</span>
                <p className="pd-info-item__value">{ficha.fechaNacimiento || "No cargada"}</p>
              </div>
            </div>
            <div className={`pd-info-item${ficha.contacto ? "" : " pd-info-item--empty"}`}>
              <span className="pd-info-item__icon" aria-hidden>☎️</span>
              <div>
                <span className="pd-info-item__label">Contacto</span>
                <p className="pd-info-item__value">{ficha.contacto || "Sin cargar"}</p>
              </div>
            </div>
            <div className={`pd-info-item${altPeso ? "" : " pd-info-item--empty"}`}>
              <span className="pd-info-item__icon" aria-hidden>📏</span>
              <div>
                <span className="pd-info-item__label">Biotipo (altura · peso)</span>
                <p className="pd-info-item__value">{altPeso || "No cargado"}</p>
              </div>
            </div>
          </div>
          {data.isSelf && (
            <p className="muted" style={{ marginBottom: 0, marginTop: "0.85rem" }}>
              Historial de lesiones y más datos los editás en «Mis perfiles».
            </p>
          )}
        </div>

        {data.isSelf && ficha.historialLesiones ? (
          <div className="pd-panel pd-panel--private">
            <h2 className="pd-panel__title">
              <span aria-hidden>🩹</span> Historial de lesiones (privado)
            </h2>
            <p style={{ whiteSpace: "pre-wrap", margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
              {ficha.historialLesiones}
            </p>
          </div>
        ) : null}

        {data.isSelf ? (
          <div className="pd-panel">
            <h2 className="pd-panel__title">
              <span aria-hidden>🪞</span> Tu autopercepción (perfil completo)
            </h2>
            {DIMENSION_SECTIONS.map((sec) => (
              <DimBarSection
                key={sec.id}
                title={sec.title}
                description={sec.description}
                icon={SECTION_ICON[sec.id]}
                tone={sec.id as "tecnico" | "tactico" | "fisico" | "psico"}
                keys={sec.keys}
                values={data.profile}
                labels={DIMENSION_LABELS}
              />
            ))}
          </div>
        ) : null}

        {showAutopercepcionAjenaAdmin ? (
          <div className="pd-panel">
            <h2 className="pd-panel__title">
              <span aria-hidden>🕵️</span> Autopercepción de {data.apodo} (solo administrador)
            </h2>
            {DIMENSION_SECTIONS.map((sec) => (
              <DimBarSection
                key={`adm-${sec.id}`}
                title={sec.title}
                description={sec.description}
                icon={SECTION_ICON[sec.id]}
                tone={sec.id as "tecnico" | "tactico" | "fisico" | "psico"}
                keys={sec.keys}
                values={data.profile}
                labels={DIMENSION_LABELS}
              />
            ))}
          </div>
        ) : null}

        {!showDetalleGrupo && data.peerCount > 0 ? (
          <div className="pd-panel">
            <h2 className="pd-panel__title">
              <span aria-hidden>👀</span> Mirada del grupo (perfil completo)
            </h2>
            <p className="pd-panel__hint" style={{ marginBottom: "0.6rem" }}>
              Solo se muestra el promedio agregado. El detalle por característica lo ven el jugador y los administradores.
            </p>
            <p className="pd-agg-score">
              <span className="pd-agg-score__value">{formatRating(data.finalBreakdown.peerAvg)}</span>
              <span className="pd-agg-score__n">({data.peerCount} valoraciones)</span>
            </p>
          </div>
        ) : null}

        {showDetalleGrupo && data.peerCount > 0 ? (
          <div className="pd-panel">
            <h2 className="pd-panel__title">
              <span aria-hidden>👥</span> Promedio del grupo por bloque
            </h2>
            {DIMENSION_SECTIONS.map((sec) => (
              <DimBarSection
                key={`peer-${sec.id}`}
                title={sec.title}
                description="Promedio de las valoraciones recibidas."
                icon={SECTION_ICON[sec.id]}
                tone={sec.id as "tecnico" | "tactico" | "fisico" | "psico"}
                keys={sec.keys}
                values={data.peerByDimension}
                labels={DIMENSION_LABELS}
              />
            ))}
          </div>
        ) : null}

        {canRate ? (
          <div className="pd-panel pd-panel--cta" id="valoracion-sobre-jugador">
            <h2 className="pd-panel__title">
              <span aria-hidden>⭐</span> Tu valoración sobre {data.apodo}
            </h2>
            <p className="pd-panel__hint">
              Por defecto, la nota final mezcla un 35 % de autopercepción y un 65 % de cómo lo ven los demás. Si en el
              perfil completo se autopuntuó con 8, 9 o 10 en alguna dimensión, o en F5 marcó «excelente» (5) en alguna
              característica, la autopercepción pesa un 10 % y el grupo un 90 %.
            </p>
            <div className="pd-cta-actions">
              <button type="button" className="btn btn-primary" onClick={() => setValoracionTabNav("completo")}>
                Valorar perfil completo (1–5)
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setValoracionTabNav("f5")}>
                Valorar perfil F5 (1–5)
              </button>
            </div>
            {!valoracionFormVisible ? (
              <p className="muted" style={{ marginBottom: 0, marginTop: "0.85rem", fontSize: "0.85rem" }}>
                Tocá un botón para abrir el formulario debajo.
              </p>
            ) : null}
          </div>
        ) : null}

        {!showDetalleGrupo && f5PeerN > 0 ? (
          <div className="pd-panel">
            <h2 className="pd-panel__title">
              <span aria-hidden>👀</span> Mirada del grupo (F5)
            </h2>
            <p className="pd-panel__hint" style={{ marginBottom: "0.6rem" }}>
              Solo promedio agregado. El detalle por dimensión lo ven el jugador y los administradores.
            </p>
            <p className="pd-agg-score">
              <span className="pd-agg-score__value">{formatRating(data.f5FinalBreakdown?.peerAvg)}</span>
              <span className="pd-agg-score__n">({f5PeerN} valoraciones)</span>
            </p>
          </div>
        ) : null}

        {showDetalleGrupo && f5PeerN > 0 ? (
          <div className="pd-panel">
            <h2 className="pd-panel__title">
              <span aria-hidden>👥</span> Promedio del grupo F5 por bloque
            </h2>
            {F5_SECTIONS.map((sec) => (
              <DimBarSection
                key={`f5p-${sec.id}`}
                title={sec.title}
                tone="cycle"
                keys={sec.keys}
                values={data.peerF5ByDimension}
                labels={F5_LABELS}
                iconByKey={f5IconByKey}
              />
            ))}
          </div>
        ) : null}

        {canRate && valoracionFormVisible ? (
          <div className="pd-panel" id="valoracion-formulario">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <Link to="/" className="btn btn-ghost">
                ← Jugadores
              </Link>
              {valoracionTab === "completo" ? (
                <button type="button" className="btn btn-primary" onClick={() => setValoracionTabNav("f5")}>
                  Valorar F5
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => setValoracionTabNav("completo")}>
                  Valorar F11
                </button>
              )}
            </div>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.05rem" }}>
              {valoracionTab === "completo" ? `Valorar F11 de ${data.apodo}` : `Valorar F5 de ${data.apodo}`}
            </h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Las estrellas empiezan vacías. Completá todas antes de enviar.
            </p>
            <div className="tabs" style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                className={`btn btn-ghost ${valoracionTab === "completo" ? "active" : ""}`}
                onClick={() => setValoracionTabNav("completo")}
              >
                F11 (1–5)
              </button>
              <button
                type="button"
                className={`btn btn-ghost ${valoracionTab === "f5" ? "active" : ""}`}
                onClick={() => setValoracionTabNav("f5")}
              >
                F5 (1–5)
              </button>
            </div>

            {valoracionTab === "completo" ? (
              <div id="perfil-completo-valoracion">
                <form onSubmit={submitRating}>
                  <ProfileScoreSliders scores={scores} onChange={setScores} allowEmpty />
                  {msg && (
                    <p className={msg.includes("guardada") ? "muted" : "error"} style={{ marginTop: "1rem" }}>
                      {msg}
                    </p>
                  )}
                  <button className="btn btn-primary" type="submit" style={{ marginTop: "1rem" }} disabled={saving}>
                    {saving ? "Guardando…" : data.myRating ? "Actualizar F11" : "Enviar F11"}
                  </button>
                </form>
              </div>
            ) : (
              <div id="f5-valoracion">
                <form onSubmit={submitF5Perfil}>
                  <F5ProfileScorePickers scores={f5Scores} onChange={setF5Scores} allowEmpty />
                  {msgF5 && (
                    <p className={msgF5.includes("guardada") ? "muted" : "error"} style={{ marginTop: "1rem" }}>
                      {msgF5}
                    </p>
                  )}
                  <button className="btn btn-primary" type="submit" style={{ marginTop: "1rem" }} disabled={savingF5}>
                    {savingF5 ? "Guardando…" : data.myF5PerfilRating ? "Actualizar F5" : "Enviar F5"}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : null}

        {data.isSelf ? <ProfileImprovementSummary data={data} /> : null}

        {!canRate ? (
          <div className="pd-panel">
            <p className="muted" style={{ margin: 0 }}>
              Este es tu perfil: las valoraciones las cargan tus compañeros desde sus cuentas.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
