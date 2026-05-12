import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getToken, setPlayerId, setToken, clearPlayerId } from "./api";
import { validateSessionWithSupabase } from "./lib/futbolAuth";

type AuthState = {
  ready: boolean;
  loggedIn: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setLoggedIn(false);
      setReady(true);
      return;
    }
    try {
      const session = await validateSessionWithSupabase(t);
      if (!session.ok) throw new Error("Sesión inválida");
      if (session.playerId) setPlayerId(session.playerId);
      setLoggedIn(true);
    } catch {
      setToken(null);
      clearPlayerId();
      setLoggedIn(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    setToken(null);
    clearPlayerId();
    setLoggedIn(false);
  }, []);

  const value = useMemo(
    () => ({ ready, loggedIn, refresh, logout }),
    [ready, loggedIn, refresh, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fuera de AuthProvider");
  return v;
}
