import type { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db, pool } from "../../db";
import { storage } from "../../storage";
import { eq } from "drizzle-orm";
import { users, roleEnum } from "@shared/schema";
import {
  requireAuth, requireHR, requireAdmin, requireRole,
  requireWorkspace, requireCEO, requireLogistics, requireTeamHandler,
  hasRole, hashPassword, verifyPassword,
} from "../../shared/auth";
import { log, hashToken } from "../../shared/audit";
import { getDaysInMonth, countWeekends } from "../../shared/date-utils";
import { sanitizeEmployeeForRole } from "../../utils/sanitize";
import { googleStart, googleCallback, logout as googleLogout } from "../../google-auth";

export function registerTeamRequestsRoutes(app: Express) {
  app.get("/api/team-requests", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    const emp = await storage.getEmployeeByUserId(user.id);
    if (!emp) return res.status(404).json({ error: "Employee profile not found" });

    const MANAGER_ROLES = ["super_admin", "hr_admin", "manager", "hr_executive", "hr_ops"];
    if (!MANAGER_ROLES.includes(user.role)) return res.status(403).json({ error: "Manager access required" });

    const teamEmps = await storage.getEmployeesByManager(emp.id);
    const userIds = (teamEmps as any[]).map((e: any) => e.userId).filter(Boolean);

    if (userIds.length === 0) return res.json({ purchases: [], travels: [], tickets: [] });

    const [allPRs, allTRs, allTickets] = await Promise.all([
      Promise.all(userIds.map((uid: string) => storage.getMyPurchaseRequests(uid))),
      Promise.all(userIds.map((uid: string) => storage.getMyTravelRequests(uid))),
      Promise.all(userIds.map((uid: string) => storage.getMyTickets(uid))),
    ]);

    res.json({
      purchases: allPRs.flat().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      travels: allTRs.flat().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      tickets: allTickets.flat().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      teamMembers: teamEmps,
    });
  });

}
