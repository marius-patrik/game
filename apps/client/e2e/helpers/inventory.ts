import { type Locator, type Page, expect } from "@playwright/test";
import { readSnapshot, waitForInventoryCount } from "./bridge";
import { openPane } from "./lobby";

function vendorDialog(page: Page): Locator {
  return page.getByRole("dialog");
}

export async function openInventory(page: Page) {
  await openPane(page);
  await page.locator('[data-tab="inventory"]').click();
}

export async function buyFromVendor(page: Page, itemId: string, qty = 1) {
  const dialog = vendorDialog(page);
  for (let index = 0; index < qty; index += 1) {
    await dialog
      .locator(`[data-item-id="${itemId}"]`)
      .first()
      .getByRole("button", { name: "Buy" })
      .click();
  }
}

export async function sellToVendor(page: Page, itemId: string, qty = 1) {
  const dialog = vendorDialog(page);
  for (let index = 0; index < qty; index += 1) {
    await dialog.locator(`[data-item-id="${itemId}"]`).last().click();
  }
}

export async function closeVendor(page: Page) {
  const dialog = vendorDialog(page);
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: "Done" }).click();
  }
}

export async function dropItem(page: Page, itemId: string, times = 1) {
  await openInventory(page);
  for (let index = 0; index < times; index += 1) {
    await page
      .locator(`[data-item="${itemId}"]`)
      .first()
      .getByRole("button", { name: "Drop" })
      .click();
  }
}

export async function equip(page: Page, itemId: string) {
  await openInventory(page);
  const row = page.locator(`[data-item="${itemId}"]`).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Equip" }).click();
}

export async function waitForRecoveredItem(page: Page, itemId: string, count: number) {
  await waitForInventoryCount(page, itemId, count);
}

export async function itemCount(page: Page, itemId: string): Promise<number> {
  const snapshot = await readSnapshot(page);
  const inventory = snapshot.self?.inventory ?? [];
  return inventory.reduce((sum, entry) => sum + (entry.itemId === itemId ? entry.qty : 0), 0);
}
