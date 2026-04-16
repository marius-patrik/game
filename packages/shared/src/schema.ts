import { MapSchema, Schema, type } from "@colyseus/schema";

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
}

export class GameRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
