import type { Application } from "express";
import { embedded } from "./embedded";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function mimeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  return MIME[path.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

const RESERVED_PREFIXES = ["/api/", "/admin/api/", "/colyseus", "/matchmake"];
const RESERVED_EXACT = new Set(["/health"]);

function isReserved(path: string): boolean {
  if (RESERVED_EXACT.has(path)) return true;
  return RESERVED_PREFIXES.some((p) => path === p || path.startsWith(p));
}

export function hasEmbeddedClient(): boolean {
  return Object.keys(embedded).length > 0;
}

export function mountStatic(app: Application) {
  if (!hasEmbeddedClient()) return;

  app.get(/^\/.*/, async (req, res, next) => {
    if (isReserved(req.path)) return next();

    const key = req.path === "/" ? "/index.html" : req.path;
    let filepath = embedded[key];
    let servedKey = key;

    if (!filepath) {
      // SPA fallback: serve index.html only for extensionless paths so
      // missing assets still 404 cleanly.
      const lastSlash = key.lastIndexOf("/");
      const looksLikeAsset = key.slice(lastSlash + 1).includes(".");
      if (!looksLikeAsset) {
        filepath = embedded["/index.html"];
        servedKey = "/index.html";
      }
    }

    if (!filepath) return next();

    const file = Bun.file(filepath);
    if (!(await file.exists())) return next();

    res.setHeader("Content-Type", mimeFor(servedKey));
    if (servedKey === "/index.html") {
      res.setHeader("Cache-Control", "no-cache");
    } else {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    res.send(Buffer.from(await file.arrayBuffer()));
  });
}
