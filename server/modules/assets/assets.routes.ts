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
import {
  insertEmployeeSchema, insertDepartmentSchema, insertDesignationSchema,
  insertSalaryStructureSchema, insertAttendanceSchema, insertRegularizationSchema,
  insertLeaveTypeSchema, insertLeaveRequestSchema, insertHolidaySchema,
  insertPayrollRunSchema, insertAnnouncementSchema, insertAssetSchema,
  insertRatingScaleSchema, insertPerformanceCycleSchema, insertGoalSchema,
  insertGoalProgressSchema, insertReviewSchema, insertCalibrationSchema,
  insertShiftSchema, insertShiftAssignmentSchema, insertOnboardingTemplateSchema, insertOnboardingTaskSchema,
} from "@shared/schema";

export function registerAssetRoutes(app: Express) {
  app.get("/api/assets", requireAuth, async (req, res) => {
    // HR/managers may query any employee or the full list; everyone else sees only their own assets.
    const privileged = ["super_admin", "hr_admin", "hr_executive", "manager"].includes(req.currentUser!.role);
    if (privileged) return res.json(await storage.getAssets(req.query.employeeId as string));
    const own = req.currentUser!.employeeId;
    if (!own) return res.json([]);
    res.json(await storage.getAssets(own));
  });

  app.post("/api/assets", requireAuth, requireHR, async (req, res) => {
    const parsed = insertAssetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createAsset(parsed.data));
  });

  app.put("/api/assets/:id", requireAuth, requireHR, async (req, res) => {
    const old = await storage.getAssets();
    const asset = old.find(a => a.id === req.params.id);
    const updated = await storage.updateAsset(req.params.id, req.body);
    await log(req, "UPDATE_ASSET", "asset", req.params.id, asset, updated);
    res.json(updated);
  });

  app.delete("/api/assets/:id", requireAuth, requireHR, async (req, res) => {
    const assetList = await storage.getAssets();
    const asset = assetList.find(a => a.id === req.params.id);
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    await storage.deleteAsset(req.params.id);
    await log(req, "DELETE_ASSET", "asset", req.params.id, asset, null);
    res.json({ success: true });
  });

  // ===== AUDIT LOGS =====
}
