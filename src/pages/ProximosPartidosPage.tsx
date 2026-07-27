import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiConvocatorias, apiPartidos, type ConvocatoriaRow, type PartidoRow, type PresenciaRow } from "../api";
import { FootballStrip, PageCheer } from "../components/FunDecor";
import PartidoEquiposView from "../components/PartidoEquiposView";
import {
  grupoConfigGet,
  labelDia,
  nextMatchIsoForDia,
  type DiaSemana,
  type GrupoConfig,
} from "../lib/grupoConfig";
import {
  miEquipoEnPartido,
  parseEquipoNombres,
  partidoTieneEquiposPublicados,
} from "../lib/partidoEquipos";

const TZ = "America/Argentina/Buenos_Aires";

type SlotConvocatoria = { dia: string; fecha: string; label: string; tone: "purple" | "blue" | "ok" };

function myConvocatoria(
  list: ConvocatoriaRow[],
  dia: string,
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

function buildSlots(cfg: GrupoConfig | null): SlotConvocatoria[] {
  const dias = cfg?.diasPartido?.length ? cfg.diasPartido : (["martes", "jueves"] as DiaSemana[]);
  const tones: Array<"purple" | "blue" | "ok"> = ["purple", "blue", "ok"];
  const slots: SlotConvocatoria[] = dias.map((dia, i) => ({
    dia,
    fecha: nextMatchIsoForDia(dia, TZ),
    label: labelDia(dia),
    tone: tones[i % tones.length],
  }));

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  for (const f of cfg?.fechasExtra ?? []) {
    if (f < today) continue;
    if (slots.some((s) => s.fecha === f)) continue;
    slots.push({ dia: "extra", fecha: f, label: "Fecha especial", tone: "ok" });
  }

  return slots.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

/** @deprecated Prefer nextMatchIsoForDia — se mantiene por compat Teams. */
export function nextMatchIso(dia: "martes" | "jueves"): string {
  return nextMatchIsoForDia(dia, TZ);
}

export default function ProximosPartidosPage() {
  const { partidoId: partidoIdParam } = useParams<{ partidoId?: string }>();
  const detalleRef = useRef<HTMLDivElement>(null);

  const [conv, setConv] = useState<ConvocatoriaRow[]>([]);
  const [me, setMe] = useState<{
    id: string;
    perfilCompletoCargado: boolean;
    perfilF5Cargado: boolean;
    miValoracionesPerfilOtros: number;
  } | null>(null);
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
  const [grupoCfg, setGrupoCfg] = useState<GrupoConfig | null>(null);

  const slots = useMemo(() => buildSlots(grupoCfg), [grupoCfg]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, meRes, companerosRes, prt, pres, evitaRes, cfg] = await Promise.all([
          apiConvocatorias.list(),
          api.meForGate(),
          api.companerosOptions(),
          apiPartidos.list(),
          apiPartidos.listPresencias(),
          api.evitaCompanerosGet().catch(() => [] as { id: string; apodo: string }[]),
          grupoConfigGet().catch(() => null),
        ]);
        if (cancelled) return;
        setConv(Array.isArray(list) ? list : []);
        setMe(meRes);
        setPartidos(Array.isArray(prt) ? prt : []);
        setPresencias(Array.isArray(pres) ? pres : []);
        setCompaneros(companerosRes);
        setGrupoCfg(cfg);
        const ids = evitaRes.map((x) => x.id);
        setEvita1(ids[0] ?? "");
        setEvita2(ids[1] ?? "");
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

  const minVal = grupoCfg?.minValoracionesPerfil ?? 4;
  const exigeF11 = grupoCfg?.exigePerfilCompleto ?? true;
  const exigeF5 = grupoCfg?.exigePerfilF5 ?? true;

  const puedeAnotarseConvocatoria =
    me != null &&
    (!exigeF11 || me.perfilCompletoCargado) &&
    (!exigeF5 || me.perfilF5Cargado) &&
    (me.miValoracionesPerfilOtros ?? 0) >= minVal;

  async function refresh() {
    const list = await apiConvocatorias.list();
    setConv(Array.isArray(list) ? list : []);
  }

  async function anotar(dia: string, fecha: string) {
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

  async function baja(dia: string, fecha: string) {
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
      setEvitaOk("Preferencias guardadas. Se usan al armar equipos.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setEvitaBusy(false);
    }
  }

  if (loading) return <p className="muted">Cargando…</p>;
  if (!meId) return <div className="error">No se pudo cargar tu sesión.</div>;

  const diasLabel = (grupoCfg?.diasPartido ?? ["martes", "jueves"]).map(labelDia).join(" / ");
  const faltanRequisitos =
    me != null &&
    ((exigeF11 && !me.perfilCompletoCargado) ||
      (exigeF5 && !me.perfilF5Cargado) ||
      (me.miValoracionesPerfilOtros ?? 0) < minVal);

  return (
    <div className="page-shell">
      <PageCheer quote="Anotate, jugá, y que hablen las stats." icon="🏟️" />
      <FootballStrip items={["🏟️", "⚽", "🗓️", "👟", "🏆", "🥅"]} />
      <header className="page-hero">
        <h1>🏟️ Próximos partidos</h1>
        <p className="sub">
          Anotate para {diasLabel || "los días del grupo"}.
          {grupoCfg
            ? ` Lista: abre ${grupoCfg.anotacionAbreDiasAntes} día(s) antes a las ${grupoCfg.anotacionAbreHora} y cierra el día del partido a las ${grupoCfg.anotacionCierraHora} (hora Argentina).`
            : " El servidor valida el horario de inscripción."}
          {grupoCfg?.horaPartidoDefault ? ` Partido habitual: ${grupoCfg.horaPartidoDefault} hs.` : ""}
          {grupoCfg?.complejoHabitual ? ` Complejo: ${grupoCfg.complejoHabitual}.` : ""}
        </p>
      </header>

      {grupoCfg?.notasLista?.trim() ? (
        <div className="card card--ok" style={{ marginTop: "0.75rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Consignas del grupo</h2>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{grupoCfg.notasLista.trim()}</p>
        </div>
      ) : null}

      {error && <div className="error">{error}</div>}

      {partidoIdParam ? (
        <div ref={detalleRef} className="card card--glow" style={{ marginTop: "1rem" }}>
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
        <div className="card card--ok" style={{ marginTop: "1rem" }}>
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

      {me && faltanRequisitos ? (
        <div className="card card--warn" style={{ marginTop: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Requisitos para anotarte</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Según la configuración del grupo, necesitás cumplir lo siguiente:
          </p>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
            {exigeF11 && !me.perfilCompletoCargado ? (
              <li>
                Guardá tu <strong>perfil completo</strong> en «Mis perfiles».
              </li>
            ) : null}
            {exigeF5 && !me.perfilF5Cargado ? (
              <li>
                Guardá tu perfil <strong>F5</strong> en «Mis perfiles».
              </li>
            ) : null}
            {(me.miValoracionesPerfilOtros ?? 0) < minVal ? (
              <li>
                Valorá el perfil completo de al menos <strong>{minVal}</strong> compañeros distintos en «Jugadores»
                (llevás <strong>{me.miValoracionesPerfilOtros ?? 0}</strong> de {minVal}).
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {misPartidosTitularConfirmados.length > 0 ? (
        <div className="card card--blue" style={{ marginTop: "1rem" }}>
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
        {slots.map((slot) => {
          const mine = myConvocatoria(conv, slot.dia, slot.fecha, meId);
          const cardClass =
            slot.tone === "blue" ? "card card--blue" : slot.tone === "ok" ? "card card--ok" : "card card--purple";
          const busyKey = `${slot.dia}-${slot.fecha}`;
          return (
            <div key={busyKey} className={cardClass}>
              <h2 style={{ marginTop: 0 }}>{slot.label}</h2>
              <p className="muted">
                Partido: {slot.fecha}
                {grupoCfg?.horaPartidoDefault ? ` · ${grupoCfg.horaPartidoDefault} hs` : ""}
              </p>
              {mine ? (
                <div>
                  <p style={{ fontWeight: 600 }}>Estado: {mine.rol_convocatoria ?? "anotado"}</p>
                  <p className="muted" style={{ fontSize: "0.9rem" }}>
                    Inscripto el {mine.created_at ? new Date(mine.created_at).toLocaleString() : "—"}. Esperando armado
                    de equipos por el administrador.
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy === busyKey}
                    onClick={() => baja(slot.dia, slot.fecha)}
                  >
                    Darme de baja
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy === busyKey || !puedeAnotarseConvocatoria}
                  onClick={() => anotar(slot.dia, slot.fecha)}
                >
                  Anotarme
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="card card--purple" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Preferencia personal (privada)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Podés elegir hasta <strong>dos</strong> compañeros con los que preferís <strong>no compartir equipo</strong>. Solo
          vos ves esta elección. Se tiene en cuenta al generar equipos parejos para separarlos cuando sea posible.
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
