import type { Page } from "@playwright/test";
import { findPortal, moveToWorld, readSnapshot, waitForZone } from "./bridge";

const MAX_TRAVEL_ATTEMPTS = 8;

export async function travelTo(page: Page, zoneId: "arena" | "lobby") {
  const portal = await findPortal(page, zoneId);

  for (let attempt = 0; attempt < MAX_TRAVEL_ATTEMPTS; attempt += 1) {
    const snapshot = await readSnapshot(page);
    if (snapshot.zoneId === zoneId) return;
    const self = snapshot.self;
    if (!self) {
      throw new Error("player snapshot unavailable while traveling");
    }

    const dx = portal.x - self.x;
    const dz = portal.z - self.z;
    if (dx * dx + dz * dz <= portal.radius * portal.radius) {
      break;
    }

    await moveToWorld(page, { x: portal.x, z: portal.z });
    try {
      await waitForZone(page, zoneId, 2_000);
      return;
    } catch {}
  }

  await waitForZone(page, zoneId);
}
