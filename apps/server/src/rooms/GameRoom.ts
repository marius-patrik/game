import { type AuthContext, type Client, matchMaker, Room } from "@colyseus/core";
import { ArraySchema, MapSchema } from "@colyseus/schema";
import type { AbilityDef, WeaponSlotKey } from "@game/shared/abilities";
import { getAbility } from "@game/shared/abilities";
import {
  CHAT_MAX_LEN,
  type ChatCommand,
  type ChatEntry,
  type ChatError,
  type ChatInbound,
  isChatChannel,
  parseChatCommand,
} from "@game/shared/chat";
import { filterProfanity } from "@game/shared/chat-profanity";
import type { DeathCause, DiedMessage } from "@game/shared/combat";
import { type EquipSlot, getItem, type ItemId, isItemId, VENDOR_STOCK } from "@game/shared/items";
import { applyXp, xpToNextLevel } from "@game/shared/progression";
import { FIRST_QUEST_ID, getQuest, QUEST_CATALOG } from "@game/shared/quests";
import {
  GameRoomState,
  InventorySlot,
  Npc,
  Player,
  QuestProgress,
  WorldDrop,
} from "@game/shared/schema";
import {
  getSkill,
  isSkillId,
  resolveSkillAbility,
  type SkillSlot,
  skillEffectiveCooldownMs,
} from "@game/shared/skills";
import {
  attackCooldownMs,
  CRIT_MULTIPLIER,
  damageBonusFromStats,
  EQUIP_SLOTS,
  equipBonus,
  manaRegenPerSec,
  maxHpFromStats,
  maxManaFromStats,
  rollCrit,
  STAT_POINTS_PER_LEVEL,
  type StatKey,
} from "@game/shared/stats";
import { clampToBounds, DEFAULT_ZONE, getZone, type Vec3, type Zone } from "@game/shared/zones";
import { auth } from "../auth";
import {
  type Combatant,
  type CombatConfig,
  checkAbilityReady,
  DEFAULT_COMBAT,
  resolveAttack,
  resolveWeaponAbility,
  SKILLS_EQUIPPED_SIZE,
  validateAllocation,
  validateUnbind,
} from "../combat";
import { loadCharacter, saveCharacter } from "../db/character";
import { insertChat, loadRecentChat } from "../db/chat";
import { addBlock, isBlocked, removeBlock } from "../db/chatBlock";
import { getPlayerLocation, savePlayerLocation } from "../db/playerLocation";
import {
  addItem,
  countItem,
  DEFAULT_LOOT,
  findSlotIndex,
  INVENTORY_SLOT_CAP,
  type LootConfig,
  removeItem,
  type Slot,
} from "../inventory";
import { log } from "../logger";
import { PartyManager } from "../party";
import { dailyTracker } from "../quests/dailyTracker";
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
type EquipSlotMessage = { slot: EquipSlot; itemId: string };
type UnequipSlotMessage = { slot: EquipSlot };
type AbilitySlotKey = WeaponSlotKey | SkillSlot;
type UseAbilityMessage = { slot: AbilitySlotKey; target?: { x: number; z: number } };
type AllocateSkillMessage = { skillId: string; slot: SkillSlot };
type UnbindSkillMessage = { slot: SkillSlot };
type BuyMessage = { itemId: string; qty?: number };
type SellMessage = { itemId: string; qty?: number };
type TurnInQuestMessage = { questId: string };
type JoinOptions = { token?: string; zoneId?: string; characterId?: string };

const SKILL_POINTS_PER_LEVEL = 1;

export type SessionUser = { id: string; name: string; role: string };

type PlayerSecurityState = { lastPos: Vec3; lastMoveAt: number };
type PlayerCombatState = { invulnerableUntil: number; lastAttackAt: number };
type PlayerPortalState = { rearmAt: number };
type LastDamageSource = { cause: DeathCause; at: number };

const SAVE_INTERVAL_MS = 10_000;
const LOOT_SPAWN_INTERVAL_MS = 5_000;
const PORTAL_REARM_MS = 2_000;
const SELL_FRACTION = 0.4;
const PARTY_SHARE_RADIUS = 10;
const PARTY_SHARE_RADIUS_SQ = PARTY_SHARE_RADIUS * PARTY_SHARE_RADIUS;
const PARTY_XP_SHARE_FRACTION = 0.6;

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
  private playerCharacterId = new Map<string, string>();
  private abilityCds = new Map<string, Map<string, number>>();
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
    this.setState(new GameRoomState());
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
    this.onMessage<AllocateSkillMessage>("allocate-skill", (client, msg) =>
      this.handleAllocateSkill(client, msg),
    );
    this.onMessage<UnbindSkillMessage>("unbind-skill", (client, msg) =>
      this.handleUnbindSkill(client, msg),
    );
    this.onMessage<EquipSlotMessage>("equipSlot", (client, msg) =>
      this.handleEquipSlot(client, msg),
    );
    this.onMessage<UnequipSlotMessage>("unequipSlot", (client, msg) =>
      this.handleUnequipSlot(client, msg),
    );
    this.onMessage<UseAbilityMessage>("use-ability", (client, msg) =>
      this.handleUseAbility(client, msg),
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

  override async onJoin(client: Client<unknown, SessionUser>, options: JoinOptions) {
    const characterId = options?.characterId;
    if (!characterId) throw new Error("characterId required");

    const userId = client.auth?.id;
    if (!userId) throw new Error("unauthorized");

    const { character: char, progress, inventory } = await loadCharacter(characterId);
    if (!char || char.userId !== userId || char.isDeleted) {
      throw new Error("invalid character");
    }

    const p = new Player();
    p.id = client.sessionId;
    p.characterId = char.id;
    p.name = char.name;
    p.customizationColor = char.color;

    let spawn: Vec3 = { x: this.zone.spawn.x, y: this.zone.spawn.y, z: this.zone.spawn.z };

    this.playerUserId.set(client.sessionId, userId);
    this.playerCharacterId.set(client.sessionId, char.id);
    try {
      const saved = await getPlayerLocation(char.id, this.zone.id);
      if (saved) spawn = { x: saved.x, y: saved.y, z: saved.z };
    } catch (err) {
      log.warn({ err, characterId, zoneId: this.zone.id }, "failed to load player location");
    }

    if (progress) {
      p.level = progress.level;
      p.xp = progress.xp;
      p.xpToNext = xpToNextLevel(progress.level);
      p.equippedItemId = progress.equippedItemId;
      p.gold = progress.gold;
      p.baseStrength = progress.strength;
      p.baseDexterity = progress.dexterity;
      p.baseVitality = progress.vitality;
      p.baseIntellect = progress.intellect;
      p.statPoints = progress.statPoints;
      p.skillPoints = progress.skillPoints;
      p.ultimateSkill = isSkillId(progress.ultimateSkill) ? progress.ultimateSkill : "";
      p.skillsEquipped = this.parseSkillsEquipped(progress.skillsEquippedJson);
      // Load equipment first, then recompute — effective stats depend on both.
      this.loadEquipment(p, progress.equipmentJson);
      this.recomputeDerivedStats(p);
      p.mana = Math.min(progress.mana, p.maxMana);
      this.loadQuests(p, progress.questsJson);
    } else {
      p.xpToNext = xpToNextLevel(1);
      p.skillsEquipped = this.buildSkillsEquipped(["", ""]);
      this.recomputeDerivedStats(p);
      p.mana = p.maxMana;
    }

    await dailyTracker.loadPlayerDailies(p, char.id);
    const exploreRewards = dailyTracker.onZoneEntered(p, this.zone.id);
    for (const r of exploreRewards) {
      this.awardXp(p, r.xp);
      client.send("quest-complete", { questId: r.questId, isDaily: true });
    }

    for (const row of inventory) {
      const slot = new InventorySlot();
      slot.itemId = row.itemId;
      slot.qty = row.qty;
      p.inventory.push(slot);
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
    if (!this.abilityCds.has(client.sessionId)) {
      this.abilityCds.set(client.sessionId, new Map());
    }

    // Stream recent chat history on join so the chat tab isn't empty.
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
    const charId = this.playerCharacterId.get(client.sessionId);
    if (p && charId) {
      try {
        await savePlayerLocation(charId, this.zone.id, { x: p.x, y: p.y, z: p.z });
      } catch (err) {
        log.warn(
          { err, characterId: charId, zoneId: this.zone.id },
          "failed to save player location on leave",
        );
      }
      try {
        await this.persistProgress(charId, p);
      } catch (err) {
        log.warn({ err, characterId: charId }, "failed to save player progress on leave");
      }
    }
    const userId = client.auth?.id;
    log.info(
      { sessionId: client.sessionId, userId, characterId: charId, zoneId: this.zone.id },
      "player left room",
    );
    this.removeFromParty(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.playerSec.delete(client.sessionId);
    this.playerCombat.delete(client.sessionId);
    this.playerPortal.delete(client.sessionId);
    this.playerUserId.delete(client.sessionId);
    this.playerCharacterId.delete(client.sessionId);
    this.abilityCds.delete(client.sessionId);
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
    for (const p of this.state.players.values()) {
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
    for (const [id, p] of this.state.players) {
      candidates.push({ id, pos: { x: p.x, y: p.y, z: p.z }, alive: p.alive, hp: p.hp });
    }
    for (const [id, m] of this.state.mobs) {
      candidates.push({
        id: `mob:${id}`,
        pos: { x: m.x, y: m.y, z: m.z },
        alive: m.alive,
        hp: m.hp,
      });
    }

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
    return this.combat.attackDamage + bonus + equipBonusTotal;
  }

  private computeAbilityDamage(p: Player, ability: AbilityDef): number {
    const statBonus = damageBonusFromStats(p.strength);
    const weaponDamage = this.equipBonusFor(p).damageBonus;
    // Unarmed abilities should not stack the weapon-damage bonus; they're
    // the fallback when there's no weapon. Weapon-bound abilities inherit
    // the item's damageBonus the same way legacy attacks do.
    const isUnarmed = ability.id === "strike" || ability.id === "punch";
    return ability.damage + statBonus + (isUnarmed ? 0 : weaponDamage);
  }

  private equipBonusFor(p: Player) {
    const defs = EQUIP_SLOTS.map((slot) => {
      const id = p.equipment.get(slot);
      return id ? getItem(id) : undefined;
    });
    return equipBonus(defs);
  }

  // ---------- Skills ----------

  // ---------- Skill allocation ----------

  private handleAllocateSkill(client: Client<unknown, SessionUser>, msg: AllocateSkillMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const skillId = msg?.skillId;
    const slot = msg?.slot;
    if (typeof skillId !== "string" || skillId.length === 0) {
      client.send("skill-error", { reason: "unknown_skill" });
      return;
    }
    const current = this.readSkillsEquipped(p);
    const result = validateAllocation({
      skillId,
      slot,
      playerLevel: p.level,
      availablePoints: p.skillPoints,
      currentNormal: current,
      currentUltimate: p.ultimateSkill,
    });
    if (!result.ok) {
      client.send("skill-error", { reason: result.reason });
      return;
    }
    p.skillsEquipped = this.buildSkillsEquipped(result.nextNormal);
    p.ultimateSkill = result.nextUltimate;
    p.skillPoints = Math.max(0, p.skillPoints - result.pointsSpent);
    client.send("skill-ok", { skillId: result.skill.id, slot: result.slot });
  }

  private handleUnbindSkill(client: Client<unknown, SessionUser>, msg: UnbindSkillMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const current = this.readSkillsEquipped(p);
    const result = validateUnbind({
      slot: msg?.slot,
      currentNormal: current,
      currentUltimate: p.ultimateSkill,
    });
    if (!result.ok) {
      client.send("skill-error", { reason: result.reason });
      return;
    }
    p.skillsEquipped = this.buildSkillsEquipped(result.nextNormal);
    p.ultimateSkill = result.nextUltimate;
    client.send("skill-ok", { skillId: "", slot: result.slot });
  }

  private readSkillsEquipped(p: Player): [string, string] {
    const arr = p.skillsEquipped;
    const a = typeof arr[0] === "string" ? arr[0] : "";
    const b = typeof arr[1] === "string" ? arr[1] : "";
    return [a, b];
  }

  private buildSkillsEquipped(next: readonly [string, string]): ArraySchema<string> {
    const out = new ArraySchema<string>();
    for (let i = 0; i < SKILLS_EQUIPPED_SIZE; i++) {
      out.push(next[i] ?? "");
    }
    return out;
  }

  private resolveSkillSlotAbility(p: Player, slot: SkillSlot): AbilityDef | undefined {
    const current = this.readSkillsEquipped(p);
    let skillId = "";
    if (slot === "S1") skillId = current[0];
    else if (slot === "S2") skillId = current[1];
    else if (slot === "U") skillId = p.ultimateSkill;
    if (!skillId || !isSkillId(skillId)) return undefined;
    return resolveSkillAbility(skillId);
  }

  // ---------- Weapon + skill abilities (W1 / W2 / S1 / S2 / U) ----------

  private handleUseAbility(client: Client<unknown, SessionUser>, msg: UseAbilityMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const slot = msg?.slot;
    let ability: AbilityDef | undefined;
    let skillSlot: SkillSlot | undefined;
    if (slot === "W1" || slot === "W2") {
      ability = resolveWeaponAbility(p.equipment, slot);
    } else if (slot === "S1" || slot === "S2" || slot === "U") {
      skillSlot = slot;
      ability = this.resolveSkillSlotAbility(p, slot);
    } else {
      client.send("ability-error", { slot: String(slot ?? ""), reason: "invalid_slot" });
      return;
    }
    if (!ability) {
      client.send("ability-error", { slot, reason: "unknown_ability" });
      return;
    }
    const cooldownMs =
      skillSlot === "U"
        ? skillEffectiveCooldownMs(p.ultimateSkill, ability.cooldownMs)
        : ability.cooldownMs;
    const cdKey = skillSlot ? `skill:${skillSlot}` : `ability:${ability.id}`;
    const cds = this.abilityCds.get(client.sessionId);
    if (!cds) return;
    const now = Date.now();
    const readyAt = cds.get(cdKey) ?? 0;
    const gate = checkAbilityReady({
      ability,
      now,
      readyAt,
      mana: p.mana,
      alive: p.alive,
    });
    if (!gate.ok) {
      client.send("ability-error", { slot, abilityId: ability.id, reason: gate.reason });
      return;
    }
    if (!this.rateLimiter.consume(client.sessionId, "attack")) {
      this.recordViolation(client, p, "rate_limit:ability");
      return;
    }

    cds.set(cdKey, now + cooldownMs);
    if (ability.manaCost > 0) p.mana = Math.max(0, p.mana - ability.manaCost);

    const baseDmg = this.computeAbilityDamage(p, ability);
    const crit = rollCrit(p.dexterity);
    const dmg = crit ? baseDmg * CRIT_MULTIPLIER : baseDmg;

    switch (ability.kind) {
      case "melee":
      case "ranged":
        this.executeSingleTargetAbility(client, p, ability, dmg, crit);
        break;
      case "aoe":
        this.executeAoeAbility(client, p, ability, dmg, crit, msg.target);
        break;
      case "movement":
        this.executeMovementAbility(client, p, ability, dmg, crit, msg.target);
        break;
      case "self":
        this.broadcast("ability-cast", {
          casterId: client.sessionId,
          abilityId: ability.id,
          pos: { x: p.x, y: p.y, z: p.z },
          hits: 0,
          crit,
          dmg: 0,
        });
        break;
    }
  }

  private executeSingleTargetAbility(
    client: Client<unknown, SessionUser>,
    attacker: Player,
    ability: AbilityDef,
    dmg: number,
    crit: boolean,
  ) {
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
      pos: { x: attacker.x, y: attacker.y, z: attacker.z },
      alive: attacker.alive,
      hp: attacker.hp,
    };
    const cfg: CombatConfig = {
      ...this.combat,
      attackDamage: dmg,
      attackRange: ability.range,
    };
    const result = resolveAttack(attackerC, candidates, cfg);
    if (!result.ok) {
      client.send("ability-cast", {
        abilityId: ability.id,
        casterId: client.sessionId,
        pos: { x: attacker.x, y: attacker.y, z: attacker.z },
        hits: 0,
        crit,
        dmg: 0,
      });
      return;
    }
    this.applyAbilityHitToTarget(client, attacker, ability, result.targetId, dmg, crit);
  }

  private applyAbilityHitToTarget(
    client: Client<unknown, SessionUser>,
    attacker: Player,
    ability: AbilityDef,
    targetId: string,
    dmg: number,
    crit: boolean,
  ) {
    if (targetId.startsWith("mob:")) {
      const mobId = targetId.slice(4);
      const hit = this.mobSystem.applyDamage(mobId, dmg);
      if (!hit.ok) return;
      this.broadcast("ability-cast", {
        casterId: client.sessionId,
        abilityId: ability.id,
        targetId,
        pos: { x: attacker.x, y: attacker.y, z: attacker.z },
        hits: 1,
        killed: hit.killed,
        dmg,
        crit,
      });
      if (hit.killed) {
        this.onMobKilledByPlayer(attacker, hit.kind, hit.xpBonus, hit.gold, hit.dropPos);
      }
      return;
    }
    const target = this.state.players.get(targetId);
    const targetCombat = this.playerCombat.get(targetId);
    if (!target || !targetCombat) return;
    if (Date.now() < targetCombat.invulnerableUntil) return;
    const newHp = Math.max(0, target.hp - dmg);
    target.hp = newHp;
    this.recordPlayerDamageSource(targetId, attacker);
    const killed = newHp === 0;
    if (killed) {
      target.alive = false;
      this.spawnKillDrop(target);
      const targetClient = this.clients.find((c) => c.sessionId === targetId);
      this.sendDeath(targetId);
      this.scheduleRespawn(targetId, targetClient);
    }
    this.broadcast("ability-cast", {
      casterId: client.sessionId,
      abilityId: ability.id,
      targetId,
      pos: { x: attacker.x, y: attacker.y, z: attacker.z },
      hits: 1,
      killed,
      dmg,
      crit,
    });
  }

  private executeAoeAbility(
    client: Client<unknown, SessionUser>,
    attacker: Player,
    ability: AbilityDef,
    dmg: number,
    crit: boolean,
    target?: { x: number; z: number },
  ) {
    const origin =
      target && Number.isFinite(target.x) && Number.isFinite(target.z)
        ? { x: target.x, y: attacker.y, z: target.z }
        : { x: attacker.x, y: attacker.y, z: attacker.z };
    const hits = this.mobSystem.applyRadialDamage(origin, ability.range, dmg);
    const killed = hits.filter((h) => h.ok && h.killed);
    for (const h of killed) {
      if (!h.ok) continue;
      this.onMobKilledByPlayer(attacker, h.kind, h.xpBonus, h.gold, h.dropPos);
    }
    this.broadcast("ability-cast", {
      casterId: client.sessionId,
      abilityId: ability.id,
      pos: origin,
      hits: hits.filter((h) => h.ok).length,
      crit,
      dmg,
    });
  }

  private executeMovementAbility(
    client: Client<unknown, SessionUser>,
    attacker: Player,
    ability: AbilityDef,
    dmg: number,
    crit: boolean,
    target?: { x: number; z: number },
  ) {
    const sec = this.playerSec.get(client.sessionId);
    let targetX: number;
    let targetZ: number;
    if (target && Number.isFinite(target.x) && Number.isFinite(target.z)) {
      const dx = target.x - attacker.x;
      const dz = target.z - attacker.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= ability.range || dist === 0) {
        targetX = target.x;
        targetZ = target.z;
      } else {
        const scale = ability.range / dist;
        targetX = attacker.x + dx * scale;
        targetZ = attacker.z + dz * scale;
      }
    } else {
      const dx = sec ? attacker.x - sec.lastPos.x : 0;
      const dz = sec ? attacker.z - sec.lastPos.z : 0;
      const len = Math.hypot(dx, dz);
      const nx = len > 0 ? dx / len : 0;
      const nz = len > 0 ? dz / len : -1;
      targetX = attacker.x + nx * ability.range;
      targetZ = attacker.z + nz * ability.range;
    }
    const dash = clampToBounds({ x: targetX, y: attacker.y, z: targetZ }, this.zone);
    attacker.x = dash.x;
    attacker.z = dash.z;
    if (sec) {
      sec.lastPos = { x: attacker.x, y: attacker.y, z: attacker.z };
      sec.lastMoveAt = Date.now();
    }
    // Hit anything within ability.range of the new position (sweep).
    this.executeAoeAbility(client, attacker, ability, dmg, crit, { x: attacker.x, z: attacker.z });
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
    const baseKey: "baseStrength" | "baseDexterity" | "baseVitality" | "baseIntellect" =
      stat === "strength"
        ? "baseStrength"
        : stat === "dexterity"
          ? "baseDexterity"
          : stat === "vitality"
            ? "baseVitality"
            : "baseIntellect";
    const prevMaxHp = p.maxHp;
    const prevMaxMana = p.maxMana;
    (p[baseKey] as number) = (p[baseKey] as number) + 1;
    this.recomputeDerivedStats(p);
    // Preserve the "spending a vit point refills the gained HP" feel without
    // overshooting the new cap.
    if (p.maxHp > prevMaxHp) p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - prevMaxHp));
    if (p.maxMana > prevMaxMana) p.mana = Math.min(p.maxMana, p.mana + (p.maxMana - prevMaxMana));
  }

  // ---------- Equipment slots ----------

  private handleEquipSlot(client: Client<unknown, SessionUser>, msg: EquipSlotMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const slot = msg?.slot;
    if (!EQUIP_SLOTS.includes(slot)) {
      client.send("equip-error", { reason: "invalid_slot", slot: String(slot ?? "") });
      return;
    }
    const itemId = msg?.itemId ?? "";
    if (itemId === "") {
      p.equipment.delete(slot);
      this.recomputeDerivedStats(p);
      return;
    }
    if (!isItemId(itemId)) {
      client.send("equip-error", { reason: "unknown_item", slot, itemId });
      return;
    }
    const def = getItem(itemId);
    if (!def || def.slot !== slot) {
      client.send("equip-error", { reason: "slot_mismatch", slot, itemId });
      return;
    }
    if (findSlotIndex(this.slotsFromPlayer(p), itemId) < 0) {
      client.send("equip-error", { reason: "not_in_inventory", slot, itemId });
      return;
    }
    p.equipment.set(slot, itemId);
    if (slot === "weapon") p.equippedItemId = itemId;
    this.recomputeDerivedStats(p);
    client.send("equip-ok", { slot, itemId });
  }

  private handleUnequipSlot(client: Client<unknown, SessionUser>, msg: UnequipSlotMessage) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const slot = msg?.slot;
    if (!EQUIP_SLOTS.includes(slot)) {
      client.send("equip-error", { reason: "invalid_slot", slot: String(slot ?? "") });
      return;
    }
    p.equipment.delete(slot);
    if (slot === "weapon") p.equippedItemId = "";
    this.recomputeDerivedStats(p);
    client.send("equip-ok", { slot, itemId: "" });
  }

  private recomputeDerivedStats(p: Player) {
    const bonus = this.equipBonusFor(p);
    // Effective stats = base + equipment bonuses; these are what HUD + combat use.
    p.strength = p.baseStrength + bonus.strength;
    p.dexterity = p.baseDexterity + bonus.dexterity;
    p.vitality = p.baseVitality + bonus.vitality;
    p.intellect = p.baseIntellect + bonus.intellect;
    p.maxHp = maxHpFromStats(p.vitality);
    p.maxMana = maxManaFromStats(p.intellect);
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
    q.goal = def.objective.kind === "explore" ? 1 : def.objective.count;
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

    const dailyRewards = dailyTracker.onItemPickedUp(p, drop.itemId, drop.qty);
    for (const r of dailyRewards) {
      this.awardXp(p, r.xp);
      client.send("quest-complete", { questId: r.questId, isDaily: true });
    }

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
      p.equipment.delete("weapon");
      this.recomputeDerivedStats(p);
      return;
    }
    if (!isItemId(itemId)) return;
    const def = getItem(itemId);
    if (!def || def.kind !== "weapon") return;
    if (findSlotIndex(this.slotsFromPlayer(p), itemId) < 0) return;
    p.equippedItemId = itemId;
    p.equipment.set("weapon", itemId);
    this.recomputeDerivedStats(p);
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
    for (const [, q] of p.quests) {
      const def = getQuest(q.id);
      if (!def) continue;
      if (def.objective.kind !== "killMobs") continue;
      if (q.status !== "active") continue;
      q.progress = Math.min(q.progress + 1, q.goal);
      if (q.progress >= q.goal) q.status = "complete";
    }

    const dailyRewards = dailyTracker.onMobKilled(p, kind);
    for (const r of dailyRewards) {
      this.awardXp(p, r.xp);
      const client = this.clients.find((c) => c.sessionId === p.id);
      client?.send("quest-complete", { questId: r.questId, isDaily: true });
    }

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
      p.skillPoints += r.newLevels * SKILL_POINTS_PER_LEVEL;
      // Effective stats didn't change on level-up, but a full refill still feels
      // right. Recompute first so cap isn't stale after spending points.
      this.recomputeDerivedStats(p);
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
      const charId = this.playerCharacterId.get(typed.sessionId);
      if (!p || !charId) continue;
      saves.push(
        savePlayerLocation(charId, this.zone.id, { x: p.x, y: p.y, z: p.z }).catch((err) => {
          log.warn({ err, characterId: charId, zoneId: this.zone.id }, "periodic save failed");
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
      const charId = this.playerCharacterId.get(typed.sessionId);
      if (!p || !charId) continue;
      saves.push(
        this.persistProgress(charId, p).catch((err) => {
          log.warn({ err, characterId: charId }, "periodic progress save failed");
        }),
      );
    }
    await Promise.all(saves);
  }

  private async persistProgress(characterId: string, p: Player) {
    const equip: Record<string, string> = {};
    for (const [slot, itemId] of p.equipment) {
      equip[slot] = itemId;
    }
    const quests: Record<string, { status: string; progress: number; goal: number }> = {};
    for (const [id, q] of p.quests) {
      quests[id] = { status: q.status, progress: q.progress, goal: q.goal };
    }
    const skillsEquipped: string[] = [];
    for (const s of p.skillsEquipped) {
      skillsEquipped.push(typeof s === "string" ? s : "");
    }
    while (skillsEquipped.length < SKILLS_EQUIPPED_SIZE) skillsEquipped.push("");
    await saveCharacter({
      characterId,
      level: p.level,
      xp: p.xp,
      equippedItemId: p.equippedItemId,
      gold: p.gold,
      mana: Math.floor(p.mana),
      maxMana: p.maxMana,
      // Persist the raw allocated (base) stats — effective stats are recomputed
      // from base + equipment every join so we never double-apply bonuses.
      strength: p.baseStrength,
      dexterity: p.baseDexterity,
      vitality: p.baseVitality,
      intellect: p.baseIntellect,
      statPoints: p.statPoints,
      equipmentJson: JSON.stringify(equip),
      questsJson: JSON.stringify(quests),
      skillCooldownsJson: "{}",
      skillsEquippedJson: JSON.stringify(skillsEquipped),
      ultimateSkill: p.ultimateSkill,
      skillPoints: p.skillPoints,
      inventory: this.slotsFromPlayer(p),
    });
    await dailyTracker.persistPlayerDailies(characterId, p);
  }

  private parseSkillsEquipped(json: string): ArraySchema<string> {
    try {
      const data = JSON.parse(json) as unknown;
      const out = new ArraySchema<string>();
      if (Array.isArray(data)) {
        for (let i = 0; i < SKILLS_EQUIPPED_SIZE; i++) {
          const v = data[i];
          const id = typeof v === "string" && isSkillId(v) ? v : "";
          out.push(id);
        }
      } else {
        for (let i = 0; i < SKILLS_EQUIPPED_SIZE; i++) out.push("");
      }
      return out;
    } catch {
      return this.buildSkillsEquipped(["", ""]);
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
    for (const [sessionId, p] of this.state.players) {
      if (!p.alive) continue;
      const portalState = this.playerPortal.get(sessionId);
      if (!portalState) continue;
      if (now < portalState.rearmAt) continue;
      for (const portal of portals) {
        const dx = p.x - portal.pos.x;
        const dz = p.z - portal.pos.z;
        if (dx * dx + dz * dz > portal.radius * portal.radius) continue;
        const client = this.clients.find((c) => c.sessionId === sessionId);
        if (portal.minLevel !== undefined && p.level < portal.minLevel) {
          portalState.rearmAt = now + PORTAL_REARM_MS;
          client?.send("portal-locked", { to: portal.to, minLevel: portal.minLevel });
          break;
        }
        portalState.rearmAt = now + PORTAL_REARM_MS;
        if (!client) break;
        const userId = this.playerUserId.get(sessionId);
        const charId = this.playerCharacterId.get(sessionId);
        log.info(
          {
            sessionId,
            userId,
            characterId: charId,
            fromZoneId: this.zone.id,
            toZoneId: portal.to,
            pos: { x: p.x, y: p.y, z: p.z },
          },
          "portal travel triggered",
        );
        if (charId) {
          savePlayerLocation(charId, this.zone.id, { x: p.x, y: p.y, z: p.z }).catch((err) => {
            log.warn({ err, characterId: charId, zoneId: this.zone.id }, "portal save failed");
          });
        }
        this.removeFromParty(sessionId);
        client.send("zone-exit", { to: portal.to });
        break;
      }
    }
  }

  private collectPlayerRefs(): PlayerRef[] {
    const out: PlayerRef[] = [];
    for (const [id, p] of this.state.players) {
      out.push({ id, pos: { x: p.x, y: p.y, z: p.z }, alive: p.alive });
    }
    return out;
  }

  private fireCasterBolt(bolt: CasterBoltEvent): void {
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

  private handleChat(client: Client<unknown, SessionUser>, msg: ChatInbound) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (!msg || typeof msg !== "object") return;
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
    if (userId) {
      insertChat({
        id: entry.id,
        channel: entry.channel,
        fromUserId: userId,
        fromName: entry.from,
        text: entry.text,
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
    if (!senderUserId) return;
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
