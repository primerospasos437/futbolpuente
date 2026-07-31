import { Trophy } from "lucide-react";
import {
  MUNDIALITO_PHASES,
  phaseIndex,
  phaseLabel,
  type MundialitoState,
} from "../lib/mundialito";

type Props = {
  state: MundialitoState;
  onLoadMatch: () => void;
  onNewEdition: () => void;
};

/**
 * Panel visual del Mundialito: stepper neón (con 16avos) + contador de Grupos + CTA.
 */
export default function MundialitoPanel({ state, onLoadMatch, onNewEdition }: Props) {
  const currentIdx = phaseIndex(state.phase);
  const isChampion = state.phase === "campeon";
  const inGrupos = state.phase === "grupos";
  const stepperPhases = MUNDIALITO_PHASES.filter((p) => p.id !== "campeon");

  return (
    <section
      className={`psb-dash-panel psb-mundi-panel${isChampion ? " psb-mundi-panel--champ" : ""}`}
      aria-labelledby="psb-dash-mundialito-title"
    >
      <div className="psb-mundi-panel__top">
        <div>
          <span className="psb-dash-mundialito__badge">
            Modo solitario · Edición #{state.edition}
          </span>
          <h2 id="psb-dash-mundialito-title" className="psb-dash-mundialito__title">
            <Trophy size={18} className="neon-icon" /> Tu Mundialito Personal
          </h2>
          <p className="psb-dash-mundialito__sub">
            {isChampion ? (
              <>
                <strong>¡Campeón!</strong> Completaste todas las fases. Podés iniciar una nueva edición.
              </>
            ) : inGrupos ? (
              <>
                Estás en <strong>Fase de Grupos</strong> — sumá <strong>2 victorias</strong> para pasar a
                16avos. Máximo <strong>1 empate</strong>; una derrota o el 2º empate te elimina.
              </>
            ) : (
              <>
                Estás en <strong>{phaseLabel(state.phase)}</strong> (eliminatoria) — ganá para avanzar,
                empatá para repetir, perdé y volvés a Grupos.
              </>
            )}
          </p>

          {inGrupos ? (
            <div className="psb-mundi-grupos-meter" aria-live="polite">
              <div className="psb-mundi-grupos-meter__row">
                <span className="psb-mundi-grupos-meter__label">Objetivo: 2 victorias</span>
                <span className="psb-mundi-grupos-meter__value psb-mundi-grupos-meter__value--win">
                  Llevás {state.victoriasGrupo}/2
                </span>
              </div>
              <div className="psb-mundi-grupos-meter__bar">
                <span
                  className="psb-mundi-grupos-meter__fill psb-mundi-grupos-meter__fill--win"
                  style={{ width: `${Math.min(100, (state.victoriasGrupo / 2) * 100)}%` }}
                />
              </div>
              <div className="psb-mundi-grupos-meter__row">
                <span className="psb-mundi-grupos-meter__label">Empates permitidos: 1</span>
                <span
                  className={`psb-mundi-grupos-meter__value${state.empatesGrupo >= 1 ? " is-warn" : ""}`}
                >
                  Llevás {state.empatesGrupo}/1
                </span>
              </div>
              <div className="psb-mundi-grupos-meter__bar">
                <span
                  className={`psb-mundi-grupos-meter__fill psb-mundi-grupos-meter__fill--draw${state.empatesGrupo >= 1 ? " is-warn" : ""}`}
                  style={{ width: `${Math.min(100, state.empatesGrupo * 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          {state.lastMessage ? (
            <p className="psb-mundi-flash" role="status">
              {state.lastMessage}
            </p>
          ) : null}
        </div>
        <div className="psb-mundi-panel__actions">
          {isChampion ? (
            <button type="button" className="btn btn-primary" onClick={onNewEdition}>
              Jugar nueva edición
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onLoadMatch}>
              ➕ Registrar resultado
            </button>
          )}
        </div>
      </div>

      {isChampion ? (
        <div className="psb-mundi-champ" aria-live="polite">
          <div className="psb-mundi-champ__trophy" aria-hidden>
            🏆
          </div>
          <p className="psb-mundi-champ__title">¡Campeón del Mundialito!</p>
          <p className="psb-mundi-champ__sub">
            {state.winsInEdition} victoria{state.winsInEdition === 1 ? "" : "s"} en esta edición ·{" "}
            {state.matchesInEdition} partido{state.matchesInEdition === 1 ? "" : "s"} jugados
          </p>
        </div>
      ) : (
        <ol className="psb-mundi-stepper" aria-label="Progreso del Mundialito">
          {stepperPhases.map((p, i) => {
            const done = i < currentIdx;
            const current = i === currentIdx;
            const future = i > currentIdx;
            return (
              <li
                key={p.id}
                className={`psb-mundi-step${done ? " is-done" : ""}${current ? " is-current" : ""}${future ? " is-future" : ""}`}
              >
                <span className="psb-mundi-step__dot" aria-hidden>
                  {done ? "✓" : current ? "●" : i + 1}
                </span>
                <span className="psb-mundi-step__label">{p.short}</span>
                {i < stepperPhases.length - 1 ? (
                  <span className={`psb-mundi-step__rail${done ? " is-done" : ""}`} aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
