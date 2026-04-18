import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Game menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
}
