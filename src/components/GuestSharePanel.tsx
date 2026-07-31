import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Check } from "lucide-react";
import {
  createGuestShare,
  qrImageUrl,
  type GuestSharePayload,
} from "../lib/guestRateShare";
import type { SkillFamily } from "../lib/personalMatches";

type Props = {
  open: boolean;
  onClose: () => void;
  playerId: string;
  apodo: string;
};

/** Genera link + QR para que un desconocido califique al jugador. */
export default function GuestSharePanel({ open, onClose, playerId, apodo }: Props) {
  const titleId = useId();
  const [formato, setFormato] = useState<SkillFamily>("f5");
  const [share, setShare] = useState<{ payload: GuestSharePayload; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShare(null);
    setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  function generate() {
    const created = createGuestShare({ playerId, apodo, formato });
    setShare({ payload: created.payload, url: created.url });
    setCopied(false);
  }

  async function copyLink() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return createPortal(
    <div className="psb-match-modal psb-cal-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="psb-match-modal__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="psb-match-modal__panel">
        <div className="psb-match-modal__head">
          <h2 id={titleId}>Pedir calificación</h2>
          <button type="button" className="psb-sport-modal__close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="psb-match-modal__sub">
          Jugás con desconocidos: compartí el link o el QR para que te califiquen sin instalar la app. Así también
          conocen PlaySportBridge.
        </p>

        <fieldset className="psb-match-fieldset">
          <legend>Formato a calificar</legend>
          <div className="psb-tipo-toggle" role="group">
            <button
              type="button"
              className={`psb-tipo-btn${formato === "f5" ? " is-active" : ""}`}
              aria-pressed={formato === "f5"}
              onClick={() => setFormato("f5")}
            >
              F5 / F7 / F8
            </button>
            <button
              type="button"
              className={`psb-tipo-btn${formato === "f11" ? " is-active" : ""}`}
              aria-pressed={formato === "f11"}
              onClick={() => setFormato("f11")}
            >
              F9 / F11
            </button>
          </div>
        </fieldset>

        <button type="button" className="psb-match-save" onClick={generate}>
          Generar link y QR
        </button>

        {share ? (
          <div className="psb-guest-share-result">
            <img
              className="psb-guest-qr"
              src={qrImageUrl(share.url)}
              alt="QR para calificar"
              width={220}
              height={220}
            />
            <p className="psb-guest-url">{share.url}</p>
            <button type="button" className="btn btn-ghost" onClick={copyLink}>
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiado" : "Copiar link"}
            </button>
            {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: "0.5rem", width: "100%" }}
                onClick={() =>
                  navigator.share({
                    title: `Calificá a ${apodo} · PlaySportBridge`,
                    text: `Ayudame calificándome en ${formato === "f5" ? "F5" : "F11"} para mi historial.`,
                    url: share.url,
                  })
                }
              >
                Compartir…
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
