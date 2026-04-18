import { expect, test } from "@playwright/test";
import { readSnapshot, waitForHpBelow, waitForLevel, waitForZone } from "./helpers/bridge";
import { createCharacter } from "./helpers/character";
import { interactWithNpc, openVendor } from "./helpers/dialog";
import { installGameE2E } from "./helpers/env";
import {
  buyFromVendor,
  closeVendor,
  dropItem,
  equip,
  itemCount,
  sellToVendor,
  waitForRecoveredItem,
} from "./helpers/inventory";
import { clickToMove, collapsePane, collectHealPotions, enterLobby } from "./helpers/lobby";
import { logout } from "./helpers/logout";
import { capture } from "./helpers/screenshots";
import { login, signup } from "./helpers/signup";
import { allocateSkill } from "./helpers/skills";
import { travelTo } from "./helpers/travel";

test("full player flow", async ({ page }) => {
  const runId = Date.now().toString(36);
  const credentials = {
    name: `Runner ${runId}`,
    email: `runner-${runId}@example.com`,
    password: `Runner-${runId}-pw`,
  };
  const character = {
    name: `Hero${runId.slice(-4)}`,
    color: "#ff5722",
  };

  await installGameE2E(page);

  await test.step("signup", async () => {
    await page.goto("/signup");
    await signup(page, credentials);
    await capture(page, "01-signup");
  });

  await test.step("character creation", async () => {
    await createCharacter(page, character);
    await capture(page, "02-character-created");
  });

  await test.step("enter lobby", async () => {
    await enterLobby(page);
    await capture(page, "03-lobby-online");
  });

  await test.step("click-to-move", async () => {
    await clickToMove(page, { x: 4, z: 4 });
    const snapshot = await readSnapshot(page);
    expect(snapshot.self?.x ?? 0).toBeGreaterThan(2.5);
    await capture(page, "04-click-move");
  });

  await test.step("elder interaction", async () => {
    await interactWithNpc(page, "Elder Cubius", "Elder Cubius");
    await capture(page, "05-elder-cubius");
  });

  await test.step("pickup world drops", async () => {
    await collapsePane(page);
    await collectHealPotions(page, 2);
    expect(await itemCount(page, "heal_potion")).toBeGreaterThanOrEqual(2);
    await capture(page, "06-heal-potions-picked-up");
  });

  await test.step("vendor grid", async () => {
    await openVendor(page);
    await capture(page, "07-vendor-open");
  });

  await test.step("sell heal potions and buy mana potions", async () => {
    await sellToVendor(page, "heal_potion", 2);
    await buyFromVendor(page, "mana_potion", 2);
    await capture(page, "08-vendor-mana-bought");
    await closeVendor(page);
  });

  await test.step("drop and recover mana potions for collector progress", async () => {
    await dropItem(page, "mana_potion", 2);
    await waitForRecoveredItem(page, "mana_potion", 2);
    await waitForLevel(page, 2);
    await capture(page, "09-level-two");
  });

  await test.step("buy sword and equip it", async () => {
    await openVendor(page);
    await sellToVendor(page, "mana_potion", 2);
    await buyFromVendor(page, "sword", 1);
    await closeVendor(page);
    await equip(page, "sword");
    await expect(page.locator('[data-slot="W1"][data-ability="slash"]')).toBeVisible();
    await expect(page.locator('[data-slot="W2"][data-ability="thrust"]')).toBeVisible();
    await capture(page, "10-sword-equipped");
  });

  await test.step("allocate skill", async () => {
    await allocateSkill(page, "skill_cleave", "S1");
    await expect(page.locator('[data-slot="S1"][data-ability="cleave"]')).toBeVisible();
    await capture(page, "11-skill-allocated");
  });

  await test.step("portal to arena", async () => {
    await collapsePane(page);
    await travelTo(page, "arena");
    await waitForZone(page, "arena");
    await capture(page, "12-arena-arrival");
  });

  await test.step("take hazard damage", async () => {
    const snapshot = await readSnapshot(page);
    const startingHp = snapshot.self?.hp ?? 100;
    await waitForHpBelow(page, startingHp);
    await expect(page.getByTestId("hit-vignette")).toBeVisible();
    await capture(page, "13-hazard-damage");
  });

  await test.step("logout and login persistence", async () => {
    await logout(page);
    await login(page, credentials);
    await enterLobby(page);
    await expect(page.locator('[data-slot="W1"][data-ability="slash"]')).toBeVisible();
    await expect(page.locator('[data-slot="S1"][data-ability="cleave"]')).toBeVisible();
    await capture(page, "14-persistence");
  });
});
