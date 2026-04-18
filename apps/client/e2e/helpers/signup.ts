import { type Page, expect } from "@playwright/test";

export async function signup(page: Page, input: { name: string; email: string; password: string }) {
  await page.getByLabel("Name").fill(input.name);
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Password").fill(input.password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByLabel("Character Name")).toBeVisible();
}

export async function login(page: Page, input: { email: string; password: string }) {
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Password").fill(input.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
