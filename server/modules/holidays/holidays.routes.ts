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
import { insertHolidaySchema } from "@shared/schema";

export function registerHolidayRoutes(app: Express) {
  app.get("/api/holidays", requireAuth, async (req, res) => {
    const { year, location } = req.query;
    const y = parseInt(year as string) || new Date().getFullYear();
    res.json(await storage.getHolidays(y, location as string));
  });

  app.post("/api/holidays", requireAuth, requireAdmin, async (req, res) => {
    const parsed = insertHolidaySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createHoliday(parsed.data));
  });

  app.put("/api/holidays/:id", requireAuth, requireAdmin, async (req, res) => {
    res.json(await storage.updateHoliday(req.params.id, req.body));
  });

  app.delete("/api/holidays/:id", requireAuth, requireAdmin, async (req, res) => {
    await storage.deleteHoliday(req.params.id);
    res.json({ success: true });
  });

  // ===== PAYROLL =====
}
