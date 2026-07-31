import { useEffect, useState } from "react";
import {
  grupoCrear,
  grupoEntrar,
  grupoUnirse,
  misGrupos,
  type GrupoMembership,
} from "../lib/gruposApi";
import { getSelectedSport } from "../lib/bridgeSession";

type Mode = "hub" | "crear" | "unirse";

type Props = {
  onGroupReady: (grupoId: string, meta: GrupoMembership) => void;
  /** Oculta el título duplicado cuando vive dentro del Dashboard. */
  embedded?: boolean;
};

export default function LandingGroupWizard({ onGroupReady, embedded = false }: Props) {
  const [mode, setMode] = useState<Mode>("hub");
  const [grupos, setGrupos] = useState<GrupoMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombreGrupo, setNombreGrupo] = useState("");
  const [pinGrupo, setPinGrupo] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [joinBy, setJoinBy] = useState<"nombre" | "codigo">("nombre");

  const deporte = getSelectedSport() ?? "futbol";

  async function loadGrupos() {
    setLoading(true);
    setError(null);
    try {
      const list = await misGrupos();
      setGrupos(list);
      setMode("hub");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar tus grupos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGrupos();
  }, []);

  async function onEnterExisting(g: GrupoMembership) {
    setBusy(true);
    setError(null);
    try {
      const r = await grupoEntrar(g.grupoId);
      onGroupReady(r.grupoId, r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar al grupo");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await grupoCrear({
        nombre: nombreGrupo,
        pin: pinGrupo,
        deporte,
      });
      onGroupReady(r.grupoId, r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el grupo");
    } finally {
      setBusy(false);
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r =
        joinBy === "codigo"
          ? await grupoUnirse({
              inviteCode,
              pin: pinGrupo || undefined,
              deporte,
            })
          : await grupoUnirse({
              nombre: nombreGrupo,
              pin: pinGrupo,
              deporte,
            });
      onGroupReady(r.grupoId, r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo unir al grupo");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="psb-auth-panel" aria-labelledby="psb-grupos-title">
        <h2 id="psb-grupos-title">Tus grupos</h2>
        <p className="psb-auth-sub">Cargando…</p>
      </section>
    );
  }

  const hasGrupos = grupos.length > 0;

  if (mode === "crear") {
    return (
      <section className="psb-auth-panel" aria-labelledby="psb-grupos-title">
        <button type="button" className="psb-back-link" onClick={() => setMode("hub")}>
          ← Volver
        </button>
        <h2 id="psb-grupos-title">Crear un grupo nuevo</h2>
        <p className="psb-auth-sub">
          Definí el nombre y un PIN compartido. Vas a ser el administrador del grupo.
        </p>
        {error ? <div className="psb-landing-error">{error}</div> : null}
        <form onSubmit={onCreate}>
          <label htmlFor="psb-g-nombre">Nombre del grupo</label>
          <input
            id="psb-g-nombre"
            value={nombreGrupo}
            onChange={(e) => setNombreGrupo(e.target.value)}
            required
            minLength={3}
            placeholder="Ej. Los del jueves"
          />
          <label htmlFor="psb-g-pin">PIN / clave del grupo (mín. 4)</label>
          <input
            id="psb-g-pin"
            type="password"
            value={pinGrupo}
            onChange={(e) => setPinGrupo(e.target.value)}
            required
            minLength={4}
            autoComplete="new-password"
          />
          <button type="submit" className="psb-btn-enter" disabled={busy}>
            {busy ? "Creando…" : "Crear grupo y entrar"}
          </button>
        </form>
      </section>
    );
  }

  if (mode === "unirse") {
    return (
      <section className="psb-auth-panel" aria-labelledby="psb-grupos-title">
        <button type="button" className="psb-back-link" onClick={() => setMode("hub")}>
          ← Volver
        </button>
        <h2 id="psb-grupos-title">Unirse a un grupo</h2>
        <p className="psb-auth-sub">Usá el nombre + PIN, o el código de invitación del admin.</p>
        {error ? <div className="psb-landing-error">{error}</div> : null}

        <div className="psb-group-join-tabs" role="tablist">
          <button
            type="button"
            className={joinBy === "nombre" ? "is-active" : ""}
            onClick={() => setJoinBy("nombre")}
          >
            Nombre + PIN
          </button>
          <button
            type="button"
            className={joinBy === "codigo" ? "is-active" : ""}
            onClick={() => setJoinBy("codigo")}
          >
            Código
          </button>
        </div>

        <form onSubmit={onJoin}>
          {joinBy === "nombre" ? (
            <>
              <label htmlFor="psb-j-nombre">Nombre del grupo</label>
              <input
                id="psb-j-nombre"
                value={nombreGrupo}
                onChange={(e) => setNombreGrupo(e.target.value)}
                required
                minLength={3}
              />
              <label htmlFor="psb-j-pin">PIN del grupo</label>
              <input
                id="psb-j-pin"
                type="password"
                value={pinGrupo}
                onChange={(e) => setPinGrupo(e.target.value)}
                required
                minLength={4}
                autoComplete="current-password"
              />
            </>
          ) : (
            <>
              <label htmlFor="psb-j-code">Código de invitación</label>
              <input
                id="psb-j-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                required
                minLength={4}
                placeholder="Ej. A1B2C3D4"
              />
              <label htmlFor="psb-j-pin2">PIN del grupo (opcional)</label>
              <input
                id="psb-j-pin2"
                type="password"
                value={pinGrupo}
                onChange={(e) => setPinGrupo(e.target.value)}
                autoComplete="current-password"
              />
            </>
          )}
          <button type="submit" className="psb-btn-enter" disabled={busy}>
            {busy ? "Uniéndote…" : "Unirme y entrar"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="psb-auth-panel" aria-labelledby="psb-grupos-title">
      {embedded ? null : (
        <>
          <h2 id="psb-grupos-title">{hasGrupos ? "Tus grupos" : "Elegí cómo empezar"}</h2>
          <p className="psb-auth-sub">
            {hasGrupos
              ? "Entrá a un grupo o creá / unite a otro."
              : "Todavía no estás en ningún grupo. Creá uno nuevo (vas a ser admin) o unite con PIN / código."}
          </p>
          <p className="psb-register-hint" style={{ marginBottom: "0.85rem" }}>
            Después de entrar a un grupo, completá tu ficha Fútbol 11 / Fútbol 5 en «Mi perfil».
          </p>
        </>
      )}
      {error ? <div className="psb-landing-error">{error}</div> : null}

      {hasGrupos ? (
        <ul className="psb-group-list">
          {grupos.map((g) => {
            const unread = g.unreadCount ?? 0;
            return (
              <li key={g.grupoId}>
                <button
                  type="button"
                  className={`psb-group-card${unread > 0 ? " psb-group-card--alert" : ""}`}
                  disabled={busy}
                  onClick={() => void onEnterExisting(g)}
                >
                  <span className="psb-group-card-top">
                    <span className="psb-group-card-name">{g.nombre}</span>
                    {unread > 0 ? (
                      <span className="psb-group-badge" aria-label={`${unread} avisos`}>
                        {unread > 9 ? "9+" : unread}
                      </span>
                    ) : null}
                  </span>
                  <span className="psb-group-card-meta">
                    {g.deporte}
                    {g.esAdmin ? " · Admin" : " · Miembro"}
                  </span>
                  {unread > 0 && g.unreadPreview ? (
                    <span className="psb-group-card-aviso">{g.unreadPreview}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="psb-group-actions">
        <button type="button" className="psb-btn-enter" disabled={busy} onClick={() => setMode("crear")}>
          Crear grupo nuevo
        </button>
        <button type="button" className="psb-btn-demo" disabled={busy} onClick={() => setMode("unirse")}>
          Unirse con PIN / código
        </button>
      </div>
    </section>
  );
}
