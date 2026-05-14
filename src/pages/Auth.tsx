import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { setToken } from "../api";
import { useAuth } from "../AuthContext";
import { loginWithSupabase, registerWithSupabase } from "../lib/futbolAuth";
import type { Pie, Posicion } from "../types";

const API_BASE = "";

export default function AuthPage() {
  const { loggedIn, refresh, ready } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register" | "recover">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoverStep, setRecoverStep] = useState<1 | 2>(1);

  const [apodo, setApodo] = useState("");
  const [pin, setPin] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [posicion, setPosicion] = useState<Posicion>("medio");
  const [posicionAlternativa, setPosicionAlternativa] = useState<Posicion>("medio");
  const [pie, setPie] = useState<Pie>("derecho");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [contacto, setContacto] = useState("");
  const [alturaStr, setAlturaStr] = useState("");
  const [pesoStr, setPesoStr] = useState("");

  const [recEmail, setRecEmail] = useState("");
  const [recApodo, setRecApodo] = useState("");
  const [recCode, setRecCode] = useState("");
  const [recPin, setRecPin] = useState("");

  useEffect(() => {
    if (searchParams.get("recuperar") === "1") {
      setMode("recover");
      setRecoverStep(1);
    }
  }, [searchParams]);

  if (ready && loggedIn) return <Navigate to="/" replace />;

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await loginWithSupabase(apodo, pin);
      setToken(r.token);
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
      const r = await registerWithSupabase({
        nombreCompleto,
        apodo,
        email,
        pin,
        posicionPreferida: posicion,
        posicionAlternativa,
        pieDominante: pie,
        fechaNacimiento,
        contacto,
        alturaCm: alturaStr,
        pesoKg: pesoStr,
      });
      setToken(r.token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function onRecoverRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/recover-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recEmail.trim(), apodo: recApodo.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "No se pudo enviar el código");
      }
      setRecoverStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function onRecoverConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/recover-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: recEmail.trim(),
          apodo: recApodo.trim(),
          code: recCode.trim(),
          newPin: recPin.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "No se pudo actualizar el PIN");
      const r = await loginWithSupabase(recApodo.trim(), recPin.trim());
      setToken(r.token);
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
        <h1>Bienvenido</h1>
        <p className="sub">
          Registrate con correo válido: sirve para recuperar el PIN si lo olvidás. Después completá perfiles en «Mis
          perfiles» y valorá a tus compañeros desde cada ficha.
        </p>

        <div className="tabs" style={{ marginBottom: "1.25rem" }}>
          <button
            type="button"
            className={`btn btn-ghost ${mode === "login" ? "active" : ""}`}
            onClick={() => {
              setMode("login");
              setRecoverStep(1);
              setError(null);
            }}
          >
            Ya tengo cuenta
          </button>
          <button
            type="button"
            className={`btn btn-ghost ${mode === "register" ? "active" : ""}`}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Registrarme
          </button>
          <button
            type="button"
            className={`btn btn-ghost ${mode === "recover" ? "active" : ""}`}
            onClick={() => {
              setMode("recover");
              setRecoverStep(1);
              setError(null);
            }}
          >
            Olvidé el PIN
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
        ) : mode === "recover" ? (
          recoverStep === 1 ? (
            <form onSubmit={onRecoverRequest}>
              <p className="muted">
                Te enviamos un código al correo con el que te registraste (revisá spam). En desarrollo, el código
                aparece en la consola del servidor si no hay API de correo configurada.
              </p>
              <div className="row">
                <label>Correo registrado</label>
                <input
                  type="email"
                  value={recEmail}
                  onChange={(e) => setRecEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="row">
                <label>Apodo</label>
                <input value={recApodo} onChange={(e) => setRecApodo(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? "Enviando…" : "Enviar código"}
              </button>
            </form>
          ) : (
            <form onSubmit={onRecoverConfirm}>
              <div className="row">
                <label>Código de 6 dígitos</label>
                <input value={recCode} onChange={(e) => setRecCode(e.target.value)} inputMode="numeric" required />
              </div>
              <div className="row">
                <label>Nuevo PIN (mínimo 4 caracteres)</label>
                <input type="password" value={recPin} onChange={(e) => setRecPin(e.target.value)} required minLength={4} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? "Guardando…" : "Guardar PIN y entrar"}
              </button>
            </form>
          )
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
            <div className="row">
              <label>Correo electrónico (único, para recuperar el PIN)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
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
              Las cualidades del perfil completo arrancan en 5/10 por defecto: ajustalas en «Mis perfiles».
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
