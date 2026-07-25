import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, useSearchParams } from "react-router-dom";
import { api } from "./api";
import { AuthProvider, useAuth } from "./AuthContext";
import { BridgeProvider, useBridgeOptional } from "./BridgeContext";
import {
  canEnterAppShell,
  getActiveGrupoId,
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
import ValorarF5PartidoPage from "./pages/ValorarF5PartidoPage";
import NotificationsBell from "./components/NotificationsBell";
import ThemeToggle from "./components/ThemeToggle";

function Shell({ children }: { children: React.ReactNode }) {
  const { loggedIn, logout, ready } = useAuth();
  const bridge = useBridgeOptional();
  const [esAdminNav, setEsAdminNav] = useState<boolean | null>(null);

  useEffect(() => {
    if (!ready || !loggedIn) {
      setEsAdminNav(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (!cancelled) setEsAdminNav(Boolean(me.esAdmin));
      } catch {
        if (!cancelled) setEsAdminNav(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, loggedIn]);

  if (!ready) {
    return (
      <div className="shell">
        <p className="muted">Cargando…</p>
      </div>
    );
  }
  if (!loggedIn) return <Navigate to="/" replace />;
  if (!canEnterAppShell()) return <Navigate to="/" replace />;

  return (
    <div className="shell">
      {isDemoMode() ? (
        <div className="demo-banner">
          <strong>Modo demostración</strong>
          <span className="muted" style={{ marginLeft: "0.5rem" }}>
            Datos ficticios locales. Nada se guarda en Supabase (invitado@futbolpuente.com).
          </span>
        </div>
      ) : null}
      <header className="topbar">
        <div className="brand">
          Fútbol <span>Grupo</span>
          {bridge?.selectedSportName ? (
            <span className="muted" style={{ display: "block", fontSize: "0.72rem", fontWeight: 500, marginTop: 2 }}>
              {bridge.selectedSportName}
            </span>
          ) : null}
        </div>
        <nav className="tabs" style={{ flex: 1, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.25rem" }}>
          {bridge ? (
            <>
              <button type="button" className="btn btn-ghost btn-change-sport" onClick={bridge.returnToLanding}>
                Cambiar deporte
              </button>
              <button type="button" className="btn btn-ghost btn-change-sport" onClick={bridge.returnToGroupPicker}>
                Cambiar grupo
              </button>
            </>
          ) : null}
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Jugadores
          </NavLink>
          <NavLink to="/proximos-partidos" className={({ isActive }) => (isActive ? "active" : "")}>
            Próximos partidos
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => (isActive ? "active" : "")}>
            Stats
          </NavLink>
          <NavLink to="/perfil" className={({ isActive }) => (isActive ? "active" : "")}>
            Mis perfiles
          </NavLink>
          <NavLink to="/mis-datos" className={({ isActive }) => (isActive ? "active" : "")}>
            Mis datos
          </NavLink>
          {esAdminNav === true ? (
            <NavLink to="/equipos" className={({ isActive }) => (isActive ? "active" : "")}>
              Equipos
            </NavLink>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Salir
          </button>
        </nav>
        <NotificationsBell />
      </header>
      {children}
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
      <Route
        path="/"
        element={
          <Shell>
            <HomePage />
          </Shell>
        }
      />
      <Route
        path="/proximos-partidos/:partidoId"
        element={
          <Shell>
            <ProximosPartidosPage />
          </Shell>
        }
      />
      <Route
        path="/proximos-partidos"
        element={
          <Shell>
            <ProximosPartidosPage />
          </Shell>
        }
      />
      <Route
        path="/stats"
        element={
          <Shell>
            <StatsPage />
          </Shell>
        }
      />
      <Route
        path="/jugador/:id"
        element={
          <Shell>
            <PlayerProfilePage />
          </Shell>
        }
      />
      <Route
        path="/perfil"
        element={
          <Shell>
            <MisPerfilesPage />
          </Shell>
        }
      />
      <Route
        path="/mis-datos"
        element={
          <Shell>
            <MisDatosPage />
          </Shell>
        }
      />
      <Route
        path="/equipos"
        element={
          <Shell>
            <TeamsPage />
          </Shell>
        }
      />
      <Route
        path="/partido/:partidoId/valorar-f5"
        element={
          <Shell>
            <ValorarF5PartidoPage />
          </Shell>
        }
      />
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

  const syncVisibility = useCallback(() => {
    if (!loggedIn) {
      setLandingVisible(true);
      return;
    }
    const ok = canEnterAppShell();
    setLandingVisible(!ok);
    setSportId(getSelectedSport());
    setGrupoId(getActiveGrupoId());
  }, [loggedIn]);

  useEffect(() => {
    if (!ready) return;
    syncVisibility();
  }, [ready, loggedIn, syncVisibility]);

  const returnToLanding = useCallback(() => {
    reopenBridgeLanding();
    setSportId(getSelectedSport());
    setGrupoId(getActiveGrupoId());
    setLandingVisible(true);
  }, []);

  const returnToGroupPicker = useCallback(() => {
    reopenGroupPicker();
    setGrupoId(null);
    setSportId(getSelectedSport());
    setLandingVisible(true);
  }, []);

  const enterBridge = useCallback((id: string) => {
    setSelectedSport(id);
    setSportId(id);
    setGrupoId(getActiveGrupoId());
    markBridgeEntered();
    // Solo ocultar landing si ya hay grupo activo
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
    }),
    [returnToLanding, returnToGroupPicker, sportId, grupoId],
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
