import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

/**
 * Arte decorativo grande (pelota / arco / camiseta / trofeo neón) en los
 * márgenes negros laterales de la pantalla, visible solo en ventanas anchas
 * donde sobra espacio. Se monta con un portal directo a <body> para no
 * depender del layout del shell y quedar siempre anclado al viewport.
 * Los PNG tienen transparencia real (alfa por brillo), así que se ven
 * plasmados en el fondo sin ningún recuadro.
 *
 * Además, cada pantalla principal (Jugadores, Próximos partidos, Stats,
 * Equipos) integra una de estas mismas imágenes dentro de su propio header
 * o panel (ver .page-hero__decor / .stats-float__decor), no solo en los
 * márgenes sueltos.
 */

const BALL = "/decor/side-ball-neon.png";
const GOAL = "/decor/side-goal-neon.png";
const JERSEY = "/decor/side-jersey-neon.png";
const TROPHY = "/decor/side-trophy-neon.png";

type DecorSet = { leftTop: string; leftBottom: string; rightTop: string; rightBottom: string };

/** Combinación distinta por sección, para que no se repita siempre lo mismo. */
function decorSetForPath(pathname: string): DecorSet {
  if (pathname.startsWith("/proximos-partidos")) {
    return { leftTop: JERSEY, leftBottom: GOAL, rightTop: TROPHY, rightBottom: BALL };
  }
  if (pathname.startsWith("/stats")) {
    // El trofeo ya aparece integrado en el panel de Stats; los márgenes usan el resto.
    return { leftTop: GOAL, leftBottom: BALL, rightTop: JERSEY, rightBottom: GOAL };
  }
  if (pathname.startsWith("/equipos")) {
    return { leftTop: BALL, leftBottom: TROPHY, rightTop: JERSEY, rightBottom: GOAL };
  }
  if (pathname.startsWith("/configuracion") || pathname.startsWith("/mis-datos") || pathname.startsWith("/perfil")) {
    return { leftTop: JERSEY, leftBottom: BALL, rightTop: TROPHY, rightBottom: GOAL };
  }
  // Jugadores ("/") y resto
  return { leftTop: TROPHY, leftBottom: JERSEY, rightTop: GOAL, rightBottom: BALL };
}

export function SideFieldDecor() {
  const location = useLocation();
  if (typeof document === "undefined") return null;

  const decor = decorSetForPath(location.pathname);

  return createPortal(
    <div className="side-decor" aria-hidden="true">
      <img className="side-decor__img side-decor__img--left-top" src={decor.leftTop} alt="" />
      <img className="side-decor__img side-decor__img--left-bottom" src={decor.leftBottom} alt="" />
      <img className="side-decor__img side-decor__img--right-top" src={decor.rightTop} alt="" />
      <img className="side-decor__img side-decor__img--right-bottom" src={decor.rightBottom} alt="" />
    </div>,
    document.body,
  );
}
