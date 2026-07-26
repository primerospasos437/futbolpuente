type Props = {
  apodo: string | null;
  loading?: boolean;
  onProfile: () => void;
  onLogout: () => void;
};

/** Barra de contexto cuando hay sesión en la landing (wizard de grupos / perfil). */
export default function LandingSessionBar({ apodo, loading, onProfile, onLogout }: Props) {
  const label = apodo?.trim() ? apodo.trim() : loading ? "…" : "jugador";

  return (
    <div className="psb-session-bar" role="status" aria-live="polite">
      <div className="psb-session-bar-text">
        <span className="psb-session-bar-hello">Hola, <strong>{label}</strong></span>
        <span className="psb-session-bar-badge">Sesión iniciada</span>
      </div>
      <div className="psb-session-bar-actions">
        <button type="button" className="psb-session-btn psb-session-btn-profile" onClick={onProfile}>
          Completar / Mi perfil
        </button>
        <button type="button" className="psb-session-btn psb-session-btn-logout" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
