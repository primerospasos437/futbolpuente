import { useCallback, useEffect, useMemo, useState } from "react";
import { api, apiConvocatorias, apiPartidos, isAdminFromPlayersList, type ConvocatoriaRow, type PartidoRow } from "../api";
import type { BalanceResponse, PlayerSummary } from "../types";
import { nextMatchIso } from "./ProximosPartidosPage";

const TITULARES_CAMPO = 10;

export default function TeamsPage() {
  const [players, setPlayers] = useState<PlayerSummary[] | null>(null);
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaRow[]>([]);
  const [diaPartido, setDiaPartido] = useState<"martes" | "jueves">("martes");
  const [titularIds, setTitularIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<BalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [partidos, setPartidos] = useState<PartidoRow[]>([]);
  const [borradorPartidoId, setBorradorPartidoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useF5Balance, setUseF5Balance] = useState(true);
  const [horaPartido, setHoraPartido] = useState("21:30");
  const [textoEquipamiento, setTextoEquipamiento] = useState("");

  const fechaPartidoCal = useMemo(() => nextMatchIso(diaPartido), [diaPartido]);

  const convFiltradas = useMemo(
    () => convocatorias.filter((c) => c.dia === diaPartido && c.fecha_partido === fechaPartidoCal),
    [convocatorias, diaPartido, fechaPartidoCal],
  );

  const anotadosPlayers = useMemo(() => {
    const ordenIds = [...convFiltradas]
      .sort((a, b) => (a.orden_inscripcion ?? 0) - (b.orden_inscripcion ?? 0))
      .map((c) => c.jugador_id);
    const seen = new Set<string>();
    const uniqIds = ordenIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (!players) return [];
    const map = new Map(players.map((p) => [p.id, p]));
    return uniqIds.map((id) => map.get(id)).filter((p): p is PlayerSummary => Boolean(p));
  }, [convFiltradas, players]);

  const suplentesPlayers = useMemo(
    () => anotadosPlayers.filter((p) => !titularIds.includes(p.id)),
    [anotadosPlayers, titularIds],
  );

  const refreshPartidos = useCallback(async () => {
    const pl = await apiPartidos.list();
    setPartidos(Array.isArray(pl) ? pl : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ jugadores: list }, conv, pl] = await Promise.all([
          api.players(),
          apiConvocatorias.list(),
          apiPartidos.list(),
        ]);
        if (cancelled) return;
        setPlayers(list);
        setConvocatorias(Array.isArray(conv) ? conv : []);
        setAdmin(isAdminFromPlayersList(list));
        setPartidos(Array.isArray(pl) ? pl : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const first = anotadosPlayers.slice(0, TITULARES_CAMPO).map((p) => p.id);
    setTitularIds(first);
    const n: Record<string, boolean> = {};
    for (const p of anotadosPlayers) n[p.id] = first.includes(p.id);
    setSelected(n);
    setResult(null);
    setBorradorPartidoId(null);
  }, [diaPartido, fechaPartidoCal, anotadosPlayers.map((p) => p.id).join("|")]);

  function syncTitularFromSelected(next: Record<string, boolean>) {
    const on = Object.entries(next)
      .filter(([, v]) => v)
      .map(([id]) => id);
    if (on.length > TITULARES_CAMPO) {
      setError(`Solo podés marcar ${TITULARES_CAMPO} titulares (5 vs 5).`);
      return;
    }
    setError(null);
    setSelected(next);
    setTitularIds(on);
  }

  const chosenIds = useMemo(() => titularIds, [titularIds]);

  const borradores = useMemo(
    () => partidos.filter((p) => p.confirmado_admin !== true).sort((a, b) => (b.fecha > a.fecha ? 1 : -1)),
    [partidos],
  );

  async function confirmarDesdeLista(partidoId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiPartidos.confirmar(partidoId);
      await refreshPartidos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if (chosenIds.length !== TITULARES_CAMPO) {
        throw new Error(`Tenés que elegir exactamente ${TITULARES_CAMPO} titulares para jugar 5 vs 5.`);
      }
      const r = await api.balanceTeams(chosenIds, { useF5Scores: useF5Balance });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function toggleTitular(playerId: string, on: boolean) {
    const next = { ...selected, [playerId]: on };
    const count = Object.values(next).filter(Boolean).length;
    if (count > TITULARES_CAMPO) {
      setError(`Máximo ${TITULARES_CAMPO} titulares.`);
      return;
    }
    setError(null);
    syncTitularFromSelected(next);
  }

  function toggleAllTitulares(on: boolean) {
    if (!on) {
      const cleared: Record<string, boolean> = {};
      for (const p of anotadosPlayers) cleared[p.id] = false;
      syncTitularFromSelected(cleared);
      return;
    }
    const first = anotadosPlayers.slice(0, TITULARES_CAMPO);
    const next: Record<string, boolean> = {};
    for (const p of anotadosPlayers) next[p.id] = first.some((x) => x.id === p.id);
    syncTitularFromSelected(next);
  }

  async function guardarBorradorInterno(): Promise<string> {
    if (!result) throw new Error("Generá los equipos primero.");
    if (titularIds.length !== TITULARES_CAMPO) throw new Error(`Seleccioná ${TITULARES_CAMPO} titulares.`);
    const suplentes = suplentesPlayers.map((s) => ({ id: s.id, apodo: s.apodo }));
    const { id } = await apiPartidos.crearBorrador(fechaPartidoCal, result.teamA, result.teamB, {
      suplentes,
      horaPartido,
      textoEquipamiento,
    });
    return id;
  }

  async function guardarBorrador() {
    setBusy(true);
    setError(null);
    try {
      const id = await guardarBorradorInterno();
      setBorradorPartidoId(id);
      await refreshPartidos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmarNotificar() {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      let pid = borradorPartidoId;
      if (!pid) pid = await guardarBorradorInterno();
      setBorradorPartidoId(pid);
      await apiPartidos.confirmar(pid);
      await refreshPartidos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function rearmarBorradorDb(partidoId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiPartidos.rearmar(partidoId);
      setBorradorPartidoId(null);
      setResult(null);
      await refreshPartidos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  function recalcularEquipos() {
    setError(null);
    void generate();
  }

  if (error && !players) return <div className="error">{error}</div>;
  if (!players) return <p className="muted">Cargando…</p>;

  return (
    <div>
      <h1>Armar equipos</h1>
      <p className="sub">
        Solo aparecen los jugadores <strong>anotados</strong> para el próximo partido del día elegido. El campo es{" "}
        <strong>5 vs 5</strong> ({TITULARES_CAMPO} titulares); el resto queda como suplente en orden de anotación. Podés
        balancear por nota F5 o por perfil completo. Las exclusiones «no compartir equipo» (Próximos partidos) se
        respetan al generar.
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Partido a armar</h2>
        <div className="row">
          <label>Día</label>
          <select value={diaPartido} onChange={(e) => setDiaPartido(e.target.value as "martes" | "jueves")}>
            <option value="martes">Martes</option>
            <option value="jueves">Jueves</option>
          </select>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Fecha de convocatoria (Argentina): <strong>{fechaPartidoCal}</strong> · {anotadosPlayers.length} anotados
        </p>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <label className="checkbox-row player-row" style={{ cursor: "pointer", marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={useF5Balance}
            onChange={(e) => setUseF5Balance(e.target.checked)}
          />
          <span>
            <strong>Usar nota final F5</strong>{" "}
            <span className="muted">
              (promedio 1–5 con mirada del grupo). Si lo desmarcás, se usa el perfil completo (1–10).
            </span>
          </span>
        </label>
      </div>

      {admin && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Detalle para las notificaciones</h2>
          <div className="row">
            <label>Hora del partido (Argentina)</label>
            <input type="time" value={horaPartido} onChange={(e) => setHoraPartido(e.target.value)} />
          </div>
          <div className="row">
            <label>Equipamiento / colores / cancha</label>
            <textarea
              value={textoEquipamiento}
              onChange={(e) => setTextoEquipamiento(e.target.value)}
              rows={2}
              placeholder="Ej.: Claros camiseta blanca · Oscuros verde · Cancha sintética municipal"
              style={{ width: "100%", maxWidth: "480px" }}
            />
          </div>
          {borradores.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <p className="muted" style={{ marginTop: 0 }}>
                Borradores guardados (sin notificar):
              </p>
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {borradores.map((p) => (
                  <li key={p.id} style={{ marginBottom: "0.5rem" }}>
                    <strong>{p.fecha}</strong> · {p.id.slice(0, 8)}…{" "}
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void confirmarDesdeLista(p.id)}
                    >
                      Confirmar
                    </button>{" "}
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => rearmarBorradorDb(p.id)}>
                      Rearmar (borrador)
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Titulares ({titularIds.length}/{TITULARES_CAMPO})</h2>
        {anotadosPlayers.length === 0 ? (
          <p className="muted">No hay jugadores anotados para esta fecha y día. Pediles que se anoten en «Próximos partidos».</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <button type="button" className="btn btn-ghost" onClick={() => toggleAllTitulares(true)}>
                Primeros {TITULARES_CAMPO} por orden de anotación
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => toggleAllTitulares(false)}>
                Quitar titulares
              </button>
            </div>
            <div className="list">
              {anotadosPlayers.map((p) => (
                <label key={p.id} className="checkbox-row player-row" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selected[p.id] ?? false}
                    onChange={(e) => toggleTitular(p.id, e.target.checked)}
                  />
                  <span>
                    <strong>{p.apodo}</strong>{" "}
                    <span className="muted">
                      ({p.posicionPreferida}) · final {p.finalScore.toFixed(2)}
                      {p.f5FinalScore != null ? ` · F5 ${p.f5FinalScore.toFixed(2)}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
        {suplentesPlayers.length > 0 ? (
          <p className="muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            <strong>Suplentes</strong> (orden de promoción si se da de baja un titular):{" "}
            {suplentesPlayers.map((s) => s.apodo).join(" · ")}
          </p>
        ) : null}
        <button
          className="btn btn-primary"
          type="button"
          style={{ marginTop: "1rem" }}
          onClick={() => void generate()}
          disabled={loading || anotadosPlayers.length < TITULARES_CAMPO}
        >
          {loading ? "Calculando…" : "Generar equipos 5 vs 5"}
        </button>
        {anotadosPlayers.length < TITULARES_CAMPO ? (
          <p className="muted" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            Hacen falta al menos {TITULARES_CAMPO} anotados para armar el partido.
          </p>
        ) : null}
        {error && (
          <div className="error" style={{ marginTop: "1rem" }}>
            {error}
          </div>
        )}
      </div>

      {result && (
        <>
          <div className="team-grid">
            <div className="card team-card">
              <h3>Equipo A · suma {result.sumA.toFixed(2)}</h3>
              <ul>
                {result.teamA.map((x) => (
                  <li key={x.id}>
                    {x.apodo} · {x.posicionPreferida} · {x.score.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card team-card">
              <h3>Equipo B · suma {result.sumB.toFixed(2)}</h3>
              <ul>
                {result.teamB.map((x) => (
                  <li key={x.id}>
                    {x.apodo} · {x.posicionPreferida} · {x.score.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {admin && (
            <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={recalcularEquipos}>
                Recalcular equipos
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void guardarBorrador()}>
                {busy ? "Guardando…" : "Guardar borrador (no notifica)"}
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirmarNotificar()}>
                {busy ? "Procesando…" : "Confirmar y notificar a todos"}
              </button>
              {borradorPartidoId ? (
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => rearmarBorradorDb(borradorPartidoId)}>
                  Volver a borrador vacío
                </button>
              ) : null}
            </div>
          )}

          <p className="muted" style={{ marginTop: "1rem" }}>
            Diferencia entre equipos (suma de notas): {result.difference.toFixed(3)} · Generado{" "}
            {new Date(result.generatedAt).toLocaleString()}
            {result.usingF5Scores != null && (
              <>
                {" "}
                · Criterio: {result.usingF5Scores ? "F5 (1–5)" : "perfil completo (1–10)"}
              </>
            )}
            {result.avoidPairsApplied != null && result.avoidPairsApplied > 0 && (
              <> · Restricciones «no mismo equipo»: {result.avoidPairsApplied} pares</>
            )}
          </p>
        </>
      )}
    </div>
  );
}
