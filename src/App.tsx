import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import AuthPage from "./pages/Auth";
import HomePage from "./pages/Home";
import PlayerProfilePage from "./pages/PlayerProfile";
import MyProfilePage from "./pages/MyProfile";
import TeamsPage from "./pages/Teams";
import PresenciasPage from "./pages/Presencias";

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
        <nav className="tabs">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Jugadores
          </NavLink>
          <NavLink to="/perfil" className={({ isActive }) => (isActive ? "active" : "")}>
            Mi perfil
          </NavLink>
          <NavLink to="/equipos" className={({ isActive }) => (isActive ? "active" : "")}>
            Equipos
          </NavLink>
          <NavLink to="/presencias" className={({ isActive }) => (isActive ? "active" : "")}>
            Presencias
          </NavLink>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Salir
          </button>
        </nav>
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
            <MyProfilePage />
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
        path="/presencias"
        element={
          <Shell>
            <PresenciasPage />
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
