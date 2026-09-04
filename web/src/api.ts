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

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
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
