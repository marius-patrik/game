import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const clientPort = Number(process.env.E2E_CLIENT_PORT ?? 3100);
const serverPort = Number(process.env.E2E_SERVER_PORT ?? 2667);
const runId = process.env.E2E_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, "-");

process.env.E2E_CLIENT_PORT = String(clientPort);
process.env.E2E_SERVER_PORT = String(serverPort);
process.env.E2E_RUN_ID = runId;

mkdirSync(path.join(__dirname, "e2e", "screenshots", runId), { recursive: true });

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/test-results",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 180_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${clientPort}`,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: [
    {
      command: [
        `PORT=${serverPort}`,
        `BETTER_AUTH_URL=http://127.0.0.1:${serverPort}`,
        `TRUSTED_ORIGINS=http://127.0.0.1:${clientPort}`,
        "DB_PATH=./data/e2e/app.db",
        "GAME_DAILY_DATE_OVERRIDE=2026-04-18",
        "bun run dev:server",
      ].join(" "),
      cwd: repoRoot,
      url: `http://127.0.0.1:${serverPort}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: ["RSBUILD_HOST=127.0.0.1", `RSBUILD_PORT=${clientPort}`, "bun run dev:client"].join(
        " ",
      ),
      cwd: repoRoot,
      url: `http://127.0.0.1:${clientPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
