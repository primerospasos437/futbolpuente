import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getToken, apiPartidos, type PartidoRow } from "../api";
import { getSupabase } from "../lib/supabase";
import type { PlayerSummary } from "../types";

const posLabel: Record<string, string> = {
  portero: "ARQ",
  defensa: "DEF",
  medio: "MED",
  delantero: "DEL",
};

const MAX_JUGADORES = 10;

interface Convocatoria {
  id: string;
  dia: string;
  fecha_partido: string;
  jugador_id: string;
  created_at: string;
}

function getNextMatchDate(targetDay: number): string {
  const now = new Date();
  const today = now.getDay();
  let diff = targetDay - today;
  if (diff < 0) diff += 7;
  if (diff === 0) {
    const hour = now.getHours();
    const min = now.getMinutes();
    if (hour > 21 || (hour === 21 && min >= 0)) {
      diff = 7;
    }
  }
  const d = new Date(now);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function isButtonEnabled(targetDay: number): boolean {
  const now = new Date();
  const currentDay = now.getDay();
  const hour = now.getHours();
  const min = now.getMinutes();
  const currentMinutes = hour * 60 + min;

  const matchTime = 21 * 60;
  const openTime = 22 * 60 + 30;

  if (currentDay === targetDay) {
    return currentMinutes < matchTime;
  }

  let daysSinceMatch = currentDay - targetDay;
  if (daysSinceMatch < 0) daysSinceMatch += 7;

  if (daysSinceMatch === 0) return currentMinutes < matchTime;

  if (daysSinceMatch > 0 && daysSinceMatch < 7) {
    if (daysSinceMatch === 0 && currentMinutes >= openTime) return true;
    return daysSinceMatch > 0;
  }
  return true;
}

const DAY_MARTES = 2;
const DAY_JUEVES = 4;

export default function HomePage() {
  const [list, setList] = useState<PlayerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [presencias, setPresencias] = useState<{ jugador_id: string; estado: string }[]>([]);
  const [partidos, setPartidos] = useState<PartidoRow[]>([]);
  const [saving, setSaving] = useState(false);

  const myId = localStorage.getItem("futbol_grupo_player_id") ?? "";
  const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; apodo: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.players();
        if (!cancelled) setList(Array.isArray(data) ? data : []);
        const token = getToken();
        if (token) {
          const sb = getSupabase();
          const { data: conv } = await sb.rpc("futbol_list_convocatorias", { p_token: token });
          if (!cancelled && conv) setConvocatorias(Array.isArray(conv) ? conv : []);
          try {
            const pres = await apiPartidos.listPresencias();
            if (!cancelled) setPresencias(Array.isArray(pres) ? pres : []);
            const parts = await apiPartidos.list();
            if (!cancelled) setPartidos(Array.isArray(parts) ? parts : []);
          } catch {}
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function getAttendanceRank(playerId: string): number {
    const mine = presencias.filter((pr) => pr.jugador_id === playerId);
    if (!mine.length) return 0;
    const good = mine.filter((pr) => pr.estado === "convocado" || pr.estado === "presente").length;
    return good / mine.length;
  }

  async function toggleAnotarse(dia: string, fecha: string) {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const sb = getSupabase();
      const yaAnotado = convocatorias.some((c) => c.dia === dia && c.fecha_partido === fecha && c.jugador_id === myId);
      if (yaAnotado) {
        await sb.rpc("futbol_desanotarse", { p_token: token, p_dia: dia, p_fecha: fecha });
        setConvocatorias((prev) => prev.filter((c) => !(c.dia === dia && c.fecha_partido === fecha && c.jugador_id === myId)));
      } else {
        await sb.rpc("futbol_anotarse", { p_token: token, p_dia: dia, p_fecha: fecha });
        setConvocatorias((prev) => [...prev, { id: "", dia, fecha_partido: fecha, jugador_id: myId, created_at: new Date().toISOString() }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function renderMatchButton(dia: string, targetDay: number, label: string) {
    const fecha = getNextMatchDate(targetDay);
    const enabled = isButtonEnabled(targetDay);
    const inscriptos = convocatorias.filter((c) => c.dia === dia && c.fecha_partido === fecha);
    const yaAnotado = inscriptos.some((c) => c.jugador_id === myId);
    const count = inscriptos.length;

    const inscriptosConRanking = inscriptos
      .map((c) => {
        const p = list.find((pl) => pl.id === c.jugador_id);
        return { ...c, apodo: p?.apodo ?? "?", rank: getAttendanceRank(c.jugador_id) };
      })
      .sort((a, b) => b.rank - a.rank);

    const cupoLleno = count >= MAX_JUGADORES && !yaAnotado;

    const miPosicion = inscriptosConRanking.findIndex((c) => c.jugador_id === myId);
    const esTitular = miPosicion >= 0 && miPosicion < MAX_JUGADORES;
    const esSuplente = miPosicion >= MAX_JUGADORES;
    const numSuplente = miPosicion - MAX_JUGADORES + 1;

    // Check if teams were already assigned for this date
    const partidoGuardado = partidos.find((p) => p.fecha === fecha);
    const miEquipo = partidoGuardado
      ? (partidoGuardado.equipo_claros as { id: string; apodo: string }[])?.some((x) => x.id === myId)
        ? "claros"
        : (partidoGuardado.equipo_oscuros as { id: string; apodo: string }[])?.some((x) => x.id === myId)
          ? "oscuros"
          : null
      : null;

    return (
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h3 style={{ margin: 0 }}>⚽ {label}</h3>
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
              {fecha} · 21:00 hs · {count}/{MAX_JUGADORES} anotados
            </p>
          </div>
          <button
            type="button"
            className={`btn ${yaAnotado ? "btn-ghost" : "btn-primary"}`}
            disabled={!enabled || saving || cupoLleno}
            onClick={() => toggleAnotarse(dia, fecha)}
            style={{ minWidth: 130 }}
          >
            {yaAnotado ? "✓ Anotado (salir)" : cupoLleno ? "Cupo lleno" : "Anotarme"}
          </button>
        </div>

        {yaAnotado && (
          <div style={{ marginTop: "0.75rem", padding: "0.6rem 0.75rem", borderRadius: "6px", background: esTitular ? "rgba(74,222,128,0.15)" : "rgba(231,76,60,0.12)", border: `1px solid ${esTitular ? "var(--accent)" : "#e74c3c"}` }}>
            {esTitular && !miEquipo && (
              <p style={{ margin: 0, fontWeight: 600, color: "var(--accent)" }}>
                ✅ Estás anotado como titular (puesto {miPosicion + 1})
              </p>
            )}
            {esSuplente && (
              <p style={{ margin: 0, fontWeight: 600, color: "#e74c3c" }}>
                ⏳ Quedaste como suplente {numSuplente}
              </p>
            )}
            {miEquipo && (
              <p style={{ margin: 0, fontWeight: 600, color: miEquipo === "claros" ? "var(--text)" : "var(--text)" }}>
                🏟️ Jugás en equipo {miEquipo === "claros" ? "⬜ CLAROS" : "⬛ OSCUROS"} · {fecha} · 21:00 hs
              </p>
            )}
          </div>
        )}

        {inscriptos.length > 0 && (
          <div style={{ marginTop: "0.75rem" }}>
            <p className="muted" style={{ margin: "0 0 0.25rem", fontSize: "0.8rem" }}>
              Anotados{count > MAX_JUGADORES ? ` (entran ${MAX_JUGADORES} por ranking)` : ""}:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {inscriptosConRanking.map((c, i) => {
                const titular = i < MAX_JUGADORES;
                const supNum = i - MAX_JUGADORES + 1;
                return (
                  <span
                    key={c.jugador_id}
                    style={{
                      fontSize: "0.85rem",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                      background: titular ? "var(--accent)" : "#e74c3c",
                      color: "#fff",
                      opacity: c.jugador_id === myId ? 1 : 0.85,
                      fontWeight: c.jugador_id === myId ? 700 : 400,
                    }}
                  >
                    {titular ? `${i + 1}. ${c.apodo}` : `S${supNum}. ${c.apodo}`}
                  </span>
                );
              })}
            </div>
            {count > MAX_JUGADORES && (
              <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#e74c3c" }}>
                ⚠️ Hay más de {MAX_JUGADORES} — entran los de mayor asistencia. Los demás quedan como suplentes.
              </p>
            )}
          </div>
        )}
        {!enabled && (
          <p className="muted" style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
            La inscripción se abre después del partido anterior ({dia} 22:30).
          </p>
        )}
      </div>
    );
  }

  if (error) return <div className="error">{error}</div>;
  if (loading) return <p className="muted">Cargando jugadores…</p>;

  const otrosJugadores = list.filter((p) => !p.isSelf);
  const faltanCalificar = otrosJugadores.filter((p) => !p.ratedByMe);
  const yaCalificados = otrosJugadores.filter((p) => p.ratedByMe);

  return (
    <div>
      <h1>Fútbol Puente Club</h1>

      {renderMatchButton("martes", DAY_MARTES, "Partido Martes")}
      {renderMatchButton("jueves", DAY_JUEVES, "Partido Jueves")}

      <h2 style={{ marginTop: "1.5rem" }}>Jugadores</h2>
      <p className="sub">
        Tocá un jugador para ver su ficha y dejar tu valoración.
      </p>

      {otrosJugadores.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <div className="card" style={{ marginBottom: 0, borderColor: faltanCalificar.length ? "var(--warn)" : "var(--border)" }}>
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
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

          <div className="card" style={{ marginBottom: 0, borderColor: yaCalificados.length ? "var(--accent-dim)" : "var(--border)" }}>
            <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
      <div className="list">
        {list.map((p) => {
          const altLine =
            p.posicionAlternativa && p.posicionAlternativa !== p.posicionPreferida
              ? ` · alt ${posLabel[p.posicionAlternativa] ?? p.posicionAlternativa}`
              : "";
          const bio = p.ficha.alturaCm != null ? ` · ${p.ficha.alturaCm} cm` : "";
          return (
            <Link key={p.id} to={`/jugador/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="player-row" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {p.fotoUrl ? (
                  <img
                    src={p.fotoUrl}
                    alt={p.apodo}
                    style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0, cursor: "pointer" }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpandedPhoto({ url: p.fotoUrl!, apodo: p.apodo }); }}
                  />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>⚽</div>
                )}
                <div className="p-main" style={{ flex: 1 }}>
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

      {expandedPhoto && (
        <div
          onClick={() => setExpandedPhoto(null)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center",
            justifyContent: "center", flexDirection: "column", zIndex: 9999, cursor: "pointer",
          }}
        >
          <img
            src={expandedPhoto.url}
            alt={expandedPhoto.apodo}
            style={{ width: 200, height: 200, borderRadius: "50%", objectFit: "cover", border: "3px solid #fff" }}
          />
          <p style={{ color: "#fff", marginTop: "0.75rem", fontWeight: 600, fontSize: "1.1rem" }}>
            {expandedPhoto.apodo}
          </p>
        </div>
      )}
    </div>
  );
}
