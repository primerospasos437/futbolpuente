import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiNotificaciones, type NotificacionRow } from "../api";

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificacionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  const unread = items.filter((n) => !n.leida).length;

  async function load() {
    try {
      const list = await apiNotificaciones.list();
      setItems(Array.isArray(list) ? list : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      if (!ref.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  async function onRead(n: NotificacionRow) {
    if (!n.leida) {
      try {
        await apiNotificaciones.marcarLeida(n.id);
        await load();
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
          if (!open) void load();
        }}
        style={{ position: "relative" }}
      >
        Notificaciones
        {unread > 0 ? (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              background: "var(--warn, #f4b942)",
              color: "#111",
              borderRadius: 999,
              fontSize: "0.7rem",
              minWidth: "1.1rem",
              textAlign: "center",
              lineHeight: 1.2,
              padding: "0 4px",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: "110%",
            width: "min(360px, 92vw)",
            maxHeight: "70vh",
            overflowY: "auto",
            zIndex: 50,
            margin: 0,
            padding: "0.75rem",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {error && <p className="error" style={{ marginTop: 0 }}>{error}</p>}
          {items.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No hay notificaciones.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((n) => (
                <li
                  key={n.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    padding: "0.5rem 0",
                    opacity: n.leida ? 0.75 : 1,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{n.titulo}</div>
                  <p className="muted" style={{ margin: "0.25rem 0", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
                    {n.cuerpo}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span className="muted" style={{ fontSize: "0.75rem" }}>
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                    {String(n.datos?.partido_id ?? "") && n.tipo === "partido_confirmado" ? (
                      <Link
                        to={`/partido/${String(n.datos.partido_id)}/valorar-f5`}
                        style={{ fontSize: "0.85rem" }}
                        onClick={() => onRead(n)}
                      >
                        Valorar F5
                      </Link>
                    ) : null}
                    {!n.leida ? (
                      <button type="button" className="btn btn-ghost" style={{ fontSize: "0.8rem", padding: "0.2rem 0.5rem" }} onClick={() => onRead(n)}>
                        Marcar leída
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
