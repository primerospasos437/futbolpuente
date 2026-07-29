import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useSearchParams } from "react-router-dom";
import { api } from "./api";
import { AuthProvider, useAuth } from "./AuthContext";
import { BridgeProvider, useBridgeOptional } from "./BridgeContext";
import {
  canEnterAppShell,
  getActiveGrupoId,
  getActiveGrupoNombre,
  getSelectedSport,
  markBridgeEntered,
  reopenBridgeLanding,
  reopenGroupPicker,
  setSelectedSport,
} from "./lib/bridgeSession";
import { sportNameById } from "./lib/sportsCatalog";
import { isDemoMode } from "./lib/demoMode";
import AuthPage from "./pages/Auth";
import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/Home";
import PlayerProfilePage from "./pages/PlayerProfile";
import MisPerfilesPage from "./pages/MisPerfilesPage";
import MisDatosPage from "./pages/MisDatosPage";
import ProximosPartidosPage from "./pages/ProximosPartidosPage";
import TeamsPage from "./pages/Teams";
import StatsPage from "./pages/StatsPage";
import GrupoConfigPage from "./pages/GrupoConfigPage";
import ValorarF5PartidoPage from "./pages/ValorarF5PartidoPage";
import EncuestaPostPartidoPage from "./pages/EncuestaPostPartidoPage";
import NotificationsBell from "./components/NotificationsBell";
import { PageSideDecor } from "./components/FunDecor";
import ThemeToggle from "./components/ThemeToggle";

function Shell() {
  const { loggedIn, logout, ready } = useAuth();
  const bridge = useBridgeOptional();
  const [esAdminNav, setEsAdminNav] = useState<boolean | null>(null);
  const [apodo, setApodo] = useState<string | null>(null);
  const activeGrupoId = bridge?.activeGrupoId ?? null;

  useEffect(() => {
    if (!ready || !loggedIn) {
      setEsAdminNav(null);
      setApodo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await api.meChrome();
        if (!cancelled) {
          setEsAdminNav(Boolean(me.esAdmin));
          setApodo(me.apodo || null);
        }
      } catch {
        if (!cancelled) {
          setEsAdminNav(false);
          setApodo(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, loggedIn, activeGrupoId]);

  if (!ready) {
    return (
      <div className="shell">
        <p className="muted">Cargando…</p>
      </div>
    );
  }
  if (!loggedIn) return <Navigate to="/" replace />;
  if (!canEnterAppShell()) return <Navigate to="/" replace />;

  const sportLabel = bridge?.selectedSportName ?? "Fútbol";
  const grupoLabel = bridge?.activeGrupoNombre ?? "Grupo";
  const userLabel = apodo?.trim() || "Jugador";

  return (
    <div className="shell">
      <PageSideDecor />
      {isDemoMode() ? (
        <div className="demo-banner">
          <strong>Modo demostración</strong>
          <span className="muted" style={{ marginLeft: "0.5rem" }}>
            Datos ficticios locales. Nada se guarda en Supabase (invitado@futbolpuente.com).
          </span>
        </div>
      ) : null}

      <div className="app-chrome">
        <header className="app-global-header">
          <div className="app-global-identity">
            <p className="app-global-user">
              <span className="app-global-apodo">{userLabel}</span>
              <span className="app-global-sep">·</span>
              <span className="app-global-sport">{sportLabel}</span>
            </p>
            <p className="app-global-grupo">{grupoLabel}</p>
          </div>

          <div className="app-global-actions">
            {bridge ? (
              <div className="app-context-actions" role="group" aria-label="Contexto">
                <button type="button" className="btn btn-ghost app-ctx-btn" onClick={bridge.returnToLanding}>
                  Cambiar deporte
                </button>
                <button type="button" className="btn btn-ghost app-ctx-btn" onClick={bridge.returnToGroupPicker}>
                  Cambiar grupo
                </button>
              </div>
            ) : null}

            <nav className="app-account-nav" aria-label="Cuenta">
              <NavLink to="/perfil" className={({ isActive }) => (isActive ? "active" : "")}>
                Mis perfiles
              </NavLink>
              <NavLink to="/mis-datos" className={({ isActive }) => (isActive ? "active" : "")}>
                Mis datos
              </NavLink>
              <button type="button" className="btn btn-ghost app-logout-btn" onClick={logout}>
                Salir
              </button>
            </nav>

            <NotificationsBell />
          </div>
        </header>

        <nav className="app-group-nav" aria-label="Secciones del grupo">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Jugadores
          </NavLink>
          <NavLink to="/proximos-partidos" className={({ isActive }) => (isActive ? "active" : "")}>
            Próximos partidos
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => (isActive ? "active" : "")}>
            Stats
          </NavLink>
          {esAdminNav === true ? (
            <NavLink to="/equipos" className={({ isActive }) => (isActive ? "active" : "")}>
              Equipos
            </NavLink>
          ) : null}
          {esAdminNav === true ? (
            <NavLink to="/configuracion" className={({ isActive }) => (isActive ? "active" : "")}>
              ⚙️ Configuración
            </NavLink>
          ) : null}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}

/** /entrar solo para recuperar PIN; el resto va a la landing. */
function EntrarRoute() {
  const [searchParams] = useSearchParams();
  if (searchParams.get("recuperar") === "1") {
    return <AuthPage />;
  }
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/entrar" element={<EntrarRoute />} />
      <Route element={<Shell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/proximos-partidos/:partidoId" element={<ProximosPartidosPage />} />
        <Route path="/proximos-partidos" element={<ProximosPartidosPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/jugador/:id" element={<PlayerProfilePage />} />
        <Route path="/perfil" element={<MisPerfilesPage />} />
        <Route path="/mis-datos" element={<MisDatosPage />} />
        <Route path="/equipos" element={<TeamsPage />} />
        <Route path="/configuracion" element={<GrupoConfigPage />} />
        <Route path="/partido/:partidoId/valorar-f5" element={<ValorarF5PartidoPage />} />
        <Route path="/partido/:partidoId/encuesta" element={<EncuestaPostPartidoPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * Puerta: landing visible hasta tener sesión + deporte + grupo activo.
 */
function BridgeLayout() {
  const { ready, loggedIn } = useAuth();
  const [landingVisible, setLandingVisible] = useState(true);
  const [sportId, setSportId] = useState<string | null>(() => getSelectedSport());
  const [grupoId, setGrupoId] = useState<string | null>(() => getActiveGrupoId());
  const [grupoNombre, setGrupoNombre] = useState<string | null>(() => getActiveGrupoNombre());

  const syncVisibility = useCallback(() => {
    if (!loggedIn) {
      setLandingVisible(true);
      return;
    }
    const ok = canEnterAppShell();
    setLandingVisible(!ok);
    setSportId(getSelectedSport());
    setGrupoId(getActiveGrupoId());
    setGrupoNombre(getActiveGrupoNombre());
  }, [loggedIn]);

  useEffect(() => {
    if (!ready) return;
    syncVisibility();
  }, [ready, loggedIn, syncVisibility]);

  const returnToLanding = useCallback(() => {
    reopenBridgeLanding();
    setSportId(getSelectedSport());
    setGrupoId(getActiveGrupoId());
    setGrupoNombre(getActiveGrupoNombre());
    setLandingVisible(true);
  }, []);

  const returnToGroupPicker = useCallback(() => {
    reopenGroupPicker();
    setGrupoId(null);
    setGrupoNombre(null);
    setSportId(getSelectedSport());
    setLandingVisible(true);
  }, []);

  const enterBridge = useCallback((id: string) => {
    setSelectedSport(id);
    setSportId(id);
    setGrupoId(getActiveGrupoId());
    setGrupoNombre(getActiveGrupoNombre());
    markBridgeEntered();
    if (getActiveGrupoId()) {
      setLandingVisible(false);
    } else {
      setLandingVisible(true);
    }
  }, []);

  const bridgeValue = useMemo(
    () => ({
      returnToLanding,
      returnToGroupPicker,
      selectedSportId: sportId,
      selectedSportName: sportNameById(sportId),
      activeGrupoId: grupoId,
      activeGrupoNombre: grupoNombre,
    }),
    [returnToLanding, returnToGroupPicker, sportId, grupoId, grupoNombre],
  );

  if (!ready) {
    return (
      <div className="psb-landing" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="muted">Cargando…</p>
      </div>
    );
  }

  return (
    <BridgeProvider value={bridgeValue}>
      <div id="landing-root" className={landingVisible ? "" : "psb-screen-hidden"} aria-hidden={!landingVisible}>
        <LandingPage onEnterBridge={enterBridge} />
      </div>
      <div id="grupo-amigos-root" className={landingVisible ? "psb-screen-hidden" : ""}>
        <AppRoutes />
      </div>
    </BridgeProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeToggle />
      <BridgeLayout />
    </AuthProvider>
  );
}
