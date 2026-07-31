import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "./api";
import { AuthProvider, useAuth } from "./AuthContext";
import { BridgeProvider, useBridgeOptional } from "./BridgeContext";
import {
  canEnterAppShell,
  canEnterDashboard,
  clearActiveGrupoId,
  getActiveGrupoId,
  getActiveGrupoNombre,
  getSelectedSport,
  markBridgeEntered,
  reopenGroupPicker,
  setSelectedSport as persistSelectedSport,
} from "./lib/bridgeSession";
import { sportNameById, SPORTS_CATALOG } from "./lib/sportsCatalog";
import { isDemoMode } from "./lib/demoMode";
import AuthPage from "./pages/Auth";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import HomePage from "./pages/Home";
import PlayerProfilePage from "./pages/PlayerProfile";
import MisPerfilesPage from "./pages/MisPerfilesPage";
import MisDatosPage from "./pages/MisDatosPage";
import ProximosPartidosPage from "./pages/ProximosPartidosPage";
import MiCalendarioPage from "./pages/MiCalendarioPage";
import TeamsPage from "./pages/Teams";
import StatsPage from "./pages/StatsPage";
import PreviaPartidoPage from "./pages/PreviaPartidoPage";
import GrupoConfigPage from "./pages/GrupoConfigPage";
import ValorarF5PartidoPage from "./pages/ValorarF5PartidoPage";
import EncuestaPostPartidoPage from "./pages/EncuestaPostPartidoPage";
import SeleccionarDeportePage from "./pages/SeleccionarDeportePage";
import ValorarInvitadoPage from "./pages/ValorarInvitadoPage";
import SportPickerModal from "./components/SportPickerModal";
import NotificationsBell from "./components/NotificationsBell";
import ThemeToggle from "./components/ThemeToggle";
import { SideFieldDecor } from "./components/FunDecor";
import { Users, Calendar, BarChart3, Scale, Settings, House } from "lucide-react";
import "./dashboard.css";

/** Rutas del espacio personal (sin tabs de grupo). */
const PERSONAL_SCOPE_PATHS = new Set([
  "/",
  "/inicio",
  "/mi-calendario",
  "/seleccionar-deporte",
  "/perfil",
  "/mis-datos",
]);

function isPersonalScope(pathname: string): boolean {
  return PERSONAL_SCOPE_PATHS.has(pathname);
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loggedIn, ready } = useAuth();
  if (!ready) {
    return (
      <div className="shell">
        <p className="muted">Cargando…</p>
      </div>
    );
  }
  if (!loggedIn) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Rutas que necesitan un grupo activo. */
function RequireGroup({ children }: { children: React.ReactNode }) {
  if (!canEnterAppShell()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Shell() {
  const { loggedIn, logout, ready } = useAuth();
  const bridge = useBridgeOptional();
  const navigate = useNavigate();
  const location = useLocation();
  const [esAdminNav, setEsAdminNav] = useState<boolean | null>(null);
  const [apodo, setApodo] = useState<string | null>(null);
  const activeGrupoId = bridge?.activeGrupoId ?? null;
  const inGroup = Boolean(activeGrupoId);
  const personalScope = isPersonalScope(location.pathname);
  /** Tabs de grupo solo en vistas de grupo (no en Dashboard / Mi Calendario). */
  const showGroupNav = inGroup && !personalScope;

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

  const sportLabel = bridge?.selectedSportName ?? "Fútbol";
  const grupoLabel = bridge?.activeGrupoNombre ?? "Sin grupo";
  const userLabel = apodo?.trim() || "Jugador";

  return (
    <div className="shell">
      <SideFieldDecor />
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
            <p className="app-global-grupo">
              {showGroupNav ? grupoLabel : "Inicio personal"}
            </p>
          </div>

          <div className="app-global-actions">
            {bridge ? (
              <div className="app-context-actions" role="group" aria-label="Contexto">
                <button
                  type="button"
                  className="btn btn-ghost app-ctx-btn"
                  onClick={() => bridge.openSportPicker()}
                >
                  🔄 Cambiar deporte
                </button>
                {showGroupNav ? (
                  <button
                    type="button"
                    className="btn btn-ghost app-ctx-btn"
                    onClick={() => {
                      bridge.returnToGroupPicker();
                      navigate("/");
                    }}
                  >
                    Cambiar grupo
                  </button>
                ) : null}
              </div>
            ) : null}

            <nav className="app-account-nav" aria-label="Cuenta">
              <NavLink to="/perfil" className={({ isActive }) => (isActive ? "active" : "")}>
                Mi perfil
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

        <nav className="app-group-nav" aria-label="Secciones">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive || location.pathname === "/inicio" ? "active" : ""
            }
          >
            <House size={15} className="neon-icon" /> Inicio
          </NavLink>

          {personalScope ? (
            <NavLink to="/mi-calendario" className={({ isActive }) => (isActive ? "active" : "")}>
              <Calendar size={15} className="neon-icon" /> Mi Calendario
            </NavLink>
          ) : null}

          {showGroupNav ? (
            <>
              <NavLink to="/jugadores" className={({ isActive }) => (isActive ? "active" : "")}>
                <Users size={15} className="neon-icon" /> Jugadores
              </NavLink>
              <NavLink to="/proximos-partidos" className={({ isActive }) => (isActive ? "active" : "")}>
                <Calendar size={15} className="neon-icon" /> Próximos partidos
              </NavLink>
              <NavLink to="/stats" className={({ isActive }) => (isActive ? "active" : "")}>
                <BarChart3 size={15} className="neon-icon" /> Stats
              </NavLink>
              {esAdminNav === true ? (
                <NavLink to="/equipos" className={({ isActive }) => (isActive ? "active" : "")}>
                  <Scale size={15} className="neon-icon" /> Equipos
                </NavLink>
              ) : null}
              {esAdminNav === true ? (
                <NavLink to="/configuracion" className={({ isActive }) => (isActive ? "active" : "")}>
                  <Settings size={15} className="neon-icon" /> Configuración
                </NavLink>
              ) : null}
            </>
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
      <Route path="/valorar-invitado/:token" element={<ValorarInvitadoPage />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/inicio" element={<Navigate to="/" replace />} />
        <Route path="/mi-calendario" element={<MiCalendarioPage />} />
        <Route path="/seleccionar-deporte" element={<SeleccionarDeportePage />} />
        <Route path="/perfil" element={<MisPerfilesPage />} />
        <Route path="/mis-datos" element={<MisDatosPage />} />

        <Route
          path="/jugadores"
          element={
            <RequireGroup>
              <HomePage />
            </RequireGroup>
          }
        />
        <Route
          path="/proximos-partidos/:partidoId"
          element={
            <RequireGroup>
              <ProximosPartidosPage />
            </RequireGroup>
          }
        />
        <Route
          path="/proximos-partidos"
          element={
            <RequireGroup>
              <ProximosPartidosPage />
            </RequireGroup>
          }
        />
        <Route
          path="/stats"
          element={
            <RequireGroup>
              <StatsPage />
            </RequireGroup>
          }
        />
        <Route
          path="/jugador/:id"
          element={
            <RequireGroup>
              <PlayerProfilePage />
            </RequireGroup>
          }
        />
        <Route
          path="/equipos"
          element={
            <RequireGroup>
              <TeamsPage />
            </RequireGroup>
          }
        />
        <Route
          path="/configuracion"
          element={
            <RequireGroup>
              <GrupoConfigPage />
            </RequireGroup>
          }
        />
        <Route
          path="/partido/:partidoId/previa"
          element={
            <RequireGroup>
              <PreviaPartidoPage />
            </RequireGroup>
          }
        />
        <Route
          path="/partido/:partidoId/valorar-f5"
          element={
            <RequireGroup>
              <ValorarF5PartidoPage />
            </RequireGroup>
          }
        />
        <Route
          path="/partido/:partidoId/encuesta"
          element={
            <RequireGroup>
              <EncuestaPostPartidoPage />
            </RequireGroup>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * Puerta: landing solo si no hay sesión.
 * Logueado → AppRoutes (dashboard personal; shell de grupo al entrar a un grupo).
 */
function BridgeLayout() {
  const { ready, loggedIn } = useAuth();
  const location = useLocation();
  const [sportId, setSportId] = useState<string | null>(() => getSelectedSport());
  const [grupoId, setGrupoId] = useState<string | null>(() => getActiveGrupoId());
  const [grupoNombre, setGrupoNombre] = useState<string | null>(() => getActiveGrupoNombre());
  const [sportModalOpen, setSportModalOpen] = useState(false);

  const isGuestRatePath = location.pathname.startsWith("/valorar-invitado/");

  const syncFromSession = useCallback(() => {
    setSportId(getSelectedSport());
    setGrupoId(getActiveGrupoId());
    setGrupoNombre(getActiveGrupoNombre());
  }, []);

  useEffect(() => {
    if (!ready || !loggedIn) return;
    if (!getSelectedSport()) {
      persistSelectedSport("futbol");
      markBridgeEntered();
    } else if (!canEnterDashboard()) {
      markBridgeEntered();
    }
    syncFromSession();
  }, [ready, loggedIn, syncFromSession]);

  useEffect(() => {
    const onGrupo = () => syncFromSession();
    window.addEventListener("psb-grupo-changed", onGrupo);
    return () => window.removeEventListener("psb-grupo-changed", onGrupo);
  }, [syncFromSession]);

  // Al cambiar de solapa/ruta, cerrar la calesita para que no quede “pegada” encima.
  useEffect(() => {
    setSportModalOpen(false);
  }, [location.pathname]);

  const openSportPicker = useCallback(() => {
    setSportModalOpen(true);
  }, []);

  const closeSportPicker = useCallback(() => {
    setSportModalOpen(false);
  }, []);

  const setSelectedSportCtx = useCallback((id: string) => {
    persistSelectedSport(id);
    setSportId(id);
    markBridgeEntered();
  }, []);

  const returnToLanding = useCallback(() => {
    // Compat: "cambiar deporte" ahora abre el modal (no vuelve a la calesita de la landing).
    setSportModalOpen(true);
  }, []);

  const returnToGroupPicker = useCallback(() => {
    reopenGroupPicker();
    clearActiveGrupoId();
    setGrupoId(null);
    setGrupoNombre(null);
    setSportId(getSelectedSport());
  }, []);

  const enterBridge = useCallback((id: string) => {
    const sport = SPORTS_CATALOG.find((s) => s.id === id)?.available === false ? "futbol" : id;
    persistSelectedSport(sport);
    setSportId(sport);
    markBridgeEntered();
    setGrupoId(getActiveGrupoId());
    setGrupoNombre(getActiveGrupoNombre());
  }, []);

  const bridgeValue = useMemo(
    () => ({
      returnToLanding,
      returnToGroupPicker,
      openSportPicker,
      setSelectedSport: setSelectedSportCtx,
      selectedSportId: sportId,
      selectedSportName: sportNameById(sportId),
      activeGrupoId: grupoId,
      activeGrupoNombre: grupoNombre,
    }),
    [returnToLanding, returnToGroupPicker, openSportPicker, setSelectedSportCtx, sportId, grupoId, grupoNombre],
  );

  if (!ready) {
    return (
      <div className="psb-landing" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="muted">Cargando…</p>
      </div>
    );
  }

  // Link/QR público: accesible sin sesión.
  if (isGuestRatePath) {
    return (
      <BridgeProvider value={bridgeValue}>
        <Routes>
          <Route path="/valorar-invitado/:token" element={<ValorarInvitadoPage />} />
        </Routes>
      </BridgeProvider>
    );
  }

  return (
    <BridgeProvider value={bridgeValue}>
      {!loggedIn ? (
        <LandingPage onEnterBridge={enterBridge} />
      ) : (
        <>
          <AppRoutes />
          <SportPickerModal
            open={sportModalOpen}
            onClose={closeSportPicker}
            onSelect={(id) => {
              const sport = SPORTS_CATALOG.find((s) => s.id === id);
              if (sport && !sport.available) return;
              setSelectedSportCtx(id);
            }}
            title="🔄 Cambiar deporte"
          />
        </>
      )}
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
