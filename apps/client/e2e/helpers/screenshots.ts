import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runId = process.env.E2E_RUN_ID ?? "manual";
const screenshotDir = path.resolve(__dirname, "../screenshots", runId);

mkdirSync(screenshotDir, { recursive: true });

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function capture(page: Page, name: string) {
  await page.screenshot({
    path: path.join(screenshotDir, `${slug(name)}.png`),
    fullPage: true,
  });
}

export function getScreenshotDir() {
  return screenshotDir;
}
