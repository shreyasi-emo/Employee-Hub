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

export function registerWorkspaceHrTasksRoutes(app: Express) {
  app.get("/api/workspace/hr-tasks", requireAuth, requireWorkspace, async (req, res) => {
    const { assignedTo, status } = req.query;
    res.json(await storage.getHrTasks(assignedTo as string, status as string));
  });
  app.post("/api/workspace/hr-tasks", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.createHrTask({ ...req.body, createdBy: req.currentUser!.id }));
  });
  app.put("/api/workspace/hr-tasks/:id", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.updateHrTask(req.params.id, req.body));
  });
  app.delete("/api/workspace/hr-tasks/:id", requireAuth, requireWorkspace, async (req, res) => {
    await storage.deleteHrTask(req.params.id);
    res.json({ success: true });
  });

}
