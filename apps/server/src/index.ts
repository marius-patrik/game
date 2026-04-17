import { BunWebSockets } from "@colyseus/bun-websockets";
import { Server, matchMaker } from "@colyseus/core";
import { monitor } from "@colyseus/monitor";
import { desc } from "drizzle-orm";
import express from "express";
import { auth } from "./auth";
import { db } from "./db/client";
import { runMigrations } from "./db/migrate";
import { user as userTable } from "./db/schema";
import { log } from "./logger";
import { requireAdmin } from "./middleware/auth";
import { GameRoom } from "./rooms/GameRoom";
import { hasEmbeddedClient, mountStatic } from "./static/serve";

await runMigrations();

const PORT = Number(process.env.PORT ?? 2567);

const transport = new BunWebSockets({});
const gameServer = new Server({ transport });

gameServer.define("zone", GameRoom).filterBy(["zoneId"]);

const app = transport.expressApp;

const trustedOrigins = new Set([
  "http://localhost:3000",
  ...(process.env.TRUSTED_ORIGINS?.split(",").filter(Boolean) ?? []),
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && trustedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());

app.all("/api/auth/*", async (req, res) => {
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const response = await auth.handler(
    new Request(url, {
      method: req.method,
      headers,
      body: hasBody ? JSON.stringify(req.body) : undefined,
    }),
  );
  res.status(response.status);
  const setCookie = response.headers.getSetCookie();
  if (setCookie.length > 0) res.setHeader("Set-Cookie", setCookie);
  response.headers.forEach((v, k) => {
    if (k.toLowerCase() !== "set-cookie") res.setHeader(k, v);
  });
  res.send(await response.text());
});

app.get("/health", (_req, res) => {
  res.type("text/plain").send("ok");
});

app.get("/admin/api/players", requireAdmin(), async (_req, res) => {
  const rows = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .orderBy(desc(userTable.createdAt))
    .limit(200);
  res.json({ players: rows });
});

app.get("/admin/api/rooms", requireAdmin(), async (_req, res) => {
  const rooms = await matchMaker.query();
  res.json({
    rooms: rooms.map((r) => ({
      roomId: r.roomId,
      name: r.name,
      clients: r.clients,
      maxClients: r.maxClients,
      locked: r.locked,
      createdAt: r.createdAt,
    })),
  });
});

app.get("/admin/api/sessions", requireAdmin(), async (_req, res) => {
  // Cross-reference live Colyseus rooms with the user table so admins see
  // which registered accounts are actually connected right now.
  const rooms = await matchMaker.query({ name: "zone" });
  const users = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
    })
    .from(userTable);
  const userById = new Map(users.map((u) => [u.id, u]));
  const sessions = rooms.flatMap((r) => {
    const meta = (r.metadata as { zoneId?: string; name?: string } | null) ?? {};
    const clientIds = Array.isArray((r as unknown as { clientIds?: string[] }).clientIds)
      ? ((r as unknown as { clientIds?: string[] }).clientIds ?? [])
      : [];
    return {
      roomId: r.roomId,
      zoneId: meta.zoneId ?? "unknown",
      zoneName: meta.name ?? "",
      clients: r.clients,
      clientIds,
    };
  });
  res.json({
    totalRooms: rooms.length,
    totalClients: rooms.reduce((s, r) => s + r.clients, 0),
    registered: users.length,
    sessions,
    registeredById: Object.fromEntries(userById),
  });
});

app.use("/colyseus", monitor());

mountStatic(app);

await gameServer.listen(PORT);

log.info({ port: PORT, embeddedClient: hasEmbeddedClient() }, "game server ready");
