import { expect, type Page } from "@playwright/test";

export async function createCharacter(page: Page, input: { name: string; color: string }) {
  await page.waitForURL((url) => url.pathname !== "/signup");
  if ((await page.getByRole("button", { name: "Create First Character" }).count()) > 0) {
    await page.getByRole("button", { name: "Create First Character" }).click();
  } else if ((await page.getByRole("button", { name: "New Character" }).count()) > 0) {
    await page.getByRole("button", { name: "New Character" }).click();
  }
  await expect(page.getByLabel("Character Name")).toBeVisible();
  await page.locator(`[data-color="${input.color}"]`).click();
  await page.getByLabel("Character Name").fill(input.name);
  await page.getByRole("button", { name: "Create Character" }).click();
  await expect(page.getByRole("button", { name: /Skip cinematic|Game menu/ })).toBeVisible();
}

export async function playExistingCharacter(page: Page) {
  const gameButton = page.getByRole("button", { name: /Skip cinematic|Game menu/ });
  if (await gameButton.isVisible().catch(() => false)) {
    return;
  }
  const playButton = page.getByRole("button", { name: "Play" }).first();
  await expect(playButton).toBeVisible({ timeout: 30_000 });
  await playButton.click();
  await expect(gameButton).toBeVisible({ timeout: 30_000 });
}
