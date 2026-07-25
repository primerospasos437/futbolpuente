export type ProfileOptionId = "grupo" | "individual" | "dt" | "equipo";

type ProfileCard = {
  id: ProfileOptionId;
  icon: string;
  title: string;
  phase: string;
  active: boolean;
  badge?: string;
  pendingLabel?: string;
};

const PROFILES: ProfileCard[] = [
  {
    id: "grupo",
    icon: "👥",
    title: "Grupo de Amigos",
    phase: "Fase 1 · Activo",
    active: true,
    badge: "Recomendado",
  },
  {
    id: "individual",
    icon: "👤",
    title: "Individual",
    phase: "Pendiente",
    active: false,
    pendingLabel: "Próximamente · Fase 2",
  },
  {
    id: "dt",
    icon: "👔",
    title: "DT / Delegado",
    phase: "Pendiente",
    active: false,
    pendingLabel: "Próximamente · Fase futura",
  },
  {
    id: "equipo",
    icon: "🛡️",
    title: "Equipo Completo",
    phase: "Pendiente",
    active: false,
    pendingLabel: "Próximamente · Fase futura",
  },
];

type Props = {
  onSelectGrupo: () => void;
  onPending: (message: string) => void;
  onBackLogin: () => void;
};

export default function LandingProfileSelect({ onSelectGrupo, onPending, onBackLogin }: Props) {
  function onCardClick(card: ProfileCard) {
    if (card.id === "grupo") {
      onSelectGrupo();
      return;
    }
    if (card.id === "individual") {
      onPending("El perfil Individual estará disponible en la Fase 2. Por ahora podés unirte con Grupo de Amigos.");
      return;
    }
    if (card.id === "dt") {
      onPending("El perfil DT / Delegado llegará en una fase futura. Mientras tanto, probá Grupo de Amigos.");
      return;
    }
    onPending("El perfil Equipo Completo llegará en una fase futura. Mientras tanto, probá Grupo de Amigos.");
  }

  return (
    <section className="psb-auth-panel psb-profile-panel" aria-labelledby="psb-profile-title">
      <h2 id="psb-profile-title" className="psb-profile-title">
        ¿Cómo vas a usar PlaySportBridge?
      </h2>
      <p className="psb-auth-sub psb-profile-sub">Seleccioná tu perfil para empezar a medir tu pasión.</p>

      <div className="psb-profile-grid" role="list">
        {PROFILES.map((card) => (
          <button
            key={card.id}
            type="button"
            role="listitem"
            className={`psb-profile-card ${card.active ? "psb-profile-card--active" : "psb-profile-card--pending"}`}
            onClick={() => onCardClick(card)}
          >
            {card.badge ? <span className="psb-profile-badge">{card.badge}</span> : null}
            <span className="psb-profile-icon" aria-hidden>
              {card.icon}
            </span>
            <span className="psb-profile-name">{card.title}</span>
            <span className="psb-profile-phase">{card.phase}</span>
            {card.pendingLabel ? <span className="psb-profile-soon">{card.pendingLabel}</span> : null}
          </button>
        ))}
      </div>

      <button type="button" className="psb-toggle-register" onClick={onBackLogin}>
        Volver al login
      </button>
    </section>
  );
}
