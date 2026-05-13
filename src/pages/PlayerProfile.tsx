import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../api";
import F5ProfileScorePickers from "../components/F5ProfileScorePickers";
import ProfileScoreSliders from "../components/ProfileScoreSliders";
import { DIMENSION_LABELS, DIMENSION_SECTIONS, defaultScores } from "../dimensions";
import { F5_LABELS, F5_SECTIONS, defaultF5Scores } from "../dimensions-f5";
import type { F5Dimension, PlayerDetail, ProfileScores } from "../types";

function DimensionReadonlyList({
  title,
  description,
  keys,
  values,
}: {
  title: string;
  description: string;
  keys: (keyof ProfileScores)[];
  values: ProfileScores;
}) {
  return (
    <section className="profile-section">
      <h3 className="profile-section-title">{title}</h3>
      <p className="profile-section-desc">{description}</p>
      <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)", lineHeight: 1.75 }}>
        {keys.map((d) => (
          <li key={d}>
            <strong style={{ color: "var(--text)" }}>{DIMENSION_LABELS[d]}:</strong> {values[d]}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DimensionPeerList({
  title,
  description,
  keys,
  peerByDimension,
}: {
  title: string;
  description: string;
  keys: (keyof ProfileScores)[];
  peerByDimension: PlayerDetail["peerByDimension"];
}) {
  return (
    <section className="profile-section">
      <h3 className="profile-section-title">{title}</h3>
      <p className="profile-section-desc">{description}</p>
      <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)", lineHeight: 1.75 }}>
        {keys.map((d) => {
          const v = peerByDimension[d];
          return (
            <li key={d}>
              <strong style={{ color: "var(--text)" }}>{DIMENSION_LABELS[d]}:</strong>{" "}
              {v != null ? v.toFixed(2) : "—"}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function F5PeerDimensionList({
  title,
  keys,
  peerByDimension,
}: {
  title: string;
  keys: F5Dimension[];
  peerByDimension: PlayerDetail["peerF5ByDimension"];
}) {
  return (
    <section className="profile-section">
      <h3 className="profile-section-title">{title}</h3>
      <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)", lineHeight: 1.75 }}>
        {keys.map((d) => {
          const v = peerByDimension[d];
          return (
            <li key={d}>
              <strong style={{ color: "var(--text)" }}>{F5_LABELS[d]}:</strong>{" "}
              {v != null ? v.toFixed(2) : "—"}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function PlayerProfilePage() {
  const { id } = useParams();
  const location = useLocation();
  const [data, setData] = useState<PlayerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<ProfileScores | null>(null);
  const [f5Scores, setF5Scores] = useState<ReturnType<typeof defaultF5Scores> | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingF5, setSavingF5] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgF5, setMsgF5] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await api.player(id);
        if (cancelled) return;
        setData(p);
        setScores(p.myRating?.scores ?? defaultScores());
        setF5Scores(p.myF5PerfilRating?.scores ?? defaultF5Scores());
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!data || location.hash !== "#f5-valoracion") return;
    const el = document.getElementById("f5-valoracion");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [data, location.hash]);

  const canRate = useMemo(() => data && !data.isSelf, [data]);
  const showDetalleGrupo = Boolean(data && (data.isSelf || data.viewerIsAdmin));
  const showAutopercepcionAjenaAdmin = Boolean(data && !data.isSelf && data.viewerIsAdmin);

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !scores || !canRate) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.ratePlayer(id, scores);
      const p = await api.player(id);
      setData(p);
      setScores(p.myRating?.scores ?? defaultScores());
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
    setSavingF5(true);
    setMsgF5(null);
    try {
      await api.ratePlayerF5Perfil(id, f5Scores);
      const p = await api.player(id);
      setData(p);
      setF5Scores(p.myF5PerfilRating?.scores ?? defaultF5Scores());
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

  return (
    <div>
      <p style={{ marginBottom: "1rem" }}>
        <Link to="/">← Volver al listado</Link>
      </p>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h1 style={{ marginBottom: "0.25rem" }}>{data.apodo}</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {data.nombreCompleto} · Principal: {data.posicionPreferida} · Alternativa:{" "}
          {ficha.posicionAlternativa ?? data.posicionPreferida} · Pie {data.pieDominante}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem" }}>
          <div className="score-pill">Perfil completo · final {data.finalScore.toFixed(2)}</div>
          {data.isSelf ? (
            <>
              <div className="score-pill">Tu autopercepción (prom.): {data.finalBreakdown.selfAvg.toFixed(2)}</div>
              <div className="score-pill">
                Grupo: {data.finalBreakdown.peerAvg != null ? data.finalBreakdown.peerAvg.toFixed(2) : "—"} (
                {data.peerCount} votos)
              </div>
            </>
          ) : (
            <div className="score-pill muted" style={{ fontSize: "0.85rem" }}>
              Autopercepción ajena: solo promedio global visible · detalle solo administrador
            </div>
          )}
          {data.f5FinalScore != null ? (
            <div className="score-pill">F5 · final {data.f5FinalScore.toFixed(2)}</div>
          ) : null}
          {data.isSelf && data.f5FinalBreakdown ? (
            <>
              <div className="score-pill">F5 autopercepción (prom.): {data.f5FinalBreakdown.selfAvg.toFixed(2)}</div>
              <div className="score-pill">
                F5 grupo: {data.f5FinalBreakdown.peerAvg != null ? data.f5FinalBreakdown.peerAvg.toFixed(2) : "—"} (
                {data.f5FinalBreakdown.peerCount} valoraciones)
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Ficha técnica y contacto</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)", lineHeight: 1.75 }}>
          {ficha.fechaNacimiento ? (
            <li>
              <strong style={{ color: "var(--text)" }}>Fecha de nacimiento:</strong> {ficha.fechaNacimiento}
            </li>
          ) : (
            <li className="muted">Fecha de nacimiento no cargada</li>
          )}
          {ficha.contacto ? (
            <li>
              <strong style={{ color: "var(--text)" }}>Contacto:</strong> {ficha.contacto}
            </li>
          ) : (
            <li className="muted">Sin contacto cargado</li>
          )}
          {altPeso ? (
            <li>
              <strong style={{ color: "var(--text)" }}>Biotipo:</strong> {altPeso}
            </li>
          ) : (
            <li className="muted">Altura / peso no cargados</li>
          )}
        </ul>
        {data.isSelf && (
          <p className="muted" style={{ marginBottom: 0, marginTop: "1rem" }}>
            Historial de lesiones y más datos los editás en «Mis perfiles».
          </p>
        )}
      </div>

      {data.isSelf && ficha.historialLesiones ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Historial de lesiones (privado)</h2>
          <p style={{ whiteSpace: "pre-wrap", margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
            {ficha.historialLesiones}
          </p>
        </div>
      ) : null}

      {data.isSelf ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Tu autopercepción (perfil completo)</h2>
          {DIMENSION_SECTIONS.map((sec) => (
            <DimensionReadonlyList
              key={sec.id}
              title={sec.title}
              description={sec.description}
              keys={sec.keys}
              values={data.profile}
            />
          ))}
        </div>
      ) : null}

      {showAutopercepcionAjenaAdmin ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Autopercepción de {data.apodo} (solo administrador)</h2>
          {DIMENSION_SECTIONS.map((sec) => (
            <DimensionReadonlyList
              key={`adm-${sec.id}`}
              title={sec.title}
              description={sec.description}
              keys={sec.keys}
              values={data.profile}
            />
          ))}
        </div>
      ) : null}

      {!showDetalleGrupo && data.peerCount > 0 ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Mirada del grupo (perfil completo)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Solo se muestra el promedio agregado. El detalle por característica lo ven el jugador y los administradores.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Promedio del grupo:</strong> {data.finalBreakdown.peerAvg != null ? data.finalBreakdown.peerAvg.toFixed(2) : "—"}{" "}
            <span className="muted">({data.peerCount} valoraciones)</span>
          </p>
        </div>
      ) : null}

      {showDetalleGrupo && data.peerCount > 0 ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Promedio del grupo por bloque</h2>
          {DIMENSION_SECTIONS.map((sec) => (
            <DimensionPeerList
              key={`peer-${sec.id}`}
              title={sec.title}
              description="Promedio de las valoraciones recibidas."
              keys={sec.keys}
              peerByDimension={data.peerByDimension}
            />
          ))}
        </div>
      ) : null}

      {!showDetalleGrupo && f5PeerN > 0 ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Mirada del grupo (F5)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Solo promedio agregado. El detalle por dimensión lo ven el jugador y los administradores.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Promedio F5 del grupo:</strong>{" "}
            {data.f5FinalBreakdown?.peerAvg != null ? data.f5FinalBreakdown.peerAvg.toFixed(2) : "—"}{" "}
            <span className="muted">({f5PeerN} valoraciones)</span>
          </p>
        </div>
      ) : null}

      {showDetalleGrupo && f5PeerN > 0 ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Promedio del grupo F5 por bloque</h2>
          {F5_SECTIONS.map((sec) => (
            <F5PeerDimensionList key={`f5p-${sec.id}`} title={sec.title} keys={sec.keys} peerByDimension={data.peerF5ByDimension} />
          ))}
        </div>
      ) : null}

      {canRate ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Tu valoración de {data.apodo} (perfil completo)</h2>
          <p className="muted">
            Valorá cada aspecto del 1 al 10 según lo que ves en entrenamientos y partidos. Podés actualizarla cuando
            quieras.
          </p>
          <form onSubmit={submitRating}>
            <ProfileScoreSliders scores={scores} onChange={setScores} />
            {msg && (
              <p className={msg.includes("guardada") ? "muted" : "error"} style={{ marginTop: "1rem" }}>
                {msg}
              </p>
            )}
            <button className="btn btn-primary" type="submit" style={{ marginTop: "1rem" }} disabled={saving}>
              {saving ? "Guardando…" : data.myRating ? "Actualizar valoración" : "Enviar valoración"}
            </button>
          </form>
        </div>
      ) : null}

      {canRate ? (
        <div className="card" style={{ marginBottom: "1rem" }} id="f5-valoracion">
          <h2 style={{ marginTop: 0 }}>Tu valoración F5 de {data.apodo}</h2>
          <p className="muted">
            Escala 1 a 5 (malo a excelente) por cada característica F5. Se combina con las valoraciones por partido para
            el promedio del grupo.
          </p>
          <form onSubmit={submitF5Perfil}>
            <F5ProfileScorePickers scores={f5Scores} onChange={setF5Scores} />
            {msgF5 && (
              <p className={msgF5.includes("guardada") ? "muted" : "error"} style={{ marginTop: "1rem" }}>
                {msgF5}
              </p>
            )}
            <button className="btn btn-primary" type="submit" style={{ marginTop: "1rem" }} disabled={savingF5}>
              {savingF5 ? "Guardando…" : data.myF5PerfilRating ? "Actualizar valoración F5" : "Enviar valoración F5"}
            </button>
          </form>
        </div>
      ) : null}

      {!canRate ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Este es tu perfil: las valoraciones las cargan tus compañeros desde sus cuentas.
          </p>
        </div>
      ) : null}
    </div>
  );
}
