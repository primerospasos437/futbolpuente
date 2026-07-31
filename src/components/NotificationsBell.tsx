import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiNotificaciones, type NotificacionRow } from "../api";
import {
  listLocalNotifications,
  LOCAL_NOTIF_EVENT,
  markLocalNotificationRead,
} from "../lib/localNotifications";

function mergeNotifs(server: NotificacionRow[], local: NotificacionRow[]): NotificacionRow[] {
  const byId = new Map<string, NotificacionRow>();
  for (const n of [...local, ...server]) byId.set(n.id, n);
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [serverItems, setServerItems] = useState<NotificacionRow[]>([]);
  const [localItems, setLocalItems] = useState<NotificacionRow[]>(() => listLocalNotifications());
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const items = useMemo(() => mergeNotifs(serverItems, localItems), [serverItems, localItems]);
  const unread = useMemo(() => items.filter((n) => !n.leida).length, [items]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await apiNotificaciones.list();
        if (!cancelled) setServerItems(list);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const refresh = () => setLocalItems(listLocalNotifications());
    window.addEventListener(LOCAL_NOTIF_EVENT, refresh);
    return () => window.removeEventListener(LOCAL_NOTIF_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function onRead(n: NotificacionRow) {
    if (n.leida) return;
    if (n.id.startsWith("local_")) {
      markLocalNotificationRead(n.id);
      setLocalItems(listLocalNotifications());
      return;
    }
    try {
      await apiNotificaciones.marcarLeida(n.id);
      setServerItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
    } catch {
      /* ignore */
    }
  }

  function hrefFor(n: NotificacionRow): string | null {
    const d = n.datos ?? {};
    if (typeof d.href === "string" && d.href.length > 0) return d.href;
    const partidoId = d.partido_id;
    if (typeof partidoId === "string" && partidoId.length > 0) {
      if (n.tipo === "partido_confirmado" || n.tipo === "partido_promovido_suplente") {
        return `/proximos-partidos/${partidoId}`;
      }
      if (n.tipo === "f5_valorar_partido") {
        return `/partido/${partidoId}/valorar-f5`;
      }
      if (n.tipo === "encuesta_post_partido") {
        return `/partido/${partidoId}/encuesta`;
      }
    }
    if (n.tipo === "convocatoria_rol_actualizado") {
      return "/proximos-partidos";
    }
    if (n.tipo === "calendario_cargar_partido") {
      return "/mi-calendario?cargar=1";
    }
    return null;
  }

  return (
    <div ref={ref} style={{ position: "relative", marginLeft: "auto" }}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-label="Notificaciones"
        onClick={() => setOpen((v) => !v)}
        style={{ position: "relative" }}
      >
        🔔
        {unread > 0 ? (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: "1.1rem",
              height: "1.1rem",
              borderRadius: "99px",
              background: "var(--danger)",
              color: "#fff",
              fontSize: "0.65rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
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
            padding: "0.75rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          }}
        >
          {err ? <p className="error" style={{ margin: 0 }}>{err}</p> : null}
          {!items.length ? (
            <p className="muted" style={{ margin: 0 }}>
              No hay notificaciones.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((n) => {
                const href = hrefFor(n);
                const inner = (
                  <div
                    onClick={() => onRead(n)}
                    style={{
                      padding: "0.55rem 0.35rem",
                      borderBottom: "1px solid var(--border)",
                      opacity: n.leida ? 0.65 : 1,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{n.titulo}</div>
                    {n.cuerpo ? (
                      <div className="muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
                        {n.cuerpo}
                      </div>
                    ) : null}
                  </div>
                );
                return (
                  <li key={n.id}>
                    {href ? (
                      <Link to={href} style={{ color: "inherit", textDecoration: "none" }} onClick={() => onRead(n)}>
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
