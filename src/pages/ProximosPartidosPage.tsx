import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { api, apiConvocatorias, apiPartidos, type ConvocatoriaRow, type PartidoRow, type PresenciaRow } from "../api";
import { Calendar, Shield } from "lucide-react";
import MatchSpotlightCard, { type SpotlightPlayerExtra } from "../components/MatchSpotlightCard";
import {
  grupoConfigGet,
  labelDia,
  nextMatchIsoForDia,
  fechaCoincideConCalendarioGrupo,
  type GrupoConfig,
} from "../lib/grupoConfig";
import {
  miEquipoEnPartido,
  parseEquipoNombres,
  partidoTieneEquiposPublicados,
} from "../lib/partidoEquipos";
import { buildPlayerListSnippets } from "../lib/partidoStats";
import type { PlayerSummary } from "../types";

const TZ = "America/Argentina/Buenos_Aires";

const POS_LABEL: Record<string, string> = {
  portero: "POR",
  defensa: "DEF",
  medio: "MED",
  delantero: "DEL",
};

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
  if (!cfg?.configurado) return [];

  const dias = cfg.diasPartido ?? [];
  if (dias.length === 0 && !(cfg.fechasExtra?.length)) return [];
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

  for (const f of cfg.fechasExtra ?? []) {
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
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
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
        const [list, meRes, companerosRes, playersRes, prt, pres, evitaRes, cfg] = await Promise.all([
          apiConvocatorias.list(),
          api.meForGate(),
          api.companerosOptions(),
          api.players().catch(() => ({ jugadores: [] as PlayerSummary[] })),
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
        setPlayers(playersRes.jugadores ?? []);
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
  const grupoListo = Boolean(grupoCfg?.configurado);

  const minVal = grupoCfg?.minValoracionesPerfil ?? 4;
  const exigeF11 = grupoCfg?.exigePerfilCompleto ?? true;
  const exigeF5 = grupoCfg?.exigePerfilF5 ?? true;

  const puedeAnotarseConvocatoria =
    grupoListo &&
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
        .filter((p) => fechaCoincideConCalendarioGrupo(p.fecha, grupoCfg, TZ))
        .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)),
    [partidos, grupoCfg],
  );

  const fechasConEquiposConfirmados = useMemo(
    () => new Set(partidosConEquipos.map((p) => p.fecha)),
    [partidosConEquipos],
  );

  const misPartidosTitularConfirmados = useMemo(() => {
    if (!meId) return [];
    const mias = presencias.filter((pr) => pr.jugador_id === meId && pr.estado === "convocado");
    const map = new Map(mias.map((pr) => [pr.partido_id, pr]));
    return partidosConEquipos.filter((p) => map.has(p.id)).map((p) => ({ partido: p, presencia: map.get(p.id)! }));
  }, [meId, partidosConEquipos, presencias]);

  const titularPartidoIds = useMemo(
    () => new Set(misPartidosTitularConfirmados.map(({ partido }) => partido.id)),
    [misPartidosTitularConfirmados],
  );

  const apodoById = useMemo(() => new Map(players.map((p) => [p.id, p.apodo])), [players]);

  const playerExtras = useMemo(() => {
    const snippets = buildPlayerListSnippets(partidos, presencias, apodoById);
    const out: Record<string, SpotlightPlayerExtra> = {};
    for (const p of players) {
      const sn = snippets.get(p.id);
      out[p.id] = {
        posicionLabel: POS_LABEL[p.posicionPreferida] ?? p.posicionPreferida?.slice(0, 3).toUpperCase(),
        lastResults: (sn?.lastChips ?? []).slice(0, 3).map((c) => ({
          letter: c.letter,
          score: c.score,
        })),
      };
    }
    return out;
  }, [players, partidos, presencias, apodoById]);

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

  if (partidoIdParam) {
    return <Navigate to="/proximos-partidos" replace />;
  }

  if (loading) return <p className="muted">Cargando…</p>;
  if (!meId) return <div className="error">No se pudo cargar tu sesión.</div>;

  const diasLabel = (grupoCfg?.diasPartido ?? []).map(labelDia).join(" / ");
  const faltanRequisitos =
    grupoListo &&
    me != null &&
    ((exigeF11 && !me.perfilCompletoCargado) ||
      (exigeF5 && !me.perfilF5Cargado) ||
      (me.miValoracionesPerfilOtros ?? 0) < minVal);

  return (
    <div className="page-shell">
      <header className="page-hero">
        <h1><Calendar size={22} className="neon-icon" /> Próximos partidos</h1>
        <p className="sub">
          {grupoListo ? (
            <>
              Anotate para {diasLabel || "los días del grupo"}.
              {grupoCfg
                ? ` Lista: abre ${grupoCfg.anotacionAbreDiasAntes} día(s) antes a las ${grupoCfg.anotacionAbreHora} y cierra el día del partido a las ${grupoCfg.anotacionCierraHora} (hora Argentina).`
                : null}
              {grupoCfg?.horaPartidoDefault ? ` Partido habitual: ${grupoCfg.horaPartidoDefault} hs.` : ""}
              {grupoCfg?.complejoHabitual ? ` Complejo: ${grupoCfg.complejoHabitual}.` : ""}
            </>
          ) : (
            <>Todavía no hay listas de anotación: el administrador tiene que configurar el grupo primero.</>
          )}
        </p>
      </header>

      {!grupoListo ? (
        <div className="card card--warn" style={{ marginTop: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Grupo sin configurar</h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
            Cuando un admin guarde la configuración (días, horarios y reglas) en «⚙️ Configuración», acá van a aparecer
            las fechas para anotarte. Hasta entonces no hay días ni requisitos de inscripción activos.
          </p>
        </div>
      ) : null}

      {grupoCfg?.notasLista?.trim() && grupoListo ? (
        <div className="card card--ok" style={{ marginTop: "0.75rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Consignas del grupo</h2>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{grupoCfg.notasLista.trim()}</p>
        </div>
      ) : null}

      {error && <div className="error">{error}</div>}

      {partidosConEquipos.length > 0 ? (
        <section style={{ marginTop: "1rem" }}>
          <h2 className="proximos-section-title"><Shield size={16} className="neon-icon" /> Partidos con equipos confirmados</h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: "0.85rem" }}>
            Compañeros, rivales, posición y últimos 3 resultados de cada uno.
          </p>
          <div className="proximos-spotlight-grid">
            {partidosConEquipos.map((p) => {
              const soyTitular = titularPartidoIds.has(p.id);
              return (
                <MatchSpotlightCard
                  key={p.id}
                  title="Próximo partido"
                  fecha={p.fecha}
                  hora={p.hora_partido}
                  claros={parseEquipoNombres(p.equipo_claros, apodoById)}
                  oscuros={parseEquipoNombres(p.equipo_oscuros, apodoById)}
                  golesClaros={p.goles_claros}
                  golesOscuros={p.goles_oscuros}
                  miEquipo={meId ? miEquipoEnPartido(p.id, meId, presencias) : null}
                  showScore={p.goles_claros != null && p.goles_oscuros != null}
                  playerExtras={playerExtras}
                  footer={
                    soyTitular ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={bajaPartidoBusy === p.id}
                        onClick={() => void bajaTitularPartidoConfirmado(p.id)}
                      >
                        {bajaPartidoBusy === p.id ? "Procesando…" : "Darme de baja como titular"}
                      </button>
                    ) : null
                  }
                />
              );
            })}
          </div>
        </section>
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
                Valorá (perfil completo o F5) al menos <strong>{minVal}</strong> compañeros distintos en «Jugadores»
                (llevás <strong>{me.miValoracionesPerfilOtros ?? 0}</strong> de {minVal}).
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {grupoListo && slots.length > 0 ? (
        <div className="proximos-slots-grid">
          {slots.map((slot) => {
            const mine = myConvocatoria(conv, slot.dia, slot.fecha, meId);
            const busyKey = `${slot.dia}-${slot.fecha}`;
            const partidoYaArmado = fechasConEquiposConfirmados.has(slot.fecha);
            const soyTitularEseDia = misPartidosTitularConfirmados.some(({ partido }) => partido.fecha === slot.fecha);
            const toneClass =
              slot.tone === "blue"
                ? "proximos-slot proximos-slot--blue"
                : slot.tone === "ok"
                  ? "proximos-slot proximos-slot--ok"
                  : "proximos-slot proximos-slot--purple";
            return (
              <div key={busyKey} className={toneClass}>
                <div className="proximos-slot__head">
                  <h2>{slot.label}</h2>
                  <span className="proximos-slot__badge">📅 {slot.fecha}</span>
                </div>
                <p className="muted proximos-slot__hora">
                  {grupoCfg?.horaPartidoDefault
                    ? `Partido habitual: ${grupoCfg.horaPartidoDefault} hs`
                    : "Horario según grupo"}
                </p>
                {partidoYaArmado || soyTitularEseDia ? (
                  <div>
                    <p style={{ fontWeight: 600, margin: "0 0 0.35rem" }}>
                      {soyTitularEseDia ? "Ya estás confirmado como titular" : "Equipos ya confirmados"}
                    </p>
                    <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                      {formatFechaPartido(slot.fecha)}. No hace falta anotarte de nuevo para esta fecha.
                      {soyTitularEseDia
                        ? " Si no podés ir, usá «Darme de baja como titular» en la tarjeta de arriba."
                        : ""}
                    </p>
                  </div>
                ) : mine ? (
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
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy === busyKey}
                      onClick={() => anotar(slot.dia, slot.fecha)}
                    >
                      Anotarme
                    </button>
                    {!puedeAnotarseConvocatoria ? (
                      <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.82rem" }}>
                        Revisá los requisitos arriba (perfiles y valoraciones F5/F11).
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

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
