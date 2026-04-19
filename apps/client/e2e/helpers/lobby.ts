import { expect, type Page } from "@playwright/test";
import {
  clickWorld,
  findDrops,
  readSnapshot,
  waitForConnected,
  waitForDrop,
  waitForInventoryCount,
  waitForPlayerMoved,
  waitForPlayerNear,
} from "./bridge";

const CLICK_TO_MOVE_ATTEMPTS = 3;

export async function dismissOverlays(page: Page) {
  const skipCinematic = page.getByRole("button", { name: "Skip cinematic" });
  if (await skipCinematic.isVisible({ timeout: 2_000 }).catch(() => false)) {
    console.info("[e2e] dismissOverlays: skip cinematic");
    await page.keyboard.press("Enter");
    await expect(skipCinematic).toBeHidden({ timeout: 5_000 });
  }
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible({ timeout: 2_000 }).catch(() => false)) {
    console.info("[e2e] dismissOverlays: tutorial");
    await gotIt.click();
  }
}

export async function enterLobby(page: Page) {
  console.info("[e2e] enterLobby: waitForConnected");
  await waitForConnected(page);
  console.info("[e2e] enterLobby: dismissOverlays");
  await dismissOverlays(page);
  console.info("[e2e] enterLobby: open menu");
  await page.getByRole("button", { name: "Game menu" }).click();
  console.info("[e2e] enterLobby: assert online");
  await expect(page.getByText(/online · \d+/)).toBeVisible();
  console.info("[e2e] enterLobby: close menu");
  await page.keyboard.press("Escape");
  console.info("[e2e] enterLobby: done");
}

export async function clickToMove(page: Page, point: { x: number; z: number }) {
  const self = (await readSnapshot(page)).self;
  if (!self) {
    throw new Error("player snapshot unavailable before click-to-move");
  }
  const start = { x: self.x, z: self.z };
  let lastError: unknown;

  for (let attempt = 1; attempt <= CLICK_TO_MOVE_ATTEMPTS; attempt += 1) {
    console.info(`[e2e] lobby:clickToMove attempt ${attempt}/${CLICK_TO_MOVE_ATTEMPTS}`);
    await clickWorld(page, point);
    await waitForPlayerMoved(page, start).catch(() => {});
    try {
      await waitForPlayerNear(page, point, 1.6, 6_000);
      return;
    } catch (error) {
      lastError = error;
      const latest = (await readSnapshot(page)).self;
      if (latest) {
        console.info(
          `[e2e] lobby:clickToMove miss attempt=${attempt} pos=(${latest.x.toFixed(2)}, ${latest.z.toFixed(2)})`,
        );
      }
      if (attempt < CLICK_TO_MOVE_ATTEMPTS) {
        await page.waitForTimeout(250);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("click-to-move failed");
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
  const inventoryTab = page.locator('[data-tab="inventory"]');
  if (await inventoryTab.isVisible().catch(() => false)) {
    return;
  }
  const trigger = page.getByRole("button", { name: /open panel/i });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(inventoryTab).toBeVisible();
}

export async function collectWorldItem(page: Page, itemId: string, nextCount: number) {
  const drop = await waitForDrop(page, itemId);
  await clickWorld(page, { x: drop.x, y: drop.y + 0.4, z: drop.z });
  try {
    await waitForInventoryCount(page, itemId, nextCount, 3_000);
    return;
  } catch {}
  await clickWorld(page, { x: drop.x, z: drop.z });
  await waitForInventoryCount(page, itemId, nextCount, 15_000);
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
