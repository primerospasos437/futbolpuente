import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getToken, setToken } from "./api";
import { isDemoMode } from "./lib/demoMode";
import { validateSessionWithSupabase } from "./lib/futbolAuth";

type AuthState = {
  ready: boolean;
  loggedIn: boolean;
  isDemo: boolean;
  demoEmail: string | null;
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
    if (isDemoMode()) {
      setLoggedIn(true);
      setReady(true);
      return;
    }
    try {
      const ok = await validateSessionWithSupabase(t);
      if (!ok) throw new Error("Sesión inválida");
      setLoggedIn(true);
    } catch {
      setToken(null);
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
    setLoggedIn(false);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      loggedIn,
      isDemo: loggedIn && isDemoMode(),
      demoEmail: isDemoMode() ? "invitado@futbolpuente.com" : null,
      refresh,
      logout,
    }),
    [ready, loggedIn, refresh, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fuera de AuthProvider");
  return v;
}
