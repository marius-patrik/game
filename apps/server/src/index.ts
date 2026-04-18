import { BunWebSockets } from "@colyseus/bun-websockets";
import { matchMaker, Server } from "@colyseus/core";
import { monitor } from "@colyseus/monitor";
import { desc } from "drizzle-orm";
import express from "express";
import {
  DEFAULT_MUTE_DURATION_MS,
  kickSession,
  muteSession,
  resolveUserIdForSession,
  revokeUserSessions,
} from "./adminCommands";
import charactersRouter from "./api/characters";
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

app.use("/api/characters", charactersRouter);

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

function pickSessionId(raw: string | string[] | undefined): string | undefined {
  if (typeof raw === "string" && raw.length > 0) return raw;
  return undefined;
}

app.post("/admin/api/sessions/:sessionId/kick", requireAdmin(), async (req, res) => {
  const sessionId = pickSessionId(req.params.sessionId);
  if (!sessionId) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  try {
    const result = await kickSession(sessionId);
    if (!result.ok) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    res.json({ ok: true, roomId: result.roomId });
  } catch (err) {
    log.warn({ err, sessionId }, "admin kick failed");
    res.status(500).json({ error: "kick failed" });
  }
});

app.post("/admin/api/sessions/:sessionId/mute", requireAdmin(), async (req, res) => {
  const sessionId = pickSessionId(req.params.sessionId);
  if (!sessionId) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  const body = (req.body ?? {}) as { durationMs?: number };
  const duration =
    typeof body.durationMs === "number" && Number.isFinite(body.durationMs) && body.durationMs > 0
      ? Math.min(body.durationMs, 24 * 60 * 60 * 1000)
      : DEFAULT_MUTE_DURATION_MS;
  try {
    const result = await muteSession(sessionId, duration);
    if (!result.ok) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    res.json({ ok: true, roomId: result.roomId, durationMs: duration });
  } catch (err) {
    log.warn({ err, sessionId }, "admin mute failed");
    res.status(500).json({ error: "mute failed" });
  }
});

app.post("/admin/api/sessions/:sessionId/revoke", requireAdmin(), async (req, res) => {
  const sessionId = pickSessionId(req.params.sessionId);
  if (!sessionId) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  try {
    const userId = await resolveUserIdForSession(sessionId);
    if (!userId) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    const removed = await revokeUserSessions(userId);
    // Best-effort kick so the player's live Colyseus socket disconnects; DB
    // revocation alone only blocks *next* reconnect.
    const kicked = await kickSession(sessionId);
    res.json({ ok: true, userId, removedSessions: removed, kicked: kicked.ok });
  } catch (err) {
    log.warn({ err, sessionId }, "admin revoke failed");
    res.status(500).json({ error: "revoke failed" });
  }
});

app.use("/colyseus", monitor());

mountStatic(app);

await gameServer.listen(PORT);

log.info({ port: PORT, embeddedClient: hasEmbeddedClient() }, "game server ready");
