import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const inputHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === inputHash;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  req.realRole = user.role;
  // TEMPORARY: dev-only role impersonation. A super_admin can preview the app as
  // any role via the header role switcher. Ignored in production.
  if (
    process.env.NODE_ENV !== "production" &&
    req.session.devRole &&
    user.role === "super_admin"
  ) {
    req.currentUser = { ...user, role: req.session.devRole as typeof user.role };
  } else {
    req.currentUser = user;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.currentUser.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

export function requireHR(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser) return res.status(401).json({ error: "Not authenticated" });
  const hrRoles = ["super_admin", "hr_admin", "hr_executive"];
  if (!hrRoles.includes(req.currentUser.role)) {
    return res.status(403).json({ error: "HR access required" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser) return res.status(401).json({ error: "Not authenticated" });
  const adminRoles = ["super_admin", "hr_admin"];
  if (!adminRoles.includes(req.currentUser.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    devRole?: string; // TEMPORARY: dev-only role impersonation
  }
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: typeof users.$inferSelect;
      realRole?: string; // actual DB role, before any dev impersonation override
    }
  }
}
