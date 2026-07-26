import { useEffect, useState } from "react";
import { setToken } from "../api";
import LandingGroupWizard from "../components/LandingGroupWizard";
import SportCarousel from "../components/SportCarousel";
import { useAuth } from "../AuthContext";
import { loginAsGuestDemo, loginWithSupabase, registerWithSupabase } from "../lib/futbolAuth";
import {
  getSelectedSport,
  setActiveGrupoId,
  setSelectedSport,
} from "../lib/bridgeSession";
import type { GrupoMembership } from "../lib/gruposApi";
import { PSB_LOGO_SRC, SPORTS_CATALOG } from "../lib/sportsCatalog";
import type { Pie, Posicion } from "../types";
import "../landing.css";

/** Pantallas del panel inferior de la landing. */
export type LandingAuthView = "login" | "register" | "grupos";

type Props = {
  onEnterBridge: (sportId: string) => void;
};

export default function LandingPage({ onEnterBridge }: Props) {
  const { refresh, loggedIn, logout } = useAuth();
  const [authView, setAuthView] = useState<LandingAuthView>("login");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [posicion, setPosicion] = useState<Posicion>("medio");

  const [logoError, setLogoError] = useState(false);

  const showCarousel = authView === "login" || authView === "grupos";
  const isRegister = authView === "register";

  useEffect(() => {
    if (!loggedIn) {
      if (authView === "grupos") setAuthView("login");
      return;
    }
    // Ya autenticado: wizard de grupos (no interrumpir el form de registro).
    if (authView === "login") {
      setAuthView("grupos");
    }
  }, [loggedIn, authView]);

  function goLogin() {
    setAuthView("login");
    setError(null);
    setInfoMessage(null);
  }

  function goRegister() {
    setAuthView("register");
    setError(null);
    setInfoMessage(null);
  }

  function finishWithGroup(_grupoId: string, _meta: GrupoMembership) {
    setActiveGrupoId(_grupoId);
    const sport = getSelectedSport() ?? "futbol";
    setSelectedSport(sport);
    onEnterBridge(sport);
  }

  function onSportPick(sportId: string) {
    const sport = SPORTS_CATALOG.find((s) => s.id === sportId);
    if (sport && !sport.available) {
      setInfoMessage(`${sport.name} próximamente. Por ahora elegí Fútbol.`);
      return;
    }
    setSelectedSport(sportId);
    setInfoMessage(null);
    if (!loggedIn) {
      setError("Primero ingresá o creá tu cuenta; después elegís el grupo.");
      return;
    }
    setAuthView("grupos");
  }

  async function onGuestDemo() {
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      const r = await loginAsGuestDemo();
      setToken(r.token);
      await refresh();
      setSelectedSport("futbol");
      setActiveGrupoId("demo-grupo");
      onEnterBridge("futbol");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al entrar en demo");
    } finally {
      setLoading(false);
    }
  }

  async function onLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      const apodo = usuario.trim();
      if (!apodo) throw new Error("Ingresá tu usuario o apodo.");
      const r = await loginWithSupabase(apodo, password);
      setToken(r.token);
      await refresh();
      if (!getSelectedSport()) setSelectedSport("futbol");
      setAuthView("grupos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ingresar");
    } finally {
      setLoading(false);
    }
  }

  async function onRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      const apodo = usuario.trim();
      if (!nombreCompleto.trim() || !apodo || !email.trim()) {
        throw new Error("Completá nombre, apodo y correo.");
      }
      const r = await registerWithSupabase({
        nombreCompleto: nombreCompleto.trim(),
        apodo,
        email: email.trim(),
        pin: password,
        posicionPreferida: posicion,
        posicionAlternativa: posicion,
        pieDominante: "derecho" as Pie,
        fechaNacimiento: "",
        contacto: "",
        alturaCm: "",
        pesoKg: "",
      });
      setToken(r.token);
      await refresh();
      setSelectedSport(getSelectedSport() ?? "futbol");
      setAuthView("grupos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  }

  function onBackFromGrupos() {
    logout();
    goLogin();
  }

  return (
    <div className="psb-landing" id="landing-root">
      <div className="psb-landing-inner">
        <header className="psb-landing-header">
          <div className="psb-logo-wrap">
            {!logoError ? (
              <img
                src={PSB_LOGO_SRC}
                alt="PlaySportBridge"
                className="psb-logo"
                onError={() => setLogoError(true)}
              />
            ) : (
              <h1 className="psb-brand">PLAYSPORTBRIDGE</h1>
            )}
          </div>
          <div className="psb-tagline-block">
            <p className="psb-tagline-lead">Tu puente al deporte</p>
            <p className="psb-tagline-sub">Conecta, medí y viví tu pasión.</p>
          </div>
        </header>

        {showCarousel ? (
          <SportCarousel
            sports={SPORTS_CATALOG}
            initialSportId={getSelectedSport()}
            onSelectEnter={onSportPick}
          />
        ) : null}

        {authView === "grupos" ? (
          <>
            {infoMessage ? <div className="psb-toast psb-toast-standalone">{infoMessage}</div> : null}
            {error ? (
              <div className="psb-landing-error" style={{ marginBottom: "0.75rem" }}>
                {error}
              </div>
            ) : null}
            <LandingGroupWizard onGroupReady={finishWithGroup} onBackLogin={onBackFromGrupos} />
          </>
        ) : (
          <section className="psb-auth-panel" aria-labelledby="psb-auth-title">
            {isRegister ? (
              <button type="button" className="psb-back-link" onClick={goLogin}>
                ← Volver al ingreso
              </button>
            ) : null}

            <h2 id="psb-auth-title">{authView === "login" ? "Ya estoy registrado" : "Creá tu cuenta"}</h2>
            <p className="psb-auth-sub">
              {authView === "login"
                ? "Ingresá con tu apodo y PIN. Después elegís o creás tu grupo."
                : "Registrá tu usuario. Después vas a crear o unirte a un grupo."}
            </p>

            {infoMessage ? <div className="psb-toast">{infoMessage}</div> : null}
            {error ? <div className="psb-landing-error">{error}</div> : null}

            <form onSubmit={authView === "login" ? onLoginSubmit : onRegisterSubmit}>
              {isRegister ? (
                <div className="psb-register-extra">
                  <div className="psb-register-hint">
                    Posición, medidas y perfiles los completás después en «Mis perfiles».
                  </div>
                  <label htmlFor="psb-nombre">Nombre completo</label>
                  <input
                    id="psb-nombre"
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                    autoComplete="name"
                    required
                  />
                  <label htmlFor="psb-email">Correo electrónico</label>
                  <input
                    id="psb-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                  <label htmlFor="psb-pos">Posición principal</label>
                  <select id="psb-pos" value={posicion} onChange={(e) => setPosicion(e.target.value as Posicion)}>
                    <option value="portero">Portero</option>
                    <option value="defensa">Defensa</option>
                    <option value="medio">Mediocampo</option>
                    <option value="delantero">Delantero</option>
                  </select>
                </div>
              ) : null}

              <label htmlFor="psb-usuario">{authView === "login" ? "Usuario / Email (apodo)" : "Apodo"}</label>
              <input
                id="psb-usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoComplete={authView === "login" ? "username" : "nickname"}
                required
              />

              <label htmlFor="psb-pass">
                {authView === "login" ? "Contraseña" : "Contraseña / PIN (mín. 4 caracteres)"}
              </label>
              <input
                id="psb-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={authView === "login" ? "current-password" : "new-password"}
                required
                minLength={isRegister ? 4 : undefined}
              />

              <button type="submit" className="psb-btn-enter" disabled={loading}>
                {loading ? "Procesando…" : authView === "login" ? "Ingresar" : "Crear cuenta"}
              </button>
            </form>

            {authView === "login" ? (
              <div className="psb-demo-block">
                <p className="psb-auth-sub" style={{ marginBottom: "0.65rem", textAlign: "center" }}>
                  ¿Querés explorar sin registrarte?
                </p>
                <button
                  type="button"
                  className="psb-btn-demo"
                  disabled={loading}
                  onClick={() => void onGuestDemo()}
                >
                  {loading ? "Entrando…" : "Probar demo · Entrar como invitado"}
                </button>
              </div>
            ) : null}

            <button
              type="button"
              className="psb-toggle-register"
              onClick={() => {
                if (authView === "login") goRegister();
                else goLogin();
              }}
            >
              {authView === "login" ? "¿Sos nuevo? Creá tu cuenta acá" : "¿Ya tenés cuenta? Ingresá acá"}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
