import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiConvocatorias, apiPartidos, type ConvocatoriaRow, type PartidoRow, type PresenciaRow } from "../api";
import PartidoEquiposView from "../components/PartidoEquiposView";
import {
  miEquipoEnPartido,
  parseEquipoNombres,
  partidoTieneEquiposPublicados,
} from "../lib/partidoEquipos";
import type { PlayerSummary } from "../types";

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

function formatFechaPartido(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  if (!y || !m || !d) return fecha;
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ProximosPartidosPage() {
  const { partidoId: partidoIdParam } = useParams<{ partidoId?: string }>();
  const detalleRef = useRef<HTMLDivElement>(null);

  const [conv, setConv] = useState<ConvocatoriaRow[]>([]);
  const [me, setMe] = useState<PlayerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [companeros, setCompaneros] = useState<{ id: string; apodo: string }[]>([]);
  const [evita1, setEvita1] = useState("");
  const [evita2, setEvita2] = useState("");
  const [evitaBusy, setEvitaBusy] = useState(false);
  const [evitaOk, setEvitaOk] = useState<string | null>(null);

  const [partidos, setPartidos] = useState<PartidoRow[]>([]);
  const [presencias, setPresencias] = useState<PresenciaRow[]>([]);
  const [bajaPartidoBusy, setBajaPartidoBusy] = useState<string | null>(null);

  const fechaMartes = useMemo(() => nextMatchIso("martes"), []);
  const fechaJueves = useMemo(() => nextMatchIso("jueves"), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, meRes, pl, prt, pres] = await Promise.all([
          apiConvocatorias.list(),
          api.me(),
          api.players(),
          apiPartidos.list(),
          apiPartidos.listPresencias(),
        ]);
        if (cancelled) return;
        setConv(Array.isArray(list) ? list : []);
        setMe(meRes);
        setPartidos(Array.isArray(prt) ? prt : []);
        setPresencias(Array.isArray(pres) ? pres : []);
        const otros = pl.jugadores.filter((p) => p.id !== meRes.id).map((p) => ({ id: p.id, apodo: p.apodo }));
        setCompaneros(otros);
        try {
          const ev = await api.evitaCompanerosGet();
          if (!cancelled) {
            const ids = ev.map((x) => x.id);
            setEvita1(ids[0] ?? "");
            setEvita2(ids[1] ?? "");
          }
        } catch {
          if (!cancelled) {
            setEvita1("");
            setEvita2("");
          }
        }
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

  const meId = me?.id ?? null;

  const puedeAnotarseConvocatoria =
    me != null &&
    me.perfilCompletoCargado &&
    me.perfilF5Cargado &&
    (me.miValoracionesPerfilOtros ?? 0) >= 4;

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

  const partidosConEquipos = useMemo(
    () =>
      partidos
        .filter(partidoTieneEquiposPublicados)
        .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)),
    [partidos],
  );

  const misPartidosTitularConfirmados = useMemo(() => {
    if (!meId) return [];
    const mias = presencias.filter((pr) => pr.jugador_id === meId && pr.estado === "convocado");
    const map = new Map(mias.map((pr) => [pr.partido_id, pr]));
    return partidosConEquipos.filter((p) => map.has(p.id)).map((p) => ({ partido: p, presencia: map.get(p.id)! }));
  }, [meId, partidosConEquipos, presencias]);

  const partidoDetalle = useMemo(() => {
    if (!partidoIdParam) return null;
    return partidos.find((p) => p.id === partidoIdParam) ?? null;
  }, [partidoIdParam, partidos]);

  const partidoDetallePublicado = partidoDetalle && partidoTieneEquiposPublicados(partidoDetalle);

  useEffect(() => {
    if (!partidoIdParam || !partidoDetallePublicado) return;
    detalleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [partidoIdParam, partidoDetallePublicado]);

  async function bajaTitularPartidoConfirmado(partidoId: string) {
    setBajaPartidoBusy(partidoId);
    setError(null);
    try {
      await apiPartidos.bajaTitularPartidoConfirmado(partidoId, null);
      const [prt, pres] = await Promise.all([apiPartidos.list(), apiPartidos.listPresencias()]);
      setPartidos(Array.isArray(prt) ? prt : []);
      setPresencias(Array.isArray(pres) ? pres : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBajaPartidoBusy(null);
    }
  }

  async function guardarEvitaEquipo() {
    setEvitaBusy(true);
    setEvitaOk(null);
    setError(null);
    try {
      const raw = [evita1, evita2].filter((x) => x && x.length > 0);
      const uniq = [...new Set(raw)];
      await api.evitaCompanerosSet(uniq);
      setEvitaOk("Preferencias guardadas. Se usan al armar equipos (martes y jueves).");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setEvitaBusy(false);
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

      {partidoIdParam ? (
        <div ref={detalleRef} className="card" style={{ marginTop: "1rem" }}>
          <Link to="/proximos-partidos" className="muted" style={{ fontSize: "0.9rem", textDecoration: "none" }}>
            ← Volver a próximos partidos
          </Link>
          {!partidoDetalle ? (
            <p className="error" style={{ marginTop: "1rem", marginBottom: 0 }}>
              No encontramos ese partido.
            </p>
          ) : !partidoDetallePublicado ? (
            <p className="muted" style={{ marginTop: "1rem", marginBottom: 0 }}>
              Este partido aún no tiene equipos publicados. Cuando el administrador confirme, vas a poder ver compañeros
              y rivales en esta pantalla.
            </p>
          ) : (
            <>
              <h2 style={{ marginTop: "0.75rem", marginBottom: "0.25rem" }}>
                {formatFechaPartido(partidoDetalle.fecha)}
                {partidoDetalle.hora_partido ? ` · ${partidoDetalle.hora_partido} hs` : ""}
              </h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Equipos confirmados. Solo se muestran los nombres de los jugadores.
              </p>
              {partidoDetalle.texto_equipamiento?.trim() ? (
                <p style={{ marginTop: "0.75rem", marginBottom: 0, fontSize: "0.95rem" }}>
                  <strong>Observación:</strong> {partidoDetalle.texto_equipamiento.trim()}
                </p>
              ) : null}
              <PartidoEquiposView
                claros={parseEquipoNombres(partidoDetalle.equipo_claros)}
                oscuros={parseEquipoNombres(partidoDetalle.equipo_oscuros)}
                miEquipo={miEquipoEnPartido(partidoDetalle.id, meId, presencias)}
              />
              {misPartidosTitularConfirmados.some(({ partido }) => partido.id === partidoDetalle.id) ? (
                <div style={{ marginTop: "1rem" }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={bajaPartidoBusy === partidoDetalle.id}
                    onClick={() => void bajaTitularPartidoConfirmado(partidoDetalle.id)}
                  >
                    {bajaPartidoBusy === partidoDetalle.id ? "Procesando…" : "Darme de baja como titular"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {!partidoIdParam && partidosConEquipos.length > 0 ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Partidos con equipos confirmados</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Tocá un partido para ver quién juega en CLAROS y OSCUROS (solo nombres).
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {partidosConEquipos.map((p) => (
              <li key={p.id} style={{ marginBottom: "0.4rem" }}>
                <Link to={`/proximos-partidos/${p.id}`}>
                  {formatFechaPartido(p.fecha)}
                  {p.hora_partido ? ` · ${p.hora_partido} hs` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {me && !puedeAnotarseConvocatoria ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Requisitos para anotarte</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            El servidor solo permite la inscripción cuando completaste tus perfiles y colaboraste valorando a otros.
          </p>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
            {!me.perfilCompletoCargado ? (
              <li>
                Guardá tu <strong>perfil completo</strong> (18 características) en «Mis perfiles» → Perfil completo.
              </li>
            ) : null}
            {!me.perfilF5Cargado ? (
              <li>
                Guardá tu perfil <strong>F5</strong> en «Mis perfiles» → F5.
              </li>
            ) : null}
            {(me.miValoracionesPerfilOtros ?? 0) < 4 ? (
              <li>
                Valorá el perfil completo de al menos <strong>4</strong> compañeros distintos en «Jugadores» (llevás{" "}
                <strong>{me.miValoracionesPerfilOtros ?? 0}</strong> de 4).
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {misPartidosTitularConfirmados.length > 0 ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Partidos confirmados (titular)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Si no podés ir, avisá con tiempo. Si hay suplentes, sube el primero de la lista y recibe notificación.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {misPartidosTitularConfirmados.map(({ partido: p }) => (
              <li key={p.id} style={{ marginBottom: "0.65rem" }}>
                <Link to={`/proximos-partidos/${p.id}`}>
                  <strong>{formatFechaPartido(p.fecha)}</strong>
                  {p.hora_partido ? ` · ${p.hora_partido} hs` : ""}
                </Link>
                <div style={{ marginTop: "0.35rem" }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={bajaPartidoBusy === p.id}
                    onClick={() => void bajaTitularPartidoConfirmado(p.id)}
                  >
                    {bajaPartidoBusy === p.id ? "Procesando…" : "Darme de baja como titular"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
              disabled={busy === `martes-${fechaMartes}` || !puedeAnotarseConvocatoria}
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
              disabled={busy === `jueves-${fechaJueves}` || !puedeAnotarseConvocatoria}
              onClick={() => anotar("jueves", fechaJueves)}
            >
              Anotarme
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Preferencia personal (privada)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Podés elegir hasta <strong>dos</strong> compañeros con los que preferís <strong>no compartir equipo</strong>. Solo
          vos ves esta elección. Se tiene en cuenta al generar equipos parejos (martes y jueves) para separarlos en
          equipos distintos cuando sea posible.
        </p>
        {evitaOk && (
          <p className="muted" style={{ color: "var(--ok, #2e7d32)", marginTop: 0 }}>
            {evitaOk}
          </p>
        )}
        <div className="row">
          <label>Jugador 1 (opcional)</label>
          <select value={evita1} onChange={(e) => setEvita1(e.target.value)}>
            <option value="">— Ninguno —</option>
            {companeros.map((c) => (
              <option key={c.id} value={c.id} disabled={c.id === evita2}>
                {c.apodo}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <label>Jugador 2 (opcional)</label>
          <select value={evita2} onChange={(e) => setEvita2(e.target.value)}>
            <option value="">— Ninguno —</option>
            {companeros.map((c) => (
              <option key={c.id} value={c.id} disabled={c.id === evita1}>
                {c.apodo}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" disabled={evitaBusy} onClick={guardarEvitaEquipo}>
          {evitaBusy ? "Guardando…" : "Guardar preferencias"}
        </button>
      </div>
    </div>
  );
}
