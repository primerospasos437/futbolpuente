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

function rowClassName(p: PlayerSummary): string {
  if (p.isSelf) return "player-row";
  if (p.ratedByMe) return "player-row player-row--valorado";
  return "player-row player-row--pendiente";
}

function PlayerRowLink({ p }: { p: PlayerSummary }) {
  const altLine =
    p.posicionAlternativa && p.posicionAlternativa !== p.posicionPreferida
      ? ` · alt ${posLabel[p.posicionAlternativa] ?? p.posicionAlternativa}`
      : "";
  const bio = p.ficha.alturaCm != null ? ` · ${p.ficha.alturaCm} cm` : "";
  const estadoValoracion = p.isSelf
    ? ""
    : p.ratedByMe
      ? " · ya valoraste"
      : " · pendiente de tu valoración";

  return (
    <Link key={p.id} to={`/jugador/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div className={rowClassName(p)}>
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
            {p.peerCount ? ` · ${p.peerCount} valoraciones` : " · sin valoraciones aún"}
            {estadoValoracion}
          </span>
        </div>
        <span className="score-pill">{p.finalScore.toFixed(2)}</span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [data, setData] = useState<PlayersListPayload | null>(null);
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

  return (
    <div>
      <h1>Jugadores</h1>
      <p className="sub">
        Perfil completo por bloques (técnico, táctico, físico y psicológico). Tocá un jugador para ver la ficha y dejar
        tu valoración. La autopercepción de cada uno (cómo se califica a sí mismo) solo la ve el propio jugador y los
        administradores; el resto ve la nota final y el promedio agregado del grupo. Recordá completar también el perfil
        F5 en «Mis perfiles» y valorar el F5 de tus compañeros desde su ficha o después de cada partido confirmado.
      </p>

      {f5Pendientes.length > 0 ? (
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
              borderColor: faltanCalificar.length ? "var(--warn)" : "var(--border)",
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
                ({faltanCalificar.length})
              </span>
            </h3>
            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.82rem" }}>
              Entrá a la ficha de cada compañero y completá las dimensiones.
            </p>
            {faltanCalificar.length === 0 ? (
              <p style={{ margin: 0, color: "var(--accent)", fontWeight: 600, fontSize: "0.95rem" }}>
                ¡Listo! Calificaste a todos.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {faltanCalificar.map((p) => (
                  <Link
                    key={p.id}
                    to={`/jugador/${p.id}`}
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
              borderColor: yaCalificados.length ? "var(--accent-dim)" : "var(--border)",
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
                ({yaCalificados.length})
              </span>
            </h3>
            <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.82rem" }}>
              Podés volver a ajustar la valoración desde la ficha de cada uno.
            </p>
            {yaCalificados.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                Todavía no enviaste valoraciones a otros jugadores.
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {yaCalificados.map((p) => (
                  <Link
                    key={p.id}
                    to={`/jugador/${p.id}`}
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
        <div className="list">{list.map((p) => <PlayerRowLink key={p.id} p={p} />)}</div>
      )}
    </div>
  );
}
