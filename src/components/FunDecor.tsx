import { createPortal } from "react-dom";

/**
 * Arte decorativo grande (pelota / arco / camiseta neón) en los márgenes negros
 * laterales de la pantalla, visible solo en ventanas anchas donde sobra espacio.
 * Se monta con un portal directo a <body> para no depender del layout del shell
 * y quedar siempre anclado al viewport.
 */
export function SideFieldDecor() {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="side-decor" aria-hidden="true">
      <img className="side-decor__img side-decor__img--left-top" src="/decor/side-ball-neon.png" alt="" />
      <img className="side-decor__img side-decor__img--left-bottom" src="/decor/side-jersey-neon.png" alt="" />
      <img className="side-decor__img side-decor__img--right-top" src="/decor/side-goal-neon.png" alt="" />
      <img className="side-decor__img side-decor__img--right-bottom" src="/decor/side-ball-neon.png" alt="" />
    </div>,
    document.body,
  );
}
