import { Server } from "@colyseus/core";
import { BunWebSockets } from "@colyseus/bun-websockets";
import { monitor } from "@colyseus/monitor";
import pino from "pino";
import { GameRoom } from "./rooms/GameRoom";

const log = pino({ transport: { target: "pino-pretty" } });

const PORT = Number(process.env.PORT ?? 2567);

const transport = new BunWebSockets({});

const gameServer = new Server({ transport });

gameServer.define("game", GameRoom);

// biome-ignore lint/suspicious/noExplicitAny: BunWebSockets exposes a Hono-like `.app` at runtime
const app = (transport as any).app;

if (app?.get) {
  app.get("/health", () => new Response("ok"));
  app.use("/colyseus", monitor());
}

await gameServer.listen(PORT);

log.info({ port: PORT }, "game server ready");
