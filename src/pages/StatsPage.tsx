import { useEffect, useMemo, useState } from "react";
import { api, apiEncuesta, apiPartidos, isAdminFromPlayersList, type PartidoRow, type PresenciaRow } from "../api";
import { collectApodosFromPartidos, parseEquipoNombres } from "../lib/partidoEquipos";
import {
  ENCUESTA_META,
  type EncuestaTrofeoRow,
} from "../lib/encuestaPostPartido";
import {
  buildCuriosidades,
  buildConclusiones,
  buildDifficultyPerformance,
  buildFunStats,
  buildPairStats,
  buildPlayerRanking,
  buildRecentMatches,
  buildRivalNemesis,
  buildSeasonSummary,
  buildTrends,
  buildWinEvolution,
  difficultyLabel,
  partidoTieneResultado,
  type PairStat,
} from "../lib/partidoStats";
import { Trophy, Activity, Target } from "lucide-react";
import MatchSpotlightCard from "../components/MatchSpotlightCard";
import { TEAM_LABEL_CLAROS, TEAM_LABEL_OSCUROS } from "../lib/teamsBalance";
import type { PlayerSummary } from "../types";
import "../stats-dashboard.css";

const FUN_ICONS: Record<string, string> = {
  mvp: "🥇",
  losses: "😤",
  dry: "💀",
  "win-streak": "🔥",
  "loss-streak": "🧊",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  if (!y || !m || !d) return fecha;
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function pairLabel(p: PairStat): string {
  return `${p.aApodo} + ${p.bApodo}`;
}

function DuoCol({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: PairStat[];
  tone: "green" | "red" | "blue" | "cyan";
}) {
  return (
    <div className={`stats-duo-col stats-duo-col--${tone}`}>
      <h3>{title}</h3>
      {!rows.length ? (
        <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
          Sin datos
        </p>
      ) : (
        <ul className="stats-duo-list">
          {rows.map((p) => (
            <li key={`${p.aId}|${p.bId}`}>
              <strong>{pairLabel(p)}</strong>
              <span>
                {p.g}-{p.p}-{p.e} · {p.pctVict.toFixed(0)}% · {p.pj} PJ
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function rachaPill(racha: string) {
  const cls = racha.startsWith("G")
    ? "stats-pill stats-pill--g"
    : racha.startsWith("P")
      ? "stats-pill stats-pill--p"
      : "stats-pill stats-pill--e";
  return <span className={cls}>{racha}</span>;
}

export default function StatsPage() {
  const [players, setPlayers] = useState<PlayerSummary[] | null>(null);
  const [partidos, setPartidos] = useState<PartidoRow[]>([]);
  const [presencias, setPresencias] = useState<PresenciaRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [formPartidoId, setFormPartidoId] = useState("");
  const [golesClaros, setGolesClaros] = useState("0");
  const [golesOscuros, setGolesOscuros] = useState("0");
  const [mvpId, setMvpId] = useState("");
  const [comentario, setComentario] = useState("");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [trofeos, setTrofeos] = useState<EncuestaTrofeoRow[]>([]);

  const admin = players ? isAdminFromPlayersList(players) : false;
  const seasonYear = new Date().getFullYear();

  async function refresh() {
    const [pl, prt, pres, trop] = await Promise.all([
      api.players(),
      apiPartidos.list(),
      apiPartidos.listPresencias(),
      apiEncuesta.trofeos().catch(() => [] as EncuestaTrofeoRow[]),
    ]);
    setPlayers(pl.jugadores);
    setPartidos(Array.isArray(prt) ? prt : []);
    setPresencias(Array.isArray(pres) ? pres : []);
    setTrofeos(Array.isArray(trop) ? trop : []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
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

  const apodoById = useMemo(() => {
    // 1) Apodos históricos guardados en el JSON de cada partido (cubre jugadores
    //    que ya no están en el roster actual pero sí en Duplas / Enfrentamientos).
    const m = collectApodosFromPartidos(partidos);
    // 2) Roster actual pisa lo anterior (apodo vigente).
    for (const p of players ?? []) m.set(p.id, p.apodo);
    return m;
  }, [players, partidos]);

  const ranking = useMemo(
    () => buildPlayerRanking(partidos, presencias, apodoById),
    [partidos, presencias, apodoById],
  );
  const funCards = useMemo(
    () => buildFunStats(partidos, presencias, apodoById),
    [partidos, presencias, apodoById],
  );
  const pairs = useMemo(
    () => buildPairStats(partidos, presencias, apodoById),
    [partidos, presencias, apodoById],
  );
  const rivals = useMemo(
    () => buildRivalNemesis(partidos, presencias, apodoById),
    [partidos, presencias, apodoById],
  );
  const trends = useMemo(() => buildTrends(ranking), [ranking]);
  const summary = useMemo(
    () => buildSeasonSummary(partidos, presencias, apodoById),
    [partidos, presencias, apodoById],
  );
  const evolution = useMemo(() => buildWinEvolution(partidos), [partidos]);
  const recent = useMemo(() => buildRecentMatches(partidos, 5), [partidos]);
  const difficulty = useMemo(
    () => buildDifficultyPerformance(partidos, presencias, apodoById),
    [partidos, presencias, apodoById],
  );
  const curiosidades = useMemo(
    () =>
      buildCuriosidades(partidos, presencias, apodoById, pairs, ranking),
    [partidos, presencias, apodoById, pairs, ranking],
  );
  const conclusiones = useMemo(
    () => buildConclusiones(summary, ranking, trends, pairs, apodoById, partidos),
    [summary, ranking, trends, pairs, apodoById, partidos],
  );
  const spotlightMatch = useMemo(() => {
    const last = recent[0];
    if (!last) return null;
    const p = partidos.find((x) => x.id === last.id);
    if (!p) return null;
    return {
      ...last,
      claros: parseEquipoNombres(p.equipo_claros, apodoById),
      oscuros: parseEquipoNombres(p.equipo_oscuros, apodoById),
    };
  }, [recent, partidos, apodoById]);

  const pendientesResultado = useMemo(
    () => partidos.filter((p) => p.confirmado_admin === true && !partidoTieneResultado(p)),
    [partidos],
  );

  const formPartido = useMemo(
    () => partidos.find((p) => p.id === formPartidoId) ?? null,
    [partidos, formPartidoId],
  );

  const mvpOpciones = useMemo(() => {
    if (!formPartido) return [];
    const fromPres = presencias.filter(
      (pr) =>
        pr.partido_id === formPartido.id &&
        (pr.estado === "convocado" || pr.estado === "presente"),
    );
    if (fromPres.length) {
      return fromPres.map((pr) => ({
        id: pr.jugador_id,
        apodo: apodoById.get(pr.jugador_id) ?? "Ex-jugador",
        equipo: pr.equipo,
      }));
    }
    return [
      ...parseEquipoNombres(formPartido.equipo_claros, apodoById).map((x) => ({
        id: x.id,
        apodo: x.apodo,
        equipo: "claros" as const,
      })),
      ...parseEquipoNombres(formPartido.equipo_oscuros, apodoById).map((x) => ({
        id: x.id,
        apodo: x.apodo,
        equipo: "oscuros" as const,
      })),
    ];
  }, [formPartido, presencias, apodoById]);

  useEffect(() => {
    if (!formPartidoId && pendientesResultado[0]) {
      setFormPartidoId(pendientesResultado[0].id);
    }
  }, [formPartidoId, pendientesResultado]);

  const evoMax = useMemo(() => {
    let m = 1;
    for (const p of evolution) m = Math.max(m, p.claros, p.oscuros);
    return m;
  }, [evolution]);

  async function onGuardarResultado(e: React.FormEvent) {
    e.preventDefault();
    if (!formPartidoId) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const gc = Number(golesClaros);
      const go = Number(golesOscuros);
      if (!Number.isFinite(gc) || !Number.isFinite(go) || gc < 0 || go < 0) {
        throw new Error("Indicá goles válidos (0 o más).");
      }
      await apiPartidos.cargarResultado(formPartidoId, {
        golesClaros: Math.round(gc),
        golesOscuros: Math.round(go),
        mvpJugadorId: mvpId || null,
        comentario: comentario.trim() || null,
      });
      await refresh();
      setOkMsg("Resultado guardado. Las stats se actualizaron.");
      setGolesClaros("0");
      setGolesOscuros("0");
      setMvpId("");
      setComentario("");
      setFormPartidoId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Cargando stats…</p>;

  return (
    <div className="stats-page">
      <div className="stats-float">
        <img className="stats-float__decor" src="/decor/side-trophy-neon.png" alt="" aria-hidden="true" />
        <div className="stats-float__chrome" aria-hidden>
          <span className="stats-float__dot stats-float__dot--r" />
          <span className="stats-float__dot stats-float__dot--y" />
          <span className="stats-float__dot stats-float__dot--g" />
          <span className="stats-float__chrome-label">Ventana · Fútbol Stats</span>
        </div>

        <header className="stats-hero">
          <div>
            <h1 className="stats-hero__title">Fútbol Stats · Temporada {seasonYear}</h1>
            <p className="stats-hero__sub">La verdad no miente · Claros vs Oscuros</p>
            <p className="stats-hero__quote">«No se trata solo de ganar: se trata de hacerlo con estilo.»</p>
          </div>
          <div className="stats-hero__badges">
            <div className="stats-hero__badge stats-hero__badge--purple">
              <Trophy size={14} className="neon-icon" /> {summary.totalPartidos} partido{summary.totalPartidos === 1 ? "" : "s"}
            </div>
            <div className="stats-hero__serie" aria-label="Serie de temporada">
              <span className="c">☀️ {TEAM_LABEL_CLAROS}</span> {summary.clarosWins}
              {" – "}
              {summary.oscurosWins} <span className="o">{TEAM_LABEL_OSCUROS} 🌙</span>
            </div>
          </div>
        </header>

        {error ? <div className="error">{error}</div> : null}
        {okMsg ? (
          <p className="muted" style={{ color: "var(--st-green, var(--accent))" }}>
            {okMsg}
          </p>
        ) : null}

        <section className="stats-kpis" aria-label="Resumen general">
          <div className="stats-kpi stats-kpi--neutral">
            <span className="stats-kpi__icon"><Activity size={18} className="neon-icon" /></span>
            <p className="stats-kpi__label">Total partidos</p>
            <p className="stats-kpi__value">{summary.totalPartidos}</p>
          </div>
          <div className="stats-kpi stats-kpi--claro">
            <span className="stats-kpi__icon">☀️</span>
            <p className="stats-kpi__label">Victorias Claros</p>
            <p className="stats-kpi__value">{summary.clarosWins}</p>
          </div>
          <div className="stats-kpi stats-kpi--oscuro">
            <span className="stats-kpi__icon">🌙</span>
            <p className="stats-kpi__label">Victorias Oscuros</p>
            <p className="stats-kpi__value">{summary.oscurosWins}</p>
          </div>
          <div className="stats-kpi stats-kpi--green">
            <span className="stats-kpi__icon">😊</span>
            <p className="stats-kpi__label">Fácil</p>
            <p className="stats-kpi__value">{summary.facil}</p>
          </div>
          <div className="stats-kpi stats-kpi--orange">
            <span className="stats-kpi__icon">🤝</span>
            <p className="stats-kpi__label">Parejo</p>
            <p className="stats-kpi__value">{summary.parejo}</p>
          </div>
          <div className="stats-kpi stats-kpi--red">
            <span className="stats-kpi__icon">🔥</span>
            <p className="stats-kpi__label">Disparejo</p>
            <p className="stats-kpi__value">{summary.disparejo}</p>
          </div>
          <div className="stats-kpi stats-kpi--purple">
            <span className="stats-kpi__icon">👥</span>
            <p className="stats-kpi__label">Jugadores</p>
            <p className="stats-kpi__value">{summary.jugadoresUnicos}</p>
          </div>
        </section>

        {spotlightMatch ? (
          <section className="stats-panel stats-panel--spotlight">
            <MatchSpotlightCard
              title="Partido del día"
              fecha={spotlightMatch.fecha}
              claros={spotlightMatch.claros}
              oscuros={spotlightMatch.oscuros}
              golesClaros={spotlightMatch.golesClaros}
              golesOscuros={spotlightMatch.golesOscuros}
              mvpApodo={spotlightMatch.mvpId ? apodoById.get(spotlightMatch.mvpId) ?? null : null}
              dificultad={spotlightMatch.dificultad}
            />
          </section>
        ) : null}

        <section className="stats-panel">
          <h2 className="stats-panel__title">
            <Trophy size={16} className="neon-icon" /> Trofeos Scaloneta
          </h2>
          <p className="stats-panel__hint">
            Votos acumulados de la encuesta post-partido: Messi, Cuti, Julián y Dibu.
          </p>
          {!trofeos.length ? (
            <p className="muted" style={{ margin: 0 }}>
              Todavía no hay votos. Cuando el admin cargue un resultado, los jugadores podrán votar.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="stats-dash-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jugador</th>
                    <th title={ENCUESTA_META.messi.titulo}>🐐 Messi</th>
                    <th title={ENCUESTA_META.cuti.titulo}>🛡️ Cuti</th>
                    <th title={ENCUESTA_META.julian.titulo}>🫁 Julián</th>
                    <th title={ENCUESTA_META.dibu.titulo}>🧤 Dibu</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {trofeos.map((t, i) => (
                    <tr key={t.jugadorId}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>{t.apodo}</strong>
                      </td>
                      <td className="g">{t.messi || "—"}</td>
                      <td>{t.cuti || "—"}</td>
                      <td className="pct">{t.julian || "—"}</td>
                      <td>{t.dibu || "—"}</td>
                      <td>
                        <strong>{t.total}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="stats-layout-2">
          <section className="stats-panel">
            <h2 className="stats-panel__title">
              <Target size={16} className="neon-icon" /> Ranking de jugadores
            </h2>
            {!ranking.length ? (
              <p className="muted" style={{ margin: 0 }}>
                Sin datos aún.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="stats-dash-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Jugador</th>
                      <th>PJ</th>
                      <th>G</th>
                      <th>P</th>
                      <th>E</th>
                      <th>% Vict</th>
                      <th>Racha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r, i) => (
                      <tr key={r.jugadorId}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{r.apodo}</strong>
                        </td>
                        <td>{r.pj}</td>
                        <td className="g">{r.g}</td>
                        <td className="p">{r.p}</td>
                        <td>{r.e}</td>
                        <td className="pct">{r.pctVict.toFixed(0)}%</td>
                        <td>{rachaPill(r.racha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="stats-panel">
            <h2 className="stats-panel__title">
              <span>😃</span> Estadísticas divertidas
            </h2>
            <div className="stats-fun-grid">
              {funCards.map((c) => {
                const hasMain = Boolean(c.value && c.value !== "—");
                const extras = (c.names ?? []).filter((n) => n && n !== "—");
                return (
                  <div
                    key={c.id}
                    className={`stats-fun-tile${c.tone ? ` stats-fun-tile--${c.tone}` : ""}`}
                  >
                    <span className="stats-fun-tile__icon">{FUN_ICONS[c.id] ?? "⭐"}</span>
                    <p className="stats-fun-tile__label">{c.title}</p>
                    {hasMain ? (
                      <span className="stats-fun-tile__main-avatar" aria-hidden>
                        {initials(c.value.split(" (")[0])}
                      </span>
                    ) : null}
                    <p className="stats-fun-tile__value">{c.value}</p>
                    {c.detail ? <p className="stats-fun-tile__detail">{c.detail}</p> : null}
                    {extras.length ? (
                      <div className="stats-fun-tile__avatars">
                        {extras.slice(0, 3).map((n) => (
                          <span key={n} className="stats-fun-tile__avatar" title={n}>
                            {initials(n.split(" (")[0])}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {c.names?.length ? (
                      <ul className="stats-fun-tile__names">
                        {c.names.map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="stats-serie-box">
              <p className="stats-serie-box__label">Serie de color</p>
              <p className="stats-serie-box__score">
                <span className="stats-serie-box__emoji">☀️</span>
                <span className="c">{TEAM_LABEL_CLAROS}</span> {summary.clarosWins}
                <span>–</span>
                {summary.oscurosWins} <span className="o">{TEAM_LABEL_OSCUROS}</span>
                <span className="stats-serie-box__emoji">🌙</span>
              </p>
            </div>
          </section>
        </div>

        <section className="stats-panel">
          <h2 className="stats-panel__title">
            <span>🤝</span> Duplas
          </h2>
          <p className="stats-panel__hint">
            Parejas del mismo equipo.{" "}
            {pairs.invictasCount > 0
              ? `${pairs.invictasCount} invicta${pairs.invictasCount === 1 ? "" : "s"} con al menos 1 victoria.`
              : "Todavía no hay duplas invictas."}
          </p>
          <div className="stats-duo-grid">
            <DuoCol title="Mejores" rows={pairs.mejores} tone="green" />
            <DuoCol title="Peores" rows={pairs.peores} tone="red" />
            <DuoCol title="Invictas" rows={pairs.invictas} tone="blue" />
            <DuoCol title="Más juntas" rows={pairs.masJuntas} tone="cyan" />
          </div>
        </section>

        <div className="stats-layout-2">
          <section className="stats-panel">
            <h2 className="stats-panel__title">
              <span>⚔️</span> Enfrentamientos
            </h2>
            <p className="stats-panel__hint">Rival favorito = a quién más le ganás · Némesis = quién más te gana</p>
            {!rivals.length ? (
              <p className="muted" style={{ margin: 0 }}>
                Sin enfrentamientos con ganador aún.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="stats-dash-table">
                  <thead>
                    <tr>
                      <th>Jugador</th>
                      <th>Rival</th>
                      <th>Némesis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rivals.map((r) => (
                      <tr key={r.jugadorId}>
                        <td>
                          <strong>{r.apodo}</strong>
                        </td>
                        <td>
                          {r.rivalApodo ? (
                            <>
                              <span className="g">{r.rivalApodo}</span>{" "}
                              <span className="muted">({r.winsVs})</span>
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          {r.nemesisApodo ? (
                            <>
                              <span className="p">{r.nemesisApodo}</span>{" "}
                              <span className="muted">({r.lossesVs})</span>
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="stats-panel">
            <h2 className="stats-panel__title">
              <span>📈</span> Evolución de victorias
            </h2>
            {!evolution.length ? (
              <p className="muted" style={{ margin: 0 }}>
                Sin partidos todavía.
              </p>
            ) : (
              <>
                <div className="stats-evo" aria-hidden={false}>
                  {evolution.map((pt) => (
                    <div key={pt.fecha} className="stats-evo__col">
                      <div className="stats-evo__bars">
                        <div
                          className="stats-evo__bar stats-evo__bar--c"
                          style={{ height: `${Math.max(8, (pt.claros / evoMax) * 80)}px` }}
                          title={`Claros ${pt.claros}`}
                        />
                        <div
                          className="stats-evo__bar stats-evo__bar--o"
                          style={{ height: `${Math.max(8, (pt.oscuros / evoMax) * 80)}px` }}
                          title={`Oscuros ${pt.oscuros}`}
                        />
                      </div>
                      <span className="stats-evo__label">{pt.label}</span>
                    </div>
                  ))}
                </div>
                <p className="stats-panel__hint" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
                  <span style={{ color: "var(--st-claro)" }}>■ Claros</span>
                  {" · "}
                  <span style={{ color: "var(--st-oscuro)" }}>■ Oscuros</span>
                  {" · acumulado"}
                </p>
              </>
            )}
          </section>
        </div>

        <div className="stats-layout-2">
          <section className="stats-panel">
            <h2 className="stats-panel__title">
              <span>🕘</span> Últimos partidos
            </h2>
            {!recent.length ? (
              <p className="muted" style={{ margin: 0 }}>
                Todavía no hay resultados.
              </p>
            ) : (
              <ul className="stats-match-list">
                {recent.map((m) => (
                  <li key={m.id}>
                    <div>
                      <strong>{formatFecha(m.fecha)}</strong>
                      <div className="stats-match-list__score">
                        <span className="c">{TEAM_LABEL_CLAROS}</span> {m.golesClaros} –{" "}
                        {m.golesOscuros} <span className="o">{TEAM_LABEL_OSCUROS}</span>
                      </div>
                      {m.mvpId ? (
                        <span className="muted" style={{ fontSize: "0.78rem" }}>
                          MVP {apodoById.get(m.mvpId) ?? "—"}
                        </span>
                      ) : null}
                    </div>
                    <span className={`stats-diff-badge stats-diff-badge--${m.dificultad}`}>
                      {difficultyLabel(m.dificultad)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="stats-panel">
            <h2 className="stats-panel__title">
              <span>🎯</span> Dificultad · rendimiento
            </h2>
            <p className="stats-panel__hint">% victoria según el tipo de partido</p>
            {!difficulty.length ? (
              <p className="muted" style={{ margin: 0 }}>
                Sin datos.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="stats-dash-table">
                  <thead>
                    <tr>
                      <th>Jugador</th>
                      <th>Fácil</th>
                      <th>Parejo</th>
                      <th>Disparejo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {difficulty.map((r) => (
                      <tr key={r.jugadorId}>
                        <td>
                          <strong>{r.apodo}</strong>
                        </td>
                        <td>
                          {r.facil.pj ? (
                            <span className="g">{r.facil.pct.toFixed(0)}%</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          {r.parejo.pj ? (
                            <span className="pct">{r.parejo.pct.toFixed(0)}%</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          {r.disparejo.pj ? (
                            <span className="p">{r.disparejo.pct.toFixed(0)}%</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <section className="stats-panel">
          <h2 className="stats-panel__title">
            <span>🔥</span> Tendencias
          </h2>
          <div className="stats-trend-row">
            <div className="stats-trend-box stats-trend-box--up">
              <span className="stats-trend-box__icon">📈</span>
              <h3>Vienen mejorando</h3>
              {!trends.subiendo.length ? (
                <p className="empty">Nadie en racha G2+</p>
              ) : (
                <ul>
                  {trends.subiendo.map((t) => (
                    <li key={t.id}>
                      {t.apodo} · {t.racha}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="stats-trend-box stats-trend-box--down">
              <span className="stats-trend-box__icon">📉</span>
              <h3>Vienen empeorando</h3>
              {!trends.bajando.length ? (
                <p className="empty">Nadie en racha P2+</p>
              ) : (
                <ul>
                  {trends.bajando.map((t) => (
                    <li key={t.id}>
                      {t.apodo} · {t.racha}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="stats-trend-box stats-trend-box--inv">
              <span className="stats-trend-box__icon">🛡️</span>
              <h3>Invictos actualmente</h3>
              {!trends.invictos.length ? (
                <p className="empty">Nadie con 2+ PJ sin derrota</p>
              ) : (
                <ul>
                  {trends.invictos.map((t) => (
                    <li key={t.id}>
                      {t.apodo} · {t.pj} PJ
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="stats-trend-box stats-trend-box--dry">
              <span className="stats-trend-box__icon">😅</span>
              <h3>Todavía no ganaron</h3>
              {!trends.sinGanar.length ? (
                <p className="empty">Todos tienen victoria</p>
              ) : (
                <ul>
                  {trends.sinGanar.map((t) => (
                    <li key={t.id}>
                      {t.apodo} · {t.pj} PJ
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {curiosidades.length || conclusiones.length ? (
          <section className="stats-insights">
            {curiosidades.length ? (
              <div className="stats-insights__panel stats-insights__panel--curio">
                <h2 className="stats-insights__title">
                  <span>💡</span> Curiosidades
                </h2>
                <ul className="stats-curio-list">
                  {curiosidades.map((c) => (
                    <li key={c.id} className={`stats-curio-item stats-curio-item--${c.tone}`}>
                      <span className="stats-curio-item__icon" aria-hidden>
                        {c.icon}
                      </span>
                      <div>
                        <strong>{c.title}</strong>
                        <p>{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {conclusiones.length ? (
              <div className="stats-insights__panel stats-insights__panel--concl">
                <h2 className="stats-insights__title">
                  <span>📋</span> Conclusiones
                </h2>
                <ol className="stats-conclusion-list">
                  {conclusiones.map((c, i) => (
                    <li key={c.id}>
                      <span className="stats-conclusion-num">{i + 1}</span>
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </section>
        ) : null}

        {admin ? (
          <section className="stats-panel stats-admin-panel">
            <h2 className="stats-panel__title">
              <span>🛠️</span> Cargar resultado (admin)
            </h2>
            <p className="stats-panel__hint">
              Solo partidos confirmados. Completá el marcador Claros – Oscuros después del partido.
            </p>
            <form onSubmit={(e) => void onGuardarResultado(e)}>
              <div className="row">
                <label>Partido</label>
                <select
                  value={formPartidoId}
                  onChange={(e) => {
                    setFormPartidoId(e.target.value);
                    const p = partidos.find((x) => x.id === e.target.value);
                    if (p && partidoTieneResultado(p)) {
                      setGolesClaros(String(p.goles_claros ?? 0));
                      setGolesOscuros(String(p.goles_oscuros ?? 0));
                      setMvpId(p.mvp_jugador_id ?? "");
                      setComentario(p.comentario_partido ?? "");
                    } else {
                      setGolesClaros("0");
                      setGolesOscuros("0");
                      setMvpId("");
                      setComentario("");
                    }
                  }}
                  required
                >
                  <option value="">— Elegí —</option>
                  {pendientesResultado.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatFecha(p.fecha)} · sin resultado
                    </option>
                  ))}
                  {partidos
                    .filter((p) => p.confirmado_admin === true && partidoTieneResultado(p))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatFecha(p.fecha)} · {p.goles_claros}-{p.goles_oscuros} (editar)
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid2">
                <div className="row">
                  <label>Goles {TEAM_LABEL_CLAROS}</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={golesClaros}
                    onChange={(e) => setGolesClaros(e.target.value)}
                    required
                  />
                </div>
                <div className="row">
                  <label>Goles {TEAM_LABEL_OSCUROS}</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={golesOscuros}
                    onChange={(e) => setGolesOscuros(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="row">
                <label>MVP (opcional)</label>
                <select value={mvpId} onChange={(e) => setMvpId(e.target.value)}>
                  <option value="">— Ninguno —</option>
                  {mvpOpciones.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.apodo} ({o.equipo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="row">
                <label>Comentario del partido (opcional)</label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Ej. buen ritmo, Claros dominaron el segundo tiempo…"
                  rows={3}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={busy || !formPartidoId}>
                {busy ? "Guardando…" : "Guardar resultado"}
              </button>
            </form>
          </section>
        ) : (
          <p className="muted" style={{ margin: "0.5rem 0 0" }}>
            Si falta un resultado, pedile al administrador que lo cargue acá.
          </p>
        )}
      </div>
    </div>
  );
}
