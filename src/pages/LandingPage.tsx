import { useState } from "react";
import { setToken } from "../api";
import { useAuth } from "../AuthContext";
import { loginAsGuestDemo, loginWithSupabase, registerWithSupabase } from "../lib/futbolAuth";
import {
  getSelectedSport,
  markBridgeEntered,
  setSelectedSport,
  setUserRole,
  type PsbUserRole,
} from "../lib/bridgeSession";
import { PSB_LOGO_SRC } from "../lib/sportsCatalog";
import type { Pie, Posicion } from "../types";
import "../landing.css";
import "../dashboard.css";

/** Pantallas del panel inferior de la landing (solo pre-login). */
export type LandingAuthView = "login" | "register";

type Props = {
  /** Tras login/registro/demo: entra al dashboard (sin exigir grupo). */
  onEnterBridge: (sportId: string) => void;
};

export default function LandingPage({ onEnterBridge }: Props) {
  const { refresh } = useAuth();
  const [authView, setAuthView] = useState<LandingAuthView>("login");
  const [registerStep, setRegisterStep] = useState<"role" | "form">("role");
  const [registerRole, setRegisterRole] = useState<PsbUserRole | null>(null);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [posicion, setPosicion] = useState<Posicion>("medio");
  const [modalidad, setModalidad] = useState<"f5" | "f11" | "ambas">("ambas");

  const [logoError, setLogoError] = useState(false);

  const isRegister = authView === "register";

  function goLogin() {
    setAuthView("login");
    setRegisterStep("role");
    setRegisterRole(null);
    setError(null);
    setInfoMessage(null);
  }

  function goRegister() {
    setAuthView("register");
    setRegisterStep("role");
    setRegisterRole(null);
    setError(null);
    setInfoMessage(null);
  }

  function pickRole(role: PsbUserRole) {
    setRegisterRole(role);
    setUserRole(role);
    setRegisterStep("form");
    setError(null);
  }

  function enterAfterAuth(sportId = "futbol") {
    setSelectedSport(sportId);
    markBridgeEntered();
    onEnterBridge(sportId);
  }

  async function onGuestDemo() {
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      const r = await loginAsGuestDemo();
      setToken(r.token);
      await refresh();
      setUserRole("jugador");
      enterAfterAuth("futbol");
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
      enterAfterAuth(getSelectedSport() ?? "futbol");
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
      if (!registerRole) throw new Error("Elegí si sos jugador o DT.");
      const apodo = usuario.trim();
      if (!nombreCompleto.trim() || !apodo || !email.trim()) {
        throw new Error("Completá nombre, apodo y correo.");
      }
      const r = await registerWithSupabase({
        nombreCompleto: nombreCompleto.trim(),
        apodo,
        email: email.trim(),
        pin: password,
        posicionPreferida: registerRole === "dt" ? "medio" : posicion,
        posicionAlternativa: registerRole === "dt" ? "medio" : posicion,
        pieDominante: "derecho" as Pie,
        modalidadPreferida: registerRole === "dt" ? "ambas" : modalidad,
        fechaNacimiento: "",
        contacto: "",
        alturaCm: "",
        pesoKg: "",
      });
      setToken(r.token);
      setUserRole(registerRole);
      await refresh();
      enterAfterAuth(getSelectedSport() ?? "futbol");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
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

        <section className="psb-auth-panel" aria-labelledby="psb-auth-title">
          {isRegister ? (
            <button
              type="button"
              className="psb-back-link"
              onClick={() => {
                if (registerStep === "form") {
                  setRegisterStep("role");
                  setRegisterRole(null);
                } else {
                  goLogin();
                }
              }}
            >
              ← {registerStep === "form" ? "Volver a elegir rol" : "Volver al ingreso"}
            </button>
          ) : null}

          <h2 id="psb-auth-title">
            {authView === "login"
              ? "Ya estoy registrado"
              : registerStep === "role"
                ? "¿Cómo vas a usar PlaySportBridge?"
                : registerRole === "dt"
                  ? "Creá tu cuenta de DT / Admin"
                  : "Creá tu cuenta de jugador"}
          </h2>
          <p className="psb-auth-sub">
            {authView === "login"
              ? "Ingresá con tu apodo y PIN. Después vas a tu inicio personal."
              : registerStep === "role"
                ? "Elegí tu rol para adaptar el recorrido. Podés cambiar de enfoque más adelante."
                : registerRole === "dt"
                  ? "Como DT vas a poder crear grupos, armar equipos y administrar la lista."
                  : "Registrá tu usuario y modalidad. Después vas a tu dashboard y elegís o creás un grupo."}
          </p>

          {infoMessage ? <div className="psb-toast">{infoMessage}</div> : null}
          {error ? <div className="psb-landing-error">{error}</div> : null}

          {isRegister && registerStep === "role" ? (
            <div className="psb-role-grid" role="group" aria-label="Rol de registro">
              <button type="button" className="psb-role-card psb-role-card--jugador" onClick={() => pickRole("jugador")}>
                <span className="psb-role-card__emoji" aria-hidden>
                  👤
                </span>
                <p className="psb-role-card__title">Jugador Individual</p>
                <p className="psb-role-card__desc">
                  Armá tu ficha, valorá compañeros, jugá el Mundialito y unite a grupos de amigos.
                </p>
              </button>
              <button type="button" className="psb-role-card psb-role-card--dt" onClick={() => pickRole("dt")}>
                <span className="psb-role-card__emoji" aria-hidden>
                  📋
                </span>
                <p className="psb-role-card__title">DT / Administrador</p>
                <p className="psb-role-card__desc">
                  Creá y administrá grupos, armá equipos y gestioná convocatorias.
                </p>
              </button>
            </div>
          ) : (
            <form onSubmit={authView === "login" ? onLoginSubmit : onRegisterSubmit}>
              {isRegister ? (
                <div className="psb-register-extra">
                  <div className="psb-register-hint">
                    {registerRole === "dt"
                      ? "Después vas a poder crear tu primer grupo desde el inicio."
                      : "Posición, medidas y perfiles los completás después en «Mi perfil»."}
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
                  {registerRole === "jugador" ? (
                    <>
                      <label htmlFor="psb-pos">Posición principal</label>
                      <select
                        id="psb-pos"
                        value={posicion}
                        onChange={(e) => setPosicion(e.target.value as Posicion)}
                      >
                        <option value="portero">Portero</option>
                        <option value="defensa">Defensa</option>
                        <option value="medio">Mediocampo</option>
                        <option value="delantero">Delantero</option>
                      </select>
                      <label htmlFor="psb-mod">Modalidad preferida</label>
                      <select
                        id="psb-mod"
                        value={modalidad}
                        onChange={(e) => setModalidad(e.target.value as "f5" | "f11" | "ambas")}
                      >
                        <option value="ambas">Fútbol 5 y Fútbol 11</option>
                        <option value="f5">Fútbol 5</option>
                        <option value="f11">Fútbol 11</option>
                      </select>
                    </>
                  ) : null}
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
          )}

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

          {!(isRegister && registerStep === "role") ? (
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
          ) : null}
        </section>
      </div>
    </div>
  );
}
