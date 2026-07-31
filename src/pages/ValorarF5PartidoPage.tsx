import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Star } from "lucide-react";
import { api, apiPartidos } from "../api";
import F5ProfileScorePickers from "../components/F5ProfileScorePickers";
import { defaultF5ScoresZeros, F5_DIMENSION_ORDER } from "../dimensions-f5";
import { personAvatarUrl } from "../lib/avatarImage";
import { getSupabase } from "../lib/supabase";
import type { F5ProfileScores } from "../types";

type PresenciaRow = { partido_id: string; jugador_id: string; equipo: string; estado: string };

export default function ValorarF5PartidoPage() {
  const { partidoId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const paraId = search.get("para") ?? "";

  const [meId, setMeId] = useState<string | null>(null);
  const [companeros, setCompaneros] = useState<{ id: string; apodo: string }[]>([]);
  const [targetId, setTargetId] = useState(paraId);
  const [scores, setScores] = useState<F5ProfileScores>(defaultF5ScoresZeros());
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!partidoId) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        const presencias = (await apiPartidos.listPresencias()) as PresenciaRow[];
        const mine = presencias.filter((pr) => pr.partido_id === partidoId && pr.jugador_id === me.id);
        if (!mine.length) {
          if (!cancelled) setMsg("No figurás en este partido.");
          return;
        }
        const others = presencias.filter((pr) => pr.partido_id === partidoId && pr.jugador_id !== me.id);
        const ids = [...new Set(others.map((o) => o.jugador_id))];
        const sb = getSupabase();
        const { data: rows } = await sb.from("jugadores_publico").select("id,apodo").in("id", ids);
        const list = (rows ?? []).map((r: { id: string; apodo: string }) => ({ id: String(r.id), apodo: String(r.apodo) }));
        if (!cancelled) {
          setMeId(me.id);
          setCompaneros(list);
          const initial = paraId && list.some((c) => c.id === paraId) ? paraId : list[0]?.id ?? "";
          setTargetId(initial);
        }
      } catch (e) {
        if (!cancelled) setMsg(e instanceof Error ? e.message : "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partidoId, paraId]);

  const target = useMemo(() => companeros.find((c) => c.id === targetId), [companeros, targetId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!partidoId || !targetId || !meId) return;
    const incomplete = F5_DIMENSION_ORDER.some((k) => !scores[k] || scores[k] < 1);
    if (incomplete) {
      setMsg("Marcá las estrellas en cada métrica (nada debe quedar vacío).");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api.ratePlayerF5Partido(partidoId, targetId, scores);
      setMsg("Guardado.");
      navigate("/jugadores");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (!partidoId) return <div className="error">Partido inválido.</div>;

  return (
    <div>
      <p style={{ marginBottom: "1rem" }}>
        <Link to="/jugadores">← Volver</Link>
      </p>
      <h1><Star size={22} className="neon-icon" /> Valorar F5 · partido</h1>
      <p className="sub">Elegí al compañero que jugó esa noche y cargá las 5 métricas (1 a 5). Las estrellas empiezan vacías.</p>

      {msg && <p className={msg === "Guardado." ? "muted" : "error"}>{msg}</p>}

      {companeros.length > 0 ? (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <label className="muted" style={{ display: "block", marginBottom: "0.5rem" }}>
            Compañero
          </label>
          <div className="avatar-pick-grid" role="radiogroup" aria-label="Compañero a valorar">
            {companeros.map((c) => {
              const isSelected = targetId === c.id;
              return (
                <button
                  type="button"
                  key={c.id}
                  role="radio"
                  aria-checked={isSelected}
                  className={`avatar-pick${isSelected ? " is-selected" : ""}`}
                  onClick={() => setTargetId(c.id)}
                >
                  <span className="avatar-pick__check">✓</span>
                  <img className="pc-avatar pc-avatar--sm pc-avatar--blue" src={personAvatarUrl(c.id)} alt="" loading="lazy" />
                  <span className="avatar-pick__name">{c.apodo}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {targetId && target ? (
        <form className="card" onSubmit={submit}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
            <img className="pc-avatar pc-avatar--sm pc-avatar--blue" src={personAvatarUrl(target.id)} alt="" />
            <h2 style={{ margin: 0 }}>{target.apodo}</h2>
          </div>
          <F5ProfileScorePickers scores={scores} onChange={setScores} allowEmpty />
          <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={busy}>
            {busy ? "Guardando…" : "Guardar valoración F5"}
          </button>
        </form>
      ) : (
        <p className="muted">No hay compañeros para valorar en este partido.</p>
      )}
    </div>
  );
}
