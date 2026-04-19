import type { Page } from "@playwright/test";

export const CLIENT_PORT = Number(process.env.E2E_CLIENT_PORT ?? 3100);
export const SERVER_PORT = Number(process.env.E2E_SERVER_PORT ?? 2667);
export const CLIENT_ORIGIN = `http://127.0.0.1:${CLIENT_PORT}`;
export const API_ORIGIN = `http://127.0.0.1:${SERVER_PORT}`;
export const WS_ORIGIN = `ws://127.0.0.1:${SERVER_PORT}`;
const E2E_PREFERENCES = JSON.stringify({
  state: {
    skipCinematics: true,
    fov: 70,
  },
  version: 0,
});

export async function installGameE2E(page: Page) {
  await page.addInitScript(
    ({ apiOrigin, wsOrigin, preferences }) => {
      const win = window as Window &
        typeof globalThis & {
          __GAME_E2E_ENABLED__?: boolean;
          __API__?: string;
          __WS__?: string;
        };
      win.__GAME_E2E_ENABLED__ = true;
      win.__API__ = apiOrigin;
      win.__WS__ = wsOrigin;
      window.localStorage.setItem("cinematic.intro.played", "1");
      window.localStorage.setItem("tutorial.v1.seen", "1");
      window.localStorage.setItem("game.preferences.v1", preferences);
    },
    { apiOrigin: API_ORIGIN, wsOrigin: WS_ORIGIN, preferences: E2E_PREFERENCES },
  );
}
