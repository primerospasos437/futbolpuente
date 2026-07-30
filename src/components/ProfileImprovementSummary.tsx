import { DIMENSION_LABELS, DIMENSION_ORDER, DIMENSION_SECTIONS } from "../dimensions";
import { formatRating } from "../lib/formatRating";
import { F5_DIMENSION_ORDER, F5_ICONS, F5_LABELS } from "../dimensions-f5";
import type { Dimension, F5Dimension, PlayerDetail, ProfileScores } from "../types";

/**
 * Ejercicios individuales concretos por dimensión: cosas que se pueden practicar
 * solo (o con lo mínimo, una pared/conos/pelota), sin depender de filmarse ni de
 * pedirle devolución a un compañero.
 */
const F11_EXERCISES: Record<Dimension, { icon: string; tip: string }> = {
  controlPrimerToque: {
    icon: "🎯",
    tip: "Pase contra una pared 15–20 min: controlá siempre orientado hacia un lado, alternando pierna hábil y la otra.",
  },
  pase: {
    icon: "🎯",
    tip: "Pase a una pared variando distancias (5, 10, 15 m) buscando que la pelota te quede «muerta» para el primer toque siguiente.",
  },
  regate1v1: {
    icon: "🌀",
    tip: "Circuito de 5–6 conos en zigzag: 10 pasadas de conducción con cambios de ritmo y de perfil (interior/exterior).",
  },
  remateFinalizacion: {
    icon: "🥅",
    tip: "Series de definición: 10 remates con la pierna hábil y 10 con la otra desde distintos ángulos, priorizando colocación sobre potencia.",
  },
  juegoAereo: {
    icon: "🤾",
    tip: "Autopase con la mano y cabeceo a un arco o pared, buscando dirección exacta (no solo pegarle fuerte).",
  },
  posicionamiento: {
    icon: "🧭",
    tip: "Mirá un tiempo de un partido (propio o profesional) siguiendo solo a un jugador de tu posición: anotá 3 lugares donde te ubicarías distinto.",
  },
  visionJuego: {
    icon: "👀",
    tip: "Convertí el «chequeo de hombros» (mirar atrás antes de recibir) en hábito: practicalo trotando o caminando, incluso sin pelota.",
  },
  movimientosSinBalon: {
    icon: "🏃",
    tip: "Trabajo en sombra sin pelota: 10 arranques explosivos con cambio de dirección cada 5–8 metros, simulando desmarques.",
  },
  tomaDecisiones: {
    icon: "⚡",
    tip: "Pase contra una pared con «toque limitado»: decidí antes de recibir si vas a primer toque, girar o devolver, y cumplilo.",
  },
  comprensionTactica: {
    icon: "🧠",
    tip: "Mirá un partido anotando qué hace tu línea (defensa/medio/ataque) cada vez que el equipo pierde la pelota, para entender las coberturas.",
  },
  velocidadAceleracion: {
    icon: "💨",
    tip: "8–10 sprints de 15–20 metros con descanso completo entre cada uno, foco en la salida explosiva de los primeros pasos.",
  },
  resistencia: {
    icon: "🫁",
    tip: "Intervalos 4×4 min fuerte / 3 min suave (trote o bici), dos veces por semana.",
  },
  fuerzaPotencia: {
    icon: "🏋️",
    tip: "Tren inferior con el propio peso: 3 series de 12–15 sentadillas, zancadas y saltos al cajón o escalón.",
  },
  agilidadCoordinacion: {
    icon: "🪜",
    tip: "Escalera de coordinación (o dibujada con tiza): 10–12 pasadas variando el patrón de pisada.",
  },
  fortalezaMental: {
    icon: "🧘",
    tip: "Visualización de 2–3 minutos antes de dormir: imaginate resolviendo bien jugadas de tu posición bajo presión.",
  },
  actitudDisciplina: {
    icon: "📋",
    tip: "Armá una rutina fija de calentamiento/movilidad antes de jugar y sostenela las próximas 4 fechas sin saltearla.",
  },
  espirituEquipo: {
    icon: "🤝",
    tip: "Objetivo para el próximo partido: dar en voz alta al menos 3 indicaciones o aliento a un compañero por tiempo.",
  },
  motivacion: {
    icon: "🔥",
    tip: "Antes de cada partido, anotá un objetivo personal simple y medible (ej. «ganar 3 duelos 1v1») y revisalo al terminar.",
  },
};

/** Categoría de cada dimensión F11, para colorear la tarjeta igual que las barras de arriba. */
const DIMENSION_CATEGORY: Record<Dimension, "tecnico" | "tactico" | "fisico" | "psico"> = (() => {
  const map = {} as Record<Dimension, "tecnico" | "tactico" | "fisico" | "psico">;
  for (const sec of DIMENSION_SECTIONS) {
    for (const k of sec.keys) map[k] = sec.id as "tecnico" | "tactico" | "fisico" | "psico";
  }
  return map;
})();

const F5_TONE_CYCLE: Record<F5Dimension, string> = {
  pulmon: "tone1",
  pegada: "tone2",
  pase: "tone3",
  quite: "tone4",
  compromiso: "tone5",
};

const F5_EXERCISES: Record<F5Dimension, { tip: string }> = {
  pulmon: {
    tip: "Intervalos cortos 30 seg fuerte / 30 seg trote durante 15–20 min, simulando el ida y vuelta constante del F5.",
  },
  pegada: {
    tip: "20 remates a los ángulos desde la media luna priorizando colocación por sobre potencia.",
  },
  pase: {
    tip: "Pase contra una pared variando ángulos y perfiles, buscando que la pelota te quede pronta para salir rápido de primera.",
  },
  quite: {
    tip: "Trabajo de posición defensiva en sombra (sin pelota): practicá el paso y la salida al despeje, 10 repeticiones por lado.",
  },
  compromiso: {
    tip: "Fijate un objetivo de esfuerzo medible para el próximo partido (ej. no perder ningún sprint de vuelta) y evaluate solo al terminar.",
  },
};

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

function TipCard({
  icon,
  label,
  scoreLabel,
  scoreValue,
  tip,
  colorTone,
  kind,
}: {
  icon: string;
  label: string;
  scoreLabel: string;
  scoreValue: number;
  tip: string;
  /** Color de la tarjeta según categoría de la dimensión (variedad visual). */
  colorTone: "tecnico" | "tactico" | "fisico" | "psico" | "tone1" | "tone2" | "tone3" | "tone4" | "tone5";
  /** Significado del dato: prioridad de mejora o gap de autopercepción. */
  kind: "low" | "gap";
}) {
  return (
    <div className={`pd-tip-card pd-tip-card--${colorTone}`}>
      <div className="pd-tip-card__head">
        <span className="pd-tip-card__icon" aria-hidden>
          {icon}
        </span>
        <div className="pd-tip-card__headtext">
          <p className="pd-tip-card__label">{label}</p>
          <p className="pd-tip-card__score">
            {scoreLabel} <strong>{formatRating(scoreValue)}</strong>
          </p>
        </div>
        <span className={`pd-tip-card__kind pd-tip-card__kind--${kind}`}>
          {kind === "low" ? "Prioridad" : "Autopercepción alta"}
        </span>
      </div>
      <p className="pd-tip-card__exercise">
        <span className="pd-tip-card__exercise-kicker">Ejercicio</span> {tip}
      </p>
    </div>
  );
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
    <div className="pd-panel">
      <h2 className="pd-panel__title">
        <span aria-hidden>📈</span> Resumen para mejorar
      </h2>
      <p className="pd-panel__hint" style={{ marginBottom: "0.75rem" }}>
        Basado en la diferencia entre tu autopercepción y el promedio que te dejan tus compañeros (cuando ya hay
        valoraciones). Es orientativo, no una nota definitiva. Los ejercicios son para practicar solo, con lo mínimo.
      </p>

      <h3 className="pd-tip-subtitle">
        <span aria-hidden>⚽</span> Perfil completo (1–5)
      </h3>
      {peerN === 0 ? (
        <p className="muted">Todavía no hay suficientes valoraciones del grupo para armar sugerencias.</p>
      ) : (
        <>
          {low.length > 0 ? (
            <div className="pd-tip-block">
              <p className="pd-tip-block__title pd-tip-block__title--low">
                🔧 Donde el grupo te ubica más abajo (priorizá acá)
              </p>
              <div className="pd-tip-grid">
                {low.map(({ key, peer }) => (
                  <TipCard
                    key={key}
                    icon={F11_EXERCISES[key].icon}
                    label={DIMENSION_LABELS[key]}
                    scoreLabel="Promedio del grupo"
                    scoreValue={peer}
                    tip={F11_EXERCISES[key].tip}
                    colorTone={DIMENSION_CATEGORY[key]}
                    kind="low"
                  />
                ))}
              </div>
            </div>
          ) : null}
          {highSelf.length > 0 ? (
            <div className="pd-tip-block">
              <p className="pd-tip-block__title pd-tip-block__title--gap">
                🪞 Te autovalorás bastante más alto que el grupo
              </p>
              <div className="pd-tip-grid">
                {highSelf.map(({ key, gap }) => (
                  <TipCard
                    key={key}
                    icon={F11_EXERCISES[key].icon}
                    label={DIMENSION_LABELS[key]}
                    scoreLabel="Diferencia aprox."
                    scoreValue={gap}
                    tip={F11_EXERCISES[key].tip}
                    colorTone={DIMENSION_CATEGORY[key]}
                    kind="gap"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      <h3 className="pd-tip-subtitle" style={{ marginTop: "1.25rem" }}>
        <span aria-hidden>🏐</span> F5 (1–5)
      </h3>
      {f5PeerN === 0 ? (
        <p className="muted">Todavía no hay valoraciones F5 del grupo para sugerencias.</p>
      ) : (
        <>
          {lowF5.length > 0 ? (
            <div className="pd-tip-block">
              <p className="pd-tip-block__title pd-tip-block__title--low">
                🔧 Métricas F5 con menor promedio del grupo
              </p>
              <div className="pd-tip-grid">
                {lowF5.map(({ key, peer }) => (
                  <TipCard
                    key={key}
                    icon={F5_ICONS[key]}
                    label={F5_LABELS[key]}
                    scoreLabel="Promedio del grupo"
                    scoreValue={peer}
                    tip={F5_EXERCISES[key].tip}
                    colorTone={F5_TONE_CYCLE[key] as "tone1" | "tone2" | "tone3" | "tone4" | "tone5"}
                    kind="low"
                  />
                ))}
              </div>
            </div>
          ) : null}
          {highSelfF5.length > 0 ? (
            <div className="pd-tip-block">
              <p className="pd-tip-block__title pd-tip-block__title--gap">
                🪞 Tu autopercepción F5 supera bastante al grupo
              </p>
              <div className="pd-tip-grid">
                {highSelfF5.map(({ key, gap }) => (
                  <TipCard
                    key={key}
                    icon={F5_ICONS[key]}
                    label={F5_LABELS[key]}
                    scoreLabel="Diferencia aprox."
                    scoreValue={gap}
                    tip={F5_EXERCISES[key].tip}
                    colorTone={F5_TONE_CYCLE[key] as "tone1" | "tone2" | "tone3" | "tone4" | "tone5"}
                    kind="gap"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
