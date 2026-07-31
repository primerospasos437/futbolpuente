import React, { createContext, useContext } from "react";

export type BridgeContextValue = {
  /** Abre el flujo de cambio de deporte (modal o landing legacy). */
  returnToLanding: () => void;
  /** Vuelve al dashboard de grupos sin cerrar sesión. */
  returnToGroupPicker: () => void;
  /** Abre el modal de calesita de deportes. */
  openSportPicker: () => void;
  /** Actualiza el deporte activo en sesión + contexto. */
  setSelectedSport: (sportId: string) => void;
  selectedSportId: string | null;
  selectedSportName: string | null;
  activeGrupoId: string | null;
  activeGrupoNombre: string | null;
};

const BridgeCtx = createContext<BridgeContextValue | null>(null);

export function BridgeProvider({
  value,
  children,
}: {
  value: BridgeContextValue;
  children: React.ReactNode;
}) {
  return <BridgeCtx.Provider value={value}>{children}</BridgeCtx.Provider>;
}

export function useBridge(): BridgeContextValue {
  const v = useContext(BridgeCtx);
  if (!v) throw new Error("useBridge fuera de BridgeProvider");
  return v;
}

export function useBridgeOptional(): BridgeContextValue | null {
  return useContext(BridgeCtx);
}
