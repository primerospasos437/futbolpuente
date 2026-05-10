import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { PlayerSummary } from "../types";

const posLabel: Record<string, string> = {
  portero: "ARQ",
  defensa: "DEF",
  medio: "MED",
  delantero: "DEL",
};

export default function HomePage() {
  const [list, setList] = useState<PlayerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.players();
        if (!cancelled) setList(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (loading) return <p className="muted">Cargando jugadores…</p>;

  return (
    <div>
      <h1>Jugadores</h1>
      <p className="sub">
        Perfil completo por bloques (técnico, táctico, físico y psicológico). Tocá un jugador para ver ficha, auto-notas
        y dejar tu valoración en las mismas dimensiones. La nota final mezcla autopercepción (35%) con el promedio del
        grupo (65%).
      </p>
      {list.length === 0 ? (
        <p className="muted">No hay jugadores registrados todavía.</p>
      ) : (
      <div className="list">
        {list.map((p) => {
          const altLine =
            p.posicionAlternativa && p.posicionAlternativa !== p.posicionPreferida
              ? ` · alt ${posLabel[p.posicionAlternativa] ?? p.posicionAlternativa}`
              : "";
          const bio = p.ficha.alturaCm != null ? ` · ${p.ficha.alturaCm} cm` : "";
          return (
            <Link key={p.id} to={`/jugador/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="player-row">
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
                  </span>
                </div>
                <span className="score-pill">{p.finalScore.toFixed(2)}</span>
              </div>
            </Link>
          );
        })}
      </div>
      )}
    </div>
  );
}
