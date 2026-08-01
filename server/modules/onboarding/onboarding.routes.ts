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

export function registerOnboardingRoutes(app: Express) {
  app.get("/api/onboarding/templates", requireAuth, requireHR, async (req, res) => {
    res.json(await storage.getOnboardingTemplates());
  });

  app.post("/api/onboarding/templates", requireAuth, requireHR, async (req, res) => {
    const parsed = insertOnboardingTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createOnboardingTemplate(parsed.data));
  });

  app.put("/api/onboarding/templates/:id", requireAuth, requireHR, async (req, res) => {
    res.json(await storage.updateOnboardingTemplate(req.params.id, req.body));
  });

  app.get("/api/onboarding/templates/:id/tasks", requireAuth, requireHR, async (req, res) => {
    res.json(await storage.getOnboardingTasks(req.params.id));
  });

  app.post("/api/onboarding/templates/:id/tasks", requireAuth, requireHR, async (req, res) => {
    const parsed = insertOnboardingTaskSchema.safeParse({ ...req.body, templateId: req.params.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createOnboardingTask(parsed.data));
  });

  app.put("/api/onboarding/tasks/:id", requireAuth, requireHR, async (req, res) => {
    res.json(await storage.updateOnboardingTask(req.params.id, req.body));
  });

  app.delete("/api/onboarding/tasks/:id", requireAuth, requireHR, async (req, res) => {
    await storage.deleteOnboardingTask(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/onboarding/instances", requireAuth, async (req, res) => {
    const hrRoles = ["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"];
    if (hrRoles.includes(req.currentUser!.role)) {
      res.json(await storage.getOnboardingInstances());
    } else {
      res.json(await storage.getOnboardingInstances(req.currentUser!.employeeId || ""));
    }
  });

  app.get("/api/onboarding/instances/:id/tasks", requireAuth, async (req, res) => {
    res.json(await storage.getOnboardingTaskItems(req.params.id));
  });

  app.put("/api/onboarding/task-items/:id", requireAuth, async (req, res) => {
    const { status, notes } = req.body;
    const data: any = { status, notes };
    if (status === "done") {
      data.completedBy = req.currentUser!.id;
      data.completedAt = new Date();
    }
    res.json(await storage.updateOnboardingTaskItem(req.params.id, data));
  });

}
