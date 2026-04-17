import { type AuthContext, type Client, Room, matchMaker } from "@colyseus/core";
import { ArraySchema, MapSchema } from "@colyseus/schema";
import {
  CHAT_MAX_LEN,
  CRIT_MULTIPLIER,
  type ChatCommand,
  type ChatEntry,
  type ChatError,
  type ChatInbound,
  DEFAULT_ZONE,
  type DeathCause,
  type DiedMessage,
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
  filterProfanity,
  getItem,
  getQuest,
  getZone,
  isChatChannel,
  isItemId,
  manaRegenPerSec,
  maxHpFromStats,
  maxManaFromStats,
  parseChatCommand,
  rollCrit,
  xpToNextLevel,
} from "@game/shared";
import { auth } from "../auth";
import { type CombatConfig, type Combatant, DEFAULT_COMBAT, resolveAttack } from "../combat";
import { insertChat, loadRecentChat } from "../db/chat";
import { addBlock, isBlocked, removeBlock } from "../db/chatBlock";
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
import { PartyManager } from "../party";
import {
  DEFAULT_SECURITY,
  RateLimiter,
  type SecurityConfig,
  ViolationTracker,
  validateMovement,
} from "../security";
import { HazardSystem } from "./systems/hazards";
import { type CasterBoltEvent, type MobKind, MobSystem, type PlayerRef } from "./systems/mobs";

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
type LastDamageSource = { cause: DeathCause; at: number };

const SAVE_INTERVAL_MS = 10_000;
const LOOT_SPAWN_INTERVAL_MS = 5_000;
const PORTAL_REARM_MS = 2_000;
const SELL_FRACTION = 0.4;
const PARTY_SHARE_RADIUS = 10; // metres
const PARTY_SHARE_RADIUS_SQ = PARTY_SHARE_RADIUS * PARTY_SHARE_RADIUS;
const PARTY_XP_SHARE_FRACTION = 0.6;

function stableColorFromSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 72% 58%)`;
}

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
  private lastDamageSource = new Map<string, LastDamageSource>();
  private saveInterval?: ReturnType<typeof setInterval>;
  private lootInterval?: ReturnType<typeof setInterval>;
  private dropCounter = 0;
  private chatCounter = 0;
  private mobSystem!: MobSystem;
  private hazardSystem!: HazardSystem;
  private muteUntil = new Map<string, number>();
  private partyManager = new PartyManager();

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
      damagePlayer: (id, dmg, source) => this.applyMobContactDamage(id, dmg, source),
      onMobKilled: (mobId, pos, kind) => this.broadcast("mob-killed", { mobId, pos, kind }),
      onTelegraph: (mobId, pos, radius, durationMs) =>
        this.broadcast("boss-telegraph", { mobId, pos, radius, durationMs }),
      onCasterBolt: (bolt) => this.fireCasterBolt(bolt),
      spawnDrop: (itemId, qty, pos) => this.spawnDrop(itemId, qty, pos),
      mobCount: this.zone.id === "lobby" ? 0 : undefined,
    });
    this.mobSystem.start();

    this.hazardSystem = new HazardSystem({
      hazards: this.state.hazards,
      getPlayers: () =>
        this.collectPlayerRefs().map((p) => ({
          id: p.id,
          x: p.pos.x,
          z: p.pos.z,
          alive: p.alive,
        })),
      damagePlayer: (id, dmg) => this.applyWorldDamage(id, dmg),
    });

    if (this.zone.id === "arena") {
      this.mobSystem.spawnSpecificKind("healer");
      this.hazardSystem.addHazard({ x: 0, z: 0, radius: 5, dps: 3 });
    }

    this.spawnZoneNpcs();
  }

  private spawnZoneNpcs() {
    if (this.zone.id !== "lobby") return;
    const vendor = new Npc();
    vendor.id = "npc:vendor";
    vendor.kind = "vendor";
    vendor.name = "Mercer the Vendor";
    vendor.x = -8.25;
    vendor.y = 0;
    vendor.z = 4;
    this.state.npcs.set(vendor.id, vendor);

    const questgiver = new Npc();
    questgiver.id = "npc:quest";
    questgiver.kind = "questgiver";
    questgiver.name = "Elder Cubius";
    questgiver.x = 8.25;
    questgiver.y = 0;
    questgiver.z = 4;
    this.state.npcs.set(questgiver.id, questgiver);
  }

  override async onJoin(client: Client<unknown, SessionUser>) {
    const p = new Player();
    p.id = client.sessionId;
    p.name = client.auth?.name ?? "";
    p.customizationColor = stableColorFromSeed(client.auth?.id ?? client.sessionId);

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
          this.preloadSkillCooldowns(client.sessionId, progress.skillCooldownsJson);
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
    if (!this.skillCds.has(client.sessionId)) {
      this.skillCds.set(client.sessionId, new Map());
    }

    // Stream recent chat history on join so the SidePanel chat tab isn't empty.
    loadRecentChat()
      .then((rows) => {
        client.send(
          "chat-history",
          rows.map((r) => ({
            id: r.id,
            channel: r.channel,
            from: r.fromName,
            text: r.text,
            at: r.createdAt.getTime(),
          })),
        );
      })
      .catch((err) => log.warn({ err }, "chat history load failed"));
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
    log.info({ sessionId: client.sessionId, userId, zoneId: this.zone.id }, "player left room");
    this.removeFromParty(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.playerSec.delete(client.sessionId);
    this.playerCombat.delete(client.sessionId);
    this.playerPortal.delete(client.sessionId);
    this.playerUserId.delete(client.sessionId);
    this.skillCds.delete(client.sessionId);
    this.lastDamageSource.delete(client.sessionId);
    this.rateLimiter.forget(client.sessionId);
    this.violations.forget(client.sessionId);
    this.mobSystem?.onPlayerLeave(client.sessionId);
    this.muteUntil.delete(client.sessionId);
  }

  override async onDispose() {
    if (this.saveInterval) clearInterval(this.saveInterval);
    if (this.lootInterval) clearInterval(this.lootInterval);
    this.mobSystem?.stop();
    this.hazardSystem?.stop();
    await this.flushAllPositions();
    await this.flushAllProgress();
  }

  // ---------- Tick ----------

  private tick(dt: number) {
    this.handleZoneTick();
    this.regenMana(dt);
    this.mobSystem?.tick(dt);
    this.hazardSystem?.tick(dt);
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
    const baseDmg = this.computeDamage(attacker);
    const crit = rollCrit(attacker.dexterity);
    const dmg = crit ? baseDmg * CRIT_MULTIPLIER : baseDmg;
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
        crit,
      });
      if (hit.killed)
        this.onMobKilledByPlayer(attacker, hit.kind, hit.xpBonus, hit.gold, hit.dropPos);
      return;
    }

    const target = this.state.players.get(result.targetId);
    const targetCombat = this.playerCombat.get(result.targetId);
    if (!target || !targetCombat) return;
    if (Date.now() < targetCombat.invulnerableUntil) return;
    target.hp = result.newHp;
    this.recordPlayerDamageSource(result.targetId, attacker);
    if (result.killed) {
      target.alive = false;
      this.spawnKillDrop(target);
      const targetClient = this.clients.find((c) => c.sessionId === result.targetId);
      this.sendDeath(result.targetId);
      this.scheduleRespawn(result.targetId, targetClient);
    }
    this.broadcast("attack", {
      attackerId: client.sessionId,
      targetId: result.targetId,
      killed: result.killed,
      dmg,
      crit,
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
        const baseDmg = this.computeDamage(p);
        const crit = rollCrit(p.dexterity);
        const dmg = crit ? baseDmg * CRIT_MULTIPLIER : baseDmg;
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
            crit,
          });
          if (hit.killed) this.onMobKilledByPlayer(p, hit.kind, hit.xpBonus, hit.gold, hit.dropPos);
        } else {
          const target = this.state.players.get(result.targetId);
          const targetCombat = this.playerCombat.get(result.targetId);
          if (!target || !targetCombat) return;
          if (Date.now() < targetCombat.invulnerableUntil) return;
          target.hp = result.newHp;
          this.recordPlayerDamageSource(result.targetId, p);
          if (result.killed) {
            target.alive = false;
            this.spawnKillDrop(target);
            const targetClient = this.clients.find((c) => c.sessionId === result.targetId);
            this.sendDeath(result.targetId);
            this.scheduleRespawn(result.targetId, targetClient);
          }
          this.broadcast("attack", {
            attackerId: client.sessionId,
            targetId: result.targetId,
            killed: result.killed,
            dmg,
            crit,
          });
        }
        break;
      }
      case "cleave": {
        const origin = { x: p.x, y: p.y, z: p.z };
        const baseDmg = this.computeDamage(p);
        const crit = rollCrit(p.dexterity);
        const dmg = crit ? baseDmg * CRIT_MULTIPLIER : baseDmg;
        const hits = this.mobSystem.applyRadialDamage(origin, skill.range, dmg);
        const killed = hits.filter((h) => h.ok && h.killed);
        for (const h of killed) {
          if (!h.ok) continue;
          this.onMobKilledByPlayer(p, h.kind, h.xpBonus, h.gold, h.dropPos);
        }
        this.broadcast("skill-cast", {
          casterId: client.sessionId,
          skillId: skill.id,
          pos: origin,
          hits: hits.filter((h) => h.ok).length,
          crit,
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
    if (!result.ok) {
      client.send("pickup-error", { reason: result.reason, itemId: drop.itemId });
      return;
    }
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

  private onMobKilledByPlayer(
    p: Player,
    kind: MobKind,
    xpBonus: number,
    gold: number,
    mobPos?: Vec3,
  ) {
    const baseXp = 10 + xpBonus;
    // Share XP with party members standing within radius of the kill. Killer
    // keeps the full award; other party members get a fraction (see
    // PARTY_XP_SHARE_FRACTION). No sharing for quest progress or gold — this
    // is tuned to reward grouping without inflating rewards too much.
    const party = this.partyManager.getPartyBySession(p.id);
    if (party && mobPos) {
      for (const memberSid of party.members) {
        const member = this.state.players.get(memberSid);
        if (!member || !member.alive) continue;
        if (memberSid === p.id) {
          this.awardXp(member, baseXp);
          continue;
        }
        const dx = member.x - mobPos.x;
        const dz = member.z - mobPos.z;
        if (dx * dx + dz * dz > PARTY_SHARE_RADIUS_SQ) continue;
        this.awardXp(member, Math.max(1, Math.floor(baseXp * PARTY_XP_SHARE_FRACTION)));
      }
    } else {
      this.awardXp(p, baseXp);
    }
    p.gold += gold;
    // quest progress: any kill-mobs quest ticks up — killer only, not party.
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

  private removeFromParty(sessionId: string) {
    const result = this.partyManager.leave(sessionId);
    const leaver = this.state.players.get(sessionId);
    if (leaver) leaver.partyId = "";
    if (!result.partyId) return;
    if (result.dissolved) return;
    // If leader was promoted, all remaining members' partyId schema fields
    // are already correct (they didn't change); leader change is pure server
    // state. Notify the new leader so the HUD can optionally flag it later.
    if (result.newLeader) {
      const promoted = this.clients.find((c) => c.sessionId === result.newLeader);
      promoted?.send("chat", {
        id: `c${++this.chatCounter}-${this.roomId.slice(-4)}`,
        channel: "zone",
        from: "party",
        text: "You are now the party leader.",
        at: Date.now(),
      } satisfies ChatEntry);
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
    // Persist skill cooldowns as remaining-ms so they restore correctly
    // across zone swaps / reconnects, independent of wall-clock drift.
    const sessionId = this.sessionIdFor(userId);
    const cdMs: Record<string, number> = {};
    if (sessionId) {
      const cds = this.skillCds.get(sessionId);
      const now = Date.now();
      cds?.forEach((readyAt, id) => {
        const remaining = readyAt - now;
        if (remaining > 0) cdMs[id] = remaining;
      });
    }
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
      skillCooldownsJson: JSON.stringify(cdMs),
      inventory: this.slotsFromPlayer(p),
    });
  }

  private sessionIdFor(userId: string): string | undefined {
    for (const [sid, uid] of this.playerUserId) {
      if (uid === userId) return sid;
    }
    return undefined;
  }

  private preloadSkillCooldowns(sessionId: string, json: string) {
    try {
      const data = JSON.parse(json) as Record<string, number>;
      const now = Date.now();
      const cds = new Map<SkillId, number>();
      for (const [id, remaining] of Object.entries(data)) {
        if (!Number.isFinite(remaining) || remaining <= 0) continue;
        if (id !== "basic" && id !== "cleave" && id !== "heal" && id !== "dash") continue;
        cds.set(id as SkillId, now + remaining);
      }
      this.skillCds.set(sessionId, cds);
    } catch {
      this.skillCds.set(sessionId, new Map());
    }
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
        const client = this.clients.find((c) => c.sessionId === sessionId);
        if (portal.minLevel !== undefined && p.level < portal.minLevel) {
          portalState.rearmAt = now + PORTAL_REARM_MS;
          client?.send("portal-locked", { to: portal.to, minLevel: portal.minLevel });
          return;
        }
        portalState.rearmAt = now + PORTAL_REARM_MS;
        if (!client) return;
        const userId = this.playerUserId.get(sessionId);
        log.info(
          {
            sessionId,
            userId,
            fromZoneId: this.zone.id,
            toZoneId: portal.to,
            pos: { x: p.x, y: p.y, z: p.z },
          },
          "portal travel triggered",
        );
        if (userId) {
          savePlayerLocation(userId, this.zone.id, { x: p.x, y: p.y, z: p.z }).catch((err) => {
            log.warn({ err, userId, zoneId: this.zone.id }, "portal save failed");
          });
        }
        // Parties are zone-scoped — traveling out drops the travelling
        // member so the rest of the party doesn't silently get share-XP from
        // someone they can't see.
        this.removeFromParty(sessionId);
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

  private fireCasterBolt(bolt: CasterBoltEvent): void {
    // Visual bolt flies to clients immediately; damage resolves when the
    // server-side flight timer expires, and only if the target is still
    // close enough to the intended landing pos. Players who sprint out of
    // the bolt's path won't take the hit, which makes casters kite-able.
    this.broadcast("caster-bolt", {
      id: bolt.id,
      mobId: bolt.mobId,
      from: bolt.from,
      to: bolt.to,
      targetId: bolt.targetId,
      durationMs: bolt.durationMs,
      damage: bolt.damage,
    });
    this.clock.setTimeout(() => {
      const target = this.state.players.get(bolt.targetId);
      const combat = this.playerCombat.get(bolt.targetId);
      if (!target || !combat || !target.alive) return;
      if (Date.now() < combat.invulnerableUntil) return;
      const dx = target.x - bolt.to.x;
      const dz = target.z - bolt.to.z;
      const HIT_RADIUS = 0.9;
      if (dx * dx + dz * dz > HIT_RADIUS * HIT_RADIUS) {
        this.broadcast("caster-bolt-miss", { id: bolt.id });
        return;
      }
      this.applyMobContactDamage(bolt.targetId, bolt.damage, {
        mobId: bolt.mobId,
        kind: "caster",
      });
      this.broadcast("caster-bolt-hit", { id: bolt.id, targetId: bolt.targetId });
    }, bolt.durationMs);
  }

  private applyMobContactDamage(
    playerId: string,
    dmg: number,
    source: { mobId: string; kind: MobKind },
  ): void {
    const target = this.state.players.get(playerId);
    const combat = this.playerCombat.get(playerId);
    if (!target || !combat || !target.alive) return;
    if (Date.now() < combat.invulnerableUntil) return;
    const newHp = Math.max(0, target.hp - dmg);
    target.hp = newHp;
    this.lastDamageSource.set(playerId, {
      cause: { kind: "mob", mobKind: source.kind },
      at: Date.now(),
    });
    if (newHp === 0) {
      target.alive = false;
      this.spawnKillDrop(target);
      const targetClient = this.clients.find((c) => c.sessionId === playerId);
      this.sendDeath(playerId);
      this.scheduleRespawn(playerId, targetClient);
    }
  }

  private applyWorldDamage(playerId: string, dmg: number): void {
    const target = this.state.players.get(playerId);
    const combat = this.playerCombat.get(playerId);
    if (!target || !combat || !target.alive) return;
    if (Date.now() < combat.invulnerableUntil) return;
    const newHp = Math.max(0, target.hp - dmg);
    target.hp = newHp;
    this.lastDamageSource.set(playerId, {
      cause: { kind: "world" },
      at: Date.now(),
    });
    if (newHp === 0) {
      target.alive = false;
      this.spawnKillDrop(target);
      const targetClient = this.clients.find((c) => c.sessionId === playerId);
      this.sendDeath(playerId);
      this.scheduleRespawn(playerId, targetClient);
    }
  }

  private recordPlayerDamageSource(targetId: string, attacker: Player) {
    this.lastDamageSource.set(targetId, {
      cause: {
        kind: "player",
        name: attacker.name && attacker.name.length > 0 ? attacker.name : "another player",
      },
      at: Date.now(),
    });
  }

  private sendDeath(sessionId: string) {
    const client = this.clients.find((c) => c.sessionId === sessionId);
    if (!client) return;
    const rec = this.lastDamageSource.get(sessionId);
    const cause: DeathCause = rec?.cause ?? { kind: "world" };
    const msg: DiedMessage = { cause, at: Date.now() };
    client.send("died", msg);
  }

  // ---------- Chat ----------

  private handleChat(client: Client<unknown, SessionUser>, msg: ChatInbound) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (!msg || typeof msg !== "object") return;
    // Clients send chat on "zone" or "global". DMs are routed via the /w
    // command, never by a direct channel: "dm" payload.
    if (!isChatChannel(msg.channel) || msg.channel === "dm") {
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
    const mutedUntil = this.muteUntil.get(client.sessionId) ?? 0;
    if (Date.now() < mutedUntil) {
      this.sendChatError(client, "muted");
      return;
    }
    if (!this.rateLimiter.consume(client.sessionId, "chat")) {
      this.recordViolation(client, p, "rate_limit:chat");
      this.sendChatError(client, "rate_limit");
      return;
    }

    const command = parseChatCommand(sanitized);
    switch (command.kind) {
      case "chat":
        this.dispatchChatMessage(client, p, msg.channel, command.text);
        return;
      case "whisper":
        this.dispatchWhisper(client, p, command);
        return;
      case "block":
      case "unblock":
        this.dispatchBlockCommand(client, command);
        return;
      case "party":
        this.dispatchPartyCommand(client, p, command.sub);
        return;
    }
  }

  private dispatchPartyCommand(
    client: Client<unknown, SessionUser>,
    self: Player,
    sub: Extract<ChatCommand, { kind: "party" }>["sub"],
  ) {
    const sessionId = client.sessionId;
    const systemEntry = (text: string): ChatEntry => {
      this.chatCounter += 1;
      return {
        id: `c${this.chatCounter.toString(36)}-${this.roomId.slice(-4)}`,
        channel: "zone",
        from: "party",
        text,
        at: Date.now(),
      };
    };

    if (sub.action === "status") {
      const party = this.partyManager.getPartyBySession(sessionId);
      if (!party) {
        client.send(
          "chat",
          systemEntry("You're not in a party. /party invite <name> to start one."),
        );
        return;
      }
      const names: string[] = [];
      for (const memberSid of party.members) {
        const member = this.state.players.get(memberSid);
        names.push(
          `${member?.name ?? memberSid.slice(0, 6)}${memberSid === party.leader ? " (leader)" : ""}`,
        );
      }
      client.send("chat", systemEntry(`Party ${party.id}: ${names.join(", ")}`));
      return;
    }

    if (sub.action === "leave") {
      const party = this.partyManager.getPartyBySession(sessionId);
      if (!party) {
        client.send("chat", systemEntry("You're not in a party."));
        return;
      }
      // Notify remaining members before we clear state.
      const remaining: string[] = [];
      for (const memberSid of party.members) {
        if (memberSid !== sessionId) remaining.push(memberSid);
      }
      this.removeFromParty(sessionId);
      client.send("chat", systemEntry("Left the party."));
      const leaverName = self.name || sessionId.slice(0, 6);
      for (const memberSid of remaining) {
        const memberClient = this.clients.find((c) => c.sessionId === memberSid);
        memberClient?.send("chat", systemEntry(`${leaverName} left the party.`));
      }
      return;
    }

    if (sub.action === "invite") {
      const match = this.findPlayerByName(sub.target, sessionId);
      if (!match) {
        this.sendChatError(client, "not_found");
        return;
      }
      const result = this.partyManager.invite(sessionId, match.sessionId);
      if (!result.ok) {
        if (result.reason === "full") this.sendChatError(client, "party_full");
        else if (result.reason === "already_in_party")
          this.sendChatError(client, "party_other_party");
        else client.send("chat", systemEntry(`Couldn't invite ${sub.target}: ${result.reason}.`));
        return;
      }
      // Sender is now (or already was) a party leader — reflect via schema.
      self.partyId = result.partyId;
      client.send("chat", systemEntry(`Invited ${match.sessionId.slice(0, 6)} to your party.`));
      const inviteeClient = this.clients.find((c) => c.sessionId === match.sessionId);
      const inviterName = self.name || sessionId.slice(0, 6);
      inviteeClient?.send(
        "chat",
        systemEntry(`[party invite from ${inviterName}] — /party accept`),
      );
      return;
    }

    if (sub.action === "accept") {
      const result = this.partyManager.accept(sessionId);
      if (!result.ok) {
        if (result.reason === "expired")
          client.send("chat", systemEntry("That invite expired. Ask again."));
        else if (result.reason === "full") this.sendChatError(client, "party_full");
        else client.send("chat", systemEntry("No pending party invite."));
        return;
      }
      self.partyId = result.partyId;
      const members = this.partyManager.membersOf(result.partyId);
      const memberNames: string[] = [];
      for (const memberSid of members) {
        const member = this.state.players.get(memberSid);
        if (member) member.partyId = result.partyId;
        memberNames.push(member?.name ?? memberSid.slice(0, 6));
      }
      const announcement = systemEntry(`Party formed: ${memberNames.join(", ")}`);
      for (const memberSid of members) {
        const memberClient = this.clients.find((c) => c.sessionId === memberSid);
        memberClient?.send("chat", announcement);
      }
      return;
    }
  }

  private dispatchChatMessage(
    client: Client<unknown, SessionUser>,
    p: Player,
    channel: "global" | "zone",
    text: string,
  ) {
    const clean = filterProfanity(text);
    const userId = this.playerUserId.get(client.sessionId);
    this.chatCounter += 1;
    const entry: ChatEntry = {
      id: `c${this.chatCounter.toString(36)}-${this.roomId.slice(-4)}`,
      channel,
      from: p.name && p.name.length > 0 ? p.name : client.sessionId.slice(0, 6),
      text: clean,
      at: Date.now(),
    };
    // Persist to chat_message so reconnecting players see recent history.
    if (userId) {
      insertChat({
        id: entry.id,
        channel: entry.channel,
        fromUserId: userId,
        fromName: entry.from,
        text: entry.text,
        now: new Date(entry.at),
      }).catch((err) => log.warn({ err }, "chat persist failed"));
    }
    if (channel === "zone") {
      this.deliverToRoom(entry, userId);
      return;
    }
    this.dispatchGlobalChat(entry, userId);
  }

  private dispatchWhisper(
    sender: Client<unknown, SessionUser>,
    senderPlayer: Player,
    cmd: Extract<ChatCommand, { kind: "whisper" }>,
  ) {
    const senderUserId = this.playerUserId.get(sender.sessionId);
    if (!senderUserId) return; // unauth'd sockets can't DM
    const cleanText = filterProfanity(cmd.text);
    const fromName =
      senderPlayer.name && senderPlayer.name.length > 0
        ? senderPlayer.name
        : sender.sessionId.slice(0, 6);
    this.chatCounter += 1;
    const entry: ChatEntry = {
      id: `c${this.chatCounter.toString(36)}-${this.roomId.slice(-4)}`,
      channel: "dm",
      from: fromName,
      to: cmd.to,
      text: cleanText,
      at: Date.now(),
    };
    // Try to deliver in-room first, then fan out to other zones. If no online
    // recipient is found anywhere, notify the sender with "not_found".
    const localMatch = this.findPlayerByName(cmd.to, sender.sessionId);
    if (localMatch) {
      this.deliverDmLocal(entry, localMatch.sessionId, localMatch.userId, senderUserId);
      sender.send("chat", entry);
      return;
    }
    matchMaker
      .query({ name: "zone" })
      .then(async (rooms) => {
        for (const room of rooms) {
          if (room.roomId === this.roomId) continue;
          try {
            const found: boolean = await matchMaker.remoteRoomCall(room.roomId, "_deliverDm", [
              entry,
              cmd.to,
              senderUserId,
            ]);
            if (found) {
              sender.send("chat", entry);
              return;
            }
          } catch (err) {
            log.warn({ err, roomId: room.roomId }, "dm relay failed");
          }
        }
        this.sendChatError(sender, "not_found");
      })
      .catch((err) => {
        log.warn({ err }, "dm global query failed");
        this.sendChatError(sender, "not_found");
      });
  }

  private dispatchBlockCommand(
    client: Client<unknown, SessionUser>,
    cmd: Extract<ChatCommand, { kind: "block" | "unblock" }>,
  ) {
    const userId = this.playerUserId.get(client.sessionId);
    if (!userId) return;
    const targetUserId = this.findUserIdByName(cmd.target);
    if (!targetUserId) {
      this.sendChatError(client, "not_found");
      return;
    }
    if (targetUserId === userId) {
      // Silently ignore self-blocks; no sensible error reason to surface.
      return;
    }
    const action =
      cmd.kind === "block" ? addBlock(userId, targetUserId) : removeBlock(userId, targetUserId);
    action
      .then(() => {
        this.chatCounter += 1;
        const entry: ChatEntry = {
          id: `c${this.chatCounter.toString(36)}-${this.roomId.slice(-4)}`,
          channel: "dm",
          from: "system",
          to: cmd.target,
          text:
            cmd.kind === "block"
              ? `Blocked ${cmd.target}. You won't see their messages.`
              : `Unblocked ${cmd.target}.`,
          at: Date.now(),
        };
        client.send("chat", entry);
      })
      .catch((err) => {
        log.warn({ err, userId, targetUserId, kind: cmd.kind }, "chat block op failed");
      });
  }

  private deliverToRoom(entry: ChatEntry, senderUserId?: string) {
    // Outbound block filter: skip clients whose viewer has blocked the sender.
    // Fast-path when the sender has no user id (shouldn't happen post-auth)
    // or when no client has any blocks — broadcast normally.
    if (!senderUserId) {
      this.broadcast("chat", entry);
      return;
    }
    this.sendFilteredByBlock(entry, senderUserId);
  }

  private dispatchGlobalChat(entry: ChatEntry, senderUserId?: string) {
    this.deliverToRoom(entry, senderUserId);
    matchMaker
      .query({ name: "zone" })
      .then((rooms) => {
        for (const room of rooms) {
          if (room.roomId === this.roomId) continue;
          matchMaker
            .remoteRoomCall(room.roomId, "_relayChat", [entry, senderUserId])
            .catch((err) => {
              log.warn({ err, roomId: room.roomId }, "chat global relay failed");
            });
        }
      })
      .catch((err) => {
        log.warn({ err }, "chat global query failed");
      });
  }

  private async sendFilteredByBlock(entry: ChatEntry, senderUserId: string): Promise<void> {
    // Walk the current clients and send individually when we know any of them
    // has blocked the sender. We only query blockers once per delivery
    // (getBlockedBy isn't symmetric — we need "who has blocked the sender").
    const tasks: Promise<void>[] = [];
    for (const client of this.clients) {
      const typed = client as Client<unknown, SessionUser>;
      const viewerUserId = this.playerUserId.get(typed.sessionId);
      if (!viewerUserId || viewerUserId === senderUserId) {
        typed.send("chat", entry);
        continue;
      }
      tasks.push(
        isBlocked(viewerUserId, senderUserId)
          .then((blocked) => {
            if (!blocked) typed.send("chat", entry);
          })
          .catch((err) => {
            // On a DB error fail-open (deliver) — moderation lag is better
            // than silencing real chat if sqlite hiccups.
            log.warn({ err }, "chat block lookup failed");
            typed.send("chat", entry);
          }),
      );
    }
    await Promise.all(tasks);
  }

  _relayChat(entry: ChatEntry, senderUserId?: string) {
    this.deliverToRoom(entry, senderUserId);
  }

  _deliverDm(entry: ChatEntry, toName: string, senderUserId: string): boolean {
    const match = this.findPlayerByName(toName);
    if (!match) return false;
    this.deliverDmLocal(entry, match.sessionId, match.userId, senderUserId);
    return true;
  }

  private deliverDmLocal(
    entry: ChatEntry,
    recipientSessionId: string,
    recipientUserId: string | undefined,
    senderUserId: string,
  ) {
    const recipient = this.clients.find((c) => c.sessionId === recipientSessionId);
    if (!recipient) return;
    // Respect blocks on inbound DMs — silently drop instead of surfacing an
    // error, so blocked senders can't probe the block list.
    if (!recipientUserId) {
      recipient.send("chat", entry);
      return;
    }
    isBlocked(recipientUserId, senderUserId)
      .then((blocked) => {
        if (!blocked) recipient.send("chat", entry);
      })
      .catch((err) => {
        log.warn({ err }, "dm block lookup failed");
        recipient.send("chat", entry);
      });
  }

  private findPlayerByName(
    name: string,
    exceptSessionId?: string,
  ): { sessionId: string; userId: string | undefined } | undefined {
    const target = name.toLowerCase();
    for (const [sessionId, p] of this.state.players) {
      if (exceptSessionId && sessionId === exceptSessionId) continue;
      if (p.name.toLowerCase() === target) {
        return { sessionId, userId: this.playerUserId.get(sessionId) };
      }
    }
    return undefined;
  }

  private findUserIdByName(name: string): string | undefined {
    const match = this.findPlayerByName(name);
    return match?.userId;
  }

  _adminKick(sessionId: string) {
    const client = this.clients.find((c) => c.sessionId === sessionId);
    client?.leave(4003);
  }

  _adminMute(sessionId: string, durationMs = 900_000) {
    const safeDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 900_000;
    this.muteUntil.set(sessionId, Date.now() + safeDuration);
  }

  _adminGetUserId(sessionId: string): string | undefined {
    return this.playerUserId.get(sessionId);
  }

  private sendChatError(client: Client, reason: ChatError["reason"]) {
    client.send("chat-error", { reason } satisfies ChatError);
  }
}
