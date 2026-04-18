import type { Page } from "@playwright/test";
import { clickWorld, findPortal, waitForZone } from "./bridge";

export async function travelTo(page: Page, zoneId: "arena" | "lobby") {
  const portal = await findPortal(page, zoneId);
  await clickWorld(page, { x: portal.x, z: portal.z });
  await waitForZone(page, zoneId);
}
