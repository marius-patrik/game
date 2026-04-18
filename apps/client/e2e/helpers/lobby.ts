import { type Page, expect } from "@playwright/test";
import {
  clickWorld,
  findDrops,
  waitForConnected,
  waitForDrop,
  waitForInventoryCount,
  waitForPlayerNear,
} from "./bridge";

export async function dismissOverlays(page: Page) {
  const skipCinematic = page.getByRole("button", { name: "Skip cinematic" });
  if (await skipCinematic.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipCinematic.click();
  }
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await gotIt.click();
  }
}

export async function enterLobby(page: Page) {
  await waitForConnected(page);
  await dismissOverlays(page);
  await page.getByRole("button", { name: "Game menu" }).click();
  await expect(page.getByText("online · 1")).toBeVisible();
  await page.getByRole("button", { name: "Game menu" }).click();
}

export async function clickToMove(page: Page, point: { x: number; z: number }) {
  await clickWorld(page, point);
  await waitForPlayerNear(page, point);
}

export async function collapsePane(page: Page) {
  if (
    await page
      .getByRole("button", { name: "Collapse panel" })
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByRole("button", { name: "Collapse panel" }).click();
  }
}

export async function openPane(page: Page) {
  const trigger = page.getByRole("button", { name: /open panel/i });
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.click();
  }
}

export async function collectWorldItem(page: Page, itemId: string, nextCount: number) {
  const drop = await waitForDrop(page, itemId);
  await clickWorld(page, { x: drop.x, z: drop.z });
  await waitForInventoryCount(page, itemId, nextCount, 10_000);
}

export async function collectHealPotions(page: Page, count: number) {
  for (let index = 1; index <= count; index += 1) {
    const existing = await findDrops(page, "heal_potion");
    if (existing.length === 0) {
      await waitForDrop(page, "heal_potion");
    }
    await collectWorldItem(page, "heal_potion", index);
  }
}
