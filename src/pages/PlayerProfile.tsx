import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import ProfileScoreSliders from "../components/ProfileScoreSliders";
import { DIMENSION_LABELS, DIMENSION_SECTIONS, defaultScores } from "../dimensions";
import type { PlayerDetail, ProfileScores } from "../types";

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

export default function PlayerProfilePage() {
  const { id } = useParams();
  const [data, setData] = useState<PlayerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<ProfileScores | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await api.player(id);
        if (cancelled) return;
        setData(p);
        setScores(p.myRating?.scores ?? defaultScores());
        // Check admin
        try {
          const token = localStorage.getItem("futbol_grupo_token") ?? "";
          const { getSupabase } = await import("../lib/supabase");
          const sb = getSupabase();
          const { data: jData } = await sb.rpc("futbol_list_jugadores", { p_token: token });
          if (jData) {
            const { isAdmin } = await import("../api");
            setAdmin(isAdmin(Array.isArray(jData) ? jData : []));
          }
        } catch {}
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const canRate = useMemo(() => data && !data.isSelf, [data]);

  async function submitRating(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !scores || !canRate) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.ratePlayer(id, scores);
      const p = await api.player(id);
      setData(p);
      setMsg("Valoración guardada.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (error) return <div className="error">{error}</div>;
  if (!data || !scores) return <p className="muted">Cargando perfil…</p>;

  const { ficha } = data;
  const altPeso =
    ficha.alturaCm != null || ficha.pesoKg != null
      ? `${ficha.alturaCm != null ? `${ficha.alturaCm} cm` : "—"} · ${ficha.pesoKg != null ? `${ficha.pesoKg} kg` : "—"}`
      : null;

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
          <div className="score-pill">Final: {data.finalScore.toFixed(2)}</div>
          {(data.isSelf || admin) && (
            <div className="score-pill">Autopercepción: {data.finalBreakdown.selfAvg.toFixed(2)}</div>
          )}
          <div className="score-pill">
            Grupo: {data.finalBreakdown.peerAvg != null ? data.finalBreakdown.peerAvg.toFixed(2) : "—"} (
            {data.peerCount} votos)
          </div>
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
            Historial de lesiones y más datos los editás en «Mi perfil».
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

      {(data.isSelf || admin) && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>
            {data.isSelf ? "Tu autopercepción (detalle por aptitud)" : `Autopercepción de ${data.apodo} (vista admin)`}
          </h2>
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
      )}

      {(data.isSelf || admin) && data.peerCount > 0 && (
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
      )}

      {canRate ? (() => {
        const lastUpdate = data.myRating?.updatedAt ? new Date(data.myRating.updatedAt) : null;
        const now = new Date();
        const daysSinceUpdate = lastUpdate ? Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const blocked = daysSinceUpdate !== null && daysSinceUpdate < 30;
        const daysRemaining = blocked ? 30 - daysSinceUpdate : 0;

        return (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Tu valoración de {data.apodo}</h2>
            {blocked ? (
              <div style={{ padding: "0.75rem", borderRadius: "6px", background: "rgba(231,76,60,0.1)", border: "1px solid #e74c3c" }}>
                <p style={{ margin: 0, color: "#e74c3c", fontWeight: 500 }}>
                  🔒 Ya valoraste a {data.apodo} este mes. Podés actualizar en {daysRemaining} día{daysRemaining !== 1 ? "s" : ""}.
                </p>
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
                  Última valoración: {lastUpdate!.toLocaleDateString()}
                </p>
              </div>
            ) : (
              <>
                <p className="muted">
                  Valorá cada aspecto del 1 al 10 según lo que ves en entrenamientos y partidos.
                  {data.myRating ? " Podés actualizar 1 vez por mes." : ""}
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
              </>
            )}
          </div>
        );
      })() : (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Este es tu perfil: las valoraciones las cargan tus compañeros desde sus cuentas.
          </p>
        </div>
      )}
    </div>
  );
}
