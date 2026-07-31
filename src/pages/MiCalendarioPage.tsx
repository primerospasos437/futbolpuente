import { useCallback, useEffect, useState } from "react";
import { Bell, CalendarPlus, MapPin, Trash2 } from "lucide-react";
import { api } from "../api";
import AgendarEncuentroModal from "../components/AgendarEncuentroModal";
import {
  addPersonalEncuentro,
  formatEncuentroFecha,
  isEncuentroPast,
  loadPersonalEncuentros,
  removePersonalEncuentro,
  sortEncuentros,
  type PersonalEncuentro,
  type PersonalEncuentroInput,
} from "../lib/personalCalendar";
import "../dashboard.css";

/**
 * Agenda personal del jugador (fuera del contexto de grupo).
 */
export default function MiCalendarioPage() {
  const [playerId, setPlayerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PersonalEncuentro[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = useCallback((id: string) => {
    if (!id) return;
    setItems(sortEncuentros(loadPersonalEncuentros(id)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (cancelled) return;
        setPlayerId(me.id);
        setItems(sortEncuentros(loadPersonalEncuentros(me.id)));
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

  function onSave(input: PersonalEncuentroInput) {
    if (!playerId) return;
    addPersonalEncuentro(playerId, input);
    refresh(playerId);
  }

  function onRemove(id: string) {
    if (!playerId) return;
    removePersonalEncuentro(playerId, id);
    refresh(playerId);
  }

  const upcoming = items.filter((e) => !isEncuentroPast(e));
  const past = items.filter((e) => isEncuentroPast(e));

  return (
    <div className="page-shell psb-cal-page">
      <header className="page-hero">
        <h1>Mi Calendario</h1>
        <p className="sub">Tus encuentros personales · agendá partidos fuera del grupo.</p>
      </header>

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
              <EncuentroCard key={e.id} encuentro={e} onRemove={() => onRemove(e.id)} />
            ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="psb-cal-section psb-cal-section--past" aria-label="Pasados">
          <h2 className="psb-cal-section__title">Anteriores</h2>
          <ul className="psb-cal-list">
            {past.map((e) => (
              <EncuentroCard key={e.id} encuentro={e} past onRemove={() => onRemove(e.id)} />
            ))}
          </ul>
        </section>
      ) : null}

      <AgendarEncuentroModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={onSave} />
    </div>
  );
}

function EncuentroCard({
  encuentro,
  past,
  onRemove,
}: {
  encuentro: PersonalEncuentro;
  past?: boolean;
  onRemove: () => void;
}) {
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
      <div className="psb-cal-card__meta">
        {encuentro.notificar ? (
          <span className="psb-cal-notify">
            <Bell size={13} aria-hidden /> Recordatorio on
          </span>
        ) : (
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Sin recordatorio
          </span>
        )}
        <button type="button" className="psb-cal-card__del" onClick={onRemove} aria-label="Eliminar encuentro">
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}
