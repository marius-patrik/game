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
