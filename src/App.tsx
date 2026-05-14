import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import AuthPage from "./pages/Auth";
import HomePage from "./pages/Home";
import PlayerProfilePage from "./pages/PlayerProfile";
import MisPerfilesPage from "./pages/MisPerfilesPage";
import MisDatosPage from "./pages/MisDatosPage";
import ProximosPartidosPage from "./pages/ProximosPartidosPage";
import TeamsPage from "./pages/Teams";
import ValorarF5PartidoPage from "./pages/ValorarF5PartidoPage";
import NotificationsBell from "./components/NotificationsBell";

function Shell({ children }: { children: React.ReactNode }) {
  const { loggedIn, logout, ready } = useAuth();
  if (!ready) {
    return (
      <div className="shell">
        <p className="muted">Cargando…</p>
      </div>
    );
  }
  if (!loggedIn) return <Navigate to="/entrar" replace />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          Fútbol <span>Grupo</span>
        </div>
        <nav className="tabs" style={{ flex: 1, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.25rem" }}>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Jugadores
          </NavLink>
          <NavLink to="/proximos-partidos" className={({ isActive }) => (isActive ? "active" : "")}>
            Próximos partidos
          </NavLink>
          <NavLink to="/perfil" className={({ isActive }) => (isActive ? "active" : "")}>
            Mis perfiles
          </NavLink>
          <NavLink to="/mis-datos" className={({ isActive }) => (isActive ? "active" : "")}>
            Mis datos
          </NavLink>
          <NavLink to="/equipos" className={({ isActive }) => (isActive ? "active" : "")}>
            Equipos
          </NavLink>
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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/entrar" element={<AuthPage />} />
      <Route
        path="/"
        element={
          <Shell>
            <HomePage />
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

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
