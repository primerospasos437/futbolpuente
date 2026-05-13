import { useEffect, useMemo, useState } from "react";
import { api, apiConvocatorias, type ConvocatoriaRow } from "../api";

const TZ = "America/Argentina/Buenos_Aires";

function todayIsoInTz(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function weekdayLongInTz(timeZone: string, addDays: number): string {
  const d = new Date(Date.now() + addDays * 86400000);
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(d);
}

function isoInTzForOffsetDays(timeZone: string, addDays: number): string {
  const d = new Date(Date.now() + addDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Próximo martes o jueves (fecha calendario en Argentina), empezando desde hoy. */
export function nextMatchIso(dia: "martes" | "jueves"): string {
  const want = dia === "martes" ? "Tuesday" : "Thursday";
  for (let i = 0; i < 21; i++) {
    if (weekdayLongInTz(TZ, i) === want) return isoInTzForOffsetDays(TZ, i);
  }
  return todayIsoInTz(TZ);
}

function myConvocatoria(
  list: ConvocatoriaRow[],
  dia: "martes" | "jueves",
  fecha: string,
  jugadorId: string,
): ConvocatoriaRow | undefined {
  return list.find((c) => c.dia === dia && c.fecha_partido === fecha && c.jugador_id === jugadorId);
}

export default function ProximosPartidosPage() {
  const [conv, setConv] = useState<ConvocatoriaRow[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fechaMartes = useMemo(() => nextMatchIso("martes"), []);
  const fechaJueves = useMemo(() => nextMatchIso("jueves"), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, me] = await Promise.all([apiConvocatorias.list(), api.me()]);
        if (cancelled) return;
        setConv(Array.isArray(list) ? list : []);
        setMeId(me.id);
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

  async function refresh() {
    const list = await apiConvocatorias.list();
    setConv(Array.isArray(list) ? list : []);
  }

  async function anotar(dia: "martes" | "jueves", fecha: string) {
    setBusy(`${dia}-${fecha}`);
    setError(null);
    try {
      await apiConvocatorias.anotarse(dia, fecha);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function baja(dia: "martes" | "jueves", fecha: string) {
    setBusy(`${dia}-${fecha}`);
    setError(null);
    try {
      await apiConvocatorias.desanotarse(dia, fecha);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="muted">Cargando…</p>;
  if (!meId) return <div className="error">No se pudo cargar tu sesión.</div>;

  const cM = myConvocatoria(conv, "martes", fechaMartes, meId);
  const cJ = myConvocatoria(conv, "jueves", fechaJueves, meId);

  return (
    <div>
      <h1>Próximos partidos</h1>
      <p className="sub">
        Anotate para el próximo martes o el próximo jueves. El servidor valida el horario (Argentina): desde ese día a
        las 22:00 hasta el día de partido a las 20:00. Cuando el administrador confirme equipos, vas a recibir una
        notificación con fecha, rivales y color de camiseta.
      </p>

      {error && <div className="error">{error}</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1rem",
          marginTop: "1rem",
        }}
      >
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Martes</h2>
          <p className="muted">Partido: {fechaMartes}</p>
          {cM ? (
            <div>
              <p style={{ fontWeight: 600 }}>Estado: {cM.rol_convocatoria ?? "anotado"}</p>
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                Inscripto el {cM.created_at ? new Date(cM.created_at).toLocaleString() : "—"}. Esperando armado de
                equipos por el administrador.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy === `martes-${fechaMartes}`}
                onClick={() => baja("martes", fechaMartes)}
              >
                Darme de baja
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy === `martes-${fechaMartes}`}
              onClick={() => anotar("martes", fechaMartes)}
            >
              Anotarme
            </button>
          )}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Jueves</h2>
          <p className="muted">Partido: {fechaJueves}</p>
          {cJ ? (
            <div>
              <p style={{ fontWeight: 600 }}>Estado: {cJ.rol_convocatoria ?? "anotado"}</p>
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                Inscripto el {cJ.created_at ? new Date(cJ.created_at).toLocaleString() : "—"}. Esperando armado de
                equipos por el administrador.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy === `jueves-${fechaJueves}`}
                onClick={() => baja("jueves", fechaJueves)}
              >
                Darme de baja
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy === `jueves-${fechaJueves}`}
              onClick={() => anotar("jueves", fechaJueves)}
            >
              Anotarme
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
