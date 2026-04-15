import { createAuthClient } from "better-auth/react";

const API_BASE =
  (typeof window !== "undefined" && (window as unknown as { __API__?: string }).__API__) ||
  "http://localhost:2567";

const TOKEN_KEY = "game.session.token";

export const tokenStore = {
  get(): string | null {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    if (typeof localStorage !== "undefined") localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    if (typeof localStorage !== "undefined") localStorage.removeItem(TOKEN_KEY);
  },
};

export const authClient = createAuthClient({
  baseURL: API_BASE,
  fetchOptions: {
    credentials: "include",
    auth: {
      type: "Bearer",
      token: () => tokenStore.get() ?? "",
    },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) tokenStore.set(token);
    },
  },
});

export const { useSession, signIn, signUp, signOut } = authClient;
