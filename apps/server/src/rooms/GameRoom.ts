import { type AuthContext, type Client, Room, matchMaker } from "@colyseus/core";
import { ArraySchema } from "@colyseus/schema";
import {
  CHAT_MAX_LEN,
  type ChatEntry,
  type ChatError,
  type ChatInbound,
  DEFAULT_ZONE,
  GameRoomState,
  InventorySlot,
  type ItemId,
  Player,
  type Vec3,
  WorldDrop,
  type Zone,
  applyXp,
  getItem,
  getZone,
  isChatChannel,
  isItemId,
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

type MoveMessage = { x: number; y: number; z: number };
type UseMessage = { itemId: string };
type EquipMessage = { itemId: string };
type PickupMessage = { dropId: string };
type DropMessage = { itemId: string; qty: number };
type JoinOptions = { token?: string; zoneId?: string };
export type SessionUser = { id: string; name: string; role: string };

type PlayerSecurityState = { lastPos: Vec3; lastMoveAt: number };
type PlayerCombatState = { invulnerableUntil: number };

const SAVE_INTERVAL_MS = 10_000;
const LOOT_SPAWN_INTERVAL_MS = 5_000;

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
  private playerUserId = new Map<string, string>();
  private saveInterval?: ReturnType<typeof setInterval>;
  private lootInterval?: ReturnType<typeof setInterval>;
  private dropCounter = 0;
  private chatCounter = 0;

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

    this.onMessage<MoveMessage>("move", (client, msg) => {
      this.handleMove(client, msg);
    });
    this.onMessage("attack", (client) => {
      this.handleAttack(client);
    });
    this.onMessage<PickupMessage>("pickup", (client, msg) => {
      this.handlePickup(client, msg);
    });
    this.onMessage<UseMessage>("use", (client, msg) => {
      this.handleUse(client, msg);
    });
    this.onMessage<EquipMessage>("equip", (client, msg) => {
      this.handleEquip(client, msg);
    });
    this.onMessage<DropMessage>("drop", (client, msg) => {
      this.handleDrop(client, msg);
    });
    this.onMessage<ChatInbound>("chat", (client, msg) => {
      this.handleChat(client, msg);
    });

    this.setSimulationInterval((dt) => this.tick(dt), 1000 / 20);
    this.saveInterval = setInterval(() => this.flushAllProgress(), SAVE_INTERVAL_MS);
    this.lootInterval = setInterval(() => this.tickLootSpawns(), LOOT_SPAWN_INTERVAL_MS);
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
        } else {
          p.xpToNext = xpToNextLevel(1);
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
      }
    } else {
      p.xpToNext = xpToNextLevel(1);
    }

    p.x = spawn.x;
    p.y = spawn.y;
    p.z = spawn.z;
    p.hp = this.combat.maxHp;
    p.maxHp = this.combat.maxHp;
    p.alive = true;
    this.state.players.set(client.sessionId, p);
    this.playerSec.set(client.sessionId, {
      lastPos: { x: p.x, y: p.y, z: p.z },
      lastMoveAt: Date.now(),
    });
    this.playerCombat.set(client.sessionId, {
      invulnerableUntil: Date.now() + this.combat.invulnerableAfterRespawnMs,
    });
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
    this.playerUserId.delete(client.sessionId);
    this.rateLimiter.forget(client.sessionId);
    this.violations.forget(client.sessionId);
  }

  override async onDispose() {
    if (this.saveInterval) clearInterval(this.saveInterval);
    if (this.lootInterval) clearInterval(this.lootInterval);
    await this.flushAllPositions();
    await this.flushAllProgress();
  }

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

    if (!result.ok) {
      this.recordViolation(client, p, `movement:${result.reason}`);
    }
  }

  private handleAttack(client: Client<unknown, SessionUser>) {
    const attacker = this.state.players.get(client.sessionId);
    if (!attacker || !attacker.alive) return;

    if (!this.rateLimiter.consume(client.sessionId, "attack")) {
      this.recordViolation(client, attacker, "rate_limit:attack");
      return;
    }

    const candidates: Combatant[] = [];
    this.state.players.forEach((p, id) => {
      candidates.push({ id, pos: { x: p.x, y: p.y, z: p.z }, alive: p.alive, hp: p.hp });
    });
    const attackerC: Combatant = {
      id: client.sessionId,
      pos: { x: attacker.x, y: attacker.y, z: attacker.z },
      alive: attacker.alive,
      hp: attacker.hp,
    };
    const bonus = this.damageBonusFor(attacker);
    const cfg: CombatConfig = { ...this.combat, attackDamage: this.combat.attackDamage + bonus };
    const result = resolveAttack(attackerC, candidates, cfg);
    if (!result.ok) return;

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
    });
  }

  private damageBonusFor(p: Player): number {
    if (!p.equippedItemId) return 0;
    const def = getItem(p.equippedItemId);
    if (!def || def.kind !== "weapon") return 0;
    if (countItem(this.slotsFromPlayer(p), p.equippedItemId) <= 0) return 0;
    return def.damageBonus ?? 0;
  }

  private slotsFromPlayer(p: Player): Slot[] {
    const out: Slot[] = [];
    for (const s of p.inventory) {
      out.push({ itemId: s.itemId, qty: s.qty });
    }
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

    if (def.healAmount) {
      p.hp = Math.min(p.maxHp, p.hp + def.healAmount);
    }
    client.send("used", { itemId, hp: p.hp });
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

  private awardXp(p: Player, amount: number) {
    const r = applyXp(p.level, p.xp, amount);
    p.level = r.level;
    p.xp = r.xp;
    p.xpToNext = r.xpToNext;
    if (r.leveledUp) {
      p.maxHp = this.combat.maxHp + (r.level - 1) * 10;
      p.hp = p.maxHp;
    }
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
    await saveProgress({
      userId,
      level: p.level,
      xp: p.xp,
      equippedItemId: p.equippedItemId,
      inventory: this.slotsFromPlayer(p),
    });
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

  private tick(_dt: number) {
    // 20Hz server tick
  }

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
