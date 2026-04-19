import { expect, type Page } from "@playwright/test";
import { clickWorld, findNpc } from "./bridge";

async function moveNearNpc(page: Page, name: string) {
  console.info(`[e2e] dialog:find ${name}`);
  const npc = await findNpc(page, name);
  const target = { x: npc.x + (npc.x >= 0 ? -1.8 : 1.8), z: npc.z };
  console.info(`[e2e] dialog:move ${name} -> (${target.x}, ${target.z})`);
  await clickWorld(page, target);
  return npc;
}

export async function interactWithNpc(page: Page, name: string, promptLabel: string) {
  console.info(`[e2e] dialog:interact ${name}`);
  await moveNearNpc(page, name);
  console.info(`[e2e] dialog:wait prompt ${promptLabel}`);
  await expect(page.getByText(promptLabel)).toBeVisible({ timeout: 15_000 });
  console.info(`[e2e] dialog:press E ${name}`);
  await page.keyboard.press("E");
}

export async function openVendor(page: Page) {
  console.info("[e2e] dialog:open vendor");
  const vendor = await findNpc(page, "Mercer the Vendor");
  await clickWorld(page, { x: vendor.x, y: vendor.y + 0.8, z: vendor.z });
  console.info("[e2e] dialog:assert vendor dialog");
  await expect(page.getByRole("dialog")).toContainText("Mercer the Vendor");
}
