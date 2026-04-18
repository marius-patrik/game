import { type Page, expect } from "@playwright/test";

export async function createCharacter(page: Page, input: { name: string; color: string }) {
  await page.locator(`[data-color="${input.color}"]`).click();
  await page.getByLabel("Character Name").fill(input.name);
  await page.getByRole("button", { name: "Create Character" }).click();
  await expect(page.getByRole("button", { name: /Skip cinematic|Game menu/ })).toBeVisible();
}
