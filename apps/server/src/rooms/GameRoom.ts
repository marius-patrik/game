import { type AuthContext, type Client, Room, matchMaker } from "@colyseus/core";
import { ArraySchema, MapSchema } from "@colyseus/schema";
import {
  CHAT_MAX_LEN,
  type ChatEntry,
  type ChatError,
  type ChatInbound,
  DEFAULT_ZONE,
  EQUIP_SLOTS,
  type EquipSlot,
  FIRST_QUEST_ID,
  GameRoomState,
  InventorySlot,
  type ItemId,
  Npc,
  Player,
  QUEST_CATALOG,
  QuestProgress,
  SKILL_CATALOG,
  STAT_POINTS_PER_LEVEL,
  type SkillId,
  type StatKey,
  VENDOR_STOCK,
  type Vec3,
  WorldDrop,
  type Zone,
  applyXp,
  attackCooldownMs,
  clampToBounds,
  damageBonusFromStats,
  equipBonus,
  getItem,
  getQuest,
  getZone,
  isChatChannel,
  isItemId,
  manaRegenPerSec,
  maxHpFromStats,
  maxManaFromStats,
  xpToNextLevel,
} from "@game/shared";
import { auth } from "../auth";
import { type CombatConfig, type Combatant, DEFAULT_COMBAT, resolveAttack } from "../combat";
import { getPlayerLocation, savePlayerLocation } from "../db/playerLocation";
import { loadProgress, saveProgress } from "../db/playerProgress";
import {
  DEFAULT_LOOT,
  INVENTORY_SLOT_CAP,
  type LootConfig,
  type Slot,
  addItem,
  countItem,
  findSlotIndex,
  removeItem,
} from "../inventory";
import { log } from "../logger";
import {
  DEFAULT_SECURITY,
  RateLimiter,
  type SecurityConfig,
  ViolationTracker,
  validateMovement,
} from "../security";
import { type MobKind, MobSystem, type PlayerRef } from "./systems/mobs";

type MoveMessage = { x: number; y: number; z: number };
type UseMessage = { itemId: string };
type EquipMessage = { itemId: string };
type PickupMessage = { dropId: string };
type DropMessage = { itemId: string; qty: number };
type AllocateStatMessage = { stat: StatKey };
type CastMessage = { skillId: SkillId };
type EquipSlotMessage = { slot: EquipSlot; itemId: string };
type UnequipSlotMessage = { slot: EquipSlot };
type BuyMessage = { itemId: string; qty?: number };
type SellMessage = { itemId: string; qty?: number };
type TurnInQuestMessage = { questId: string };
type JoinOptions = { token?: string; zoneId?: string };

export type SessionUser = { id: string; name: string; role: string };

type PlayerSecurityState = { lastPos: Vec3; lastMoveAt: number };
type PlayerCombatState = { invulnerableUntil: number; lastAttackAt: number };
type PlayerPortalState = { rearmAt: number };
type SkillCooldowns = Map<SkillId, number>;

const SAVE_INTERVAL_MS = 10_000;
const LOOT_SPAWN_INTERVAL_MS = 5_000;
const PORTAL_REARM_MS = 2_000;
const SELL_FRACTION = 0.4;

function stripControlChars(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 32 && code !== 127) out += input.charAt(i);
  }
  return out;
}

export class GameRoom extends Room<GameRoomState> {
  override maxClients = 64;
  override state = new GameRoomState();
  private zone!: Zone;
  private security: SecurityConfig = DEFAULT_SECURITY;
  private combat: CombatConfig = DEFAULT_COMBAT;
  private loot: LootConfig = DEFAULT_LOOT;
  private rateLimiter = new RateLimiter(this.security.rateLimits);
  private violations = new ViolationTracker(this.security.violations);
  private playerSec = new Map<string, PlayerSecurityState>();
  private playerCombat = new Map<string, PlayerCombatState>();
  private playerPortal = new Map<string, PlayerPortalState>();
  private playerUserId = new Map<string, string>();
  private skillCds = new Map<string, SkillCooldowns>();
  private saveInterval?: ReturnType<typeof setInterval>;
  private lootInterval?: ReturnType<typeof setInterval>;
  private dropCounter = 0;
  private chatCounter = 0;
  private mobSystem!: MobSystem;

  override async onAuth(_client: Client, options: JoinOptions, ctx: AuthContext) {
    const headers = new Headers();
    const cookie = ctx.headers.cookie;
    if (typeof cookie === "string") headers.set("cookie", cookie);
    if (options?.token) headers.set("authorization", `Bearer ${options.token}`);
    const session = await auth.api.getSession({ headers });
    if (!session?.user) throw new Error("unauthorized");
    const user: SessionUser = {
      id: session.user.id,
      name: session.user.name,
      role: (session.user as { role?: string }).role ?? "player",
    };
    return user;
  }

  override onCreate(options: JoinOptions = {}) {
    const zone = getZone(options.zoneId ?? DEFAULT_ZONE);
    if (!zone) throw new Error(`unknown zoneId ${options.zoneId}`);
    this.zone = zone;
    this.maxClients = zone.maxClients;
    this.setMetadata({ zoneId: zone.id, name: zone.name });

    this.onMessage<MoveMessage>("move", (client, msg) => this.handleMove(client, msg));
    this.onMessage("attack", (client) => this.handleAttack(client));
    this.onMessage<PickupMessage>("pickup", (client, msg) => this.handlePickup(client, msg));
    this.onMessage<UseMessage>("use", (client, msg) => this.handleUse(client, msg));
    this.onMessage<EquipMessage>("equip", (client, msg) => this.handleEquip(client, msg));
    this.onMessage<DropMessage>("drop", (client, msg) => this.handleDrop(client, msg));
    this.onMessage<ChatInbound>("chat", (client, msg) => this.handleChat(client, msg));
    this.onMessage<AllocateStatMessage>("allocateStat", (client, msg) =>
      this.handleAllocateStat(client, msg),
    );
    this.onMessage<CastMessage>("cast", (client, msg) => this.handleCast(client, msg));
    this.onMessage<EquipSlotMessage>("equipSlot", (client, msg) =>
      this.handleEquipSlot(client, msg),
    );
    this.onMessage<UnequipSlotMessage>("unequipSlot", (client, msg) =>
      this.handleUnequipSlot(client, msg),
    );
    this.onMessage<BuyMessage>("buy", (client, msg) => this.handleBuy(client, msg));
    this.onMessage<SellMessage>("sell", (client, msg) => this.handleSell(client, msg));
    this.onMessage<TurnInQuestMessage>("turnInQuest", (client, msg) =>
      this.handleTurnInQuest(client, msg),
    );

    this.setSimulationInterval((dt) => this.tick(dt), 1000 / 20);
    this.saveInterval = setInterval(() => this.flushAllProgress(), SAVE_INTERVAL_MS);
    this.lootInterval = setInterval(() => this.tickLootSpawns(), LOOT_SPAWN_INTERVAL_MS);

    this.mobSystem = new MobSystem({
      mobs: this.state.mobs,
      zone: this.zone,
      getPlayers: () => this.collectPlayerRefs(),
      damagePlayer: (id, dmg) => this.applyMobContactDamage(id, dmg),
      onMobKilled: (mobId, pos, kind) => this.broadcast("mob-killed", { mobId, pos, kind }),
      spawnDrop: (itemId, qty, pos) => this.spawnDrop(itemId, qty, pos),
    });
    this.mobSystem.start();

    this.spawnZoneNpcs();
  }

  private spawnZoneNpcs() {
    if (this.zone.id !== "lobby") return;
    const vendor = new Npc();
    vendor.id = "npc:vendor";
    vendor.kind = "vendor";
    vendor.name = "Mercer the Vendor";
    vendor.x = -6;
    vendor.y = 0;
    vendor.z = 4;
    this.state.npcs.set(vendor.id, vendor);

    const questgiver = new Npc();
    questgiver.id = "npc:quest";
    questgiver.kind = "questgiver";
    questgiver.name = "Elder Cubius";
    questgiver.x = 6;
    questgiver.y = 0;
    questgiver.z = 4;
    this.state.npcs.set(questgiver.id, questgiver);
  }

  override async onJoin(client: Client<unknown, SessionUser>) {
    const p = new Player();
    p.id = client.sessionId;
    p.name = client.auth?.name ?? "";

    const userId = client.auth?.id;
    let spawn: Vec3 = { x: this.zone.spawn.x, y: this.zone.spawn.y, z: this.zone.spawn.z };

    if (userId) {
      this.playerUserId.set(client.sessionId, userId);
      try {
        const saved = await getPlayerLocation(userId, this.zone.id);
        if (saved) spawn = { x: saved.x, y: saved.y, z: saved.z };
      } catch (err) {
        log.warn({ err, userId, zoneId: this.zone.id }, "failed to load player location");
      }
      try {
        const { progress, inventory } = await loadProgress(userId);
        if (progress) {
          p.level = progress.level;
          p.xp = progress.xp;
          p.xpToNext = xpToNextLevel(progress.level);
          p.equippedItemId = progress.equippedItemId;
          p.gold = progress.gold;
          p.strength = progress.strength;
          p.dexterity = progress.dexterity;
          p.vitality = progress.vitality;
          p.intellect = progress.intellect;
          p.statPoints = progress.statPoints;
          p.maxHp = maxHpFromStats(p.vitality);
          p.maxMana = maxManaFromStats(p.intellect);
          p.mana = Math.min(progress.mana, p.maxMana);
          this.loadEquipment(p, progress.equipmentJson);
          this.loadQuests(p, progress.questsJson);
        } else {
          p.xpToNext = xpToNextLevel(1);
          p.maxHp = maxHpFromStats(p.vitality);
          p.maxMana = maxManaFromStats(p.intellect);
          p.mana = p.maxMana;
        }
        for (const row of inventory) {
          const slot = new InventorySlot();
          slot.itemId = row.itemId;
          slot.qty = row.qty;
          p.inventory.push(slot);
        }
      } catch (err) {
        log.warn({ err, userId }, "failed to load player progress");
        p.xpToNext = xpToNextLevel(1);
        p.maxHp = maxHpFromStats(p.vitality);
        p.maxMana = maxManaFromStats(p.intellect);
        p.mana = p.maxMana;
      }
    } else {
      p.xpToNext = xpToNextLevel(1);
      p.maxHp = maxHpFromStats(p.vitality);
      p.maxMana = maxManaFromStats(p.intellect);
      p.mana = p.maxMana;
    }

    p.x = spawn.x;
    p.y = spawn.y;
    p.z = spawn.z;
    if (p.hp <= 0 || p.hp > p.maxHp) p.hp = p.maxHp;
    else p.hp = Math.min(p.hp || p.maxHp, p.maxHp);
    p.hp = p.maxHp; // respawn to full on join
    p.alive = true;

    // ensure first quest is offered
    if (!p.quests.has(FIRST_QUEST_ID) && this.zone.id === "lobby") {
      // auto-accept first quest to simplify onboarding
      const def = getQuest(FIRST_QUEST_ID);
      if (def) this.grantQuest(p, def.id);
    }

    this.state.players.set(client.sessionId, p);
    this.playerSec.set(client.sessionId, {
      lastPos: { x: p.x, y: p.y, z: p.z },
      lastMoveAt: Date.now(),
    });
    this.playerCombat.set(client.sessionId, {
      invulnerableUntil: Date.now() + this.combat.invulnerableAfterRespawnMs,
      lastAttackAt: 0,
    });
    this.playerPortal.set(client.sessionId, { rearmAt: Date.now() + PORTAL_REARM_MS });
    this.skillCds.set(client.sessionId, new Map());
  }

  override async onLeave(client: Client<unknown, SessionUser>) {
    const p = this.state.players.get(client.sessionId);
    const userId = client.auth?.id;
    if (p && userId) {
      try {
        await savePlayerLocation(userId, this.zone.id, { x: p.x, y: p.y, z: p.z });
      } catch (err) {
        log.warn({ err, userId, zoneId: this.zone.id }, "failed to save player location on leave");
      }
      try {
        await this.persistProgress(userId, p);
      } catch (err) {
        log.warn({ err, userId }, "failed to save player progress on leave");
      }
    }
    this.state.players.delete(client.sessionId);
    this.playerSec.delete(client.sessionId);
    this.playerCombat.delete(client.sessionId);
    this.playerPortal.delete(client.sessionId);
    this.playerUserId.delete(client.sessionId);
    this.skillCds.delete(client.sessionId);
    this.rateLimiter.forget(client.sessionId);
    this.violations.forget(client.sessionId);
    this.mobSystem?.onPlayerLeave(client.sessionId);
  }

  override async onDispose() {
    if (this.saveInterval) clearInterval(this.saveInterval);
    if (this.lootInterval) clearInterval(this.lootInterval);
    this.mobSystem?.stop();
    await this.flushAllPositions();
    await this.flushAllProgress();
  }

  // ---------- Tick ----------

  private tick(dt: number) {
    this.handleZoneTick();
    this.regenMana(dt);
    this.mobSystem?.tick(dt);
  }

  private regenMana(dtMs: number) {
    const dtSec = dtMs / 1000;
    for (const [, p] of this.state.players) {
      if (!p.alive) continue;
      if (p.mana >= p.maxMana) continue;
      p.mana = Math.min(p.maxMana, p.mana + manaRegenPerSec(p.intellect) * dtSec);
    }
  }

  // ---------- Movement ----------

  private handleMove(client: Client<unknown, SessionUser>, msg: MoveMessage) {
    const p = this.state.players.get(client.sessionId);
    const sec = this.playerSec.get(client.sessionId);
    if (!p || !sec) return;

    if (!this.rateLimiter.consume(client.sessionId, "move")) {
      this.recordViolation(client, p, "rate_limit:move");
      return;
    }

    const now = Date.now();
    const dtMs = now - sec.lastMoveAt;
    const result = validateMovement({
      prev: sec.lastPos,
      next: { x: msg.x, y: msg.y, z: msg.z },
      dtMs,
      zone: this.zone,
      maxSpeed: this.security.movement.maxSpeed,
      tolerance: this.security.movement.tolerance,
    });
    p.x = result.position.x;
    p.y = result.position.y;
    p.z = result.position.z;
    sec.lastPos = { ...result.position };
    sec.lastMoveAt = now;
    if (!result.ok) this.recordViolation(client, p, `movement:${result.reason}`);
  }

  // ---------- Combat ----------

  private handleAttack(client: Client<unknown, SessionUser>) {
    const attacker = this.state.players.get(client.sessionId);
    const combat = this.playerCombat.get(client.sessionId);
    if (!attacker || !attacker.alive || !combat) return;
    if (!this.rateLimiter.consume(client.sessionId, "attack")) {
      this.recordViolation(client, attacker, "rate_limit:attack");
      return;
    }
    const now = Date.now();
    const cooldown = attackCooldownMs(attacker.dexterity);
    if (now - combat.lastAttackAt < cooldown) return;
    combat.lastAttackAt = now;

    const candidates: Combatant[] = [];
    this.state.players.forEach((p, id) => {
      candidates.push({ id, pos: { x: p.x, y: p.y, z: p.z }, alive: p.alive, hp: p.hp });
    });
    this.state.mobs.forEach((m, id) => {
      candidates.push({
        id: `mob:${id}`,
        pos: { x: m.x, y: m.y, z: m.z },
        alive: m.alive,
        hp: m.hp,
      });
    });

    const attackerC: Combatant = {
      id: client.sessionId,
      pos: { x: attacker.x, y: attacker.y, z: attacker.z },
      alive: attacker.alive,
      hp: attacker.hp,
    };
    const dmg = this.computeDamage(attacker);
    const cfg: CombatConfig = { ...this.combat, attackDamage: dmg };
    const result = resolveAttack(attackerC, candidates, cfg);
    if (!result.ok) return;

    if (result.targetId.startsWith("mob:")) {
      const mobId = result.targetId.slice(4);
      const hit = this.mobSystem.applyDamage(mobId, dmg);
      if (!hit.ok) return;
      this.broadcast("attack", {
        attackerId: client.sessionId,
        targetId: result.targetId,
        killed: hit.killed,
        dmg,
      });
      if (hit.killed) this.onMobKilledByPlayer(attacker, hit.kind, hit.xpBonus, hit.gold);
      return;
    }

    const target = this.state.players.get(result.targetId);
    const targetCombat = this.playerCombat.get(result.targetId);
    if (!target || !targetCombat) return;
    if (Date.now() < targetCombat.invulnerableUntil) return;
    target.hp = result.newHp;
    if (result.killed) {
      target.alive = false;
      this.spawnKillDrop(target);
      const targetClient = this.clients.find((c) => c.sessionId === result.targetId);
      this.scheduleRespawn(result.targetId, targetClient);
    }
    this.broadcast("attack", {
      attackerId: client.sessionId,
      targetId: result.targetId,
      killed: result.killed,
      dmg,
    });
  }

  private computeDamage(p: Player): number {
    const bonus = damageBonusFromStats(p.strength);
    const equipBonusTotal = this.equipBonusFor(p).damageBonus;
    const legacyEquipped = p.equippedItemId ? (getItem(p.equippedItemId)?.damageBonus ?? 0) : 0;
    return this.combat.attackDamage + bonus + equipBonusTotal + legacyEquipped;
  }

  private equipBonusFor(p: Player) {
    const defs = EQUIP_SLOTS.map((slot) => {
      const id = p.equipment.get(slot);
      return id ? getItem(id) : undefined;
    });
    return equipBonus(defs);
  }

  // ---------- Skills ----------

  private handleCast(client: Client<unknown, SessionUser>, msg: CastMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !p.alive) return;
    const skill = SKILL_CATALOG[msg?.skillId];
    if (!skill) return;

    const cds = this.skillCds.get(client.sessionId);
    if (!cds) return;
    const now = Date.now();
    const ready = cds.get(skill.id) ?? 0;
    if (now < ready) {
      client.send("cast-error", { skillId: skill.id, reason: "cooldown" });
      return;
    }
    if (p.mana < skill.manaCost) {
      client.send("cast-error", { skillId: skill.id, reason: "mana" });
      return;
    }

    p.mana = Math.max(0, p.mana - skill.manaCost);
    cds.set(skill.id, now + skill.cooldownMs);

    switch (skill.id) {
      case "basic": {
        // Same flow as the legacy "attack" message — picks nearest candidate
        // (player or mob), applies damage, broadcasts. Lives in the skill
        // system now so the HUD shows one unified action bar.
        const candidates: Combatant[] = [];
        this.state.players.forEach((pp, id) => {
          if (id === client.sessionId) return;
          candidates.push({ id, pos: { x: pp.x, y: pp.y, z: pp.z }, alive: pp.alive, hp: pp.hp });
        });
        this.state.mobs.forEach((m, id) => {
          candidates.push({
            id: `mob:${id}`,
            pos: { x: m.x, y: m.y, z: m.z },
            alive: m.alive,
            hp: m.hp,
          });
        });
        const attackerC: Combatant = {
          id: client.sessionId,
          pos: { x: p.x, y: p.y, z: p.z },
          alive: p.alive,
          hp: p.hp,
        };
        const dmg = this.computeDamage(p);
        const cfg: CombatConfig = { ...this.combat, attackDamage: dmg, attackRange: skill.range };
        const result = resolveAttack(attackerC, candidates, cfg);
        if (!result.ok) return;
        if (result.targetId.startsWith("mob:")) {
          const mobId = result.targetId.slice(4);
          const hit = this.mobSystem.applyDamage(mobId, dmg);
          if (!hit.ok) return;
          this.broadcast("attack", {
            attackerId: client.sessionId,
            targetId: result.targetId,
            killed: hit.killed,
            dmg,
          });
          if (hit.killed) this.onMobKilledByPlayer(p, hit.kind, hit.xpBonus, hit.gold);
        } else {
          const target = this.state.players.get(result.targetId);
          const targetCombat = this.playerCombat.get(result.targetId);
          if (!target || !targetCombat) return;
          if (Date.now() < targetCombat.invulnerableUntil) return;
          target.hp = result.newHp;
          if (result.killed) {
            target.alive = false;
            this.spawnKillDrop(target);
            const targetClient = this.clients.find((c) => c.sessionId === result.targetId);
            this.scheduleRespawn(result.targetId, targetClient);
          }
          this.broadcast("attack", {
            attackerId: client.sessionId,
            targetId: result.targetId,
            killed: result.killed,
            dmg,
          });
        }
        break;
      }
      case "cleave": {
        const origin = { x: p.x, y: p.y, z: p.z };
        const hits = this.mobSystem.applyRadialDamage(origin, skill.range, this.computeDamage(p));
        const killed = hits.filter((h) => h.ok && h.killed);
        for (const h of killed) {
          if (!h.ok) continue;
          this.onMobKilledByPlayer(p, h.kind, h.xpBonus, h.gold);
        }
        this.broadcast("skill-cast", {
          casterId: client.sessionId,
          skillId: skill.id,
          pos: origin,
          hits: hits.filter((h) => h.ok).length,
        });
        break;
      }
      case "heal": {
        p.hp = Math.min(p.maxHp, p.hp + 40);
        client.send("skill-cast", {
          casterId: client.sessionId,
          skillId: skill.id,
          pos: { x: p.x, y: p.y, z: p.z },
          hits: 0,
        });
        break;
      }
      case "dash": {
        const sec = this.playerSec.get(client.sessionId);
        const dx = sec ? p.x - sec.lastPos.x : 0;
        const dz = sec ? p.z - sec.lastPos.z : 0;
        const len = Math.hypot(dx, dz);
        const nx = len > 0 ? dx / len : 0;
        const nz = len > 0 ? dz / len : -1; // default forward
        const dash = clampToBounds(
          { x: p.x + nx * skill.range, y: p.y, z: p.z + nz * skill.range },
          this.zone,
        );
        p.x = dash.x;
        p.z = dash.z;
        if (sec) {
          sec.lastPos = { x: p.x, y: p.y, z: p.z };
          sec.lastMoveAt = Date.now();
        }
        this.broadcast("skill-cast", {
          casterId: client.sessionId,
          skillId: skill.id,
          pos: { x: p.x, y: p.y, z: p.z },
          hits: 0,
        });
        break;
      }
    }
  }

  // ---------- Stats ----------

  private handleAllocateStat(client: Client<unknown, SessionUser>, msg: AllocateStatMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (p.statPoints <= 0) return;
    const stat = msg?.stat;
    if (stat !== "strength" && stat !== "dexterity" && stat !== "vitality" && stat !== "intellect")
      return;
    p.statPoints -= 1;
    (p[stat] as number) = p[stat] + 1;
    if (stat === "vitality") {
      const newMax = maxHpFromStats(p.vitality);
      const delta = newMax - p.maxHp;
      p.maxHp = newMax;
      p.hp = Math.min(p.maxHp, p.hp + Math.max(0, delta));
    }
    if (stat === "intellect") {
      const newMax = maxManaFromStats(p.intellect);
      const delta = newMax - p.maxMana;
      p.maxMana = newMax;
      p.mana = Math.min(p.maxMana, p.mana + Math.max(0, delta));
    }
  }

  // ---------- Equipment slots ----------

  private handleEquipSlot(client: Client<unknown, SessionUser>, msg: EquipSlotMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const slot = msg?.slot;
    if (!EQUIP_SLOTS.includes(slot)) return;
    const itemId = msg?.itemId ?? "";
    if (itemId === "") {
      p.equipment.delete(slot);
      return;
    }
    if (!isItemId(itemId)) return;
    const def = getItem(itemId);
    if (!def || def.slot !== slot) return;
    if (findSlotIndex(this.slotsFromPlayer(p), itemId) < 0) return;
    p.equipment.set(slot, itemId);
    this.recomputeDerivedStats(p);
  }

  private handleUnequipSlot(client: Client<unknown, SessionUser>, msg: UnequipSlotMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (!EQUIP_SLOTS.includes(msg?.slot)) return;
    p.equipment.delete(msg.slot);
    this.recomputeDerivedStats(p);
  }

  private recomputeDerivedStats(p: Player) {
    // equipment can affect vitality/intellect → maxHp/maxMana
    const bonus = this.equipBonusFor(p);
    const newMaxHp = maxHpFromStats(p.vitality + bonus.vitality);
    const newMaxMana = maxManaFromStats(p.intellect + bonus.intellect);
    p.maxHp = newMaxHp;
    p.maxMana = newMaxMana;
    p.hp = Math.min(p.hp, p.maxHp);
    p.mana = Math.min(p.mana, p.maxMana);
  }

  // ---------- Vendor ----------

  private handleBuy(client: Client<unknown, SessionUser>, msg: BuyMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (this.zone.id !== "lobby") return;
    const itemId = msg?.itemId;
    if (!itemId || !isItemId(itemId)) return;
    if (!VENDOR_STOCK.includes(itemId)) return;
    const qty = Math.max(1, Math.floor(msg?.qty ?? 1));
    const def = getItem(itemId);
    if (!def?.price) return;
    const totalCost = def.price * qty;
    if (p.gold < totalCost) {
      client.send("vendor-error", { reason: "gold" });
      return;
    }
    const slots = this.slotsFromPlayer(p);
    const add = addItem(slots, itemId, qty, INVENTORY_SLOT_CAP);
    if (!add.ok) {
      client.send("vendor-error", { reason: "inventory" });
      return;
    }
    p.gold -= totalCost;
    this.writeSlotsToPlayer(p, add.slots);
    client.send("vendor-ok", { action: "buy", itemId, qty: add.added, gold: p.gold });
  }

  private handleSell(client: Client<unknown, SessionUser>, msg: SellMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (this.zone.id !== "lobby") return;
    const itemId = msg?.itemId;
    if (!itemId || !isItemId(itemId)) return;
    const qty = Math.max(1, Math.floor(msg?.qty ?? 1));
    const def = getItem(itemId);
    if (!def?.price) return;
    const slots = this.slotsFromPlayer(p);
    const rem = removeItem(slots, itemId, qty);
    if (!rem.ok) {
      client.send("vendor-error", { reason: "inventory" });
      return;
    }
    this.writeSlotsToPlayer(p, rem.slots);
    // clear any slot-equipped ref if item gone
    for (const slot of EQUIP_SLOTS) {
      if (p.equipment.get(slot) === itemId && countItem(rem.slots, itemId) <= 0) {
        p.equipment.delete(slot);
      }
    }
    const sellPrice = Math.max(1, Math.floor(def.price * SELL_FRACTION));
    p.gold += sellPrice * qty;
    client.send("vendor-ok", { action: "sell", itemId, qty, gold: p.gold });
  }

  // ---------- Quests ----------

  private grantQuest(p: Player, questId: string) {
    const def = getQuest(questId);
    if (!def) return;
    const q = new QuestProgress();
    q.id = def.id;
    q.status = "active";
    q.progress = 0;
    q.goal = def.objective.kind === "killMobs" ? def.objective.count : def.objective.count;
    p.quests.set(questId, q);
  }

  private handleTurnInQuest(client: Client<unknown, SessionUser>, msg: TurnInQuestMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (this.zone.id !== "lobby") return;
    const questId = msg?.questId;
    if (!questId) return;
    const q = p.quests.get(questId);
    const def = getQuest(questId);
    if (!q || !def) return;
    if (q.status !== "complete") return;
    q.status = "turned_in";
    this.awardXp(p, def.xpReward);
    p.gold += def.goldReward;
    if (def.itemReward) {
      const slots = this.slotsFromPlayer(p);
      const add = addItem(slots, def.itemReward.itemId, def.itemReward.qty, INVENTORY_SLOT_CAP);
      if (add.ok) this.writeSlotsToPlayer(p, add.slots);
    }
    // offer next quest if available
    if (questId === FIRST_QUEST_ID && !p.quests.has("arena-initiate")) {
      this.grantQuest(p, "arena-initiate");
    }
    client.send("quest-complete", { questId });
  }

  // ---------- Pickup / use / drop / equip (legacy single-slot) ----------

  private handlePickup(client: Client<unknown, SessionUser>, msg: PickupMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !p.alive) return;
    if (!this.rateLimiter.consume(client.sessionId, "move")) return;
    const drop = this.state.drops.get(msg?.dropId ?? "");
    if (!drop) return;
    const dx = drop.x - p.x;
    const dz = drop.z - p.z;
    if (dx * dx + dz * dz > this.loot.pickupRange * this.loot.pickupRange) return;
    const currentSlots = this.slotsFromPlayer(p);
    const result = addItem(currentSlots, drop.itemId, drop.qty, INVENTORY_SLOT_CAP);
    if (!result.ok) return;
    this.writeSlotsToPlayer(p, result.slots);
    this.state.drops.delete(drop.id);
    const def = getItem(drop.itemId);
    if (def?.xpReward) this.awardXp(p, def.xpReward);
    client.send("pickup", { itemId: drop.itemId, qty: result.added });
  }

  private handleUse(client: Client<unknown, SessionUser>, msg: UseMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !p.alive) return;
    if (!this.rateLimiter.consume(client.sessionId, "attack")) return;
    const itemId = msg?.itemId;
    if (!itemId || !isItemId(itemId)) return;
    const def = getItem(itemId);
    if (!def || def.kind !== "consumable") return;
    if (findSlotIndex(this.slotsFromPlayer(p), itemId) < 0) return;
    const result = removeItem(this.slotsFromPlayer(p), itemId, 1);
    if (!result.ok) return;
    this.writeSlotsToPlayer(p, result.slots);
    if (def.healAmount) p.hp = Math.min(p.maxHp, p.hp + def.healAmount);
    if (def.manaAmount) p.mana = Math.min(p.maxMana, p.mana + def.manaAmount);
    client.send("used", { itemId, hp: p.hp, mana: p.mana });
  }

  private handleEquip(client: Client<unknown, SessionUser>, msg: EquipMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const itemId = msg?.itemId ?? "";
    if (itemId === "") {
      p.equippedItemId = "";
      return;
    }
    if (!isItemId(itemId)) return;
    const def = getItem(itemId);
    if (!def || def.kind !== "weapon") return;
    if (findSlotIndex(this.slotsFromPlayer(p), itemId) < 0) return;
    p.equippedItemId = itemId;
    // also fill the weapon equipment slot if empty so bonuses apply consistently
    if (!p.equipment.has("weapon")) p.equipment.set("weapon", itemId);
  }

  private handleDrop(client: Client<unknown, SessionUser>, msg: DropMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !p.alive) return;
    const qty = Math.max(1, Math.floor(msg?.qty ?? 1));
    const itemId = msg?.itemId;
    if (!itemId || !isItemId(itemId)) return;
    const result = removeItem(this.slotsFromPlayer(p), itemId, qty);
    if (!result.ok) return;
    this.writeSlotsToPlayer(p, result.slots);
    if (p.equippedItemId === itemId && countItem(result.slots, itemId) <= 0) {
      p.equippedItemId = "";
    }
    this.spawnDrop(itemId as ItemId, qty, { x: p.x, y: p.y, z: p.z });
  }

  // ---------- Mob kill callbacks ----------

  private onMobKilledByPlayer(p: Player, kind: MobKind, xpBonus: number, gold: number) {
    this.awardXp(p, 10 + xpBonus);
    p.gold += gold;
    // quest progress: any kill-mobs quest ticks up
    for (const [, q] of p.quests) {
      const def = getQuest(q.id);
      if (!def) continue;
      if (def.objective.kind !== "killMobs") continue;
      if (q.status !== "active") continue;
      q.progress = Math.min(q.progress + 1, q.goal);
      if (q.progress >= q.goal) q.status = "complete";
    }
    // boss always drops a soul on top of normal loot
    if (kind === "boss") {
      this.spawnDrop("soul", 1, { x: p.x, y: p.y, z: p.z });
    }
  }

  private awardXp(p: Player, amount: number) {
    const r = applyXp(p.level, p.xp, amount);
    p.level = r.level;
    p.xp = r.xp;
    p.xpToNext = r.xpToNext;
    if (r.leveledUp) {
      p.statPoints += r.newLevels * STAT_POINTS_PER_LEVEL;
      p.maxHp = maxHpFromStats(p.vitality);
      p.maxMana = maxManaFromStats(p.intellect);
      p.hp = p.maxHp;
      p.mana = p.maxMana;
    }
  }

  // ---------- Utility ----------

  private slotsFromPlayer(p: Player): Slot[] {
    const out: Slot[] = [];
    for (const s of p.inventory) out.push({ itemId: s.itemId, qty: s.qty });
    return out;
  }

  private writeSlotsToPlayer(p: Player, slots: readonly Slot[]) {
    const next = new ArraySchema<InventorySlot>();
    for (const s of slots) {
      const slot = new InventorySlot();
      slot.itemId = s.itemId;
      slot.qty = s.qty;
      next.push(slot);
    }
    p.inventory = next;
  }

  private spawnKillDrop(victim: Player) {
    this.spawnDrop(this.loot.killDropItemId, this.loot.killDropQty, {
      x: victim.x,
      y: victim.y,
      z: victim.z,
    });
  }

  private spawnDrop(itemId: ItemId, qty: number, pos: Vec3) {
    if (!isItemId(itemId)) return;
    this.dropCounter += 1;
    const id = `d${this.dropCounter.toString(36)}`;
    const drop = new WorldDrop();
    drop.id = id;
    drop.itemId = itemId;
    drop.qty = qty;
    drop.x = pos.x;
    drop.y = pos.y;
    drop.z = pos.z;
    this.state.drops.set(id, drop);
  }

  private scheduleRespawn(targetId: string, client: Client | undefined) {
    this.clock.setTimeout(() => {
      const p = this.state.players.get(targetId);
      const combatState = this.playerCombat.get(targetId);
      if (!p || !combatState) return;
      p.x = this.zone.spawn.x;
      p.y = this.zone.spawn.y;
      p.z = this.zone.spawn.z;
      p.hp = p.maxHp;
      p.mana = p.maxMana;
      p.alive = true;
      combatState.invulnerableUntil = Date.now() + this.combat.invulnerableAfterRespawnMs;
      const sec = this.playerSec.get(targetId);
      if (sec) {
        sec.lastPos = { x: p.x, y: p.y, z: p.z };
        sec.lastMoveAt = Date.now();
      }
      if (client) client.send("respawned", { x: p.x, y: p.y, z: p.z });
    }, this.combat.respawnDelayMs);
  }

  private recordViolation(client: Client, p: Player, reason: string) {
    const { count, shouldKick } = this.violations.record(client.sessionId);
    p.violations = count;
    log.warn(
      { sessionId: client.sessionId, userId: (client.auth as SessionUser)?.id, reason, count },
      "anti-cheat violation",
    );
    if (shouldKick) {
      log.warn(
        { sessionId: client.sessionId, userId: (client.auth as SessionUser)?.id, count },
        "anti-cheat kick",
      );
      client.leave(4003);
    }
  }

  private async flushAllPositions() {
    const saves: Promise<void>[] = [];
    for (const client of this.clients) {
      const typed = client as Client<unknown, SessionUser>;
      const p = this.state.players.get(typed.sessionId);
      const userId = typed.auth?.id;
      if (!p || !userId) continue;
      saves.push(
        savePlayerLocation(userId, this.zone.id, { x: p.x, y: p.y, z: p.z }).catch((err) => {
          log.warn({ err, userId, zoneId: this.zone.id }, "periodic save failed");
        }),
      );
    }
    await Promise.all(saves);
  }

  private async flushAllProgress() {
    const saves: Promise<void>[] = [];
    for (const client of this.clients) {
      const typed = client as Client<unknown, SessionUser>;
      const p = this.state.players.get(typed.sessionId);
      const userId = typed.auth?.id;
      if (!p || !userId) continue;
      saves.push(
        this.persistProgress(userId, p).catch((err) => {
          log.warn({ err, userId }, "periodic progress save failed");
        }),
      );
    }
    await Promise.all(saves);
  }

  private async persistProgress(userId: string, p: Player) {
    const equip: Record<string, string> = {};
    p.equipment.forEach((itemId, slot) => {
      equip[slot] = itemId;
    });
    const quests: Record<string, { status: string; progress: number; goal: number }> = {};
    p.quests.forEach((q, id) => {
      quests[id] = { status: q.status, progress: q.progress, goal: q.goal };
    });
    await saveProgress({
      userId,
      level: p.level,
      xp: p.xp,
      equippedItemId: p.equippedItemId,
      gold: p.gold,
      mana: Math.floor(p.mana),
      maxMana: p.maxMana,
      strength: p.strength,
      dexterity: p.dexterity,
      vitality: p.vitality,
      intellect: p.intellect,
      statPoints: p.statPoints,
      equipmentJson: JSON.stringify(equip),
      questsJson: JSON.stringify(quests),
      inventory: this.slotsFromPlayer(p),
    });
  }

  private loadEquipment(p: Player, json: string) {
    try {
      const data = JSON.parse(json) as Record<string, string>;
      const map = new MapSchema<string>();
      for (const slot of EQUIP_SLOTS) {
        const id = data[slot];
        if (typeof id === "string" && id.length > 0 && isItemId(id)) map.set(slot, id);
      }
      p.equipment = map;
    } catch {
      // keep default empty map
    }
  }

  private loadQuests(p: Player, json: string) {
    try {
      const data = JSON.parse(json) as Record<
        string,
        { status: string; progress: number; goal: number }
      >;
      const map = new MapSchema<QuestProgress>();
      for (const [id, q] of Object.entries(data)) {
        if (!getQuest(id)) continue;
        const rec = new QuestProgress();
        rec.id = id;
        rec.status = q.status;
        rec.progress = q.progress;
        rec.goal = q.goal;
        map.set(id, rec);
      }
      p.quests = map;
    } catch {
      // keep default empty map
    }
  }

  private tickLootSpawns() {
    let potions = 0;
    for (const [, d] of this.state.drops) {
      if (d.itemId === "heal_potion") potions += 1;
    }
    if (potions >= this.loot.potionMaxInZone) return;
    const min = this.zone.bounds.min;
    const max = this.zone.bounds.max;
    const x = min.x + Math.random() * (max.x - min.x);
    const z = min.z + Math.random() * (max.z - min.z);
    this.spawnDrop("heal_potion", 1, { x, y: 0, z });
  }

  private handleZoneTick() {
    const portals = this.zone.portals;
    if (portals.length === 0) return;
    const now = Date.now();
    this.state.players.forEach((p, sessionId) => {
      if (!p.alive) return;
      const portalState = this.playerPortal.get(sessionId);
      if (!portalState) return;
      if (now < portalState.rearmAt) return;
      for (const portal of portals) {
        const dx = p.x - portal.pos.x;
        const dz = p.z - portal.pos.z;
        if (dx * dx + dz * dz > portal.radius * portal.radius) continue;
        portalState.rearmAt = now + PORTAL_REARM_MS;
        const client = this.clients.find((c) => c.sessionId === sessionId);
        if (!client) return;
        const userId = this.playerUserId.get(sessionId);
        if (userId) {
          savePlayerLocation(userId, this.zone.id, { x: p.x, y: p.y, z: p.z }).catch((err) => {
            log.warn({ err, userId, zoneId: this.zone.id }, "portal save failed");
          });
        }
        client.send("zone-exit", { to: portal.to });
        return;
      }
    });
  }

  private collectPlayerRefs(): PlayerRef[] {
    const out: PlayerRef[] = [];
    this.state.players.forEach((p, id) => {
      out.push({ id, pos: { x: p.x, y: p.y, z: p.z }, alive: p.alive });
    });
    return out;
  }

  private applyMobContactDamage(playerId: string, dmg: number): void {
    const target = this.state.players.get(playerId);
    const combat = this.playerCombat.get(playerId);
    if (!target || !combat || !target.alive) return;
    if (Date.now() < combat.invulnerableUntil) return;
    const newHp = Math.max(0, target.hp - dmg);
    target.hp = newHp;
    if (newHp === 0) {
      target.alive = false;
      this.spawnKillDrop(target);
      const targetClient = this.clients.find((c) => c.sessionId === playerId);
      this.scheduleRespawn(playerId, targetClient);
    }
  }

  // ---------- Chat (unchanged) ----------

  private handleChat(client: Client<unknown, SessionUser>, msg: ChatInbound) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (!msg || typeof msg !== "object") return;
    if (!isChatChannel(msg.channel)) {
      this.sendChatError(client, "invalid_channel");
      return;
    }
    if (typeof msg.text !== "string") {
      this.sendChatError(client, "empty");
      return;
    }
    const sanitized = stripControlChars(msg.text).trim();
    if (sanitized.length === 0) {
      this.sendChatError(client, "empty");
      return;
    }
    if (sanitized.length > CHAT_MAX_LEN) {
      this.sendChatError(client, "too_long");
      return;
    }
    if (!this.rateLimiter.consume(client.sessionId, "chat")) {
      this.recordViolation(client, p, "rate_limit:chat");
      this.sendChatError(client, "rate_limit");
      return;
    }
    this.chatCounter += 1;
    const entry: ChatEntry = {
      id: `c${this.chatCounter.toString(36)}`,
      channel: msg.channel,
      from: p.name && p.name.length > 0 ? p.name : client.sessionId.slice(0, 6),
      text: sanitized,
      at: Date.now(),
    };
    if (msg.channel === "zone") {
      this.broadcast("chat", entry);
      return;
    }
    this.dispatchGlobalChat(entry);
  }

  private dispatchGlobalChat(entry: ChatEntry) {
    this.broadcast("chat", entry);
    matchMaker
      .query({ name: "zone" })
      .then((rooms) => {
        for (const room of rooms) {
          if (room.roomId === this.roomId) continue;
          matchMaker.remoteRoomCall(room.roomId, "_relayChat", [entry]).catch((err) => {
            log.warn({ err, roomId: room.roomId }, "chat global relay failed");
          });
        }
      })
      .catch((err) => {
        log.warn({ err }, "chat global query failed");
      });
  }

  _relayChat(entry: ChatEntry) {
    this.broadcast("chat", entry);
  }

  private sendChatError(client: Client, reason: ChatError["reason"]) {
    client.send("chat-error", { reason } satisfies ChatError);
  }
}
