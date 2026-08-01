// Shared authentication & role-based access control (RBAC).
//
// Single source of truth for every route guard in the app. Previously these
// were scattered across server/auth.ts (base guards) and inline copies inside
// routes.ts (requireWorkspace/requireCEO) and routes-v2.ts
// (requireLogistics/requireTeamHandler/requireCEO). They are consolidated here.
import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// ===== Password hashing (scrypt) =====
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

// ===== Base auth =====
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

// ===== Role helpers & guards =====
/** True when the current (post-impersonation) user holds any of the given roles. */
export function hasRole(req: Request, ...roles: string[]): boolean {
  return !!req.currentUser && roles.includes(req.currentUser.role);
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

// HR/Admin Workspace access (ATS, office admin, approvals inbox).
const WORKSPACE_ROLES = ["super_admin", "hr_admin", "hr_executive", "recruiter", "hr_ops", "office_admin", "ceo_approver"];
export function requireWorkspace(req: Request, res: Response, next: NextFunction) {
  if (!WORKSPACE_ROLES.includes(req.currentUser?.role as string)) {
    return res.status(403).json({ error: "Workspace access denied" });
  }
  next();
}

// Final CEO/super-admin approval authority.
const CEO_ROLES = ["super_admin", "ceo_approver"];
export function requireCEO(req: Request, res: Response, next: NextFunction) {
  if (!CEO_ROLES.includes(req.currentUser?.role as string)) {
    return res.status(403).json({ error: "CEO/Admin access required" });
  }
  next();
}

// Logistics movement handlers.
export function requireLogistics(req: Request, res: Response, next: NextFunction) {
  if (hasRole(req, "super_admin", "logistics", "hr_admin")) return next();
  return res.status(403).json({ error: "Logistics access required" });
}

// Teams that handle unified service requests: HR, Admin, Logistics, Finance, IT.
export function requireTeamHandler(req: Request, res: Response, next: NextFunction) {
  if (hasRole(req, "super_admin", "hr_admin", "hr_executive", "hr_ops", "office_admin", "logistics", "finance")) return next();
  return res.status(403).json({ error: "Team handler access required" });
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
