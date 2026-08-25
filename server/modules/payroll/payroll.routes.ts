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

export function registerPayrollRoutes(app: Express) {
  app.get("/api/payroll-runs", requireAuth, async (req, res) => {
    const financeRoles = ["super_admin", "hr_admin", "finance"];
    if (!financeRoles.includes(req.currentUser!.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.getPayrollRuns());
  });

  app.post("/api/payroll-runs", requireAuth, async (req, res) => {
    const financeRoles = ["super_admin", "hr_admin", "finance"];
    if (!financeRoles.includes(req.currentUser!.role)) return res.status(403).json({ error: "Access denied" });

    const { month, year } = req.body;
    const existing = await storage.getPayrollRunByMonth(month, year);
    if (existing) return res.status(400).json({ error: "Payroll run already exists for this month" });

    const run = await storage.createPayrollRun({
      month, year, status: "draft", createdBy: req.currentUser!.id,
    });
    await log(req, "CREATE_PAYROLL_RUN", "payroll_run", run.id);
    res.json(run);
  });

  app.post("/api/payroll-runs/:id/compute", requireAuth, async (req, res) => {
    const financeRoles = ["super_admin", "hr_admin", "finance"];
    if (!financeRoles.includes(req.currentUser!.role)) return res.status(403).json({ error: "Access denied" });

    const run = await storage.getPayrollRun(req.params.id);
    if (!run) return res.status(404).json({ error: "Payroll run not found" });
    if (run.status === "locked") return res.status(400).json({ error: "Payroll run is locked" });

    // Get statutory config
    const pfRate = parseFloat(await storage.getStatutoryValue("pf_employee_rate") || "0.12");
    const pfEmployerRate = parseFloat(await storage.getStatutoryValue("pf_employer_rate") || "0.12");
    const esiEmployeeRate = parseFloat(await storage.getStatutoryValue("esi_employee_rate") || "0.0075");
    const esiEmployerRate = parseFloat(await storage.getStatutoryValue("esi_employer_rate") || "0.0325");
    const esiCeiling = parseFloat(await storage.getStatutoryValue("esi_ceiling") || "21000");
    const pfCeiling = parseFloat(await storage.getStatutoryValue("pf_ceiling") || "15000");

    const activeEmps = await storage.getEmployees({ status: "active" });
    const workingDays = getDaysInMonth(run.month, run.year);
    const weekends = countWeekends(run.month, run.year);
    const holidays_ = await storage.getHolidays(run.year);
    const holidayDates = holidays_
      .filter(h => !h.isOptional)
      .map(h => h.date)
      .filter(d => new Date(d).getMonth() + 1 === run.month);
    const effectiveWorkDays = workingDays - weekends - holidayDates.length;

    // Delete existing payslips for this run
    await storage.deletePayslipsByRunId(run.id);

    const payslips_ = [];
    for (const emp of activeEmps) {
      const salary = await storage.getCurrentSalaryStructure(emp.id, `${run.year}-${String(run.month).padStart(2, "0")}-28`);
      if (!salary) continue;

      const attendance = await storage.getAttendanceRecords(emp.id, run.month, run.year);
      const presentDays = attendance.filter(a => ["present", "wfh", "on_duty"].includes(a.status)).length;
      const halfDays = attendance.filter(a => a.status === "half_day").length;
      const effectivePresent = presentDays + (halfDays * 0.5);

      // LOP = effective working days - present days - approved leave days
      const approvedLeaveDays = attendance.filter(a => a.status === "leave").length;
      const lopDays = Math.max(0, effectiveWorkDays - effectivePresent - approvedLeaveDays);

      const basicMonthly = parseFloat(salary.basicSalary.toString());
      const lopDeduction = lopDays > 0 ? (basicMonthly / effectiveWorkDays) * lopDays : 0;

      const grossEarnings = {
        basic: basicMonthly,
        hra: parseFloat(salary.hra?.toString() || "0"),
        specialAllowance: parseFloat(salary.specialAllowance?.toString() || "0"),
        conveyanceAllowance: parseFloat(salary.conveyanceAllowance?.toString() || "0"),
        medicalAllowance: parseFloat(salary.medicalAllowance?.toString() || "0"),
        otherAllowances: parseFloat(salary.otherAllowances?.toString() || "0"),
      };
      const grossSalary = Object.values(grossEarnings).reduce((a, b) => a + b, 0) - lopDeduction;

      // PF on basic capped at 15000
      const pfBase = Math.min(basicMonthly, pfCeiling);
      const pfEmp = emp.pfEligible ? pfBase * pfRate : 0;
      const pfEmplr = emp.pfEligible ? pfBase * pfEmployerRate : 0;

      // ESI if gross <= ceiling
      const esiEmp = emp.esiEligible && grossSalary <= esiCeiling ? grossSalary * esiEmployeeRate : 0;
      const esiEmplr = emp.esiEligible && grossSalary <= esiCeiling ? grossSalary * esiEmployerRate : 0;

      // PT (simplified Maharashtra slab)
      let pt = 0;
      if (grossSalary > 10000) pt = 200;

      const totalDeductions = pfEmp + esiEmp + pt + lopDeduction;
      const netPay = grossSalary - totalDeductions;

      const slip = await storage.createPayslip({
        payrollRunId: run.id,
        employeeId: emp.id,
        month: run.month,
        year: run.year,
        totalWorkingDays: effectiveWorkDays,
        presentDays: String(effectivePresent),
        lopDays: String(lopDays),
        basicSalary: String(grossEarnings.basic),
        hra: String(grossEarnings.hra),
        specialAllowance: String(grossEarnings.specialAllowance),
        conveyanceAllowance: String(grossEarnings.conveyanceAllowance),
        medicalAllowance: String(grossEarnings.medicalAllowance),
        otherAllowances: String(grossEarnings.otherAllowances),
        bonus: "0",
        grossSalary: String(grossSalary),
        pfEmployee: String(pfEmp),
        pfEmployer: String(pfEmplr),
        esiEmployee: String(esiEmp),
        esiEmployer: String(esiEmplr),
        professionalTax: String(pt),
        tds: "0",
        loanRecovery: "0",
        otherDeductions: "0",
        lopDeduction: String(lopDeduction),
        totalDeductions: String(totalDeductions),
        netPay: String(netPay),
        adjustments: [],
      });
      payslips_.push(slip);
    }

    // Update run totals
    const totalGross = payslips_.reduce((a, b) => a + parseFloat(b.grossSalary?.toString() || "0"), 0);
    const totalDeductions = payslips_.reduce((a, b) => a + parseFloat(b.totalDeductions?.toString() || "0"), 0);
    const totalNet = payslips_.reduce((a, b) => a + parseFloat(b.netPay?.toString() || "0"), 0);

    const updatedRun = await storage.updatePayrollRun(run.id, {
      status: "review",
      totalEmployees: payslips_.length,
      totalGross: String(totalGross),
      totalDeductions: String(totalDeductions),
      totalNetPay: String(totalNet),
    });

    await log(req, "COMPUTE_PAYROLL", "payroll_run", run.id, null, { employees: payslips_.length });
    res.json({ run: updatedRun, payslips: payslips_ });
  });

  app.post("/api/payroll-runs/:id/lock", requireAuth, async (req, res) => {
    const adminRoles = ["super_admin", "hr_admin"];
    if (!adminRoles.includes(req.currentUser!.role)) return res.status(403).json({ error: "Access denied" });
    const run = await storage.getPayrollRun(req.params.id);
    if (!run) return res.status(404).json({ error: "Not found" });
    if (run.status === "locked") return res.status(400).json({ error: "Already locked" });

    const updated = await storage.updatePayrollRun(run.id, {
      status: "locked",
      lockedBy: req.currentUser!.id,
      lockedAt: new Date(),
    });
    await log(req, "LOCK_PAYROLL", "payroll_run", run.id);

    try {
      const monthLabel = new Date(run.year, run.month - 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      const ceoUsers = (await storage.getAllUsers()).filter((u: any) => ["ceo_approver", "super_admin"].includes(u.role));
      for (const ceo of ceoUsers) {
        await storage.createNotification({
          userId: ceo.id,
          type: "approval_pending",
          title: `Payroll Locked — ${monthLabel}`,
          body: `The ${monthLabel} payroll run has been locked and is pending your review/approval before disbursement.`,
          link: "/payroll",
        });
      }
    } catch {}

    res.json(updated);
  });

  app.post("/api/payroll-runs/:id/unlock", requireAuth, async (req, res) => {
    if (req.currentUser!.role !== "super_admin") return res.status(403).json({ error: "Super admin only" });
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "Reason required to unlock payroll" });
    const updated = await storage.updatePayrollRun(req.params.id, {
      status: "review",
      unlockReason: reason,
    });
    await log(req, "UNLOCK_PAYROLL", "payroll_run", req.params.id, null, null, reason);
    res.json(updated);
  });

  app.get("/api/payroll-runs/:id/payslips", requireAuth, async (req, res) => {
    const financeRoles = ["super_admin", "hr_admin", "finance"];
    if (!financeRoles.includes(req.currentUser!.role)) return res.status(403).json({ error: "Access denied" });
    res.json(await storage.getPayslips(req.params.id));
  });

  app.get("/api/payslips/me", requireAuth, async (req, res) => {
    const empId = req.currentUser!.employeeId;
    if (!empId) return res.json([]);
    await log(req, "VIEW_PAYSLIP", "payslip", empId);
    res.json(await storage.getEmployeePayslips(empId));
  });

  app.get("/api/payslips/employee/:employeeId", requireAuth, async (req, res) => {
    const allowedRoles = ["super_admin", "hr_admin", "finance"];
    if (!allowedRoles.includes(req.currentUser!.role) && req.currentUser!.employeeId !== req.params.employeeId) {
      return res.status(403).json({ error: "Access denied" });
    }
    await log(req, "VIEW_PAYSLIP", "payslip", req.params.employeeId);
    res.json(await storage.getEmployeePayslips(req.params.employeeId));
  });

  app.put("/api/payslips/:id", requireAuth, async (req, res) => {
    const financeRoles = ["super_admin", "hr_admin", "finance"];
    if (!financeRoles.includes(req.currentUser!.role)) return res.status(403).json({ error: "Access denied" });
    const { id, createdAt, updatedAt, ...safe } = req.body;
    res.json(await storage.updatePayslip(req.params.id, safe));
  });

  // ===== STATUTORY CONFIG =====
  app.get("/api/statutory-config", requireAuth, requireAdmin, async (req, res) => {
    res.json(await storage.getStatutoryConfig());
  });

  app.put("/api/statutory-config", requireAuth, requireAdmin, async (req, res) => {
    const { key, value, description } = req.body;
    await storage.setStatutoryConfig(key, value, description);
    await log(req, "UPDATE_STATUTORY_CONFIG", "statutory_config", key);
    res.json({ success: true });
  });

  // ===== ANNOUNCEMENTS =====
}
