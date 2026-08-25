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

export function registerLeaveRoutes(app: Express) {
  app.get("/api/leave-types", requireAuth, async (req, res) => {
    res.json(await storage.getLeaveTypes());
  });

  app.post("/api/leave-types", requireAuth, requireHR, async (req, res) => {
    const parsed = insertLeaveTypeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createLeaveType(parsed.data));
  });

  app.put("/api/leave-types/:id", requireAuth, requireHR, async (req, res) => {
    res.json(await storage.updateLeaveType(req.params.id, req.body));
  });

  // ===== LEAVE BALANCES =====
  app.get("/api/leave-balances", requireAuth, async (req, res) => {
    const { employeeId, year } = req.query;
    // Only HR/managers may read another employee's balances; everyone else is forced to their own.
    const privileged = hasRole(req, "super_admin", "hr_admin", "hr_executive", "manager");
    const empId = (privileged && employeeId) ? (employeeId as string) : (req.currentUser!.employeeId || "");
    if (!empId) return res.status(400).json({ error: "Employee ID required" });
    const y = parseInt(year as string) || new Date().getFullYear();
    res.json(await storage.getLeaveBalances(empId, y));
  });

  app.put("/api/leave-balances/adjust", requireAuth, requireHR, async (req, res) => {
    const { employeeId, leaveTypeId, year, adjustment, reason } = req.body;
    if (!reason) return res.status(400).json({ error: "Reason required for leave balance adjustments" });
    const bal = await storage.getLeaveBalance(employeeId, leaveTypeId, year);
    const currentBalance = parseFloat(bal?.closingBalance?.toString() || "0");
    const newBalance = currentBalance + parseFloat(adjustment);
    await storage.upsertLeaveBalance({
      employeeId, leaveTypeId, year,
      openingBalance: bal?.openingBalance?.toString() || "0",
      accrued: bal?.accrued?.toString() || "0",
      taken: bal?.taken?.toString() || "0",
      adjusted: String(parseFloat(bal?.adjusted?.toString() || "0") + parseFloat(adjustment)),
      closingBalance: String(newBalance),
    });
    await storage.addLeaveLedgerEntry({
      employeeId, leaveTypeId,
      transactionType: "adjustment",
      days: String(adjustment),
      balanceAfter: String(newBalance),
      notes: reason,
      createdBy: req.currentUser!.id,
    });
    await log(req, "LEAVE_BALANCE_ADJUST", "leave_balance", employeeId, { balance: currentBalance }, { balance: newBalance }, reason);
    res.json({ success: true, newBalance });
  });

  // ===== LEAVE REQUESTS =====
  app.get("/api/leave-requests", requireAuth, async (req, res) => {
    const { employeeId, status } = req.query;
    const hrRoles = ["super_admin", "hr_admin", "hr_executive"];
    const managerRoles = ["manager"];

    if (hrRoles.includes(req.currentUser!.role)) {
      res.json(await storage.getLeaveRequests(employeeId as string, status as string));
    } else if (managerRoles.includes(req.currentUser!.role)) {
      const empId = req.currentUser!.employeeId;
      if (empId) {
        const teamReqs = await storage.getTeamLeaveRequests(empId);
        res.json(teamReqs);
      } else {
        res.json([]);
      }
    } else {
      res.json(await storage.getLeaveRequests(req.currentUser!.employeeId || undefined, status as string));
    }
  });

  app.post("/api/leave-requests", requireAuth, async (req, res) => {
    // Only HR may file on another employee's behalf; everyone else files for themselves.
    const empId = (hasRole(req, "super_admin", "hr_admin", "hr_executive") && req.body.employeeId) ? req.body.employeeId : req.currentUser!.employeeId;
    if (!empId) return res.status(400).json({ error: "Employee ID required" });

    // Check balance
    const { leaveTypeId, totalDays, year } = req.body;
    const balance = await storage.getLeaveBalance(empId, leaveTypeId, year || new Date().getFullYear());
    const available = parseFloat(balance?.closingBalance?.toString() || "0");
    const requested = parseFloat(totalDays);

    const leaveType = (await storage.getLeaveTypes()).find(lt => lt.id === leaveTypeId);
    if (leaveType?.isPaid && available < requested) {
      return res.status(400).json({ error: `Insufficient leave balance. Available: ${available} days, Requested: ${requested} days` });
    }

    const parsed = insertLeaveRequestSchema.safeParse({ ...req.body, employeeId: empId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    // Server owns the workflow state — never trust a client-sent status/approver (auto-approve below handles within-24h).
    const request = await storage.createLeaveRequest({ ...parsed.data, status: "pending" } as any);

    // Auto-approve immediately if the leave starts within 24h (mirrors WFH). Balance was just
    // checked above, so sufficiency holds.
    const startMs = new Date(`${request.startDate}T00:00:00`).getTime();
    const autoApprove = startMs - 24 * 60 * 60 * 1000 <= Date.now();
    let finalReq: any = request;
    if (autoApprove) {
      finalReq = await storage.updateLeaveRequest(request.id, { status: "approved" as any, approvalNotes: "Auto-approved (starts within 24h)" });
      await storage.deductLeaveOnApproval(request);
    }

    // Notify manager + HR (+ the employee if it was auto-approved)
    try {
      const employee = await storage.getEmployee(empId);
      const who = employee ? `${employee.firstName} ${employee.lastName}` : "An employee";
      const range = `${request.startDate} to ${request.endDate}`;
      if (autoApprove) {
        const u = (await storage.getAllUsers()).find((x) => x.employeeId === empId);
        if (u) await storage.createNotification({ userId: u.id, type: "leave_approved", title: "Leave auto-approved", body: `Your leave (${range}) was auto-approved — it starts within 24h.`, link: "/leave" });
      }
      const body = `${who} ${autoApprove ? "took" : "applied for"} leave (${leaveType?.name || "leave"}) ${range}`;
      const payload = { type: "leave_applied", title: autoApprove ? "Leave (auto-approved)" : "Leave Request", body, link: "/leave" };
      if (employee?.managerId) await storage.notifyEmployee(employee.managerId, payload);
      await storage.notifyByRole(["hr_admin", "hr_executive"], payload);
    } catch {}

    res.json(finalReq);
  });

  app.put("/api/leave-requests/:id", requireAuth, async (req, res) => {
    const { status, approvalNotes, reason } = req.body;
    const leaveReq = await storage.getLeaveRequest(req.params.id);
    if (!leaveReq) return res.status(404).json({ error: "Not found" });

    const viewer = req.currentUser!;
    const isSelf = viewer.employeeId === leaveReq.employeeId;

    if (status === "cancelled" && !isSelf) {
      return res.status(403).json({ error: "Can only cancel own requests" });
    }
    // Approval/rejection is the employee's direct manager or a Super Admin only.
    // HR and CEO are notified and can view, but cannot action leave requests.
    if (["approved", "rejected"].includes(status)) {
      let canDecide = viewer.role === "super_admin";
      if (!canDecide && viewer.role === "manager" && viewer.employeeId) {
        const directReports = await storage.getEmployeesByManager(viewer.employeeId);
        canDecide = directReports.some(e => e.id === leaveReq.employeeId);
      }
      if (!canDecide) return res.status(403).json({ error: "Only the employee's manager or a Super Admin can decide this request." });
      // Don't let an approval push a paid balance negative (create-time guard can be stale).
      if (status === "approved" && !(await storage.isLeaveBalanceSufficient(leaveReq))) {
        return res.status(400).json({ error: "Not enough leave balance to approve this request." });
      }
    }

    const updated = await storage.updateLeaveRequest(req.params.id, {
      status,
      approvalNotes,
      approvedBy: ["approved", "rejected"].includes(status) ? req.currentUser!.id : undefined,
    });

    // Deduct balance + write the ledger on approval.
    if (status === "approved") {
      await storage.deductLeaveOnApproval(leaveReq, req.currentUser!.id);
    }

    // Notify employee of decision
    if (["approved", "rejected"].includes(status)) {
      try {
        const emp = await storage.getEmployee(leaveReq.employeeId);
        const empUser = emp ? (await storage.getAllUsers()).find(u => u.employeeId === emp.id) : null;
        if (empUser) {
          await storage.createNotification({
            userId: empUser.id,
            type: `leave_${status}`,
            title: `Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            body: `Your leave request from ${leaveReq.startDate} to ${leaveReq.endDate} has been ${status}.${approvalNotes ? ` Note: ${approvalNotes}` : ""}`,
            link: "/leave",
          });
        }
      } catch {}
    }

    res.json(updated);
  });

  // End an approved leave from today (employee coming back early). Trims the tail — or cancels the
  // whole leave if today is its start — and restores the balance for the un-taken days.
  app.post("/api/leave-requests/:id/end", requireAuth, async (req, res) => {
    const lr = await storage.getLeaveRequest(req.params.id);
    if (!lr) return res.status(404).json({ error: "Not found" });
    if (req.currentUser!.employeeId !== lr.employeeId) return res.status(403).json({ error: "You can only end your own leave." });
    if (lr.status !== "approved") return res.status(400).json({ error: "Only an approved leave can be ended." });
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (todayStr > lr.endDate) return res.status(400).json({ error: "This leave has already ended." });
    // Working days being given back: from max(today, start) .. endDate inclusive.
    const fromStr = todayStr < lr.startDate ? lr.startDate : todayStr;
    let restore = 0;
    for (let d = new Date(`${fromStr}T00:00:00`), e = new Date(`${lr.endDate}T00:00:00`); d <= e; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay(); if (wd !== 0 && wd !== 6) restore++;
    }
    // New end = day before `fromStr`. If that's before the start, the whole leave is cancelled.
    const dayBefore = new Date(`${fromStr}T00:00:00`); dayBefore.setDate(dayBefore.getDate() - 1);
    const newEnd = `${dayBefore.getFullYear()}-${pad(dayBefore.getMonth() + 1)}-${pad(dayBefore.getDate())}`;
    const cancelWhole = newEnd < lr.startDate;
    const total = parseFloat(lr.totalDays.toString());
    // Cap restore to what was actually deducted; whole-cancel restores everything.
    const restoreDays = cancelWhole ? total : Math.min(restore, total);
    if (cancelWhole) await storage.updateLeaveRequest(lr.id, { status: "cancelled" as any, totalDays: "0" as any });
    else await storage.updateLeaveRequest(lr.id, { endDate: newEnd, totalDays: String(Math.max(0, total - restoreDays)) as any });
    if (restoreDays > 0) {
      const year = new Date(lr.startDate).getFullYear();
      const bal = await storage.getLeaveBalance(lr.employeeId, lr.leaveTypeId, year);
      const newClosing = parseFloat(bal?.closingBalance?.toString() || "0") + restoreDays;
      await storage.upsertLeaveBalance({
        employeeId: lr.employeeId, leaveTypeId: lr.leaveTypeId, year,
        openingBalance: bal?.openingBalance?.toString() || "0",
        accrued: bal?.accrued?.toString() || "0",
        taken: String(Math.max(0, parseFloat(bal?.taken?.toString() || "0") - restoreDays)),
        adjusted: bal?.adjusted?.toString() || "0",
        closingBalance: String(newClosing),
      } as any);
      await storage.addLeaveLedgerEntry({ employeeId: lr.employeeId, leaveTypeId: lr.leaveTypeId, transactionType: "adjustment", days: String(restoreDays), balanceAfter: String(newClosing), referenceId: lr.id, notes: `Leave ${lr.id} ended early — ${restoreDays}d returned` } as any);
    }
    await log(req, "END_LEAVE", "leave_request", lr.id, lr, { endedAt: todayStr, restoreDays });
    res.json({ ok: true, restoreDays, cancelled: cancelWhole });
  });

  // ===== LEAVE LEDGER =====
  app.get("/api/leave-ledger", requireAuth, async (req, res) => {
    const { employeeId, leaveTypeId } = req.query;
    // Only HR/managers may read another employee's ledger; everyone else is forced to their own.
    const privileged = hasRole(req, "super_admin", "hr_admin", "hr_executive", "manager");
    const empId = (privileged && employeeId) ? (employeeId as string) : (req.currentUser!.employeeId || "");
    if (!empId) return res.status(400).json({ error: "Employee ID required" });
    res.json(await storage.getLeaveLedger(empId, leaveTypeId as string));
  });

  // ===== HOLIDAYS =====
}
