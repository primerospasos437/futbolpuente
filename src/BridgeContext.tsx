import React, { createContext, useContext } from "react";

export type BridgeContextValue = {
  returnToLanding: () => void;
  /** Vuelve al wizard de grupos sin cerrar sesión. */
  returnToGroupPicker: () => void;
  selectedSportId: string | null;
  selectedSportName: string | null;
  activeGrupoId: string | null;
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
