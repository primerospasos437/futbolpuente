import { DIMENSION_LABELS, DIMENSION_ORDER } from "../dimensions";
import { F5_DIMENSION_ORDER, F5_LABELS } from "../dimensions-f5";
import type { Dimension, F5Dimension, PlayerDetail, ProfileScores } from "../types";

function topLowestPeerDims(
  peerByDimension: PlayerDetail["peerByDimension"],
  n: number,
): { key: Dimension; peer: number }[] {
  const rows: { key: Dimension; peer: number }[] = [];
  for (const d of DIMENSION_ORDER) {
    const v = peerByDimension[d];
    if (v != null && Number.isFinite(v)) rows.push({ key: d, peer: v });
  }
  rows.sort((a, b) => a.peer - b.peer);
  return rows.slice(0, n);
}

function topSelfAbovePeerDims(
  profile: ProfileScores,
  peerByDimension: PlayerDetail["peerByDimension"],
  n: number,
): { key: Dimension; gap: number }[] {
  const rows: { key: Dimension; gap: number }[] = [];
  for (const d of DIMENSION_ORDER) {
    const pv = peerByDimension[d];
    if (pv == null || !Number.isFinite(pv)) continue;
    const gap = profile[d] - pv;
    if (gap > 0.6) rows.push({ key: d, gap });
  }
  rows.sort((a, b) => b.gap - a.gap);
  return rows.slice(0, n);
}

function topLowestPeerF5(
  peerF5ByDimension: PlayerDetail["peerF5ByDimension"],
  n: number,
): { key: F5Dimension; peer: number }[] {
  const rows: { key: F5Dimension; peer: number }[] = [];
  for (const d of F5_DIMENSION_ORDER) {
    const v = peerF5ByDimension[d];
    if (v != null && Number.isFinite(v)) rows.push({ key: d, peer: v });
  }
  rows.sort((a, b) => a.peer - b.peer);
  return rows.slice(0, n);
}

function topSelfAbovePeerF5(
  f5: PlayerDetail["f5Profile"],
  peerF5ByDimension: PlayerDetail["peerF5ByDimension"],
  n: number,
): { key: F5Dimension; gap: number }[] {
  const rows: { key: F5Dimension; gap: number }[] = [];
  for (const d of F5_DIMENSION_ORDER) {
    const pv = peerF5ByDimension[d];
    if (pv == null || !Number.isFinite(pv)) continue;
    const gap = f5[d] - pv;
    if (gap > 0.35) rows.push({ key: d, gap });
  }
  rows.sort((a, b) => b.gap - a.gap);
  return rows.slice(0, n);
}

export default function ProfileImprovementSummary({ data }: { data: PlayerDetail }) {
  if (!data.isSelf) return null;

  const peerN = data.peerCount;
  const f5PeerN = data.f5FinalBreakdown?.peerCount ?? 0;

  const low = peerN > 0 ? topLowestPeerDims(data.peerByDimension, 4) : [];
  const highSelf = peerN > 0 ? topSelfAbovePeerDims(data.profile, data.peerByDimension, 3) : [];
  const lowF5 = f5PeerN > 0 ? topLowestPeerF5(data.peerF5ByDimension, 4) : [];
  const highSelfF5 = f5PeerN > 0 ? topSelfAbovePeerF5(data.f5Profile, data.peerF5ByDimension, 3) : [];

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h2 style={{ marginTop: 0 }}>Resumen para mejorar</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Basado en la diferencia entre tu autopercepción y el promedio que te dejan tus compañeros (cuando ya hay
        valoraciones). Es orientativo, no una nota definitiva.
      </p>

      <h3 style={{ fontSize: "1.02rem", marginTop: "1rem" }}>Perfil completo (1–10)</h3>
      {peerN === 0 ? (
        <p className="muted">Todavía no hay suficientes valoraciones del grupo para armar sugerencias.</p>
      ) : (
        <>
          {low.length > 0 ? (
            <div style={{ marginTop: "0.5rem" }}>
              <p style={{ margin: "0 0 0.35rem", fontWeight: 600 }}>Donde el grupo te ubica más abajo (priorizá trabajo acá)</p>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)", lineHeight: 1.65 }}>
                {low.map(({ key, peer }) => (
                  <li key={key}>
                    <strong style={{ color: "var(--text)" }}>{DIMENSION_LABELS[key]}</strong> — promedio del grupo{" "}
                    {peer.toFixed(2)}. Qué hacer: pedí feedback concreto después del partido o en entrenamiento, filmá
                    situaciones similares y repetí con calidad (pocos toques, buena toma de decisión).
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {highSelf.length > 0 ? (
            <div style={{ marginTop: "0.85rem" }}>
              <p style={{ margin: "0 0 0.35rem", fontWeight: 600 }}>Donde te autovalorás bastante más alto que el grupo</p>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)", lineHeight: 1.65 }}>
                {highSelf.map(({ key, gap }) => (
                  <li key={key}>
                    <strong style={{ color: "var(--text)" }}>{DIMENSION_LABELS[key]}</strong> — diferencia aprox.{" "}
                    {gap.toFixed(1)} puntos. Qué hacer: alineá expectativas con lo que ven los demás; mostrá esas
                    cualidades de forma más estable en partido (menos “picos” y más constancia).
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      <h3 style={{ fontSize: "1.02rem", marginTop: "1.25rem" }}>F5 (1–5)</h3>
      {f5PeerN === 0 ? (
        <p className="muted">Todavía no hay valoraciones F5 del grupo para sugerencias.</p>
      ) : (
        <>
          {lowF5.length > 0 ? (
            <div style={{ marginTop: "0.5rem" }}>
              <p style={{ margin: "0 0 0.35rem", fontWeight: 600 }}>Dimensiones F5 con menor promedio del grupo</p>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)", lineHeight: 1.65 }}>
                {lowF5.map(({ key, peer }) => (
                  <li key={key}>
                    <strong style={{ color: "var(--text)" }}>{F5_LABELS[key]}</strong> — promedio {peer.toFixed(2)}. Qué
                    hacer: practicá micro-situaciones (transiciones, duelos, comunicación) y pedí una mirada honesta a
                    un compañero después del partido.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {highSelfF5.length > 0 ? (
            <div style={{ marginTop: "0.85rem" }}>
              <p style={{ margin: "0 0 0.35rem", fontWeight: 600 }}>Donde tu autopercepción F5 supera bastante al grupo</p>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)", lineHeight: 1.65 }}>
                {highSelfF5.map(({ key, gap }) => (
                  <li key={key}>
                    <strong style={{ color: "var(--text)" }}>{F5_LABELS[key]}</strong> — diferencia ~{gap.toFixed(2)} en
                    escala 1–5. Qué hacer: buscá evidencia en video o pedí ejemplos concretos a quienes te valoran más
                    bajo para entender el gap.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
