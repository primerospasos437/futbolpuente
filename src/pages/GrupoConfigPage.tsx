import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api";
import { FootballStrip, PageCheer } from "../components/FunDecor";
import { setActiveGrupoNombre } from "../lib/bridgeSession";
import {
  DIAS_SEMANA,
  grupoConfigGet,
  grupoConfigSet,
  grupoMiembroSetRol,
  grupoMiembrosListar,
  type DiaSemana,
  type GrupoConfig,
  type GrupoMiembro,
  type GrupoModalidad,
} from "../lib/grupoConfig";

type TabId = "general" | "calendario" | "cupos" | "reglas" | "admins";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "calendario", label: "Días y horarios" },
  { id: "cupos", label: "Modalidad y cupos" },
  { id: "reglas", label: "Reglas de inscripción" },
  { id: "admins", label: "Administradores" },
];

export default function GrupoConfigPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>("general");
  const [cfg, setCfg] = useState<GrupoConfig | null>(null);
  const [miembros, setMiembros] = useState<GrupoMiembro[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [extraDate, setExtraDate] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.meChrome();
        if (cancelled) return;
        if (!me.esAdmin) {
          setAllowed(false);
          return;
        }
        setAllowed(true);
        const [c, m] = await Promise.all([grupoConfigGet(), grupoMiembrosListar()]);
        if (cancelled) return;
        setCfg(c);
        setMiembros(m);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(patch: Partial<GrupoConfig>, successMsg: string) {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const next = await grupoConfigSet(patch);
      setCfg(next);
      if (patch.nombre != null) setActiveGrupoNombre(next.nombre);
      setOkMsg(successMsg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function toggleDia(dia: DiaSemana) {
    if (!cfg) return;
    const has = cfg.diasPartido.includes(dia);
    const next = has ? cfg.diasPartido.filter((d) => d !== dia) : [...cfg.diasPartido, dia];
    setCfg({ ...cfg, diasPartido: next });
  }

  async function onToggleAdmin(m: GrupoMiembro) {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const nextRol = m.esAdmin ? "miembro" : "admin";
      await grupoMiembroSetRol(m.jugadorId, nextRol);
      const list = await grupoMiembrosListar();
      setMiembros(list);
      setOkMsg(nextRol === "admin" ? `${m.apodo} ahora es admin.` : `${m.apodo} ya no es admin.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar rol");
    } finally {
      setSaving(false);
    }
  }

  if (allowed === false) return <Navigate to="/" replace />;
  if (error && !cfg) return <div className="error">{error}</div>;
  if (allowed == null || !cfg) return <p className="muted">Cargando configuración…</p>;

  return (
    <div className="page-shell grupo-config-page">
      <PageCheer quote="El grupo se arma como ustedes juegan." icon="⚙️" />
      <FootballStrip items={["⚙️", "🗓️", "👥", "🏟️", "📋"]} />
      <header className="page-hero">
        <h1>⚙️ Configuración del grupo</h1>
        <p className="sub">
          Solo admins. Personalizá días, cupos, reglas de inscripción y quién administra.
          {cfg.inviteCode ? (
            <>
              {" "}
              Código de invitación: <strong>{cfg.inviteCode}</strong>
            </>
          ) : null}
        </p>
      </header>

      <div className="tabs mis-perfiles-tabs" role="tablist" aria-label="Secciones de configuración">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={`btn btn-ghost ${tab === t.id ? "active" : ""}`}
            aria-selected={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setOkMsg(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <div className="error">{error}</div> : null}
      {okMsg ? <p className="muted mis-perfiles-ok">{okMsg}</p> : null}

      {tab === "general" ? (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              {
                nombre: cfg.nombre,
                complejoHabitual: cfg.complejoHabitual,
                notasLista: cfg.notasLista,
              },
              "Datos generales guardados.",
            );
          }}
        >
          <h2 className="mis-perfiles-panel-title">Información general</h2>
          <div className="grid2">
            <div className="row">
              <label htmlFor="gc-nombre">Nombre del grupo</label>
              <input
                id="gc-nombre"
                value={cfg.nombre}
                onChange={(e) => setCfg({ ...cfg, nombre: e.target.value })}
                required
              />
            </div>
            <div className="row">
              <label htmlFor="gc-complejo">Complejo habitual</label>
              <input
                id="gc-complejo"
                value={cfg.complejoHabitual}
                onChange={(e) => setCfg({ ...cfg, complejoHabitual: e.target.value })}
                placeholder="Ej. Predio Norte cancha 3"
              />
            </div>
          </div>
          <div className="row">
            <label htmlFor="gc-notas">Notas / consignas de la lista</label>
            <textarea
              id="gc-notas"
              rows={4}
              value={cfg.notasLista}
              onChange={(e) => setCfg({ ...cfg, notasLista: e.target.value })}
              placeholder="Horario de llegada, vestimenta, costo, etc."
            />
          </div>
          <div className="mis-perfiles-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar general"}
            </button>
          </div>
        </form>
      ) : null}

      {tab === "calendario" ? (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              {
                diasPartido: cfg.diasPartido,
                fechasExtra: cfg.fechasExtra,
                horaPartidoDefault: cfg.horaPartidoDefault,
                anotacionAbreDiasAntes: cfg.anotacionAbreDiasAntes,
                anotacionAbreHora: cfg.anotacionAbreHora,
                anotacionCierraHora: cfg.anotacionCierraHora,
              },
              "Calendario y horarios guardados.",
            );
          }}
        >
          <h2 className="mis-perfiles-panel-title">Días y horarios</h2>
          <p className="profile-section-desc">Días habituales de juego (se muestra el próximo de cada uno).</p>
          <div className="grupo-config-dias">
            {DIAS_SEMANA.map((d) => (
              <label key={d.id} className="grupo-config-check">
                <input
                  type="checkbox"
                  checked={cfg.diasPartido.includes(d.id)}
                  onChange={() => toggleDia(d.id)}
                />
                {d.label}
              </label>
            ))}
          </div>

          <div className="grid3" style={{ marginTop: "1rem" }}>
            <div className="row">
              <label htmlFor="gc-hora">Hora del partido</label>
              <input
                id="gc-hora"
                type="time"
                value={cfg.horaPartidoDefault}
                onChange={(e) => setCfg({ ...cfg, horaPartidoDefault: e.target.value })}
              />
            </div>
            <div className="row">
              <label htmlFor="gc-abre-dias">Abre lista (días antes)</label>
              <input
                id="gc-abre-dias"
                type="number"
                min={0}
                max={21}
                value={cfg.anotacionAbreDiasAntes}
                onChange={(e) => setCfg({ ...cfg, anotacionAbreDiasAntes: Number(e.target.value) })}
              />
            </div>
            <div className="row">
              <label htmlFor="gc-abre-hora">Hora de apertura</label>
              <input
                id="gc-abre-hora"
                type="time"
                value={cfg.anotacionAbreHora}
                onChange={(e) => setCfg({ ...cfg, anotacionAbreHora: e.target.value })}
              />
            </div>
          </div>
          <div className="grid2">
            <div className="row">
              <label htmlFor="gc-cierra">Cierre el día del partido</label>
              <input
                id="gc-cierra"
                type="time"
                value={cfg.anotacionCierraHora}
                onChange={(e) => setCfg({ ...cfg, anotacionCierraHora: e.target.value })}
              />
            </div>
          </div>

          <h3 style={{ fontSize: "1.05rem", marginTop: "1.25rem" }}>Fechas especiales</h3>
          <p className="profile-section-desc">Fechas puntuales fuera de la rotación semanal.</p>
          <div className="grid2">
            <div className="row">
              <label htmlFor="gc-extra">Agregar fecha</label>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input id="gc-extra" type="date" value={extraDate} onChange={(e) => setExtraDate(e.target.value)} />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    if (!extraDate) return;
                    if (cfg.fechasExtra.includes(extraDate)) return;
                    setCfg({ ...cfg, fechasExtra: [...cfg.fechasExtra, extraDate].sort() });
                    setExtraDate("");
                  }}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
          {cfg.fechasExtra.length ? (
            <ul className="grupo-config-extras">
              {cfg.fechasExtra.map((f) => (
                <li key={f}>
                  <span>{f}</span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setCfg({ ...cfg, fechasExtra: cfg.fechasExtra.filter((x) => x !== f) })}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Sin fechas extra.</p>
          )}

          <div className="mis-perfiles-actions">
            <button className="btn btn-primary" type="submit" disabled={saving || cfg.diasPartido.length < 1}>
              {saving ? "Guardando…" : "Guardar días y horarios"}
            </button>
          </div>
        </form>
      ) : null}

      {tab === "cupos" ? (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              {
                modalidadGrupo: cfg.modalidadGrupo,
                cupoMaximo: cfg.cupoMaximo,
                cupoListaEspera: cfg.cupoListaEspera,
              },
              "Modalidad y cupos guardados.",
            );
          }}
        >
          <h2 className="mis-perfiles-panel-title">Modalidad y cupos</h2>
          <div className="grid3">
            <div className="row">
              <label htmlFor="gc-mod">Modalidad del grupo</label>
              <select
                id="gc-mod"
                value={cfg.modalidadGrupo}
                onChange={(e) => setCfg({ ...cfg, modalidadGrupo: e.target.value as GrupoModalidad })}
              >
                <option value="f5">Fútbol 5</option>
                <option value="f7">Fútbol 7</option>
                <option value="f11">Fútbol 11</option>
                <option value="ambas">Mixta / varias</option>
              </select>
            </div>
            <div className="row">
              <label htmlFor="gc-cupo">Cupo máximo (titulares)</label>
              <input
                id="gc-cupo"
                type="number"
                min={2}
                max={40}
                value={cfg.cupoMaximo}
                onChange={(e) => setCfg({ ...cfg, cupoMaximo: Number(e.target.value) })}
              />
            </div>
            <div className="row">
              <label htmlFor="gc-espera">Lista de espera</label>
              <input
                id="gc-espera"
                type="number"
                min={0}
                max={40}
                value={cfg.cupoListaEspera}
                onChange={(e) => setCfg({ ...cfg, cupoListaEspera: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="mis-perfiles-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar modalidad y cupos"}
            </button>
          </div>
        </form>
      ) : null}

      {tab === "reglas" ? (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              {
                exigePerfilCompleto: cfg.exigePerfilCompleto,
                exigePerfilF5: cfg.exigePerfilF5,
                minValoracionesPerfil: cfg.minValoracionesPerfil,
              },
              "Reglas de inscripción guardadas.",
            );
          }}
        >
          <h2 className="mis-perfiles-panel-title">Reglas de inscripción</h2>
          <label className="grupo-config-check">
            <input
              type="checkbox"
              checked={cfg.exigePerfilCompleto}
              onChange={(e) => setCfg({ ...cfg, exigePerfilCompleto: e.target.checked })}
            />
            Exigir perfil completo (Fútbol 11) guardado
          </label>
          <label className="grupo-config-check">
            <input
              type="checkbox"
              checked={cfg.exigePerfilF5}
              onChange={(e) => setCfg({ ...cfg, exigePerfilF5: e.target.checked })}
            />
            Exigir perfil Fútbol 5 guardado
          </label>
          <div className="row" style={{ marginTop: "0.85rem", maxWidth: "16rem" }}>
            <label htmlFor="gc-min-val">Mínimo de compañeros valorados (0 = no exige)</label>
            <input
              id="gc-min-val"
              type="number"
              min={0}
              max={50}
              value={cfg.minValoracionesPerfil}
              onChange={(e) => setCfg({ ...cfg, minValoracionesPerfil: Number(e.target.value) })}
            />
          </div>
          <div className="mis-perfiles-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar reglas"}
            </button>
          </div>
        </form>
      ) : null}

      {tab === "admins" ? (
        <div className="card">
          <h2 className="mis-perfiles-panel-title">Administradores</h2>
          <p className="profile-section-desc">
            Otorgá o quitá el rol admin. Debe quedar al menos un administrador.
          </p>
          <ul className="grupo-config-miembros">
            {miembros.map((m) => (
              <li key={m.jugadorId}>
                <div>
                  <strong>{m.apodo}</strong>
                  <span className="muted"> · {m.nombreCompleto}</span>
                  {m.esAdmin ? <span className="score-pill" style={{ marginLeft: 8 }}>admin</span> : null}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={saving}
                  onClick={() => void onToggleAdmin(m)}
                >
                  {m.esAdmin ? "Quitar admin" : "Hacer admin"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
