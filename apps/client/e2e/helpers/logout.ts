import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Game menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  const signInButton = page.getByRole("button", { name: "Sign in" });
  await expect(signInButton).toBeVisible();
  await page.reload();
  await expect(signInButton).toBeVisible();
}
