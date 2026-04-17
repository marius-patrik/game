import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class InventorySlot extends Schema {
  @type("string") itemId = "";
  @type("number") qty = 0;
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
  @type("boolean") alive = true;
  @type("number") level = 1;
  @type("number") xp = 0;
  @type("number") xpToNext = 100;
  @type("string") equippedItemId = "";
  @type([InventorySlot]) inventory = new ArraySchema<InventorySlot>();
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

export class GameRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: WorldDrop }) drops = new MapSchema<WorldDrop>();
  @type({ map: Mob }) mobs = new MapSchema<Mob>();
}
