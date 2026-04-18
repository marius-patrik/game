import { type Page, expect } from "@playwright/test";
import { openPane } from "./lobby";

export async function allocateSkill(page: Page, skillId: string, slot: "S1" | "S2" | "U") {
  await openPane(page);
  await page.locator('[data-tab="skills"]').click();
  const card = page.locator(`[data-skill="${skillId}"]`).first();
  await expect(card).toBeVisible();
  await card.locator(`[data-bind="${slot}"]`).click();
}
