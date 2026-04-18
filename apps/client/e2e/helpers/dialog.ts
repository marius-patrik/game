import { type Page, expect } from "@playwright/test";
import { findNpc } from "./bridge";
import { clickToMove } from "./lobby";

async function moveNearNpc(page: Page, name: string) {
  const npc = await findNpc(page, name);
  await clickToMove(page, { x: npc.x, z: npc.z + 1.2 });
  return npc;
}

export async function interactWithNpc(page: Page, name: string, promptLabel: string) {
  await moveNearNpc(page, name);
  await expect(page.getByText(promptLabel)).toBeVisible();
  await page.keyboard.press("E");
}

export async function openVendor(page: Page) {
  await interactWithNpc(page, "Mercer the Vendor", "Mercer the Vendor");
  await expect(page.getByRole("dialog")).toContainText("Mercer the Vendor");
}
