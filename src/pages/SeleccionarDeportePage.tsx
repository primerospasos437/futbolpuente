import { useNavigate } from "react-router-dom";
import SportCarousel from "../components/SportCarousel";
import { useBridgeOptional } from "../BridgeContext";
import { getSelectedSport, setSelectedSport } from "../lib/bridgeSession";
import { SPORTS_CATALOG, sportNameById } from "../lib/sportsCatalog";
import "../landing.css";

/** Ruta dedicada a la calesita de deportes (`/seleccionar-deporte`). */
export default function SeleccionarDeportePage() {
  const navigate = useNavigate();
  const bridge = useBridgeOptional();
  const current = getSelectedSport();

  function onPick(sportId: string) {
    const sport = SPORTS_CATALOG.find((s) => s.id === sportId);
    if (sport && !sport.available) return;
    setSelectedSport(sportId);
    bridge?.setSelectedSport?.(sportId);
    navigate("/", { replace: true });
  }

  return (
    <div className="page-shell psb-sport-select-page">
      <header className="page-hero">
        <h1>🔄 Seleccionar deporte</h1>
        <p className="sub">
          Deporte actual: <strong>{sportNameById(current) ?? "ninguno"}</strong>. Tocá el del centro para confirmar.
        </p>
      </header>
      <div className="card card--blue">
        <SportCarousel sports={SPORTS_CATALOG} initialSportId={current} onSelectEnter={onPick} />
      </div>
      <button type="button" className="btn btn-ghost" style={{ marginTop: "1rem" }} onClick={() => navigate(-1)}>
        ← Volver
      </button>
    </div>
  );
}
