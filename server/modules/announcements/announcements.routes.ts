import type { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db, pool } from "../../db";
import { storage } from "../../storage";
import { eq } from "drizzle-orm";
import { users, roleEnum, employees, COMMUNITY_REACTIONS } from "@shared/schema";
import {
  requireAuth, requireHR, requireAdmin, requireRole,
  requireWorkspace, requireCEO, requireLogistics, requireTeamHandler,
  hasRole, hashPassword, verifyPassword,
} from "../../shared/auth";
import { log, hashToken } from "../../shared/audit";
import { getDaysInMonth, countWeekends } from "../../shared/date-utils";
import { sanitizeEmployeeForRole } from "../../utils/sanitize";
import { googleStart, googleCallback, logout as googleLogout } from "../../google-auth";
import {
  insertEmployeeSchema, insertDepartmentSchema, insertDesignationSchema,
  insertSalaryStructureSchema, insertAttendanceSchema, insertRegularizationSchema,
  insertLeaveTypeSchema, insertLeaveRequestSchema, insertHolidaySchema,
  insertPayrollRunSchema, insertAnnouncementSchema, insertAssetSchema,
  insertRatingScaleSchema, insertPerformanceCycleSchema, insertGoalSchema,
  insertGoalProgressSchema, insertReviewSchema, insertCalibrationSchema,
  insertShiftSchema, insertShiftAssignmentSchema, insertOnboardingTemplateSchema, insertOnboardingTaskSchema,
} from "@shared/schema";

export function registerAnnouncementRoutes(app: Express) {
  app.get("/api/announcements", requireAuth, async (req, res) => {
    res.json(await storage.getAnnouncements());
  });

  // Create an announcement OR a community post (same table, distinguished by `kind`). Permission differs:
  // announcements = HR only; community = HR OR an individually-granted user (users.canPostCommunity).
  app.post("/api/announcements", requireAuth, async (req, res) => {
    const kind = req.body?.kind === "community" ? "community" : "announcement";
    const isHrRole = hasRole(req, "super_admin", "hr_admin", "hr_executive");
    if (kind === "community") {
      if (!(isHrRole || (req.currentUser as any).canPostCommunity)) return res.status(403).json({ error: "Community posting not allowed" });
    } else if (!isHrRole) {
      return res.status(403).json({ error: "HR access required" });
    }
    const body: any = { ...req.body, kind, publishedBy: req.currentUser!.id };
    if (body.expiresAt) { try { body.expiresAt = new Date(body.expiresAt); } catch { delete body.expiresAt; } }
    const parsed = insertAnnouncementSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid announcement data: " + Object.entries(parsed.error.flatten().fieldErrors).map(([f, e]) => `${f}: ${(e as string[]).join(", ")}`).join("; ") });
    const ann = await storage.createAnnouncement(parsed.data);
    // Announcements notify everyone; community posts are pull-only (viewed on the Community tab) to avoid noise.
    if (kind !== "community") {
      try {
        const recipients = (await storage.getAllUsers()).filter((u: any) => u.isActive && u.id !== req.currentUser!.id);
        for (const u of recipients) await storage.notifyUser(u.id, { type: "announcement_posted", title: "New Announcement", body: ann.title, link: "/announcements" });
      } catch {}
    }
    res.json(ann);
  });

  // Take down a post — HR/Admin can remove any; a community author may remove their own.
  app.delete("/api/announcements/:id", requireAuth, async (req, res) => {
    const id = String(req.params.id);
    const ann = await storage.getAnnouncement(id);
    if (!ann) return res.status(404).json({ error: "Not found" });
    const isHrRole = hasRole(req, "super_admin", "hr_admin", "hr_executive");
    if (!isHrRole && ann.publishedBy !== req.currentUser!.id) return res.status(403).json({ error: "Not allowed to remove this post" });
    await storage.deleteAnnouncement(id);
    res.json({ success: true });
  });

  // Toggle a basic reaction (fixed emoji set) on a post — any authenticated employee.
  app.post("/api/announcements/:id/react", requireAuth, async (req, res) => {
    const emoji = String(req.body?.emoji || "");
    if (!(COMMUNITY_REACTIONS as readonly string[]).includes(emoji)) return res.status(400).json({ error: "Invalid reaction" });
    const updated = await storage.toggleAnnouncementReaction(String(req.params.id), req.currentUser!.id, emoji);
    if (!updated) return res.status(404).json({ error: "Post not found" });
    res.json(updated);
  });

  // ===== Community posting permission (HR/Admin manage who else may post) =====
  app.get("/api/community/contributors", requireAuth, requireHR, async (_req, res) => {
    const [us, emps] = await Promise.all([storage.getAllUsers(), db.select().from(employees)]);
    const empByUserId = new Map((emps as any[]).filter((e) => e.userId).map((e) => [e.userId, e]));
    const rows = (us as any[])
      .filter((u) => u.isActive)
      .map((u) => {
        const e = empByUserId.get(u.id);
        const alwaysAllowed = ["super_admin", "hr_admin", "hr_executive"].includes(u.role);
        return {
          userId: u.id,
          employeeId: e?.id || u.employeeId || null,
          name: e ? `${e.firstName} ${e.lastName}` : u.username,
          email: e?.email || null,
          role: u.role,
          alwaysAllowed,          // HR/Admin — always allowed, toggle disabled
          granted: !!u.canPostCommunity,
          canPost: alwaysAllowed || !!u.canPostCommunity,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(rows);
  });

  app.patch("/api/community/contributors/:userId", requireAuth, requireHR, async (req, res) => {
    const canPost = !!req.body?.canPost;
    const u = await storage.setUserCommunityPermission(String(req.params.userId), canPost);
    if (!u) return res.status(404).json({ error: "User not found" });
    res.json({ userId: u.id, granted: !!u.canPostCommunity });
  });

  // ===== ASSETS =====
}
