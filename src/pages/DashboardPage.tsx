import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, RefreshCw, UserRound } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useBridgeOptional } from "../BridgeContext";
import CargarPartidoModal from "../components/CargarPartidoModal";
import LandingGroupWizard from "../components/LandingGroupWizard";
import MundialitoPanel from "../components/MundialitoPanel";
import { formatRating } from "../lib/formatRating";
import {
  getSelectedSport,
  setActiveGrupoId,
  setActiveGrupoNombre,
  setSelectedSport,
} from "../lib/bridgeSession";
import type { GrupoMembership } from "../lib/gruposApi";
import {
  applyMundialitoResult,
  defaultMundialitoState,
  loadMundialito,
  saveMundialito,
  startNewMundialitoEdition,
  type MundialitoState,
} from "../lib/mundialito";
import {
  addPersonalMatch,
  loadPersonalMatches,
  summarizePersonalMatches,
  type PersonalMatchInput,
  type PersonalStatsSummary,
} from "../lib/personalMatches";
import { sportNameById } from "../lib/sportsCatalog";
import type { PlayerSummary } from "../types";
import "../dashboard.css";
import "../landing.css";

/**
 * Home personal post-login: stats, carga de partido, Mundialito y Mis Grupos.
 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const bridge = useBridgeOptional();
  const [me, setMe] = useState<PlayerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchModalMundialito, setMatchModalMundialito] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mundialito, setMundialito] = useState<MundialitoState>(defaultMundialitoState);
  const [summary, setSummary] = useState<PersonalStatsSummary>({
    partidos: 0,
    goles: 0,
    asistencias: 0,
    quites: 0,
    atajadas: 0,
    avgRendimiento: null,
  });

  const sportId = bridge?.selectedSportId ?? getSelectedSport();
  const sportName = bridge?.selectedSportName ?? sportNameById(sportId) ?? "Fútbol";
  const playerId = me?.id ?? "";

  const refreshLocal = useCallback((id: string) => {
    if (!id) return;
    setMundialito(loadMundialito(id));
    setSummary(summarizePersonalMatches(loadPersonalMatches(id)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await api.me();
        if (cancelled) return;
        setMe(p);
        setMundialito(loadMundialito(p.id));
        setSummary(summarizePersonalMatches(loadPersonalMatches(p.id)));
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

  function onGroupReady(grupoId: string, meta: GrupoMembership) {
    setActiveGrupoId(grupoId);
    if (meta?.nombre) setActiveGrupoNombre(meta.nombre);
    const sport = getSelectedSport() ?? "futbol";
    setSelectedSport(sport);
    bridge?.setSelectedSport?.(sport);
    window.dispatchEvent(new Event("psb-grupo-changed"));
    navigate("/jugadores");
  }

  function openMatchModal(asMundialito: boolean) {
    setMatchModalMundialito(asMundialito);
    setMatchModalOpen(true);
  }

  function onSaveMatch(input: PersonalMatchInput) {
    if (!playerId) return;
    addPersonalMatch(playerId, input);
    let msg = "Partido guardado.";
    if (input.esMundialito) {
      const current = loadMundialito(playerId);
      const { next, message } = applyMundialitoResult(current, input.resultado);
      saveMundialito(playerId, next);
      setMundialito(next);
      msg = message;
    }
    refreshLocal(playerId);
    setToast(msg);
    window.setTimeout(() => setToast(null), 4500);
  }

  function onNewEdition() {
    if (!playerId) return;
    const next = startNewMundialitoEdition(loadMundialito(playerId));
    saveMundialito(playerId, next);
    setMundialito(next);
    setToast(next.lastMessage);
    window.setTimeout(() => setToast(null), 4000);
  }

  if (loading) return <p className="muted">Cargando tu inicio…</p>;
  if (error && !me) return <div className="error">{error}</div>;

  const apodo = me?.apodo?.trim() || "Jugador";

  return (
    <div className="psb-dash">
      <header className="psb-dash-header">
        <div>
          <h1 className="psb-dash-hello">Hola, {apodo}</h1>
          <p className="psb-dash-hello-sub">
            Estás en <strong>{sportName}</strong>
            {bridge?.activeGrupoNombre ? (
              <>
                {" "}
                · último grupo: <strong>{bridge.activeGrupoNombre}</strong>
              </>
            ) : null}
          </p>
        </div>
        <div className="psb-dash-actions">
          <Link to="/perfil" className="btn btn-ghost">
            <UserRound size={15} className="neon-icon" /> Mi perfil
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => bridge?.openSportPicker?.()}>
            <RefreshCw size={15} className="neon-icon" /> Cambiar deporte
          </button>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      {toast ? (
        <div className="psb-dash-toast" role="status">
          {toast}
        </div>
      ) : null}

      <div className="psb-dash-grid">
        {/* SECCIÓN 1 — Stats individuales */}
        <section className="psb-dash-panel" aria-labelledby="psb-dash-stats-title">
          <h2 id="psb-dash-stats-title" className="psb-dash-panel__title">
            <BarChart3 size={18} className="neon-icon" /> Tus números
          </h2>
          <p className="psb-dash-panel__hint">
            Resumen de tus partidos cargados. Activá el switch de Mundialito al guardar para mover el torneo.
          </p>
          <div className="psb-dash-kpis">
            <div className="psb-dash-kpi psb-dash-kpi--gold">
              <p className="psb-dash-kpi__label">Partidos</p>
              <p className="psb-dash-kpi__value">{summary.partidos}</p>
            </div>
            <div className="psb-dash-kpi psb-dash-kpi--green">
              <p className="psb-dash-kpi__label">Goles</p>
              <p className="psb-dash-kpi__value">{summary.goles}</p>
            </div>
            <div className="psb-dash-kpi psb-dash-kpi--blue">
              <p className="psb-dash-kpi__label">Asistencias</p>
              <p className="psb-dash-kpi__value">{summary.asistencias}</p>
            </div>
            <div className="psb-dash-kpi psb-dash-kpi--purple">
              <p className="psb-dash-kpi__label">Prom. F5 / F11</p>
              <p className="psb-dash-kpi__value" style={{ fontSize: "1.05rem" }}>
                {me?.f5FinalScore != null ? formatRating(me.f5FinalScore) : "—"}
                {" / "}
                {me ? formatRating(me.finalScore) : "—"}
              </p>
            </div>
          </div>
          <div className="psb-dash-cta">
            <button type="button" className="btn btn-primary" onClick={() => openMatchModal(false)}>
              ➕ Cargar nuevo partido
            </button>
            {bridge?.activeGrupoId ? (
              <Link to="/stats" className="btn btn-ghost">
                Ver stats del grupo
              </Link>
            ) : (
              <span className="btn btn-ghost" style={{ opacity: 0.55, pointerEvents: "none" }}>
                Stats del grupo (entrá a un grupo)
              </span>
            )}
          </div>
        </section>

        {/* SECCIÓN 2 — Mundialito */}
        <MundialitoPanel
          state={mundialito}
          onLoadMatch={() => openMatchModal(true)}
          onNewEdition={onNewEdition}
        />

        {/* SECCIÓN 3 — Mis grupos */}
        <section className="psb-dash-panel psb-dash-groups" aria-labelledby="psb-dash-grupos-title">
          <h2 id="psb-dash-grupos-title" className="psb-dash-panel__title">
            📋 Mis grupos
          </h2>
          <p className="psb-dash-panel__hint">
            Entrá a un grupo para jugar con tus amigos, o creá / unite a uno nuevo.
          </p>
          <LandingGroupWizard onGroupReady={onGroupReady} embedded />
        </section>
      </div>

      <CargarPartidoModal
        open={matchModalOpen}
        onClose={() => setMatchModalOpen(false)}
        onSave={onSaveMatch}
        defaultMundialito={matchModalMundialito}
      />
    </div>
  );
}
