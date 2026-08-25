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

export function registerUserRoutes(app: Express) {
  app.get("/api/users", requireAuth, requireAdmin, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    res.json(allUsers.map(u => ({ ...u, password: undefined })));
  });

  app.get("/api/workspace/users", requireAuth, requireWorkspace, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    const workspaceRoles = ["super_admin", "hr_admin", "hr_executive", "recruiter", "hr_ops", "office_admin", "ceo_approver"];
    res.json(allUsers.filter((u: any) => workspaceRoles.includes(u.role)).map((u: any) => ({ id: u.id, username: u.username, role: u.role })));
  });

  app.put("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
    const { role, isActive } = req.body;
    const old = await storage.getUser(req.params.id);
    if (!old) return res.status(404).json({ error: "Not found" });
    // Only a super_admin may grant or alter the super_admin role, and role must be a known value
    // (mirrors the guard on PUT /api/employees/:id — closes the hr_admin self-promotion path).
    if (role !== undefined) {
      if (!(roleEnum.enumValues as readonly string[]).includes(role)) {
        return res.status(400).json({ error: "Unknown role" });
      }
      const touchingSuperAdmin = role === "super_admin" || old.role === "super_admin";
      if (touchingSuperAdmin && req.currentUser!.role !== "super_admin") {
        return res.status(403).json({ error: "Only a Super Admin can assign or change the Super Admin role." });
      }
    }
    const updated = await storage.updateUser(req.params.id, { role, isActive });
    await log(req, "UPDATE_USER", "user", req.params.id, { role: old?.role }, { role });
    res.json({ ...updated, password: undefined });
  });

  // ===== PERFORMANCE: RATING SCALES =====
}
