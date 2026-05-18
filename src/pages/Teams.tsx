import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, apiConvocatorias, apiPartidos, isAdminFromPlayersList, type ConvocatoriaRow, type PartidoRow } from "../api";
import { formatRating } from "../lib/formatRating";
import { TEAM_LABEL_CLAROS, TEAM_LABEL_OSCUROS } from "../lib/teamsBalance";
import type { BalanceResponse, PlayerSummary } from "../types";
import { nextMatchIso } from "./ProximosPartidosPage";

const TITULARES_CAMPO = 10;

type ModoFuente = "anotados" | "manual";

function playerScoreLine(p: PlayerSummary): string {
  const f11 = formatRating(p.finalScore);
  const f5 = p.f5FinalScore != null ? ` · F5 ${formatRating(p.f5FinalScore)}` : "";
  return `(${p.posicionPreferida}) · F11 ${f11}${f5}`;
}

export default function TeamsPage() {
  const [players, setPlayers] = useState<PlayerSummary[] | null>(null);
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaRow[]>([]);
  const [diaPartido, setDiaPartido] = useState<"martes" | "jueves">("martes");
  const [modoFuente, setModoFuente] = useState<ModoFuente>("anotados");
  const [manualPoolIds, setManualPoolIds] = useState<string[]>([]);
  const [busquedaManual, setBusquedaManual] = useState("");
  const [titularIds, setTitularIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<BalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [partidos, setPartidos] = useState<PartidoRow[]>([]);
  const [borradorPartidoId, setBorradorPartidoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useF5Balance, setUseF5Balance] = useState(true);
  const [horaPartido, setHoraPartido] = useState("21:30");
  const [observacion, setObservacion] = useState("");

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

  const poolPlayers = useMemo(() => {
    if (modoFuente === "anotados") return anotadosPlayers;
    if (!players) return [];
    const set = new Set(manualPoolIds);
    return players.filter((p) => set.has(p.id)).sort((a, b) => a.apodo.localeCompare(b.apodo, "es"));
  }, [modoFuente, anotadosPlayers, players, manualPoolIds]);

  const suplentesPlayers = useMemo(
    () => poolPlayers.filter((p) => !titularIds.includes(p.id)),
    [poolPlayers, titularIds],
  );

  const busquedaManualNorm = busquedaManual.trim().toLowerCase();

  const jugadoresBusqueda = useMemo(() => {
    if (!players || modoFuente !== "manual") return [];
    const enPool = new Set(manualPoolIds);
    return players
      .filter((p) => !enPool.has(p.id))
      .filter((p) => {
        if (!busquedaManualNorm) return true;
        return (
          p.apodo.toLowerCase().includes(busquedaManualNorm) ||
          p.nombreCompleto.toLowerCase().includes(busquedaManualNorm)
        );
      })
      .slice(0, 25);
  }, [players, modoFuente, manualPoolIds, busquedaManualNorm]);

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

  const poolKey = poolPlayers.map((p) => p.id).join("|");

  useEffect(() => {
    const first = poolPlayers.slice(0, TITULARES_CAMPO).map((p) => p.id);
    setTitularIds(first);
    const n: Record<string, boolean> = {};
    for (const p of poolPlayers) n[p.id] = first.includes(p.id);
    setSelected(n);
    setResult(null);
    setBorradorPartidoId(null);
  }, [diaPartido, fechaPartidoCal, modoFuente, poolKey]);

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

  function agregarAlPool(playerId: string) {
    setManualPoolIds((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));
    setBusquedaManual("");
    setError(null);
  }

  function quitarDelPool(playerId: string) {
    setManualPoolIds((prev) => prev.filter((id) => id !== playerId));
    setError(null);
  }

  function importarAnotadosAlPool() {
    const ids = anotadosPlayers.map((p) => p.id);
    setManualPoolIds((prev) => {
      const set = new Set(prev);
      for (const id of ids) set.add(id);
      return [...set];
    });
    setError(null);
  }

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
      for (const p of poolPlayers) cleared[p.id] = false;
      syncTitularFromSelected(cleared);
      return;
    }
    const first = poolPlayers.slice(0, TITULARES_CAMPO);
    const next: Record<string, boolean> = {};
    for (const p of poolPlayers) next[p.id] = first.some((x) => x.id === p.id);
    syncTitularFromSelected(next);
  }

  async function guardarBorradorInterno(): Promise<string> {
    if (!result) throw new Error("Generá los equipos primero.");
    if (titularIds.length !== TITULARES_CAMPO) throw new Error(`Seleccioná ${TITULARES_CAMPO} titulares.`);
    const suplentes = suplentesPlayers.map((s) => ({ id: s.id, apodo: s.apodo }));
    const { id } = await apiPartidos.crearBorrador(fechaPartidoCal, result.teamA, result.teamB, {
      suplentes,
      horaPartido,
      textoEquipamiento: observacion,
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
  if (admin === false) return <Navigate to="/" replace />;

  return (
    <div>
      <h1>Armar equipos</h1>
      <p className="sub">
        Armá el partido <strong>5 vs 5</strong> ({TITULARES_CAMPO} titulares). Podés usar solo los{" "}
        <strong>anotados</strong> o armar una lista <strong>manual</strong> con cualquier jugador registrado. El balanceo
        equilibra el <strong>promedio en cada característica</strong> (F5 o F11) y reparte defensas, mediocampistas y
        delanteros según puesto principal o alternativo; se respetan las exclusiones «no compartir equipo».
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Origen de jugadores</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <button
            type="button"
            className={`btn ${modoFuente === "anotados" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setModoFuente("anotados")}
          >
            Solo anotados
          </button>
          <button
            type="button"
            className={`btn ${modoFuente === "manual" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setModoFuente("manual")}
          >
            Selección manual
          </button>
        </div>
        {modoFuente === "anotados" ? (
          <p className="muted" style={{ margin: 0 }}>
            Aparecen los jugadores anotados en «Próximos partidos» para el día y fecha elegidos.
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Buscá jugadores registrados y agregalos al partido aunque no se hayan anotado. En el pool marcá quiénes son
            titulares.
          </p>
        )}
      </div>

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
          Fecha de convocatoria (Argentina): <strong>{fechaPartidoCal}</strong>
          {modoFuente === "anotados" ? (
            <>
              {" "}
              · {anotadosPlayers.length} anotados
            </>
          ) : (
            <>
              {" "}
              · {poolPlayers.length} en el pool manual
            </>
          )}
        </p>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <label className="checkbox-row player-row" style={{ cursor: "pointer", marginBottom: 0 }}>
          <input type="checkbox" checked={useF5Balance} onChange={(e) => setUseF5Balance(e.target.checked)} />
          <span>
            <strong>Usar nota final F5</strong>{" "}
            <span className="muted">(1–5). Si lo desmarcás, se usa el perfil completo F11 (1–10).</span>
          </span>
        </label>
      </div>

      {modoFuente === "manual" && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Agregar jugadores al partido</h2>
          <div className="row">
            <label>Buscar por apodo o nombre</label>
            <input
              type="search"
              value={busquedaManual}
              onChange={(e) => setBusquedaManual(e.target.value)}
              placeholder="Ej: Juan, Messi…"
              autoComplete="off"
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={anotadosPlayers.length === 0}
              onClick={importarAnotadosAlPool}
            >
              Importar anotados del día ({anotadosPlayers.length})
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={manualPoolIds.length === 0}
              onClick={() => setManualPoolIds([])}
            >
              Vaciar pool
            </button>
          </div>
          {jugadoresBusqueda.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {busquedaManualNorm
                ? "No hay jugadores que coincidan o ya están en el pool."
                : "Escribí para buscar o importá los anotados."}
            </p>
          ) : (
            <ul className="list" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {jugadoresBusqueda.map((p) => (
                <li
                  key={p.id}
                  className="player-row"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}
                >
                  <span>
                    <strong>{p.apodo}</strong>{" "}
                    <span className="muted">{playerScoreLine(p)}</span>
                  </span>
                  <button type="button" className="btn btn-primary" onClick={() => agregarAlPool(p.id)}>
                    Agregar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {admin === true && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Notificación automática al confirmar</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Fecha y hora se usan para avisar a <strong>titulares</strong> (equipo Claros u Oscuros, día y hora) y a{" "}
            <strong>suplentes</strong> (solo número de suplente, día y hora; se les avisa aparte si pasan a titular).
          </p>
          <div className="row">
            <label>Hora del partido (Argentina)</label>
            <input type="time" value={horaPartido} onChange={(e) => setHoraPartido(e.target.value)} />
          </div>
          <div className="row">
            <label>Observación (opcional)</label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              placeholder="Solo si hace falta otra información (se agrega al mensaje de los titulares)."
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
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Titulares ({titularIds.length}/{TITULARES_CAMPO})
          {modoFuente === "manual" ? " · pool manual" : ""}
        </h2>
        {poolPlayers.length === 0 ? (
          <p className="muted">
            {modoFuente === "anotados"
              ? "No hay jugadores anotados para esta fecha y día. Pediles que se anoten en «Próximos partidos» o usá selección manual."
              : "Agregá jugadores al pool con la búsqueda de arriba."}
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <button type="button" className="btn btn-ghost" onClick={() => toggleAllTitulares(true)}>
                Primeros {TITULARES_CAMPO} del pool
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => toggleAllTitulares(false)}>
                Quitar titulares
              </button>
            </div>
            <div className="list">
              {poolPlayers.map((p) => (
                <div key={p.id} className="checkbox-row player-row" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <label style={{ cursor: "pointer", flex: 1, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      checked={selected[p.id] ?? false}
                      onChange={(e) => toggleTitular(p.id, e.target.checked)}
                    />
                    <span>
                      <strong>{p.apodo}</strong> <span className="muted">{playerScoreLine(p)}</span>
                    </span>
                  </label>
                  {modoFuente === "manual" ? (
                    <button type="button" className="btn btn-ghost" onClick={() => quitarDelPool(p.id)}>
                      Quitar
                    </button>
                  ) : null}
                </div>
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
          disabled={loading || poolPlayers.length < TITULARES_CAMPO}
        >
          {loading ? "Calculando…" : "Generar equipos 5 vs 5"}
        </button>
        {poolPlayers.length < TITULARES_CAMPO ? (
          <p className="muted" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            Hacen falta al menos {TITULARES_CAMPO} jugadores en el pool para armar el partido.
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
              <h3>{TEAM_LABEL_CLAROS} · prom. {formatRating(result.sumA)}</h3>
              <ul>
                {result.teamA.map((x) => (
                  <li key={x.id}>
                    {x.apodo} · {x.posicionPreferida} · {formatRating(x.score)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card team-card">
              <h3>{TEAM_LABEL_OSCUROS} · prom. {formatRating(result.sumB)}</h3>
              <ul>
                {result.teamB.map((x) => (
                  <li key={x.id}>
                    {x.apodo} · {x.posicionPreferida} · {formatRating(x.score)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {admin === true && (
            <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={recalcularEquipos}>
                Recalcular equipos
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void guardarBorrador()}>
                {busy ? "Guardando…" : "Solo guardar borrador (sin notificar)"}
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void confirmarNotificar()}>
                {busy ? "Procesando…" : "Confirmar partido y enviar notificaciones automáticamente"}
              </button>
              {borradorPartidoId ? (
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => rearmarBorradorDb(borradorPartidoId)}>
                  Volver a borrador vacío
                </button>
              ) : null}
            </div>
          )}

          <p className="muted" style={{ marginTop: "1rem" }}>
            Desbalance entre equipos (suma de diferencias por característica): {formatRating(result.difference)} ·
            Generado{" "}
            {new Date(result.generatedAt).toLocaleString()}
            {result.usingF5Scores != null && (
              <>
                {" "}
                · Criterio: {result.usingF5Scores ? "F5 (1–5)" : "perfil completo F11 (1–10)"}
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
