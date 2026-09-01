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

export function registerShiftRoutes(app: Express) {
  app.get("/api/shifts", requireAuth, async (req, res) => {
    res.json(await storage.getShifts());
  });

  app.post("/api/shifts", requireAuth, requireHR, async (req, res) => {
    const parsed = insertShiftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createShift(parsed.data));
  });

  app.put("/api/shifts/:id", requireAuth, requireHR, async (req, res) => {
    res.json(await storage.updateShift(req.params.id, req.body));
  });

  app.delete("/api/shifts/:id", requireAuth, requireHR, async (req, res) => {
    await storage.deleteShift(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/shift-assignments", requireAuth, async (req, res) => {
    const { employeeId } = req.query;
    const hrRoles = ["super_admin", "hr_admin", "hr_executive", "ceo_approver"];
    if (!hrRoles.includes(req.currentUser!.role) && req.currentUser!.employeeId !== employeeId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.getShiftAssignments(employeeId as string));
  });

  app.post("/api/shift-assignments", requireAuth, requireHR, async (req, res) => {
    const parsed = insertShiftAssignmentSchema.safeParse({ ...req.body, createdBy: req.currentUser!.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createShiftAssignment(parsed.data));
  });

  app.post("/api/shift-assignments/bulk", requireAuth, requireHR, async (req, res) => {
    const { employeeIds, shiftId, effectiveFrom, effectiveTo } = req.body;
    if (!Array.isArray(employeeIds) || !shiftId || !effectiveFrom) {
      return res.status(400).json({ error: "employeeIds, shiftId, effectiveFrom required" });
    }
    const results = await Promise.all(employeeIds.map((employeeId: string) =>
      storage.createShiftAssignment({ employeeId, shiftId, effectiveFrom, effectiveTo: effectiveTo || null, createdBy: req.currentUser!.id })
    ));
    res.json(results);
  });

  app.delete("/api/shift-assignments/:id", requireAuth, requireHR, async (req, res) => {
    await storage.deleteShiftAssignment(req.params.id);
    res.json({ success: true });
  });

  // ===== EMPLOYMENT HISTORY =====
}
