import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bell, CalendarPlus, MapPin, Shirt, Trash2 } from "lucide-react";
import { api } from "../api";
import AgendarEncuentroModal from "../components/AgendarEncuentroModal";
import CargarPartidoModal from "../components/CargarPartidoModal";
import { ensureNotificationPermission, syncCalendarPostMatchReminders } from "../lib/calendarReminders";
import {
  addPersonalEncuentro,
  formatEncuentroFecha,
  isEncuentroPast,
  loadPersonalEncuentros,
  removePersonalEncuentro,
  sortEncuentros,
  type FutbolFormato,
  type PersonalEncuentro,
  type PersonalEncuentroInput,
} from "../lib/personalCalendar";
import { addPersonalMatch, skillFamilyForFormato, type PersonalMatchInput } from "../lib/personalMatches";
import "../dashboard.css";

/**
 * Agenda personal del jugador (fuera del contexto de grupo).
 */
export default function MiCalendarioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [playerId, setPlayerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PersonalEncuentro[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchTipo, setMatchTipo] = useState<FutbolFormato>("F5");
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback((id: string) => {
    if (!id) return;
    setItems(sortEncuentros(loadPersonalEncuentros(id)));
    syncCalendarPostMatchReminders(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (cancelled) return;
        setPlayerId(me.id);
        setItems(sortEncuentros(loadPersonalEncuentros(me.id)));
        syncCalendarPostMatchReminders(me.id);
        void ensureNotificationPermission();
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

  useEffect(() => {
    if (searchParams.get("cargar") === "1") {
      setMatchOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Poll suave por si el partido acaba con la app abierta
  useEffect(() => {
    if (!playerId) return;
    const t = window.setInterval(() => syncCalendarPostMatchReminders(playerId), 60_000);
    return () => window.clearInterval(t);
  }, [playerId]);

  function onSave(input: PersonalEncuentroInput) {
    if (!playerId) return;
    addPersonalEncuentro(playerId, input);
    refresh(playerId);
    if (input.notificar) void ensureNotificationPermission();
    setToast("Encuentro agendado. Te avisamos después para cargarlo.");
    window.setTimeout(() => setToast(null), 3500);
  }

  function onRemove(id: string) {
    if (!playerId) return;
    removePersonalEncuentro(playerId, id);
    refresh(playerId);
  }

  function onSaveMatch(input: PersonalMatchInput) {
    if (!playerId) return;
    addPersonalMatch(playerId, input);
    setToast("Partido cargado en tus números.");
    window.setTimeout(() => setToast(null), 3500);
  }

  function openCargarFrom(e: PersonalEncuentro) {
    setMatchTipo(e.tipo);
    setMatchOpen(true);
  }

  const upcoming = items.filter((e) => !isEncuentroPast(e));
  const past = items.filter((e) => isEncuentroPast(e));

  return (
    <div className="page-shell psb-cal-page">
      <header className="page-hero">
        <h1>Mi Calendario</h1>
        <p className="sub">Tus encuentros personales · agendá partidos fuera del grupo.</p>
      </header>

      {toast ? (
        <div className="psb-dash-toast" role="status">
          {toast}
        </div>
      ) : null}

      <button type="button" className="psb-cal-cta" onClick={() => setModalOpen(true)}>
        <CalendarPlus size={22} aria-hidden />
        🗓️ Agendar Nuevo Encuentro
      </button>

      {loading ? <p className="muted">Cargando agenda…</p> : null}
      {error ? <div className="error">{error}</div> : null}

      {!loading && !error && upcoming.length === 0 && past.length === 0 ? (
        <div className="psb-cal-empty">
          <p>Todavía no tenés encuentros agendados.</p>
          <p className="muted">Tocá el botón de arriba para sumar el primero.</p>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="psb-cal-section" aria-label="Próximos">
          <h2 className="psb-cal-section__title">Próximos</h2>
          <ul className="psb-cal-list">
            {upcoming.map((e) => (
              <EncuentroCard
                key={e.id}
                encuentro={e}
                onRemove={() => onRemove(e.id)}
                onCargar={() => openCargarFrom(e)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="psb-cal-section psb-cal-section--past" aria-label="Pasados">
          <h2 className="psb-cal-section__title">Anteriores</h2>
          <ul className="psb-cal-list">
            {past.map((e) => (
              <EncuentroCard
                key={e.id}
                encuentro={e}
                past
                onRemove={() => onRemove(e.id)}
                onCargar={() => openCargarFrom(e)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <AgendarEncuentroModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={onSave} />
      <CargarPartidoModal
        open={matchOpen}
        onClose={() => setMatchOpen(false)}
        onSave={onSaveMatch}
        defaultTipo={matchTipo}
      />
    </div>
  );
}

function EncuentroCard({
  encuentro,
  past,
  onRemove,
  onCargar,
}: {
  encuentro: PersonalEncuentro;
  past?: boolean;
  onRemove: () => void;
  onCargar: () => void;
}) {
  const family = skillFamilyForFormato(encuentro.tipo);
  return (
    <li className={`psb-cal-card${past ? " is-past" : ""}`}>
      <div className="psb-cal-card__top">
        <span className="psb-cal-badge" data-tipo={encuentro.tipo}>
          {encuentro.tipo}
        </span>
        <time dateTime={`${encuentro.fecha}T${encuentro.hora}`}>
          {formatEncuentroFecha(encuentro.fecha, encuentro.hora)}
        </time>
      </div>
      <p className="psb-cal-card__lugar">
        <MapPin size={15} aria-hidden />
        {encuentro.lugar}
      </p>
      <p className={`psb-cal-card__camiseta psb-cal-card__camiseta--${encuentro.camiseta}`}>
        <Shirt size={15} aria-hidden />
        Camiseta {encuentro.camiseta === "claros" ? "Claros" : "Oscuros"}
        <span className="muted" style={{ marginLeft: "0.35rem", fontSize: "0.75rem" }}>
          · evalúa como {family === "f5" ? "F5" : "F11"}
        </span>
      </p>
      <div className="psb-cal-card__meta">
        {encuentro.notificar ? (
          <span className="psb-cal-notify">
            <Bell size={13} aria-hidden /> Recordatorio post-partido
          </span>
        ) : (
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Sin recordatorio
          </span>
        )}
        <div className="psb-cal-card__actions">
          <button type="button" className="btn btn-ghost psb-cal-card__load" onClick={onCargar}>
            Cargar
          </button>
          <button type="button" className="psb-cal-card__del" onClick={onRemove} aria-label="Eliminar encuentro">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </li>
  );
}
