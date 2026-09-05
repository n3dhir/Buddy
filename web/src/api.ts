export interface Entry {
  id: number;
  amount: number;
  currency: string;
  category: string;
  note: string | null;
  payment_method: string | null;
  date: string;
  is_income: boolean;
  created_at: string;
  updated_at: string;
}

export interface Summary {
  period: string;
  from: string;
  to: string;
  count: number;
  total_income: number;
  total_spent: number;
  net: number;
}

export interface Breakdown {
  period: string;
  from: string;
  to: string;
  breakdown: { category: string; total: number; count: number }[];
}

export type Period = "week" | "month" | "year";

export function getToken(): string | null {
  return localStorage.getItem("rafiq_token");
}

export interface AuthUser {
  id: number;
  username: string;
}

export interface TokenInfo {
  id: number;
  name: string;
  scopes: string[];
  created_at: string;
}

export const ALL_SCOPES = [
  "entries:create",
  "entries:read",
  "entries:update",
  "entries:delete",
];

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem("rafiq_user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem("rafiq_token", t);
  else localStorage.removeItem("rafiq_token");
}

export function setSession(token: string | null, user: AuthUser | null) {
  setToken(token);
  if (user) localStorage.setItem("rafiq_user", JSON.stringify(user));
  else localStorage.removeItem("rafiq_user");
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    const err = new Error((data as { error?: string }).error ?? "unauthorized") as Error & {
      status?: number;
    };
    err.status = 401;
    throw err;
  }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  register: (username: string, password: string) =>
    req<{ token: string; user: AuthUser }>(`/api/auth/register`, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    req<{ token: string; user: AuthUser }>(`/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  tokens: () => req<TokenInfo[]>(`/api/tokens`),
  createToken: (name: string, scopes: string[]) =>
    req<TokenInfo & { token: string }>(`/api/tokens`, {
      method: "POST",
      body: JSON.stringify({ name, scopes }),
    }),
  revokeToken: (id: number) =>
    req<{ revoked: boolean }>(`/api/tokens/${id}`, { method: "DELETE" }),
  summary: (period: Period, category?: string) =>
    req<Summary>(
      `/api/summary?period=${period}${category ? `&category=${encodeURIComponent(category)}` : ""}`,
    ),
  breakdown: (period: Period) => req<Breakdown>(`/api/breakdown?period=${period}`),
  entries: (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    return req<Entry[]>(`/api/entries?${q}`);
  },
  log: (kind: "expense" | "income", body: Record<string, unknown>) =>
    req<Entry>(`/api/entries/${kind}`, { method: "POST", body: JSON.stringify(body) }),
  edit: (id: number, patch: Record<string, unknown>) =>
    req<Entry>(`/api/entries/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id: number) => req<{ deleted: boolean }>(`/api/entries/${id}`, { method: "DELETE" }),
};
