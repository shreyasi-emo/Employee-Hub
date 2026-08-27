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

export function registerEmployeeRoutes(app: Express) {
  app.get("/api/employees/me", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    if (!user.employeeId) return res.status(404).json({ error: "No linked employee record" });
    const emp = await storage.getEmployee(user.employeeId);
    if (!emp) return res.status(404).json({ error: "Employee not found" });
    // Resolve the reporting manager's display name (server-side, so the client never needs the directory).
    let managerName: string | null = null;
    if (emp.managerId) {
      const mgr = await storage.getEmployee(emp.managerId);
      if (mgr) managerName = `${mgr.firstName || ""} ${mgr.lastName || ""}`.trim() || null;
    }
    res.json({ ...emp, managerName });
  });

  app.put("/api/employees/me", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    if (!user.employeeId) return res.status(404).json({ error: "No linked employee record" });
    const allowedFields = ["currentAddress", "permanentAddress", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation", "phone"];
    const updates: any = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    const old = await storage.getEmployee(user.employeeId);
    const emp = await storage.updateEmployee(user.employeeId, updates);
    await log(req, "SELF_UPDATE_PROFILE", "employee", user.employeeId, old, emp);
    res.json(emp);
  });

  // ===== DEPARTMENTS =====
  app.get("/api/departments", requireAuth, async (req, res) => {
    const depts = await storage.getDepartments();
    res.json(depts);
  });

  app.post("/api/departments", requireAuth, requireHR, async (req, res) => {
    const parsed = insertDepartmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const dept = await storage.createDepartment(parsed.data);
    await log(req, "CREATE_DEPARTMENT", "department", dept.id, null, dept);
    res.json(dept);
  });

  app.put("/api/departments/:id", requireAuth, requireHR, async (req, res) => {
    const old = await storage.getDepartment(req.params.id);
    const dept = await storage.updateDepartment(req.params.id, req.body);
    await log(req, "UPDATE_DEPARTMENT", "department", dept.id, old, dept);
    res.json(dept);
  });

  // ===== DESIGNATIONS =====
  app.get("/api/designations", requireAuth, async (req, res) => {
    res.json(await storage.getDesignations());
  });

  app.post("/api/designations", requireAuth, requireHR, async (req, res) => {
    const d = await storage.createDesignation(req.body);
    res.json(d);
  });

  // ===== EMPLOYEES =====
  app.get("/api/employees", requireAuth, async (req, res) => {
    const { status, departmentId, search } = req.query;
    const emps = await storage.getEmployees({
      status: status as string,
      departmentId: departmentId as string,
      search: search as string,
    });
    const viewer = req.currentUser!;
    // Attach the linked user's System Role (feature access) for HR/admin views.
    const canSeeRoles = ["super_admin", "hr_admin", "hr_executive"].includes(viewer.role);
    const roleByEmp = canSeeRoles
      ? new Map((await storage.getAllUsers()).filter(u => u.employeeId).map(u => [u.employeeId, u.role]))
      : null;
    const sanitized = emps.map(e => {
      const s = sanitizeEmployeeForRole(e as any, viewer.role, viewer.employeeId) as any;
      if (roleByEmp) s.systemRole = roleByEmp.get(e.id) ?? null;
      return s;
    });
    res.json(sanitized);
  });

  app.get("/api/employees/:id", requireAuth, async (req, res) => {
    const emp = await storage.getEmployee(req.params.id);
    if (!emp) return res.status(404).json({ error: "Employee not found" });
    const viewer = req.currentUser!;
    const privilegedRoles = ["super_admin", "hr_admin", "hr_executive", "finance", "manager"];
    if (!privilegedRoles.includes(viewer.role) && viewer.employeeId !== emp.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    const out = sanitizeEmployeeForRole(emp as any, viewer.role, viewer.employeeId) as any;
    if (["super_admin", "hr_admin", "hr_executive"].includes(viewer.role)) {
      const linked = (await storage.getAllUsers()).find(u => u.employeeId === emp.id);
      out.systemRole = linked?.role ?? null;
    }
    res.json(out);
  });

  app.post("/api/employees", requireAuth, requireHR, async (req, res) => {
    // Employee code is server-assigned. Generate it BEFORE validation, since
    // employeeCode is a required (notNull) field in insertEmployeeSchema.
    if (!req.body.employeeCode) {
      req.body.employeeCode = await storage.getNextEmployeeCode();
    }

    const parsed = insertEmployeeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const emp = await storage.createEmployee(parsed.data as any);

    // System Role (feature access). Only HR Admin + Super Admin may set it; anyone else always
    // creates the account as "employee". A Super Admin is additionally required to grant super_admin.
    let sysRole: string = (roleEnum.enumValues as readonly string[]).includes(req.body.systemRole) ? req.body.systemRole : "employee";
    if (!hasRole(req, "super_admin", "hr_admin")) sysRole = "employee";
    if (sysRole === "super_admin" && req.currentUser!.role !== "super_admin") sysRole = "employee";

    // Create user account in INVITED state (no password set)
    const username = emp.email.toLowerCase();
    let inviteUrl: string | null = null;
    try {
      const rawInviteToken = crypto.randomBytes(32).toString("hex");
      const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const user = await storage.createUser({
        username,
        password: hashPassword(crypto.randomBytes(32).toString("hex")),
        role: sysRole as any,
        employeeId: emp.id,
        // Active immediately — login is via company Google SSO, no password setup needed.
        accountStatus: "active",
        isActive: true,
        inviteToken: rawInviteToken,
        inviteExpiresAt,
      });
      await storage.updateEmployee(emp.id, { userId: user.id });
      inviteUrl = `/invite/${rawInviteToken}`;
    } catch {}

    // Grant the default annual leave balances (Casual Leave = 12, etc.)
    try { await storage.applyDefaultLeaveBalances(emp.id, new Date().getFullYear()); } catch {}

    // Notify HR/admins of the new joiner
    try {
      const deptName = emp.departmentId ? (await storage.getDepartments()).find((d: any) => d.id === emp.departmentId)?.name : null;
      await storage.notifyByRole(["super_admin", "hr_admin", "hr_executive", "hr_ops"], {
        type: "employee_created", title: "New Employee Added",
        body: `${emp.firstName} ${emp.lastName} (${emp.employeeCode}) joined${deptName ? ` ${deptName}` : ""}.`,
        link: `/employees/${emp.id}`,
      });
    } catch {}

    await log(req, "CREATE_EMPLOYEE", "employee", emp.id, null, { ...emp, panNumber: undefined, aadhaarMasked: undefined });
    res.json({ ...emp, inviteUrl });
  });

  app.put("/api/employees/:id", requireAuth, requireHR, async (req, res) => {
    const old = await storage.getEmployee(req.params.id);
    if (!old) return res.status(404).json({ error: "Not found" });

    // System Role guard: only HR Admin + Super Admin may change a role; only a Super Admin may
    // assign or alter super_admin. Gated on an *actual* change so an HR Executive editing other
    // fields (their payload still echoes the current role) is never blocked.
    const roleProvided = req.body.systemRole && (roleEnum.enumValues as readonly string[]).includes(req.body.systemRole);
    const linkedUser = roleProvided ? (await storage.getAllUsers()).find(u => u.employeeId === req.params.id) : undefined;
    const roleChanging = !!(roleProvided && linkedUser && linkedUser.role !== req.body.systemRole);
    if (roleChanging) {
      if (!hasRole(req, "super_admin", "hr_admin")) {
        return res.status(403).json({ error: "Only an HR Admin or Super Admin can change a system role." });
      }
      const touchingSuperAdmin = req.body.systemRole === "super_admin" || linkedUser!.role === "super_admin";
      if (touchingSuperAdmin && req.currentUser!.role !== "super_admin") {
        return res.status(403).json({ error: "Only a Super Admin can assign or change the Super Admin role." });
      }
    }

    // userId (login-account link) and employeeCode are server-managed; systemRole is a virtual field
    // that lives on the user account (applied below), never a column on employees — strip all of them.
    const { userId, employeeCode, id, createdAt, updatedAt, systemRole, ...safeEmp } = req.body;
    const emp = await storage.updateEmployee(req.params.id, safeEmp);

    // Apply the System Role change to the linked user account.
    if (roleChanging) {
      await storage.updateUser(linkedUser!.id, { role: req.body.systemRole });
      await log(req, "UPDATE_USER_ROLE", "user", linkedUser!.id, { role: linkedUser!.role }, { role: req.body.systemRole });
    }
    await log(req, "UPDATE_EMPLOYEE", "employee", emp.id, { ...old, panNumber: undefined }, { ...emp, panNumber: undefined });

    // Track employment history for key field changes
    const trackedFields: { field: string; label: string }[] = [
      { field: "designationId", label: "designation" },
      { field: "departmentId", label: "department" },
      { field: "managerId", label: "manager" },
      { field: "workLocation", label: "location" },
      { field: "employmentStatus", label: "status" },
    ];
    for (const { field, label } of trackedFields) {
      const oldVal = (old as any)[field];
      const newVal = (emp as any)[field];
      if (oldVal !== newVal) {
        await storage.addEmploymentHistory({
          employeeId: emp.id,
          changeType: label,
          fieldName: field,
          oldValue: oldVal ? String(oldVal) : null,
          newValue: newVal ? String(newVal) : null,
          effectiveDate: new Date().toISOString().split("T")[0],
          changedBy: req.currentUser?.id,
          reason: req.body.reason || null,
        });
      }
    }

    if (req.body.employmentStatus === "exited" && old.employmentStatus !== "exited") {
      const linkedUser = (await storage.getAllUsers()).find(u => u.employeeId === emp.id);
      if (linkedUser) {
        await storage.updateUser(linkedUser.id, { isActive: false, accountStatus: "exited" });
        await log(req, "AUTO_SUSPEND_USER", "user", linkedUser.id, { isActive: true }, { isActive: false, accountStatus: "exited" }, "Auto-suspended on employee exit");
      }
    }
    res.json(emp);
  });

  // ===== SALARY STRUCTURES =====
  app.get("/api/employees/:id/salary", requireAuth, async (req, res) => {
    const allowedRoles = ["super_admin", "hr_admin", "hr_executive", "finance"];
    if (!allowedRoles.includes(req.currentUser!.role) && req.currentUser!.employeeId !== req.params.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    await log(req, "VIEW_SALARY", "salary_structure", req.params.id);
    res.json(await storage.getSalaryStructures(req.params.id));
  });

  app.post("/api/employees/:id/salary", requireAuth, requireAdmin, async (req, res) => {
    const { reason, ...data } = req.body;
    if (!reason) return res.status(400).json({ error: "Reason required for salary changes" });
    const parsed = insertSalaryStructureSchema.safeParse({ ...data, employeeId: req.params.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const salary = await storage.createSalaryStructure({ ...parsed.data, createdBy: req.currentUser!.id });
    await log(req, "UPDATE_SALARY", "salary_structure", salary.id, null, salary, reason);
    res.json(salary);
  });

  // ===== ATTENDANCE =====
  app.get("/api/employees/:id/history", requireAuth, async (req, res) => {
    const allowedRoles = ["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"];
    if (!allowedRoles.includes(req.currentUser!.role) && req.currentUser!.employeeId !== req.params.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.getEmploymentHistory(req.params.id));
  });

  // ===== ONBOARDING =====
}
