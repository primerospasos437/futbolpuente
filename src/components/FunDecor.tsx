import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

/**
 * Arte decorativo grande (pelota / arco / camiseta neón) en los márgenes negros
 * laterales de la pantalla, visible solo en ventanas anchas donde sobra espacio.
 * Se monta con un portal directo a <body> para no depender del layout del shell
 * y quedar siempre anclado al viewport. Los bordes se difuminan con una máscara
 * radial (ver CSS) para que se vean plasmados en el fondo, no como stickers.
 */

const BALL = "/decor/side-ball-neon.png";
const GOAL = "/decor/side-goal-neon.png";
const JERSEY = "/decor/side-jersey-neon.png";

type DecorSet = { leftTop: string; leftBottom: string; rightTop: string; rightBottom: string };

/** Combinación distinta por sección, para que no se repita siempre lo mismo. */
function decorSetForPath(pathname: string): DecorSet {
  if (pathname.startsWith("/proximos-partidos")) {
    return { leftTop: JERSEY, leftBottom: GOAL, rightTop: BALL, rightBottom: JERSEY };
  }
  if (pathname.startsWith("/stats")) {
    return { leftTop: GOAL, leftBottom: BALL, rightTop: JERSEY, rightBottom: GOAL };
  }
  if (pathname.startsWith("/equipos")) {
    return { leftTop: BALL, leftBottom: GOAL, rightTop: JERSEY, rightBottom: BALL };
  }
  if (pathname.startsWith("/configuracion") || pathname.startsWith("/mis-datos") || pathname.startsWith("/perfil")) {
    return { leftTop: JERSEY, leftBottom: BALL, rightTop: GOAL, rightBottom: JERSEY };
  }
  // Jugadores ("/") y resto
  return { leftTop: BALL, leftBottom: JERSEY, rightTop: GOAL, rightBottom: BALL };
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
