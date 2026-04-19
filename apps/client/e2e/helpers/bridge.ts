import type { Page } from "@playwright/test";

export type InventoryEntry = { itemId: string; qty: number };
export type PlayerState = {
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  gold: number;
  inventory: InventoryEntry[];
  equipment: Record<string, string>;
  skillsEquipped: [string, string];
  ultimateSkill: string;
};

export type DropState = {
  id: string;
  itemId: string;
  qty: number;
  x: number;
  y: number;
  z: number;
};
export type NpcState = { id: string; kind: string; name: string; x: number; y: number; z: number };
export type PortalState = { to: string; x: number; y: number; z: number; radius: number };
export type HazardState = { id: string; x: number; z: number; radius: number };

export type GameSnapshot = {
  status: string;
  zoneId: string;
  playerCount: number;
  self?: PlayerState;
  drops: DropState[];
  npcs: NpcState[];
  portals: PortalState[];
  hazards: HazardState[];
};

export async function waitForBridge(page: Page) {
  await page.waitForFunction(() => Boolean((window as { __gameE2E?: unknown }).__gameE2E));
}

export async function readSnapshot(page: Page): Promise<GameSnapshot> {
  const snapshot = await page.evaluate(() => {
    const win = window as Window &
      typeof globalThis & {
        __gameE2E?: { snapshot: () => unknown };
      };
    return (win.__gameE2E?.snapshot() ?? null) as GameSnapshot | null;
  });
  if (!snapshot) {
    throw new Error("game e2e snapshot unavailable");
  }
  return snapshot;
}

export async function waitForConnected(page: Page, timeout = 30_000) {
  await page.waitForFunction(
    () => {
      const win = window as Window &
        typeof globalThis & {
          __gameE2E?: { snapshot: () => GameSnapshot | null };
        };
      const snapshot = win.__gameE2E?.snapshot();
      if (snapshot?.status === "connected" && Boolean(snapshot.self)) {
        return true;
      }
      const gameMenu = document.querySelector('button[aria-label="Game menu"]');
      const bottomBars = document.querySelector('[data-testid="bottom-bars"]');
      const topRight = document.querySelector('[data-testid="top-right-sidebar"]');
      const canvas = document.querySelector("canvas");
      return Boolean(gameMenu && bottomBars && topRight && canvas);
    },
    undefined,
    { timeout },
  );
}

export async function clickWorld(
  page: Page,
  point: { x: number; z: number; y?: number },
  opts: { double?: boolean } = {},
) {
  const projected = await projectWorldPoint(page, point);
  if (!projected) {
    throw new Error(`could not project world point (${point.x}, ${point.z})`);
  }
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("game canvas unavailable");
  }
  await canvas.click({
    position: {
      x: projected.x - box.x,
      y: projected.y - box.y,
    },
    clickCount: opts.double ? 2 : 1,
    force: true,
  });
}

export async function projectWorldPoint(
  page: Page,
  point: { x: number; z: number; y?: number },
): Promise<{ x: number; y: number } | null> {
  return await page.evaluate(({ x, y, z }) => {
    const win = window as Window &
      typeof globalThis & {
        __gameE2E?: {
          worldToViewport: (point: { x: number; y?: number; z: number }) => {
            x: number;
            y: number;
          } | null;
        };
      };
    return win.__gameE2E?.worldToViewport({ x, y, z }) ?? null;
  }, point);
}

export async function moveToWorld(page: Page, point: { x: number; z: number }) {
  const sent = await page.evaluate(({ x, z }) => {
    const win = window as Window &
      typeof globalThis & {
        __gameE2E?: { moveTo: (point: { x: number; z: number }) => void };
      };
    if (!win.__gameE2E) return false;
    win.__gameE2E.moveTo({ x, z });
    return true;
  }, point);
  if (!sent) {
    throw new Error("game e2e move bridge unavailable");
  }
}

export async function waitForPlayerNear(
  page: Page,
  point: { x: number; z: number },
  radius = 1.25,
  timeout = 10_000,
) {
  const radiusSq = radius * radius;
  await page.waitForFunction(
    ({ x, z, radiusSq: expectedRadiusSq }) => {
      const win = window as Window &
        typeof globalThis & {
          __gameE2E?: { snapshot: () => GameSnapshot | null };
        };
      const self = win.__gameE2E?.snapshot()?.self;
      if (!self) return false;
      const dx = self.x - x;
      const dz = self.z - z;
      return dx * dx + dz * dz <= expectedRadiusSq;
    },
    { x: point.x, z: point.z, radiusSq },
    { timeout },
  );
}

export async function waitForPlayerMoved(
  page: Page,
  from: { x: number; z: number },
  minDistance = 0.35,
  timeout = 2_000,
) {
  const minDistanceSq = minDistance * minDistance;
  await page.waitForFunction(
    ({ x, z, minDistanceSq: expectedMinDistanceSq }) => {
      const win = window as Window &
        typeof globalThis & {
          __gameE2E?: { snapshot: () => GameSnapshot | null };
        };
      const self = win.__gameE2E?.snapshot()?.self;
      if (!self) return false;
      const dx = self.x - x;
      const dz = self.z - z;
      return dx * dx + dz * dz >= expectedMinDistanceSq;
    },
    { x: from.x, z: from.z, minDistanceSq },
    { timeout },
  );
}

export async function waitForInventoryCount(
  page: Page,
  itemId: string,
  expectedCount: number,
  timeout = 10_000,
) {
  await page.waitForFunction(
    ({ itemId: expectedItemId, expectedCount: minCount }) => {
      const win = window as Window &
        typeof globalThis & {
          __gameE2E?: { snapshot: () => GameSnapshot | null };
        };
      const inventory = win.__gameE2E?.snapshot()?.self?.inventory ?? [];
      const total = inventory.reduce(
        (sum, slot) => sum + (slot.itemId === expectedItemId ? slot.qty : 0),
        0,
      );
      return total >= minCount;
    },
    { itemId, expectedCount },
    { timeout },
  );
}

export async function waitForLevel(page: Page, level: number, timeout = 10_000) {
  await page.waitForFunction(
    (expectedLevel) => {
      const win = window as Window &
        typeof globalThis & {
          __gameE2E?: { snapshot: () => GameSnapshot | null };
        };
      return (win.__gameE2E?.snapshot()?.self?.level ?? 0) >= expectedLevel;
    },
    level,
    { timeout },
  );
}

export async function waitForZone(page: Page, zoneId: string, timeout = 15_000) {
  await page.waitForFunction(
    (expectedZoneId) => {
      const win = window as Window &
        typeof globalThis & {
          __gameE2E?: { snapshot: () => GameSnapshot | null };
        };
      return win.__gameE2E?.snapshot()?.zoneId === expectedZoneId;
    },
    zoneId,
    { timeout },
  );
}

export async function waitForHpBelow(page: Page, maxHp: number, timeout = 10_000) {
  await page.waitForFunction(
    (expectedHp) => {
      const win = window as Window &
        typeof globalThis & {
          __gameE2E?: { snapshot: () => GameSnapshot | null };
        };
      const hp = win.__gameE2E?.snapshot()?.self?.hp;
      return typeof hp === "number" && hp < expectedHp;
    },
    maxHp,
    { timeout },
  );
}

export async function findNpc(page: Page, name: string): Promise<NpcState> {
  const snapshot = await readSnapshot(page);
  const npc = snapshot.npcs.find((entry) => entry.name === name);
  if (!npc) throw new Error(`npc ${name} not found`);
  return npc;
}

export async function findPortal(page: Page, to: string): Promise<PortalState> {
  const snapshot = await readSnapshot(page);
  const portal = snapshot.portals.find((entry) => entry.to === to);
  if (!portal) throw new Error(`portal to ${to} not found`);
  return portal;
}

export async function findDrops(page: Page, itemId: string): Promise<DropState[]> {
  const snapshot = await readSnapshot(page);
  return snapshot.drops.filter((drop) => drop.itemId === itemId);
}

export async function waitForDrop(
  page: Page,
  itemId: string,
  timeout = 20_000,
): Promise<DropState> {
  await page.waitForFunction(
    (expectedItemId) => {
      const win = window as Window &
        typeof globalThis & {
          __gameE2E?: { snapshot: () => GameSnapshot | null };
        };
      const drops = win.__gameE2E?.snapshot()?.drops ?? [];
      return drops.some((drop) => drop.itemId === expectedItemId);
    },
    itemId,
    { timeout },
  );
  const drops = await findDrops(page, itemId);
  const first = drops[0];
  if (!first) throw new Error(`drop ${itemId} vanished before read`);
  return first;
}
