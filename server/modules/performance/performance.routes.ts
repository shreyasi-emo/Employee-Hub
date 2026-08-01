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

export function registerPerformanceRoutes(app: Express) {
  app.get("/api/performance/rating-scales", requireAuth, async (req, res) => {
    res.json(await storage.getRatingScales());
  });

  app.post("/api/performance/rating-scales", requireAuth, requireHR, async (req, res) => {
    const parsed = insertRatingScaleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const s = await storage.createRatingScale(parsed.data);
    await log(req, "CREATE_RATING_SCALE", "rating_scale", s.id, null, s);
    res.json(s);
  });

  app.patch("/api/performance/rating-scales/:id", requireAuth, requireHR, async (req, res) => {
    const s = await storage.updateRatingScale(req.params.id, req.body);
    res.json(s);
  });

  // ===== PERFORMANCE: CYCLES =====
  app.get("/api/performance/cycles", requireAuth, async (req, res) => {
    res.json(await storage.getPerformanceCycles());
  });

  app.get("/api/performance/cycles/:id", requireAuth, async (req, res) => {
    const c = await storage.getPerformanceCycle(req.params.id);
    if (!c) return res.status(404).json({ error: "Cycle not found" });
    res.json(c);
  });

  app.post("/api/performance/cycles", requireAuth, requireHR, async (req, res) => {
    const parsed = insertPerformanceCycleSchema.safeParse({ ...req.body, createdBy: req.currentUser?.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const c = await storage.createPerformanceCycle(parsed.data);
    await log(req, "CREATE_PERFORMANCE_CYCLE", "performance_cycle", c.id, null, c);
    res.json(c);
  });

  app.patch("/api/performance/cycles/:id", requireAuth, requireHR, async (req, res) => {
    const old = await storage.getPerformanceCycle(req.params.id);
    const c = await storage.updatePerformanceCycle(req.params.id, req.body);
    if (req.body.status && old?.status !== req.body.status) {
      await log(req, "UPDATE_CYCLE_STATUS", "performance_cycle", c.id, { status: old?.status }, { status: c.status }, req.body.reason);
    }
    res.json(c);
  });

  // ===== PERFORMANCE: GOALS =====
  app.get("/api/performance/goals", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    const { cycleId, employeeId } = req.query;
    let empId = employeeId as string | undefined;

    if (user.role === "employee" && user.employeeId) {
      empId = user.employeeId;
    } else if (user.role === "manager" && !empId) {
      // manager sees their direct reports
    }

    const gs = await storage.getGoals(cycleId as string, empId);
    res.json(gs);
  });

  app.post("/api/performance/goals", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    const employeeId = req.body.employeeId || user.employeeId;
    if (!employeeId) return res.status(400).json({ error: "Employee ID required" });

    const cycle = await storage.getPerformanceCycle(req.body.cycleId);
    if (!cycle) return res.status(404).json({ error: "Cycle not found" });
    if (cycle.status === "locked" || cycle.status === "archived") {
      return res.status(403).json({ error: "Cannot add goals to a locked/archived cycle" });
    }

    const parsed = insertGoalSchema.safeParse({ ...req.body, employeeId, createdBy: user.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const g = await storage.createGoal(parsed.data);
    res.json(g);
  });

  app.patch("/api/performance/goals/:id", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    const old = await storage.getGoal(req.params.id);
    if (!old) return res.status(404).json({ error: "Goal not found" });

    if (old.isLocked && user.role !== "super_admin" && user.role !== "hr_admin") {
      return res.status(403).json({ error: "Goal is locked" });
    }

    const updates: any = { ...req.body };
    if (req.body.isApproved === true && !old.isApproved) {
      updates.approvedBy = user.id;
      updates.approvedAt = new Date();
      await log(req, "APPROVE_GOAL", "goal", old.id, { isApproved: false }, { isApproved: true });
    }
    if (req.body.isApproved !== undefined && old.isApproved && !req.body.isApproved) {
      await log(req, "UNAPPROVE_GOAL", "goal", old.id, null, null, req.body.reason);
    }

    const g = await storage.updateGoal(req.params.id, updates);
    res.json(g);
  });

  app.delete("/api/performance/goals/:id", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    const g = await storage.getGoal(req.params.id);
    if (!g) return res.status(404).json({ error: "Goal not found" });
    if (g.isLocked || g.isApproved) {
      if (user.role !== "super_admin" && user.role !== "hr_admin") {
        return res.status(403).json({ error: "Cannot delete approved/locked goal" });
      }
    }
    await storage.deleteGoal(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/performance/goals/:id/progress", requireAuth, async (req, res) => {
    res.json(await storage.getGoalProgressUpdates(req.params.id));
  });

  app.post("/api/performance/goals/:id/progress", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    const g = await storage.getGoal(req.params.id);
    if (!g) return res.status(404).json({ error: "Goal not found" });
    const p = await storage.addGoalProgress({
      goalId: req.params.id,
      progressValue: req.body.progressValue,
      note: req.body.note,
      updatedBy: user.id,
    });
    res.json(p);
  });

  // ===== PERFORMANCE: REVIEWS =====
  app.get("/api/performance/reviews/:cycleId", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    if (user.role === "super_admin" || user.role === "hr_admin" || user.role === "hr_executive") {
      return res.json(await storage.getReviewsByCycle(req.params.cycleId));
    }
    const empId = user.employeeId;
    if (!empId) return res.json([]);
    const r = await storage.getReview(req.params.cycleId, empId);
    res.json(r ? [r] : []);
  });

  app.get("/api/performance/reviews/:cycleId/:employeeId", requireAuth, async (req, res) => {
    const r = await storage.getReview(req.params.cycleId, req.params.employeeId);
    res.json(r || null);
  });

  app.put("/api/performance/reviews/:cycleId/:employeeId", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    const { cycleId, employeeId } = req.params;

    const cycle = await storage.getPerformanceCycle(cycleId);
    if (!cycle) return res.status(404).json({ error: "Cycle not found" });

    const existing = await storage.getReview(cycleId, employeeId);
    if (existing?.status === "hr_locked" || existing?.status === "finalized") {
      if (user.role !== "super_admin" && user.role !== "hr_admin") {
        return res.status(403).json({ error: "Review is locked" });
      }
      if (req.body.unlock) {
        await log(req, "UNLOCK_REVIEW", "review", existing.id, { status: existing.status }, null, req.body.reason);
      }
    }

    const updates: any = { ...req.body };
    delete updates.unlock;

    if (req.body.selfReview && user.employeeId === employeeId) {
      updates.status = "self_submitted";
    }
    if (req.body.managerReview) {
      await log(req, "SUBMIT_MANAGER_REVIEW", "review", existing?.id, null, { cycleId, employeeId });
      updates.status = "manager_submitted";
    }
    if (req.body.status === "hr_locked" || req.body.status === "finalized") {
      await log(req, "LOCK_REVIEW", "review", existing?.id, { status: existing?.status }, { status: req.body.status });
    }
    if (req.body.finalOutcome) {
      await log(req, "SET_FINAL_OUTCOME", "review", existing?.id, null, req.body.finalOutcome, req.body.reason);
    }

    const r = await storage.upsertReview(cycleId, employeeId, updates);
    res.json(r);
  });

  // ===== PERFORMANCE: CALIBRATION =====
  app.get("/api/performance/calibration/:cycleId", requireAuth, requireHR, async (req, res) => {
    res.json(await storage.getCalibrationSessions(req.params.cycleId));
  });

  app.post("/api/performance/calibration/:cycleId", requireAuth, requireHR, async (req, res) => {
    const s = await storage.createCalibrationSession({ ...req.body, cycleId: req.params.cycleId });
    await log(req, "CREATE_CALIBRATION_SESSION", "calibration", s.id, null, s);
    res.json(s);
  });

  app.patch("/api/performance/calibration/:id", requireAuth, requireHR, async (req, res) => {
    const old = await storage.getCalibrationSession(req.params.id);
    const updates: any = { ...req.body };
    if (req.body.status === "locked" && old?.status !== "locked") {
      updates.lockedBy = req.currentUser?.id;
      updates.lockedAt = new Date();
      await log(req, "LOCK_CALIBRATION", "calibration", req.params.id, { status: old?.status }, { status: "locked" });
    }
    const s = await storage.updateCalibrationSession(req.params.id, updates);
    res.json(s);
  });

  // ===== NOTIFICATIONS =====
  // ===== PERFORMANCE: REPORTS =====
  app.get("/api/performance/reports/distribution/:cycleId", requireAuth, requireHR, async (req, res) => {
    const { cycleId } = req.params;
    const reviewList = await storage.getReviewsByCycle(cycleId);
    const dist: Record<string, number> = {};
    for (const r of reviewList) {
      const outcome = r.finalOutcome as any;
      if (outcome?.finalRating) {
        dist[outcome.finalRating] = (dist[outcome.finalRating] || 0) + 1;
      }
    }
    const goalList = await storage.getGoals(cycleId);
    const goalStats = {
      total: goalList.length,
      completed: goalList.filter(g => g.status === "completed").length,
      onTrack: goalList.filter(g => g.status === "on_track").length,
      atRisk: goalList.filter(g => g.status === "at_risk").length,
      offTrack: goalList.filter(g => g.status === "off_track").length,
    };
    res.json({ ratingDistribution: dist, goalStats, totalReviews: reviewList.length });
  });

}
