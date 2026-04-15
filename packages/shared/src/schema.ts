import { MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") id = "";
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
}

export class GameRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
