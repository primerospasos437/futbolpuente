const TOKEN_KEY = "futbol_grupo_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function fetchApi(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  register: (body: Record<string, unknown>) =>
    fetchApi("/api/players/register", { method: "POST", body: JSON.stringify(body) }) as Promise<{
      token: string;
      playerId: string;
    }>,
  login: (apodo: string, pin: string) =>
    fetchApi("/api/session", { method: "POST", body: JSON.stringify({ apodo, pin }) }) as Promise<{
      token: string;
      playerId: string;
    }>,
  me: () => fetchApi("/api/me") as Promise<import("./types").PlayerSummary>,
  players: () => fetchApi("/api/players") as Promise<import("./types").PlayerSummary[]>,
  player: (id: string) => fetchApi(`/api/players/${id}`) as Promise<import("./types").PlayerDetail>,
  updateMe: (body: Record<string, unknown>) =>
    fetchApi("/api/me/profile", { method: "PATCH", body: JSON.stringify(body) }) as Promise<
      import("./types").PlayerSummary
    >,
  ratePlayer: (id: string, scores: import("./types").ProfileScores) =>
    fetchApi(`/api/players/${id}/rating`, {
      method: "PUT",
      body: JSON.stringify({ scores }),
    }) as Promise<{ saved: boolean; target: import("./types").PlayerSummary }>,
  balanceTeams: (playerIds?: string[]) =>
    fetchApi("/api/teams/balance", {
      method: "POST",
      body: JSON.stringify(playerIds?.length ? { playerIds } : {}),
    }) as Promise<import("./types").BalanceResponse>,
};
