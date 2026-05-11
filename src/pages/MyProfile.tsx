import { useEffect, useState } from "react";
import { api } from "../api";
import ProfileScoreSliders from "../components/ProfileScoreSliders";
import { DIMENSION_LABELS, DIMENSION_ORDER, DIMENSION_SECTIONS } from "../dimensions";
import type { Dimension, Pie, PlayerSummary, Posicion, ProfileScores } from "../types";

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; } }
        else { if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; } }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function MyProfilePage() {
  const [me, setMe] = useState<PlayerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [posicion, setPosicion] = useState<Posicion>("medio");
  const [posicionAlternativa, setPosicionAlternativa] = useState<Posicion>("medio");
  const [pie, setPie] = useState<Pie>("derecho");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [contacto, setContacto] = useState("");
  const [alturaStr, setAlturaStr] = useState("");
  const [pesoStr, setPesoStr] = useState("");
  const [historialLesiones, setHistorialLesiones] = useState("");
  const [profile, setProfile] = useState<ProfileScores | null>(null);
  const [arcoValor, setArcoValor] = useState(5);
  const [arcoComunicacion, setArcoComunicacion] = useState(5);
  const [arcoManos, setArcoManos] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await api.me();
        if (cancelled) return;
        setMe(p);
        setNombreCompleto(p.nombreCompleto);
        setPosicion(p.posicionPreferida);
        setPosicionAlternativa(p.posicionAlternativa ?? p.posicionPreferida);
        setPie(p.pieDominante);
        setFechaNacimiento(p.ficha.fechaNacimiento ?? "");
        setContacto(p.ficha.contacto ?? "");
        setAlturaStr(p.ficha.alturaCm != null ? String(p.ficha.alturaCm) : "");
        setPesoStr(p.ficha.pesoKg != null ? String(p.ficha.pesoKg) : "");
        setHistorialLesiones(p.ficha.historialLesiones ?? "");
        setProfile({ ...p.profile });
        const arco = (p as any).arcoScores ?? {};
        setArcoValor(arco.valor ?? 5);
        setArcoComunicacion(arco.comunicacion ?? 5);
        setArcoManos(arco.manos ?? 5);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        nombreCompleto,
        posicionPreferida: posicion,
        posicionAlternativa,
        pieDominante: pie,
        fechaNacimiento,
        contacto,
        historialLesiones,
        profile,
      };
      body.alturaCm = alturaStr.trim() === "" ? null : Number(alturaStr.replace(",", "."));
      body.pesoKg = pesoStr.trim() === "" ? null : Number(pesoStr.replace(",", "."));
      if (posicion !== "portero") {
        body.arcoScores = { valor: arcoValor, comunicacion: arcoComunicacion, manos: arcoManos };
      }

      const p = await api.updateMe(body);
      setMe(p);
      setHistorialLesiones(p.ficha.historialLesiones ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (error && !me) return <div className="error">{error}</div>;
  if (!me || !profile) return <p className="muted">Cargando…</p>;

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file, 300);
    try {
      await api.updateFoto(dataUrl);
      setMe((prev) => prev ? { ...prev, fotoUrl: dataUrl } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir foto");
    }
  }

  return (
    <div>
      <h1>Mi perfil</h1>
      <p className="sub">
        @{me.apodo}. La nota final mezcla tu autopercepción (35%) con el promedio del grupo (65%). El historial de
        lesiones es privado: solo vos lo ves.
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            {me.fotoUrl ? (
              <img src={me.fotoUrl} alt={me.apodo} style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>
                ⚽
              </div>
            )}
            <label style={{ position: "absolute", bottom: -4, right: -4, background: "var(--accent)", color: "#fff", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.8rem" }}>
              📷
              <input type="file" accept="image/*" onChange={handleFotoChange} style={{ display: "none" }} />
            </label>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <div className="score-pill">Final: {me.finalScore.toFixed(2)}</div>
            <div className="score-pill">Autopercepción: {me.finalBreakdown.selfAvg.toFixed(2)}</div>
            <div className="score-pill">
              Grupo: {me.finalBreakdown.peerAvg != null ? me.finalBreakdown.peerAvg.toFixed(2) : "—"}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <form className="card" onSubmit={onSave}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem" }}>Datos personales y ficha técnica</h2>
        <p className="profile-section-desc" style={{ marginTop: 0 }}>
          Datos estructurales: identificación, contacto y biotipo. Podés actualizarlos cuando cambien.
        </p>

        <div className="row">
          <label>Nombre completo</label>
          <input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} required />
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
          <label>Contacto</label>
          <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Teléfono, mail, WhatsApp…" />
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
          <label>Historial de lesiones (solo vos lo ves)</label>
          <textarea
            value={historialLesiones}
            onChange={(e) => setHistorialLesiones(e.target.value)}
            placeholder="Ej.: esguince tobillo derecho 03/2024 — recuperado; molestia isquios…"
          />
        </div>

        {posicion !== "portero" && (
          <>
            <h2 style={{ fontSize: "1.15rem", marginTop: "1.5rem" }}>🧤 Capacidades en el arco (obligatorio)</h2>
            <p className="profile-section-desc">
              Como jugador de campo, valorá tus capacidades cuando te toca ir al arco. Escala 1–10.
            </p>
            <div className="row">
              <label>Valor / Audacia (tirarse al piso, salir a tapar remates)</label>
              <input
                type="range" min={1} max={10} value={arcoValor}
                onChange={(e) => setArcoValor(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--muted)" }}>
                <span>1 (no me tiro)</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{arcoValor}</span>
                <span>10 (me juego entero)</span>
              </div>
            </div>
            <div className="row">
              <label>Comunicación (gritar, ordenar, dirigir como último hombre)</label>
              <input
                type="range" min={1} max={10} value={arcoComunicacion}
                onChange={(e) => setArcoComunicacion(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--muted)" }}>
                <span>1 (callado)</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{arcoComunicacion}</span>
                <span>10 (siempre ordeno)</span>
              </div>
            </div>
            <div className="row">
              <label>Uso de manos y pies para atajar</label>
              <input
                type="range" min={1} max={10} value={arcoManos}
                onChange={(e) => setArcoManos(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--muted)" }}>
                <span>1 (solo pies)</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{arcoManos}</span>
                <span>10 (manos y pies)</span>
              </div>
            </div>
          </>
        )}

        <h2 style={{ fontSize: "1.15rem", marginTop: "1.5rem" }}>Autopercepción (1 a 10)</h2>
        <p className="profile-section-desc">
          Valorá cómo te ves en cada aspecto. Tus compañeros harán su valoración por separado desde tu perfil público.
        </p>

        <ProfileScoreSliders scores={profile} onChange={setProfile} />

        <button className="btn btn-primary" type="submit" style={{ marginTop: "1.25rem" }} disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>

      <ImprovementSuggestions player={me} profile={profile} />
    </div>
  );
}

function ImprovementSuggestions({ player, profile }: { player: PlayerSummary; profile: ProfileScores }) {
  const scores = DIMENSION_ORDER.map((k) => ({ key: k, value: profile[k], label: DIMENSION_LABELS[k] }));
  const sorted = [...scores].sort((a, b) => a.value - b.value);
  const weakest = sorted.slice(0, 4).filter((s) => s.value <= 6);

  const peerScores: { key: Dimension; value: number; label: string }[] = [];
  if (player.peerCount > 0 && player.finalBreakdown.peerAvg != null) {
    for (const k of DIMENSION_ORDER) {
      const peerVal = (player as any).peerByDimension?.[k];
      if (peerVal != null) peerScores.push({ key: k, value: peerVal, label: DIMENSION_LABELS[k] });
    }
  }
  const peerWeak = peerScores.length > 0
    ? [...peerScores].sort((a, b) => a.value - b.value).slice(0, 3).filter((s) => s.value <= 6)
    : [];

  const allWeak = new Map<string, { label: string; self: number; peer?: number }>();
  for (const w of weakest) {
    allWeak.set(w.key, { label: w.label, self: w.value });
  }
  for (const w of peerWeak) {
    const existing = allWeak.get(w.key);
    if (existing) existing.peer = w.value;
    else allWeak.set(w.key, { label: w.label, self: profile[w.key as Dimension], peer: w.value });
  }

  const suggestions = [...allWeak.entries()].slice(0, 5);

  if (suggestions.length === 0) return null;

  const sectionForDim = (dim: string) => {
    for (const sec of DIMENSION_SECTIONS) {
      if ((sec.keys as string[]).includes(dim)) return sec.title.replace(/^\d+\.\s*/, "");
    }
    return "";
  };

  const tips: Record<string, string> = {
    controlPrimerToque: "Practicá recepción con ambos pies bajo presión. Pared contra pared, control y giro.",
    pase: "Trabajá pases a un toque y variá distancias. Precisión > fuerza.",
    regate1v1: "Ensayá fintas simples (bicicleta, recorte) a velocidad real en espacios reducidos.",
    remateFinalizacion: "Definición: practicá con ambas piernas apuntando a los rincones, no solo potencia.",
    juegoAereo: "Mejorá timing de salto y ataque al balón. Practicá cabeceo de córner.",
    posicionamiento: "Mirá videos de tu posición. Pensá siempre: ¿dónde debería estar si pierdo/gano el balón?",
    visionJuego: "Antes de recibir, girá la cabeza para ver opciones. Anticipá la jugada siguiente.",
    movimientosSinBalon: "Desmarque constante: diagonal, a espaldas del defensor, ofrecer línea de pase.",
    tomaDecisiones: "Simplificá: menos gambeta innecesaria, más pases seguros. Elegí rápido.",
    comprensionTactica: "Estudiá el sistema del equipo. Preguntá al que arma qué espera de tu posición.",
    velocidadAceleracion: "Sprints cortos (10-20m) con cambio de dirección. Repeticiones de arranque.",
    resistencia: "Sumá trote continuo 20-30 min entre semana. Mejora mucho el segundo tiempo.",
    fuerzaPotencia: "Sentadillas, estocadas, saltos al cajón. Fuerza funcional para duelos.",
    agilidadCoordinacion: "Escalera de coordinación, conos, slalom. Mejora los cambios de dirección.",
    fortalezaMental: "Error = aprendizaje. No te castigues en el partido, reseteá después de cada jugada.",
    actitudDisciplina: "Llegá a tiempo, calentá siempre, hidratate. La constancia marca diferencia.",
    espirituEquipo: "Comunicá en la cancha: pedí, avisá, alentá. El equipo funciona mejor hablando.",
    motivacion: "Ponete mini-objetivos por partido (ej: 3 recuperaciones, 0 pases malos al arco).",
  };

  return (
    <div className="card" style={{ marginTop: "1.5rem" }}>
      <h2 style={{ marginTop: 0 }}>💡 Áreas para mejorar</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Según tu autopercepción{player.peerCount > 0 ? " y las valoraciones de tus compañeros" : ""}, estas son las
        aptitudes donde más podés crecer:
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
        {suggestions.map(([dim, info]) => (
          <div key={dim} style={{ padding: "0.75rem", borderRadius: "6px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{info.label}</strong>
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                {sectionForDim(dim)}
              </span>
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.25rem" }}>
              Tu nota: {info.self}/10
              {info.peer != null ? ` · Grupo: ${info.peer.toFixed(1)}/10` : ""}
            </div>
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.9rem", lineHeight: 1.5 }}>
              {tips[dim] ?? "Trabajá esta aptitud con ejercicios específicos en entrenamientos."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
