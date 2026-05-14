import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
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

  const scoreLabel = listaTab === "completo" ? p.finalScore.toFixed(2) : (p.f5FinalScore ?? "—").toString();
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
  const [f5Pendientes, setF5Pendientes] = useState<{ partidoId: string; fecha: string; companeros: { id: string; apodo: string }[] }[]>([]);
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
  const faltanCalificarF5 = data.faltanCalificarF5;
  const yaCalificadosF5 = data.yaCalificadosF5;

  const faltan = listaTab === "completo" ? faltanCalificar : faltanCalificarF5;
  const ya = listaTab === "completo" ? yaCalificados : yaCalificadosF5;

  return (
    <div>
      <h1>Jugadores</h1>

      <div className="tabs" style={{ marginBottom: "1rem" }}>
        <button
          type="button"
          className={`btn btn-ghost ${listaTab === "completo" ? "active" : ""}`}
          onClick={() => setListaTab("completo")}
        >
          Perfil completo
        </button>
        <button type="button" className={`btn btn-ghost ${listaTab === "f5" ? "active" : ""}`} onClick={() => setListaTab("f5")}>
          F5
        </button>
      </div>

      {listaTab === "completo" ? (
        <p className="sub">
          Perfil completo por bloques (técnico, táctico, físico y psicológico). Tocá un jugador para ver la ficha y dejar
          tu valoración del 1 al 10. La autopercepción de cada uno solo la ve el propio jugador y los administradores; el
          resto ve la nota final y el promedio agregado del grupo.
        </p>
      ) : (
        <p className="sub">
          Valoración F5 de perfil (1 a 5 por característica), con las mismas reglas de privacidad que el perfil completo:
          entrá a la ficha del compañero y completá el formulario F5. Podés usar esta lista para ver a quién te falta
          valorar.
        </p>
      )}

      {listaTab === "f5" && f5Pendientes.length > 0 ? (
        <div className="card" style={{ marginBottom: "1.25rem", borderColor: "var(--accent-dim)" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Te falta valorar F5 en partidos confirmados</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Valorá a los compañeros con los que jugaste esa noche (1 a 5 por característica).
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {f5Pendientes.map((b) => (
              <li key={b.partidoId} style={{ marginBottom: "0.5rem" }}>
                <Link to={`/partido/${b.partidoId}/valorar-f5`} style={{ fontWeight: 600 }}>
                  Partido {b.fecha}
                </Link>
                <span className="muted"> — faltan: {b.companeros.map((c) => c.apodo).join(", ")}</span>
              </li>
            ))}
          </ul>
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
              borderColor: faltan.length ? "var(--warn)" : "var(--border)",
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
                ({faltan.length})
              </span>
            </h3>
            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.82rem" }}>
              {listaTab === "completo"
                ? "Entrá a la ficha de cada compañero y completá las dimensiones del 1 al 10."
                : "Entrá a la ficha de cada compañero y completá las 12 características F5 (1 al 5)."}
            </p>
            {faltan.length === 0 ? (
              <p style={{ margin: 0, color: "var(--accent)", fontWeight: 600, fontSize: "0.95rem" }}>
                ¡Listo! Calificaste a todos.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {faltan.map((p) => (
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
              borderColor: ya.length ? "var(--accent-dim)" : "var(--border)",
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
                ({ya.length})
              </span>
            </h3>
            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.82rem" }}>
              Podés volver a ajustar la valoración desde la ficha de cada uno.
            </p>
            {ya.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                Todavía no enviaste valoraciones a otros jugadores.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {ya.map((p) => (
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
