import { useCallback, useEffect, useRef, useState } from "react";

export type SportCarouselItem = {
  id: string;
  icon: string;
  name: string;
  available: boolean;
};

type Props = {
  sports: SportCarouselItem[];
  initialSportId?: string | null;
  onSelectEnter: (sportId: string) => void;
};

function offsetClass(index: number, selected: number, total: number): string {
  let d = index - selected;
  if (d > total / 2) d -= total;
  if (d < -total / 2) d += total;
  if (d === 0) return "is-center";
  if (Math.abs(d) === 1) return "is-near";
  return "is-far";
}

export default function SportCarousel({ sports, initialSportId, onSelectEnter }: Props) {
  const initialIndex = Math.max(
    0,
    sports.findIndex((s) => s.id === initialSportId),
  );
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [selected, setSelected] = useState(initialIndex >= 0 ? initialIndex : 0);
  const scrollRaf = useRef<number | null>(null);

  const syncSelectedFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || !sports.length) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    itemRefs.current.forEach((node, i) => {
      if (!node) return;
      const cardCenter = node.offsetLeft + node.offsetWidth / 2;
      const d = Math.abs(cardCenter - center);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setSelected(best);
  }, [sports.length]);

  const scrollToIndex = useCallback((index: number, smooth = true) => {
    const node = itemRefs.current[index];
    const track = trackRef.current;
    if (!node || !track) return;
    const left = node.offsetLeft - (track.clientWidth - node.offsetWidth) / 2;
    track.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
    setSelected(index);
  }, []);

  useEffect(() => {
    const idx = initialIndex >= 0 ? initialIndex : 0;
    scrollToIndex(idx, false);
    const t = window.setTimeout(() => scrollToIndex(idx, false), 80);
    return () => window.clearTimeout(t);
  }, [initialIndex, scrollToIndex]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current);
      scrollRaf.current = requestAnimationFrame(syncSelectedFromScroll);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current);
    };
  }, [syncSelectedFromScroll]);

  function onCardClick(index: number) {
    if (index === selected) {
      onSelectEnter(sports[index].id);
      return;
    }
    scrollToIndex(index);
  }

  const current = sports[selected];

  return (
    <div className="psb-carousel-wrap">
      <p className="psb-carousel-label">Elegí tu deporte</p>
      <p className="psb-carousel-hint muted">Deslizá la calesita · Tocá de nuevo el deporte del centro para entrar</p>

      <div className="psb-carousel-3d">
        <div ref={trackRef} className="psb-carousel-track" role="list" aria-label="Deportes">
          {sports.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="listitem"
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className={`psb-carousel-item ${offsetClass(i, selected, sports.length)} ${s.available ? "" : "psb-carousel-item--soon"}`}
              onClick={() => onCardClick(i)}
              aria-pressed={i === selected}
            >
              <span className="psb-sport-icon" aria-hidden>
                {s.icon}
              </span>
              <span className="psb-sport-name">{s.name}</span>
              {!s.available ? <span className="psb-sport-badge">Próximamente</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="psb-carousel-actions">
        <button
          type="button"
          className="psb-carousel-arrow"
          aria-label="Deporte anterior"
          onClick={() => scrollToIndex((selected - 1 + sports.length) % sports.length)}
        >
          ‹
        </button>
        <button
          type="button"
          className="psb-btn-sport-enter"
          onClick={() => onSelectEnter(current.id)}
        >
          {current.available ? `Entrar a ${current.name}` : `${current.name} — próximamente`}
        </button>
        <button
          type="button"
          className="psb-carousel-arrow"
          aria-label="Siguiente deporte"
          onClick={() => scrollToIndex((selected + 1) % sports.length)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
