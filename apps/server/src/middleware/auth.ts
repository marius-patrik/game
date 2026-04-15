import type { NextFunction, Request, Response } from "express";
import { auth } from "../auth";

export type SessionUser = { id: string; name: string; email: string; role: string };

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

async function resolveSession(req: Request): Promise<SessionUser | null> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  const u = session.user as { id: string; name: string; email: string; role?: string };
  return { id: u.id, name: u.name, email: u.email, role: u.role ?? "player" };
}

export function requireAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await resolveSession(req);
    if (!user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    req.user = user;
    next();
  };
}

export function requireAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await resolveSession(req);
    if (!user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (user.role !== "admin") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    req.user = user;
    next();
  };
}
