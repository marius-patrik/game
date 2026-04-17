import { tokenStore } from "@/auth/client";
import { resolveApiBase } from "@/lib/endpoint";

const API_BASE = resolveApiBase();

export async function adminFetch<T>(path: string): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function adminPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: body === undefined ? "{}" : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }
  return (await res.json()) as T;
}

export type AdminPlayer = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

export type AdminRoom = {
  roomId: string;
  name: string;
  clients: number;
  maxClients: number;
  locked: boolean;
  createdAt: string;
};
