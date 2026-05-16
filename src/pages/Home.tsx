import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { formatRating } from "../lib/formatRating";
import type { PlayerSummary, PlayersListPayload } from "../types";

const posLabel: Record<string, string> = {
  portero: "ARQ",
  defensa: "DEF",
  medio: "MED",
  delantero: "DEL",
};

function rowClassName(p: PlayerSummary, listaTab: "completo" | "f5"): string {
  if (p.isSelf) return "player-row";
  const valorado = listaTab === "completo" ? p.ratedByMe : p.ratedF5PerfilByMe;
  if (valorado) return "player-row player-row--valorado";
  return "player-row player-row--pendiente";
}

function PlayerRowLink({ p, listaTab }: { p: PlayerSummary; listaTab: "completo" | "f5" }) {
  const altLine =
    p.posicionAlternativa && p.posicionAlternativa !== p.posicionPreferida
      ? ` · alt ${posLabel[p.posicionAlternativa] ?? p.posicionAlternativa}`
      : "";
  const bio = p.ficha.alturaCm != null ? ` · ${p.ficha.alturaCm} cm` : "";
  const estadoValoracion =
    listaTab === "completo"
      ? p.isSelf
        ? ""
        : p.ratedByMe
          ? " · ya valoraste el perfil completo"
          : " · pendiente: perfil completo"
      : p.isSelf
        ? ""
        : p.ratedF5PerfilByMe
          ? " · ya valoraste el F5"
          : " · pendiente: F5";

  const scoreLabel = listaTab === "completo" ? formatRating(p.finalScore) : formatRating(p.f5FinalScore);
  const f5Peer = p.f5FinalBreakdown?.peerCount ?? 0;
  const valoracionesMeta =
    listaTab === "completo"
      ? p.peerCount
        ? ` · ${p.peerCount} valoraciones`
        : " · sin valoraciones aún"
      : f5Peer
        ? ` · ${f5Peer} valoraciones F5`
        : " · sin valoraciones F5 aún";

  const to =
    listaTab === "f5" ? `/jugador/${p.id}#f5-valoracion` : `/jugador/${p.id}#perfil-completo-valoracion`;

  return (
    <Link key={p.id} to={to} style={{ textDecoration: "none", color: "inherit" }}>
      <div className={rowClassName(p, listaTab)}>
        <div className="p-main">
          <span className="p-name">
            {p.apodo}
            {p.isSelf ? (
              <span className="muted" style={{ marginLeft: 8, fontWeight: 500 }}>
                (vos)
              </span>
            ) : null}
          </span>
          <span className="p-meta">
            {p.nombreCompleto} · {posLabel[p.posicionPreferida] ?? p.posicionPreferida}
            {altLine}
            {bio}
            {valoracionesMeta}
            {estadoValoracion}
          </span>
        </div>
        <span className="score-pill">{listaTab === "f5" ? `F5 ${scoreLabel}` : scoreLabel}</span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [data, setData] = useState<PlayersListPayload | null>(null);
  const [listaTab, setListaTab] = useState<"completo" | "f5">("completo");
  const [f5Pendientes, setF5Pendientes] = useState<{ partidoId: string; fecha: string; companeros: { id: string; apodo: string }[] }[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [payload, pend] = await Promise.all([
          api.players(),
          api.pendientesValoracionF5Partidos().catch(() => []),
        ]);
        if (!cancelled) {
          setData(payload);
          setF5Pendientes(
            pend.map((x) => ({
              partidoId: x.partido.id,
              fecha: x.partido.fecha,
              companeros: x.companeros,
            })),
          );
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <p className="muted">Cargando jugadores…</p>;

  const list = data.jugadores;
  const otrosJugadores = list.filter((p) => !p.isSelf);
  const faltanCalificar = otrosJugadores.filter((p) => !p.ratedByMe);
  const yaCalificados = otrosJugadores.filter((p) => p.ratedByMe);
  const faltanCalificarF5 = otrosJugadores.filter((p) => !p.ratedF5PerfilByMe);
  const yaCalificadosF5 = otrosJugadores.filter((p) => p.ratedF5PerfilByMe);

  const sinValoracionesGrupo = otrosJugadores.filter((p) => p.peerCount === 0);
  const sinValoracionesF5Grupo = otrosJugadores.filter((p) => (p.f5FinalBreakdown?.peerCount ?? 0) === 0);

  return (
    <div>
      <h1>Jugadores</h1>
      <p className="sub">
        Tocá un compañero para abrir su ficha. La autopercepción (cómo se califica cada uno) es privada: en la ficha solo
        se muestra la nota final agregada para el resto. Recordá completar también el perfil F5 en «Mis perfiles».
      </p>

      <div className="tabs" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className={`btn btn-ghost ${listaTab === "completo" ? "active" : ""}`}
          onClick={() => setListaTab("completo")}
        >
          Perfil completo (1–10)
        </button>
        <button
          type="button"
          className={`btn btn-ghost ${listaTab === "f5" ? "active" : ""}`}
          onClick={() => setListaTab("f5")}
        >
          F5 (1–5)
        </button>
      </div>

      {f5Pendientes.length > 0 ? (
        <div className="card" style={{ marginBottom: "1.25rem", borderColor: "var(--warn)" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Valoración F5 después del partido</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Tenés pendiente calificar a compañeros de partidos confirmados en los que participaste.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.8 }}>
            {f5Pendientes.map((b) => (
              <li key={b.partidoId}>
                <strong>Partido {b.fecha}</strong>:{" "}
                {b.companeros.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 ? ", " : null}
                    <Link to={`/partido/${b.partidoId}/valorar-f5?para=${encodeURIComponent(c.id)}`}>{c.apodo}</Link>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(sinValoracionesGrupo.length > 0 || sinValoracionesF5Grupo.length > 0) && otrosJugadores.length > 0 ? (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Recordatorios para el grupo</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.92rem" }}>
            Avisales a tus compañeros si aún no tienen suficientes valoraciones del grupo (perfil completo o F5).
          </p>
          {sinValoracionesGrupo.length > 0 ? (
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.92rem" }}>
              <strong>Perfil completo sin valoraciones del grupo:</strong>{" "}
              {sinValoracionesGrupo.map((p) => p.apodo).join(", ")}
            </p>
          ) : null}
          {sinValoracionesF5Grupo.length > 0 ? (
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.92rem" }}>
              <strong>F5 sin valoraciones del grupo:</strong> {sinValoracionesF5Grupo.map((p) => p.apodo).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {otrosJugadores.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <div
            className="card"
            style={{
              marginBottom: 0,
              borderColor: (listaTab === "completo" ? faltanCalificar : faltanCalificarF5).length ? "var(--warn)" : "var(--border)",
            }}
          >
            <h3
              style={{
                margin: "0 0 0.35rem",
                fontSize: "1.05rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span aria-hidden>⏳</span> Te falta calificar
              <span className="muted" style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                ({listaTab === "completo" ? faltanCalificar.length : faltanCalificarF5.length})
              </span>
            </h3>
            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.82rem" }}>
              {listaTab === "completo"
                ? "Entrá a la ficha de cada compañero y completá el perfil completo."
                : "En la ficha, sección F5, valorá el perfil F5 de cada compañero."}
            </p>
            {(listaTab === "completo" ? faltanCalificar : faltanCalificarF5).length === 0 ? (
              <p style={{ margin: 0, color: "var(--accent)", fontWeight: 600, fontSize: "0.95rem" }}>
                ¡Listo! Calificaste a todos en esta categoría.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {(listaTab === "completo" ? faltanCalificar : faltanCalificarF5).map((p) => (
                  <Link
                    key={p.id}
                    to={
                      listaTab === "f5"
                        ? `/jugador/${p.id}#f5-valoracion`
                        : `/jugador/${p.id}#perfil-completo-valoracion`
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.35rem 0.65rem",
                      borderRadius: "999px",
                      background: "rgba(244, 185, 66, 0.15)",
                      border: "1px solid rgba(244, 185, 66, 0.45)",
                      color: "var(--text)",
                      textDecoration: "none",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                    }}
                  >
                    {p.apodo}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div
            className="card"
            style={{
              marginBottom: 0,
              borderColor: (listaTab === "completo" ? yaCalificados : yaCalificadosF5).length ? "var(--accent-dim)" : "var(--border)",
            }}
          >
            <h3
              style={{
                margin: "0 0 0.35rem",
                fontSize: "1.05rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span aria-hidden>✓</span> Ya calificaste
              <span className="muted" style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                ({listaTab === "completo" ? yaCalificados.length : yaCalificadosF5.length})
              </span>
            </h3>
            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.82rem" }}>
              Podés volver a ajustar la valoración desde la ficha de cada uno.
            </p>
            {(listaTab === "completo" ? yaCalificados : yaCalificadosF5).length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                Todavía no enviaste valoraciones a otros jugadores en esta categoría.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {(listaTab === "completo" ? yaCalificados : yaCalificadosF5).map((p) => (
                  <Link
                    key={p.id}
                    to={
                      listaTab === "f5"
                        ? `/jugador/${p.id}#f5-valoracion`
                        : `/jugador/${p.id}#perfil-completo-valoracion`
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.35rem 0.65rem",
                      borderRadius: "999px",
                      background: "rgba(62, 207, 142, 0.12)",
                      border: "1px solid rgba(62, 207, 142, 0.4)",
                      color: "var(--text)",
                      textDecoration: "none",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                    }}
                  >
                    {p.apodo}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="muted">No hay jugadores registrados todavía.</p>
      ) : (
        <div className="list">{list.map((p) => <PlayerRowLink key={p.id} p={p} listaTab={listaTab} />)}</div>
      )}
    </div>
  );
}
