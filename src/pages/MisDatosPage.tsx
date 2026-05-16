import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import type { MisDatosPrivados } from "../types";

function normEmail(s: string): string {
  return String(s ?? "").trim().toLowerCase();
}

export default function MisDatosPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<MisDatosPrivados | null>(null);
  const [apodo, setApodo] = useState("");
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pinParaEmail, setPinParaEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [pinActual, setPinActual] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [pinNuevo2, setPinNuevo2] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  const emailOriginal = data ? normEmail(data.email) : "";
  const emailCambia = data != null && normEmail(email) !== emailOriginal;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await api.misDatosPrivados();
        if (cancelled) return;
        setData(d);
        setApodo(d.apodo);
        setEmail(d.email);
        setNombre(d.nombre);
        setApellido(d.apellido);
        setTelefono(d.telefono);
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

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const apodoTrim = apodo.trim();
      if (!apodoTrim) throw new Error("El apodo es obligatorio");

      const emailNorm = normEmail(email);
      if (emailNorm && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) {
        throw new Error("Correo electrónico inválido");
      }
      if (emailCambia && !pinParaEmail.trim()) {
        throw new Error("Para cambiar el correo ingresá tu PIN actual.");
      }

      const d = await api.setMisDatosPrivados({
        nombre,
        apellido,
        telefono,
        apodo: apodoTrim,
        ...(emailCambia ? { email: emailNorm, pin: pinParaEmail } : {}),
      });
      setData(d);
      setEmail(d.email);
      setApodo(d.apodo);
      setPinParaEmail("");
      setOkMsg(
        emailCambia
          ? "Datos guardados. Si tu proyecto exige confirmar el correo, revisá la bandeja del mail nuevo."
          : "Datos guardados.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function cambiarPin(e: React.FormEvent) {
    e.preventDefault();
    setPinBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      if (pinNuevo !== pinNuevo2) throw new Error("Los PIN nuevos no coinciden");
      await api.cambiarPin(pinActual, pinNuevo);
      setPinActual("");
      setPinNuevo("");
      setPinNuevo2("");
      setOkMsg("PIN actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setPinBusy(false);
    }
  }

  if (loading) return <p className="muted">Cargando…</p>;
  if (!data && error) return <div className="error">{error}</div>;
  if (!data) return <div className="error">No se pudieron cargar tus datos.</div>;

  return (
    <div>
      <h1>Mis datos</h1>
      <p className="sub">
        Datos privados de tu cuenta. El apodo es el que usás para entrar. Si cambiás el correo, necesitás tu PIN actual.
      </p>

      {error && <div className="error">{error}</div>}
      {okMsg && (
        <p className="muted" style={{ color: "var(--ok, #2e7d32)" }}>
          {okMsg}
        </p>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Cuenta y contacto</h2>
        <form onSubmit={guardarDatos}>
          <div className="row">
            <label>Apodo</label>
            <input
              type="text"
              value={apodo}
              onChange={(e) => setApodo(e.target.value)}
              autoComplete="username"
              required
            />
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
              Es el nombre con el que iniciás sesión. Si lo cambiás, usá el nuevo apodo la próxima vez que entres.
            </p>
          </div>
          <div className="row">
            <label>Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          {emailCambia && (
            <div className="row">
              <label>PIN actual (para confirmar el cambio de correo)</label>
              <input
                type="password"
                value={pinParaEmail}
                onChange={(e) => setPinParaEmail(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          )}
          <div className="row">
            <label>Nombre</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" />
          </div>
          <div className="row">
            <label>Apellido</label>
            <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} autoComplete="family-name" />
          </div>
          <div className="row">
            <label>Teléfono</label>
            <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Guardar datos"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>PIN de acceso</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Si recordás tu PIN actual, podés cambiarlo acá. Si no, usá la recuperación por correo (misma cuenta y apodo
          con la que te registraste).
        </p>
        <form onSubmit={cambiarPin}>
          <div className="row">
            <label>PIN actual</label>
            <input type="password" value={pinActual} onChange={(e) => setPinActual(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="row">
            <label>PIN nuevo</label>
            <input type="password" value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="row">
            <label>Repetir PIN nuevo</label>
            <input type="password" value={pinNuevo2} onChange={(e) => setPinNuevo2(e.target.value)} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={pinBusy}>
            {pinBusy ? "Actualizando…" : "Cambiar PIN"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", marginBottom: 0 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              logout();
              navigate("/entrar?recuperar=1");
            }}
          >
            Olvidé mi PIN — recuperar por correo
          </button>
        </p>
      </div>
    </div>
  );
}
