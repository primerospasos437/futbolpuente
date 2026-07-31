import { useEffect } from "react";
import { createPortal } from "react-dom";
import SportCarousel from "./SportCarousel";
import { SPORTS_CATALOG } from "../lib/sportsCatalog";
import { getSelectedSport } from "../lib/bridgeSession";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (sportId: string) => void;
  title?: string;
};

/** Modal elegante con la calesita de deportes (solo al cambiar deporte). */
export default function SportPickerModal({
  open,
  onClose,
  onSelect,
  title = "Cambiar deporte",
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Bloquear scroll del fondo mientras el modal está abierto
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="psb-sport-modal" role="dialog" aria-modal="true" aria-labelledby="psb-sport-modal-title">
      <button type="button" className="psb-sport-modal__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="psb-sport-modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="psb-sport-modal__head">
          <h2 id="psb-sport-modal-title">{title}</h2>
          <button type="button" className="psb-sport-modal__close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <SportCarousel
          sports={SPORTS_CATALOG}
          initialSportId={getSelectedSport()}
          onSelectEnter={(id) => {
            const sport = SPORTS_CATALOG.find((s) => s.id === id);
            if (sport && !sport.available) return;
            onSelect(id);
            onClose();
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
