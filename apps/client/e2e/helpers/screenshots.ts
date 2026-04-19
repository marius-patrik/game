import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runId = process.env.E2E_RUN_ID ?? "manual";
const screenshotDir = path.resolve(__dirname, "../screenshots", runId);
const SCREENSHOT_TIMEOUT_MS = 10_000;

mkdirSync(screenshotDir, { recursive: true });

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function capture(page: Page, name: string) {
  const targetPath = path.join(screenshotDir, `${slug(name)}.png`);
  console.info(`[e2e] capture:start ${name}`);
  const captureAttempt = async (
    label: string,
    action: () => Promise<unknown>,
  ): Promise<true | string> => {
    try {
      await action();
      console.info(`[e2e] capture:done ${name} via ${label}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[e2e] capture:retry ${name} via ${label} failed: ${message}`);
      return message;
    }
  };

  const pageCapture = await captureAttempt("page", () =>
    page.screenshot({
      path: targetPath,
      animations: "disabled",
      timeout: SCREENSHOT_TIMEOUT_MS,
    }),
  );
  if (pageCapture === true) return;

  const bodyCapture = await captureAttempt("body", () =>
    page.locator("body").screenshot({
      path: targetPath,
      animations: "disabled",
      timeout: SCREENSHOT_TIMEOUT_MS,
    }),
  );
  if (bodyCapture === true) return;

  const canvasCapture = await captureAttempt("canvas", () =>
    page.locator("canvas").first().screenshot({
      path: targetPath,
      animations: "disabled",
      timeout: SCREENSHOT_TIMEOUT_MS,
    }),
  );
  if (canvasCapture === true) return;

  console.warn(`[e2e] capture:skip ${name}`);
}

export function getScreenshotDir() {
  return screenshotDir;
}
