import { expect, type Page } from "@playwright/test";

export async function signup(page: Page, input: { name: string; email: string; password: string }) {
  await page.getByLabel("Name").fill(input.name);
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Password").fill(input.password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL(
    (url) => url.pathname === "/characters" || url.pathname === "/characters/new",
  );
}

export async function login(page: Page, input: { email: string; password: string }) {
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Password").fill(input.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect
    .poll(
      async () => {
        if (
          await page
            .getByRole("button", { name: /Skip cinematic|Game menu/ })
            .isVisible()
            .catch(() => false)
        ) {
          return "game";
        }
        if (
          await page
            .getByRole("button", { name: "Play" })
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          return "characters";
        }
        return "pending";
      },
      { timeout: 30_000 },
    )
    .not.toBe("pending");
}
