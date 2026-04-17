import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class InventorySlot extends Schema {
  @type("string") itemId = "";
  @type("number") qty = 0;
}

export class QuestProgress extends Schema {
  @type("string") id = "";
  @type("string") status = "active"; // "active" | "complete" | "turned_in"
  @type("number") progress = 0;
  @type("number") goal = 0;
}

export class Player extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") violations = 0;
  @type("number") hp = 100;
  @type("number") maxHp = 100;
  @type("number") mana = 50;
  @type("number") maxMana = 50;
  @type("boolean") alive = true;
  @type("number") level = 1;
  @type("number") xp = 0;
  @type("number") xpToNext = 100;
  @type("number") gold = 0;
  @type("number") strength = 5;
  @type("number") dexterity = 5;
  @type("number") vitality = 5;
  @type("number") intellect = 5;
  @type("number") statPoints = 0;
  @type("string") equippedItemId = "";
  @type("string") partyId = "";
  @type({ map: "string" }) equipment = new MapSchema<string>();
  @type([InventorySlot]) inventory = new ArraySchema<InventorySlot>();
  @type({ map: QuestProgress }) quests = new MapSchema<QuestProgress>();
}

export class WorldDrop extends Schema {
  @type("string") id = "";
  @type("string") itemId = "";
  @type("number") qty = 0;
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
}

export class Mob extends Schema {
  @type("string") id = "";
  @type("string") kind = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") hp = 0;
  @type("number") maxHp = 0;
  @type("boolean") alive = true;
}

export class Npc extends Schema {
  @type("string") id = "";
  @type("string") kind = ""; // "vendor" | "questgiver"
  @type("string") name = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
}

export class HazardZone extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") radius = 0;
  @type("number") dps = 0;
}

export class GameRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: WorldDrop }) drops = new MapSchema<WorldDrop>();
  @type({ map: Mob }) mobs = new MapSchema<Mob>();
  @type({ map: Npc }) npcs = new MapSchema<Npc>();
  @type({ map: HazardZone }) hazards = new MapSchema<HazardZone>();
}
