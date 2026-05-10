import { useState } from "react";

const GATE_KEY = "futbol_puente_gate";
const GATE_CODE = "fobalpuenteclub";

export function isGateUnlocked(): boolean {
  return localStorage.getItem(GATE_KEY) === "ok";
}

export function GateScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [showCode, setShowCode] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().toLowerCase() === GATE_CODE) {
      localStorage.setItem(GATE_KEY, "ok");
      onUnlock();
    } else {
      setError(true);
    }
  }

  return (
    <div className="shell">
      <div className="card" style={{ maxWidth: 400, margin: "4rem auto", textAlign: "center" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>⚽ Fútbol Puente Club</h1>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          Ingresá el código del grupo para acceder.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <input
              type={showCode ? "text" : "password"}
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(false); }}
              placeholder="Código de acceso"
              autoComplete="off"
              required
              style={{ textAlign: "center", fontSize: "1.1rem" }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "0.5rem", cursor: "pointer", fontSize: "0.9rem", color: "var(--muted)" }}>
            <input
              type="checkbox"
              checked={showCode}
              onChange={(e) => setShowCode(e.target.checked)}
            />
            Mostrar código
          </label>
          {error && <p className="error" style={{ marginTop: "0.5rem" }}>Código incorrecto</p>}
          <button className="btn btn-primary" type="submit" style={{ marginTop: "1rem", width: "100%" }}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
