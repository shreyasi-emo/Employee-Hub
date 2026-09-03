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
import { insertAnnouncementSchema } from "@shared/schema";

export function registerAnnouncementRoutes(app: Express) {
  app.get("/api/announcements", requireAuth, async (req, res) => {
    res.json(await storage.getAnnouncements());
  });

  app.post("/api/announcements", requireAuth, requireHR, async (req, res) => {
    const body: any = { ...req.body, publishedBy: req.currentUser!.id };
    if (body.expiresAt) { try { body.expiresAt = new Date(body.expiresAt); } catch { delete body.expiresAt; } }
    const parsed = insertAnnouncementSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid announcement data: " + Object.entries(parsed.error.flatten().fieldErrors).map(([f, e]) => `${f}: ${(e as string[]).join(", ")}`).join("; ") });
    const ann = await storage.createAnnouncement(parsed.data);
    try {
      const recipients = (await storage.getAllUsers()).filter((u: any) => u.isActive && u.id !== req.currentUser!.id);
      for (const u of recipients) await storage.notifyUser(u.id, { type: "announcement_posted", title: "New Announcement", body: ann.title, link: "/announcements" });
    } catch {}
    res.json(ann);
  });

  app.delete("/api/announcements/:id", requireAuth, requireHR, async (req, res) => {
    await storage.deleteAnnouncement(req.params.id);
    res.json({ success: true });
  });

  // ===== ASSETS =====
}
