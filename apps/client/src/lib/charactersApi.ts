import { resolveApiBase } from "./endpoint";

const API_BASE = resolveApiBase();

const TOKEN_KEY = "game.session.token";

export type Character = {
  id: string;
  name: string;
  color: string;
  level: number;
  lastPlayedAt: string;
};

function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "request failed" }));
    throw new Error(error.error || "request failed");
  }
  return res.json();
}

export const charactersApi = {
  async list(): Promise<Character[]> {
    const data = await authedFetch("/api/characters");
    return data.characters;
  },
  async create(name: string, color: string): Promise<Character> {
    const data = await authedFetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    return data.character;
  },
  async delete(id: string): Promise<void> {
    await authedFetch(`/api/characters/${id}`, { method: "DELETE" });
  },
};
