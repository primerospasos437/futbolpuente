import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { setToken, setPlayerId, getToken } from "../api";
import { useAuth } from "../AuthContext";
import { prodSupabaseEnvBrokenMessage } from "../lib/supabaseEnvCheck";
import { defaultScores } from "../dimensions";
import { loginWithSupabase, registerWithSupabase } from "../lib/futbolAuth";
import type { Pie, Posicion } from "../types";

export default function AuthPage() {
  const { loggedIn, refresh, ready } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [apodo, setApodo] = useState("");
  const [pin, setPin] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [posicion, setPosicion] = useState<Posicion>("medio");
  const [posicionAlternativa, setPosicionAlternativa] = useState<Posicion>("medio");
  const [pie, setPie] = useState<Pie>("derecho");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [contacto, setContacto] = useState("");
  const [alturaStr, setAlturaStr] = useState("");
  const [pesoStr, setPesoStr] = useState("");

  useEffect(() => {
    const bad = prodSupabaseEnvBrokenMessage();
    if (bad) setError(bad);
  }, []);

  if (ready && loggedIn) return <Navigate to="/" replace />;

  if (!ready && getToken()) {
    return (
      <div className="shell">
        <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>
          Comprobando sesión…
        </p>
      </div>
    );
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await loginWithSupabase(apodo, pin);
      setToken(r.token);
      setPlayerId(r.playerId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const profile = defaultScores();
      const r = await registerWithSupabase({
        nombreCompleto,
        apodo,
        pin,
        posicionPreferida: posicion,
        posicionAlternativa,
        pieDominante: pie,
        fechaNacimiento,
        contacto,
        alturaCm: alturaStr,
        pesoKg: pesoStr,
        profile,
      });
      setToken(r.token);
      setPlayerId(r.playerId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <div className="card" style={{ maxWidth: 560, margin: "2rem auto" }}>
        <h1>Fútbol Puente Club</h1>
        <p className="sub">
          Registrate con tus datos y completá el perfil deportivo detallado en «Mi perfil»: capacidades técnicas,
          tácticas, físicas y psicológicas (escala 1–10), más ficha técnica e historial de lesiones (solo visible para
          vos). Después valorá a tus compañeros desde cada perfil.
        </p>

        <div className="tabs" style={{ marginBottom: "1.25rem" }}>
          <button
            type="button"
            className={`btn btn-ghost ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
          >
            Ya tengo cuenta
          </button>
          <button
            type="button"
            className={`btn btn-ghost ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
          >
            Registrarme
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {mode === "login" ? (
          <form onSubmit={onLogin}>
            <div className="row">
              <label>Apodo</label>
              <input value={apodo} onChange={(e) => setApodo(e.target.value)} autoComplete="username" required />
            </div>
            <div className="row">
              <label>PIN (solo números recomendado)</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        ) : (
          <form onSubmit={onRegister}>
            <div className="row">
              <label>Nombre completo</label>
              <input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} required />
            </div>
            <div className="row">
              <label>Apodo (único en el grupo)</label>
              <input value={apodo} onChange={(e) => setApodo(e.target.value)} required />
            </div>

            <div className="grid2">
              <div className="row">
                <label>Posición principal</label>
                <select value={posicion} onChange={(e) => setPosicion(e.target.value as Posicion)}>
                  <option value="portero">Portero</option>
                  <option value="defensa">Defensa</option>
                  <option value="medio">Mediocampo</option>
                  <option value="delantero">Delantero</option>
                </select>
              </div>
              <div className="row">
                <label>Posición alternativa</label>
                <select
                  value={posicionAlternativa}
                  onChange={(e) => setPosicionAlternativa(e.target.value as Posicion)}
                >
                  <option value="portero">Portero</option>
                  <option value="defensa">Defensa</option>
                  <option value="medio">Mediocampo</option>
                  <option value="delantero">Delantero</option>
                </select>
              </div>
            </div>

            <div className="grid2">
              <div className="row">
                <label>Pie dominante</label>
                <select value={pie} onChange={(e) => setPie(e.target.value as Pie)}>
                  <option value="derecho">Derecho</option>
                  <option value="izquierdo">Izquierdo</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
              <div className="row">
                <label>Fecha de nacimiento</label>
                {/* `type="date"` entrega siempre ISO `YYYY-MM-DD` al estado; `futbolRegistration` la revalida y canoniza antes del RPC. */}
                <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
              </div>
            </div>

            <div className="row">
              <label>Contacto (teléfono, mail o WhatsApp)</label>
              <input
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="Opcional"
                autoComplete="tel"
              />
            </div>

            <div className="grid2">
              <div className="row">
                <label>Altura (cm)</label>
                <input
                  inputMode="decimal"
                  value={alturaStr}
                  onChange={(e) => setAlturaStr(e.target.value)}
                  placeholder="Ej. 178"
                />
              </div>
              <div className="row">
                <label>Peso (kg)</label>
                <input
                  inputMode="decimal"
                  value={pesoStr}
                  onChange={(e) => setPesoStr(e.target.value)}
                  placeholder="Ej. 72"
                />
              </div>
            </div>

            <div className="row">
              <label>PIN de acceso (guardalo: sirve para entrar)</label>
              <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} required minLength={4} />
            </div>

            <p className="muted" style={{ marginTop: "1rem" }}>
              Las cualidades deportivas arrancan en 5/10 por defecto: ajustalas en «Mi perfil». El historial de lesiones
              también lo cargás ahí (solo vos lo ves).
            </p>

            <button className="btn btn-primary" type="submit" style={{ marginTop: "1rem" }} disabled={loading}>
              {loading ? "Creando…" : "Crear jugador"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
