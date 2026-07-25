import type { PartidoJugadorNombre } from "../lib/partidoEquipos";
import { TEAM_LABEL_CLAROS, TEAM_LABEL_OSCUROS } from "../lib/teamsBalance";

type Props = {
  claros: PartidoJugadorNombre[];
  oscuros: PartidoJugadorNombre[];
  /** Resalta el equipo del usuario sin mostrar datos extra. */
  miEquipo?: "claros" | "oscuros" | null;
};

function ListaEquipo({
  titulo,
  jugadores,
  tone,
  destacado,
}: {
  titulo: string;
  jugadores: PartidoJugadorNombre[];
  tone: "claros" | "oscuros";
  destacado: boolean;
}) {
  return (
    <div
      className={`card team-card team-card--${tone}${destacado ? " team-card--mine" : ""}`}
    >
      <h3>
        {titulo}
        {destacado ? (
          <span className="muted" style={{ fontSize: "0.85rem", fontWeight: 500, marginLeft: "0.35rem" }}>
            (tu equipo)
          </span>
        ) : null}
      </h3>
      {jugadores.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Sin jugadores cargados.
        </p>
      ) : (
        <ul>
          {jugadores.map((j) => (
            <li key={j.id}>{j.apodo}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PartidoEquiposView({ claros, oscuros, miEquipo }: Props) {
  return (
    <div className="team-grid" style={{ marginTop: "1rem" }}>
      <ListaEquipo
        titulo={TEAM_LABEL_CLAROS}
        jugadores={claros}
        tone="claros"
        destacado={miEquipo === "claros"}
      />
      <ListaEquipo
        titulo={TEAM_LABEL_OSCUROS}
        jugadores={oscuros}
        tone="oscuros"
        destacado={miEquipo === "oscuros"}
      />
    </div>
  );
}
