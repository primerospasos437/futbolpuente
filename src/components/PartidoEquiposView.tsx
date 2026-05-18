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
  destacado,
}: {
  titulo: string;
  jugadores: PartidoJugadorNombre[];
  destacado: boolean;
}) {
  return (
    <div
      className="card team-card"
      style={
        destacado
          ? { borderColor: "var(--accent, #4caf50)", boxShadow: "0 0 0 1px var(--accent, #4caf50)" }
          : undefined
      }
    >
      <h3 style={{ marginTop: 0 }}>
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
        <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
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
      <ListaEquipo titulo={TEAM_LABEL_CLAROS} jugadores={claros} destacado={miEquipo === "claros"} />
      <ListaEquipo titulo={TEAM_LABEL_OSCUROS} jugadores={oscuros} destacado={miEquipo === "oscuros"} />
    </div>
  );
}
