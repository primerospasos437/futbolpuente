import { useEffect, useState } from "react";
import { api, apiPartidos, isAdmin as checkAdmin, type PartidoRow, type PresenciaRow } from "../api";
import type { PlayerSummary } from "../types";

interface RankingEntry {
  id: string;
  apodo: string;
  convocado: number;
  presente: number;
  ausente: number;
  reemplazado: number;
  porcentaje: number;
}

export default function PresenciasPage() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [partidos, setPartidos] = useState<PartidoRow[]>([]);
  const [presencias, setPresencias] = useState<PresenciaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [selectedPartido, setSelectedPartido] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [playerList, partidoList, presenciaList] = await Promise.all([
          api.players(),
          apiPartidos.list(),
          apiPartidos.listPresencias(),
        ]);
        if (cancelled) return;
        setPlayers(Array.isArray(playerList) ? playerList : []);
        setPartidos(Array.isArray(partidoList) ? partidoList : []);
        setPresencias(Array.isArray(presenciaList) ? presenciaList : []);
        // Check admin
        try {
          const token = localStorage.getItem("futbol_grupo_token") ?? "";
          const { getSupabase } = await import("../lib/supabase");
          const sb = getSupabase();
          const { data } = await sb.rpc("futbol_list_jugadores", { p_token: token });
          if (data) setAdmin(checkAdmin(Array.isArray(data) ? data : []));
        } catch {}
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ranking: RankingEntry[] = players.map((p) => {
    const mine = presencias.filter((pr) => pr.jugador_id === p.id);
    const convocado = mine.length;
    const presente = mine.filter((pr) => pr.estado === "convocado" || pr.estado === "presente").length;
    const ausente = mine.filter((pr) => pr.estado === "ausente").length;
    const reemplazado = mine.filter((pr) => pr.estado === "reemplazado").length;
    const porcentaje = convocado > 0 ? (presente / convocado) * 100 : 0;
    return { id: p.id, apodo: p.apodo, convocado, presente, ausente, reemplazado, porcentaje };
  }).sort((a, b) => b.porcentaje - a.porcentaje || b.presente - a.presente);

  async function markPlayer(partidoId: string, jugadorId: string, estado: string) {
    setSaving(true);
    try {
      await apiPartidos.marcarPresencia(partidoId, jugadorId, estado);
      setPresencias((prev) =>
        prev.map((pr) =>
          pr.partido_id === partidoId && pr.jugador_id === jugadorId
            ? { ...pr, estado: estado as PresenciaRow["estado"] }
            : pr
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Cargando presencias…</p>;
  if (error) return <div className="error">{error}</div>;

  const selPartido = partidos.find((p) => p.id === selectedPartido);
  const selPresencias = presencias.filter((pr) => pr.partido_id === selectedPartido);

  return (
    <div>
      <h1>Ranking de presencias</h1>
      <p className="sub">
        Historial de asistencia a partidos. Los que más asisten tienen prioridad cuando hay demasiados jugadores.
      </p>

      {ranking.length > 0 && partidos.length > 0 ? (
        <div className="card" style={{ marginBottom: "1.5rem", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>#</th>
                <th style={{ textAlign: "left", padding: "0.5rem" }}>Jugador</th>
                <th style={{ textAlign: "center", padding: "0.5rem" }}>Partidos</th>
                <th style={{ textAlign: "center", padding: "0.5rem" }}>Presentes</th>
                <th style={{ textAlign: "center", padding: "0.5rem" }}>Ausencias</th>
                <th style={{ textAlign: "center", padding: "0.5rem" }}>%</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem", fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: "0.5rem" }}>{r.apodo}</td>
                  <td style={{ textAlign: "center", padding: "0.5rem" }}>{r.convocado}</td>
                  <td style={{ textAlign: "center", padding: "0.5rem", color: "var(--accent)" }}>{r.presente}</td>
                  <td style={{ textAlign: "center", padding: "0.5rem", color: "#e74c3c" }}>
                    {r.ausente + r.reemplazado}
                  </td>
                  <td style={{ textAlign: "center", padding: "0.5rem", fontWeight: 600 }}>
                    {r.convocado > 0 ? `${r.porcentaje.toFixed(0)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          No hay partidos registrados todavía. Armá un partido desde la pestaña «Equipos» y guardalo.
        </p>
      )}

      {admin && partidos.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Gestionar presencias</h2>
          <div className="row">
            <label>Seleccionar partido</label>
            <select
              value={selectedPartido ?? ""}
              onChange={(e) => setSelectedPartido(e.target.value || null)}
            >
              <option value="">— Elegir partido —</option>
              {partidos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fecha} ({p.estado})
                </option>
              ))}
            </select>
          </div>

          {selPartido && (
            <div style={{ marginTop: "1rem" }}>
              <p className="muted">
                Marcá las presencias o reemplazos. Un jugador «reemplazado» cuenta como ausencia en el ranking.
              </p>
              <div className="list" style={{ marginTop: "0.5rem" }}>
                {selPresencias.map((pr) => {
                  const p = players.find((pl) => pl.id === pr.jugador_id);
                  if (!p) return null;
                  return (
                    <div key={pr.jugador_id} className="player-row" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ flex: 1 }}>
                        <strong>{p.apodo}</strong>{" "}
                        <span className="muted">({pr.equipo})</span>
                      </span>
                      <select
                        value={pr.estado}
                        onChange={(e) => markPlayer(selPartido.id, pr.jugador_id, e.target.value)}
                        disabled={saving}
                        style={{ fontSize: "0.85rem" }}
                      >
                        <option value="convocado">Convocado</option>
                        <option value="presente">Presente</option>
                        <option value="ausente">Ausente</option>
                        <option value="reemplazado">Reemplazado</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
