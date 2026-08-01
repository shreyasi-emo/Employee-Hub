import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import crypto from "crypto";
import { pool } from "./db";
import { storage } from "./storage";
import { hashPassword, verifyPassword, requireAuth, requireHR, requireAdmin, requireRole } from "./auth";
import { registerV2Routes } from "./routes-v2";
import { googleStart, googleCallback, logout as googleLogout } from "./google-auth";

import { sanitizeEmployeeForRole } from "./utils/sanitize";
import { db } from "./db";
import { users, roleEnum } from "@shared/schema";
import {
  insertEmployeeSchema, insertDepartmentSchema, insertDesignationSchema,
  insertSalaryStructureSchema, insertAttendanceSchema, insertRegularizationSchema,
  insertLeaveTypeSchema, insertLeaveRequestSchema, insertHolidaySchema,
  insertPayrollRunSchema, insertAnnouncementSchema, insertAssetSchema,
  insertRatingScaleSchema, insertPerformanceCycleSchema, insertGoalSchema,
  insertGoalProgressSchema, insertReviewSchema, insertCalibrationSchema,
  insertShiftSchema, insertShiftAssignmentSchema, insertOnboardingTemplateSchema, insertOnboardingTaskSchema,
} from "@shared/schema";

const PgSession = connectPgSimple(session);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function log(req: Request, action: string, entityType: string, entityId?: string, oldVal?: any, newVal?: any, reason?: string) {
  try {
    await storage.addAuditLog({
      userId: req.currentUser?.id,
      employeeId: req.currentUser?.employeeId ?? undefined,
      action,
      entityType,
      entityId,
      oldValue: oldVal,
      newValue: newVal,
      reason,
      ipAddress: req.ip,
    });
  } catch {}
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Session
  app.use(session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "emo-hris-secret-2024",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  }));

  // ===== HEALTH =====
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });
  // ===== GOOGLE SSO (the only login method) =====
  app.get("/api/auth/google", googleStart);
  app.get("/api/auth/google/callback", googleCallback);
  app.post("/api/auth/logout", googleLogout);

  // TEMPORARY: Bypassed Google SSO for local UI development
  // Accepts any email with the password "password" and establishes a real
  // session (so the rest of the app works normally). Disabled in production.
  // REMOVE this endpoint before deploying.
  app.post("/api/auth/dev-login", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Not found" });
    }
    const { email, password } = req.body ?? {};
    if (password !== "password") {
      return res.status(401).json({ error: 'Local dev login requires the password "password".' });
    }
    // Prefer a user matching the entered email/username; otherwise fall back to
    // the seeded super admin, then to any existing user.
    let user = email ? await storage.getUserByUsernameOrEmail(email) : null;
    if (!user) user = await storage.getUserByUsername("superadmin");
    if (!user) {
      const [first] = await db.select().from(users).limit(1);
      user = first ?? null;
    }
    if (!user) {
      return res.status(500).json({ error: "No users found. Seed the database first." });
    }
    // Dev convenience: activate the impersonated account so requireAuth accepts it
    // (newly created / invited employees are inactive until they log in via SSO).
    if (!user.isActive || user.accountStatus !== "active") {
      user = await storage.updateUser(user.id, { isActive: true, accountStatus: "active" });
    }
    req.session.userId = user.id;
    res.json({ user: { ...user, password: undefined } });
  });

  // ===== v2 ROUTES (logistics, vehicles, reimbursements, requests, approvals, ref-docs, zoho) =====
  registerV2Routes(app);


  // ===== BOOTSTRAP (first-admin creation, one-time only) =====
  app.post("/api/auth/bootstrap", async (req, res) => {
    const bootstrapToken = process.env.BOOTSTRAP_TOKEN;
    if (!bootstrapToken) {
      return res.status(404).json({ error: "Not found" });
    }
    if (req.headers["x-bootstrap-token"] !== bootstrapToken) {
      return res.status(401).json({ error: "Invalid bootstrap token" });
    }
    const existing = await db.select().from(users).limit(1);
    if (existing.length > 0) {
      return res.status(403).json({ error: "Bootstrap already completed" });
    }
    const { username, password } = req.body;
    if (!username || !password || password.length < 8) {
      return res.status(400).json({ error: "username and password (min 8 chars) required" });
    }
    const user = await storage.createUser({
      username: username.toLowerCase().trim(),
      password: hashPassword(password),
      role: "hr_admin",
    });
    console.log(`[BOOTSTRAP] First admin created: ${user.username}`);
    res.json({ success: true, userId: user.id });
  });

  // ===== AUTH =====
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const user = await storage.getUserByUsernameOrEmail(username);
    if (!user || !user.password || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (!user.isActive) return res.status(403).json({ error: "Account disabled" });
    req.session.userId = user.id;
    await storage.updateUser(user.id, { lastLogin: new Date() });
    await log(req, "LOGIN", "user", user.id);
    res.json({ user: { ...user, password: undefined } });
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    await log(req, "LOGOUT", "user", req.currentUser?.id);
    req.session.destroy(() => res.json({ success: true }));
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    let employee = null;
    if (user.employeeId) {
      employee = await storage.getEmployee(user.employeeId);
    }
    // realRole / devRole power the dev-only role switcher (see /api/auth/dev-role)
    res.json({
      user: { ...user, password: undefined },
      employee,
      realRole: req.realRole,
      devRole: req.session.devRole ?? null,
    });
  });

  // TEMPORARY: dev-only role impersonation. Lets a super_admin preview the app as
  // any role from the header switcher. Pass { role } to impersonate, or
  // { role: "reset" } to return to the real role. Disabled in production.
  app.post("/api/auth/dev-role", requireAuth, async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Not found" });
    }
    if (req.realRole !== "super_admin") {
      return res.status(403).json({ error: "Only super_admin can switch roles" });
    }
    const { role } = req.body ?? {};
    if (!role || role === "reset") {
      delete req.session.devRole;
      return res.json({ ok: true, devRole: null });
    }
    if (!roleEnum.enumValues.includes(role)) {
      return res.status(400).json({ error: "Unknown role" });
    }
    req.session.devRole = role;
    res.json({ ok: true, devRole: role });
  });

  app.put("/api/auth/change-password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await storage.getUser(req.currentUser!.id);
    if (!user || !verifyPassword(currentPassword, user.password)) {
      return res.status(400).json({ error: "Current password incorrect" });
    }
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    await storage.updateUser(user.id, { password: hashPassword(newPassword) });
    await log(req, "CHANGE_PASSWORD", "user", user.id);
    res.json({ success: true });
  });

  // ===== INVITE FLOW =====
  app.post("/api/auth/invite", requireAuth, requireAdmin, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await storage.updateUser(userId, {
      inviteToken: token,
      inviteExpiresAt: expiresAt,
      accountStatus: "invited",
      isActive: false,
    });
    await log(req, "SEND_INVITE", "user", userId, null, { userId }, "Invite sent by admin");
    const inviteUrl = `/invite/${token}`;
    res.json({ inviteUrl, token, expiresAt });
  });

  app.get("/api/auth/invite/:token", async (req, res) => {
    const user = await storage.getUserByInviteToken(req.params.token);
    if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired invite link" });
    }
    let emp = null;
    if (user.employeeId) emp = await storage.getEmployee(user.employeeId);
    res.json({ username: user.username, employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null });
  });

  app.post("/api/auth/accept-invite", async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and password required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const user = await storage.getUserByInviteToken(token);
    if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired invite link" });
    }
    await storage.updateUser(user.id, {
      password: hashPassword(password),
      inviteToken: null,
      inviteExpiresAt: null,
      accountStatus: "active",
      isActive: true,
    });
    await log(req, "ACCEPT_INVITE", "user", user.id);
    res.json({ success: true });
  });

  // ===== FORGOT / RESET PASSWORD =====
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { username, email } = req.body;
    const identifier = (username || email || "").trim();
    if (!identifier) return res.status(400).json({ error: "Username or email required" });
    const user = await storage.getUserByUsernameOrEmail(identifier);
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      await storage.updateUser(user.id, { resetToken: hashToken(rawToken), resetExpiresAt: expiresAt });
    }
    res.json({ success: true });
  });

  app.get("/api/auth/reset-token/:token", async (req, res) => {
    const user = await storage.getUserByResetToken(hashToken(req.params.token));
    if (!user || !user.resetExpiresAt || user.resetExpiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }
    res.json({ username: user.username });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and password required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const user = await storage.getUserByResetToken(hashToken(token));
    if (!user || !user.resetExpiresAt || user.resetExpiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }
    await storage.updateUser(user.id, {
      password: hashPassword(password),
      resetToken: null,
      resetExpiresAt: null,
    });
    await log(req, "RESET_PASSWORD", "user", user.id);
    res.json({ success: true });
  });

  // ===== EMPLOYEE SELF-SERVICE =====
  app.get("/api/employees/me", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    if (!user.employeeId) return res.status(404).json({ error: "No linked employee record" });
    const emp = await storage.getEmployee(user.employeeId);
    if (!emp) return res.status(404).json({ error: "Employee not found" });
    res.json(emp);
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
    const sanitized = emps.map(e => sanitizeEmployeeForRole(e as any, viewer.role, viewer.employeeId));
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
    res.json(sanitizeEmployeeForRole(emp as any, viewer.role, viewer.employeeId));
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

    // Create user account in INVITED state (no password set)
    const username = emp.email.toLowerCase();
    let inviteUrl: string | null = null;
    try {
      const rawInviteToken = crypto.randomBytes(32).toString("hex");
      const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const user = await storage.createUser({
        username,
        password: hashPassword(crypto.randomBytes(32).toString("hex")),
        role: "employee",
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
    const emp = await storage.updateEmployee(req.params.id, req.body);
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
  app.get("/api/attendance", requireAuth, async (req, res) => {
    const { employeeId, month, year } = req.query;
    const empId = (employeeId as string) || req.currentUser!.employeeId || "";
    if (!empId) return res.status(400).json({ error: "Employee ID required" });
    const m = parseInt(month as string) || new Date().getMonth() + 1;
    const y = parseInt(year as string) || new Date().getFullYear();

    // Check access
    const allowedRoles = ["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"];
    if (!allowedRoles.includes(req.currentUser!.role) && req.currentUser!.employeeId !== empId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const records = visibleAttendance(await storage.getAttendanceRecords(empId, m, y));
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const to = `${y}-${String(m).padStart(2, "0")}-${String(getDaysInMonth(m, y)).padStart(2, "0")}`;
    const leaves = await storage.getApprovedLeavesInRange(from, to, empId);
    const existing = new Set(records.map((r: any) => `${r.employeeId}|${r.date}`));
    res.json([...records, ...expandApprovedLeaveDays(leaves, from, to, existing)]);
  });

  // Org-wide monthly attendance (for summaries / side panel). HR/manager only.
  app.get("/api/attendance/month", requireAuth, async (req, res) => {
    if (!["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"].includes(req.currentUser!.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const m = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const y = parseInt(req.query.year as string) || new Date().getFullYear();
    const records = visibleAttendance(await storage.getMonthlyAttendance(m, y));
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const to = `${y}-${String(m).padStart(2, "0")}-${String(getDaysInMonth(m, y)).padStart(2, "0")}`;
    const leaves = await storage.getApprovedLeavesInRange(from, to);
    const existing = new Set(records.map((r: any) => `${r.employeeId}|${r.date}`));
    res.json([...records, ...expandApprovedLeaveDays(leaves, from, to, existing)]);
  });

  // Org-wide attendance within a date range. HR/manager only.
  app.get("/api/attendance/range", requireAuth, async (req, res) => {
    if (!["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"].includes(req.currentUser!.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });
    const records = visibleAttendance(await storage.getAttendanceInRange(from as string, to as string));
    const leaves = await storage.getApprovedLeavesInRange(from as string, to as string);
    const existing = new Set(records.map((r: any) => `${r.employeeId}|${r.date}`));
    res.json([...records, ...expandApprovedLeaveDays(leaves, from as string, to as string, existing)]);
  });

  app.post("/api/attendance", requireAuth, requireHR, async (req, res) => {
    const parsed = insertAttendanceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { reason } = req.body;
    if (parsed.data.source === "admin_override" && !reason) {
      return res.status(400).json({ error: "Reason required for admin override" });
    }

    const rec = await storage.upsertAttendance({
      ...parsed.data,
      overrideBy: parsed.data.source === "admin_override" ? req.currentUser!.id : undefined,
      overrideReason: reason,
    });
    if (parsed.data.source === "admin_override") {
      await log(req, "ATTENDANCE_OVERRIDE", "attendance", rec.id, null, rec, reason);
    }
    res.json(rec);
  });

  // Self-service: mark yourself "On Duty" (out for official work) for today.
  // No approval — it just records today's status + notifies your manager. On-duty details
  // (purpose / location / expected return / remarks) are stored as JSON in `notes`.
  app.post("/api/attendance/on-duty", requireAuth, async (req, res) => {
    const empId = req.currentUser!.employeeId;
    if (!empId) return res.status(400).json({ error: "No employee record is linked to your account." });
    const { purpose, location, expectedReturn, remarks } = req.body || {};
    if (!purpose || !String(purpose).trim()) return res.status(400).json({ error: "Please choose a purpose for the on-duty trip." });
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    // If Expected Return falls on a later date, the trip spans multiple days — mark each working
    // day from today through the return date as On Duty (subsequent days show as calendar labels).
    const spanEnd = expectedReturn ? String(expectedReturn).slice(0, 10) : dateStr;
    // Cap the span so a far-off return date can't create an unbounded run of records.
    const MAX_SPAN_DAYS = 14;
    const spanCap = new Date(now.getFullYear(), now.getMonth(), now.getDate() + MAX_SPAN_DAYS);
    if (spanEnd > dateStr && new Date(`${spanEnd}T00:00:00`) > spanCap) {
      return res.status(400).json({ error: `On Duty can span at most ${MAX_SPAN_DAYS} days.` });
    }
    const meta = {
      kind: "on_duty",
      purpose: String(purpose).trim(),
      location: location ? String(location).trim() : null,
      expectedReturn: expectedReturn || null,
      remarks: remarks ? String(remarks).trim() : null,
      spanStart: dateStr,
      spanEnd: spanEnd > dateStr ? spanEnd : dateStr,
    };
    // Today's record carries the check-in time; subsequent days are markers only.
    const rec = await storage.upsertAttendance({
      employeeId: empId, date: dateStr, status: "on_duty", source: "manual",
      checkIn: now, notes: JSON.stringify(meta),
    } as any);
    if (meta.spanEnd > dateStr) {
      const cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(`${meta.spanEnd}T00:00:00`);
      cur.setDate(cur.getDate() + 1);
      while (cur <= end) {
        const wd = cur.getDay();
        if (wd !== 0 && wd !== 6) {
          const ds = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
          await storage.upsertAttendance({ employeeId: empId, date: ds, status: "on_duty", source: "manual", checkIn: null, notes: JSON.stringify({ ...meta, marker: true }) } as any);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
    await log(req, "MARK_ON_DUTY", "attendance", rec.id, null, rec);
    // Notify the employee's manager (best-effort).
    try {
      const emp = await storage.getEmployee(empId);
      if (emp?.managerId) {
        const nm = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "A team member";
        await storage.notifyEmployee(emp.managerId, {
          type: "info", title: "Team member on duty",
          body: `${nm} marked On Duty — ${meta.purpose}${meta.location ? " · " + meta.location : ""}.`,
          link: "/attendance",
        });
      }
    } catch { /* best-effort */ }
    res.json(rec);
  });

  // End an active On-Duty trip: stamp today's record as ended and drop any future span markers.
  app.post("/api/attendance/on-duty/end", requireAuth, async (req, res) => {
    const empId = req.currentUser!.employeeId;
    if (!empId) return res.status(400).json({ error: "No employee record is linked to your account." });
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const todayRec = await storage.getAttendanceByDate(empId, todayStr);
    if (todayRec?.status === "on_duty") {
      let meta: any; try { meta = JSON.parse(todayRec.notes || "{}"); } catch { meta = {}; }
      meta.endedAt = now.toISOString();
      await storage.upsertAttendance({ employeeId: empId, date: todayStr, status: "on_duty", source: todayRec.source, checkIn: todayRec.checkIn, notes: JSON.stringify(meta) } as any);
    }
    // Remove future on-duty markers of the span — sweep this month + the next two (covers the capped span).
    for (let k = 0; k < 3; k++) {
      const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
      const recs = await storage.getAttendanceRecords(empId, d.getMonth() + 1, d.getFullYear());
      for (const r of recs as any[]) if (r.status === "on_duty" && r.date > todayStr) await storage.deleteAttendanceByDate(empId, r.date);
    }
    await log(req, "END_ON_DUTY", "attendance", todayRec?.id, todayRec, null);
    res.json({ ok: true });
  });

  // Self-service: request Work From Home for a day (today .. +5). Needs manager approval, but
  // auto-approves if not actioned by 24h before the WFH date. Stored as an attendance record
  // (status "wfh") whose `notes` carries the approval state.
  app.post("/api/attendance/wfh", requireAuth, async (req, res) => {
    const empId = req.currentUser!.employeeId;
    if (!empId) return res.status(400).json({ error: "No employee record is linked to your account." });
    const { date, endDate, reason, duration } = req.body || {};
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Please pick a valid date." });
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return res.status(400).json({ error: "Invalid end date." });
    const pad = (n: number) => String(n).padStart(2, "0");
    const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    // Max = the 5th working day (Mon–Fri) ahead of today.
    const maxD = new Date(today); let bd = 0;
    while (bd < 5) { maxD.setDate(maxD.getDate() + 1); const w = maxD.getDay(); if (w !== 0 && w !== 6) bd++; }
    const startD = parse(date);
    const endD = endDate ? parse(endDate) : startD;
    if (endD < startD) return res.status(400).json({ error: "End date can't be before the start date." });
    if (startD < today || endD > maxD) return res.status(400).json({ error: "WFH can be requested for today up to 5 working days ahead." });
    const isRange = endD > startD;
    // Working days in the range (weekends skipped).
    const days: string[] = [];
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const w = d.getDay(); if (w === 0 || w === 6) continue;
      days.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }
    if (!days.length) return res.status(400).json({ error: "Pick at least one working day (weekends aren't allowed)." });
    // Conflict guards across every day — a holiday or an approved leave blocks the whole request.
    const holsSet = new Set<string>();
    for (const yr of Array.from(new Set(days.map((d) => parseInt(d.slice(0, 4)))))) (await storage.getHolidays(yr) as any[]).forEach((h) => holsSet.add(h.date));
    for (const ds of days) {
      if (holsSet.has(ds)) return res.status(400).json({ error: `${ds} is a public holiday.` });
      const ov = await storage.getApprovedLeavesInRange(ds, ds, empId);
      if ((ov as any[]).length) return res.status(400).json({ error: `You have approved leave on ${ds}.` });
    }
    const now = new Date();
    // Duration only applies to a single day; a range is always full days.
    const dur = isRange ? "full" : (["full", "first_half", "second_half"].includes(duration) ? duration : "full");
    let firstRec: any = null;
    for (const ds of days) {
      const autoApproveAt = new Date(parse(ds).getTime() - 24 * 60 * 60 * 1000);
      const approval = now >= autoApproveAt ? "approved" : "pending";
      const meta: any = {
        kind: "wfh", approval, duration: dur,
        reason: reason ? String(reason).trim() : null,
        requestedAt: now.toISOString(), autoApproveAt: autoApproveAt.toISOString(),
        decidedAt: approval === "approved" ? now.toISOString() : null,
        decidedBy: approval === "approved" ? "auto" : null,
      };
      if (isRange) { meta.rangeStart = days[0]; meta.rangeEnd = days[days.length - 1]; }
      const rec = await storage.upsertAttendance({ employeeId: empId, date: ds, status: "wfh", source: "manual", checkIn: null, notes: JSON.stringify(meta) } as any);
      if (!firstRec) firstRec = rec;
    }
    await log(req, "WFH_REQUEST", "attendance", firstRec?.id, null, firstRec);
    const rangeLabel = isRange ? `${days[0]} to ${days[days.length - 1]}` : days[0];
    try {
      const emp = await storage.getEmployee(empId);
      const nm = `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim() || "A team member";
      if (emp?.managerId) await storage.notifyEmployee(emp.managerId, { type: "info", title: "WFH request to review", body: `${nm} requested WFH (${rangeLabel})${reason ? " — " + String(reason).trim() : ""}. Approve or reject it in Attendance.`, link: "/attendance" });
      await storage.notifyByRole(["hr_admin", "hr_executive"], { type: "info", title: "WFH request", body: `${nm} requested WFH (${rangeLabel}).`, link: "/attendance" });
    } catch { /* best-effort */ }
    res.json(firstRec);
  });

  // Manager/HR decision on a pending WFH request (identified by employee + date).
  app.patch("/api/attendance/wfh", requireAuth, async (req, res) => {
    const { employeeId, date, decision } = req.body || {};
    if (!employeeId || !date || !["approved", "rejected"].includes(decision)) return res.status(400).json({ error: "employeeId, date and a valid decision are required." });
    const viewer = req.currentUser!;
    // Only the employee's direct manager or a Super Admin can decide. HR/CEO are view-only.
    let canDecide = viewer.role === "super_admin";
    if (!canDecide && viewer.role === "manager" && viewer.employeeId) {
      const reports = await storage.getEmployeesByManager(viewer.employeeId);
      canDecide = reports.some((e) => e.id === employeeId);
    }
    if (!canDecide) return res.status(403).json({ error: "Only the employee's manager or a Super Admin can decide this request." });
    const rec = await storage.getAttendanceByDate(employeeId, date);
    if (!rec) return res.status(404).json({ error: "WFH request not found." });
    let meta: any; try { meta = JSON.parse(rec.notes || "{}"); } catch { meta = {}; }
    if (meta.kind !== "wfh") return res.status(400).json({ error: "Not a WFH request." });
    if (meta.approval !== "pending" || new Date() >= new Date(meta.autoApproveAt)) return res.status(400).json({ error: "This request can no longer be decided (already resolved or auto-approved)." });
    meta.approval = decision; meta.decidedAt = new Date().toISOString(); meta.decidedBy = viewer.id;
    const updated = await storage.upsertAttendance({ employeeId, date, status: "wfh", source: rec.source, checkIn: rec.checkIn, notes: JSON.stringify(meta) } as any);
    await log(req, "WFH_DECISION", "attendance", rec.id, rec, updated, decision);
    try {
      const empUser = (await storage.getAllUsers()).find((u) => u.employeeId === employeeId);
      if (empUser) await storage.createNotification({ userId: empUser.id, type: `wfh_${decision}`, title: `WFH ${decision}`, body: `Your WFH request for ${date} was ${decision}.`, link: "/attendance" });
    } catch { /* best-effort */ }
    res.json(updated);
  });

  // Pending WFH requests a manager/HR can act on (their team; HR = everyone). Only truly-pending
  // ones (not yet within the 24h auto-approve window) are returned.
  app.get("/api/attendance/wfh-pending", requireAuth, async (req, res) => {
    const viewer = req.currentUser!;
    // Only actionable roles get the queue: Super Admin (all) or a manager (their reports).
    if (!(viewer.role === "super_admin" || viewer.role === "manager")) return res.json([]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const toD = new Date(today); toD.setDate(toD.getDate() + 6);
    const to = `${toD.getFullYear()}-${String(toD.getMonth() + 1).padStart(2, "0")}-${String(toD.getDate()).padStart(2, "0")}`;
    const recs = await storage.getWfhInRange(from, to);
    let allowIds: Set<string> | null = null;
    if (viewer.role === "manager" && viewer.employeeId) {
      allowIds = new Set((await storage.getEmployeesByManager(viewer.employeeId)).map((e) => e.id));
    }
    const now = new Date();
    const out: any[] = [];
    for (const r of recs) {
      let meta: any; try { meta = JSON.parse(r.notes || "{}"); } catch { continue; }
      if (meta.kind !== "wfh" || meta.approval !== "pending") continue;
      if (new Date(meta.autoApproveAt) <= now) continue; // already auto-approved
      if (allowIds && !allowIds.has(r.employeeId)) continue;
      out.push({ ...r, meta });
    }
    res.json(out);
  });

  // ===== REGULARIZATION =====
  app.get("/api/regularizations", requireAuth, async (req, res) => {
    const { employeeId, status } = req.query;
    const empId = (employeeId as string) || req.currentUser!.employeeId || undefined;
    const hrRoles = ["super_admin", "hr_admin", "hr_executive"];
    const viewer = req.currentUser!;

    if (hrRoles.includes(viewer.role)) {
      res.json(await storage.getRegularizationRequests(undefined, status as string));
    } else if (viewer.role === "manager" && viewer.employeeId) {
      const directReports = await storage.getEmployeesByManager(viewer.employeeId);
      const directReportIds = new Set(directReports.map(e => e.id));
      const all = await storage.getRegularizationRequests(undefined, status as string);
      res.json(all.filter(r => directReportIds.has(r.employeeId)));
    } else {
      res.json(await storage.getRegularizationRequests(empId, status as string));
    }
  });

  app.post("/api/regularizations", requireAuth, async (req, res) => {
    const parsed = insertRegularizationSchema.safeParse({
      ...req.body,
      employeeId: req.body.employeeId || req.currentUser!.employeeId,
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const req_ = await storage.createRegularizationRequest(parsed.data as any);
    try {
      const emp = await storage.getEmployee(req_.employeeId);
      const who = emp ? `${emp.firstName} ${emp.lastName}` : "An employee";
      const payload = { type: "regularization_applied", title: "Attendance Regularization", body: `${who} requested regularization for ${req_.attendanceDate}.`, link: "/attendance" };
      if (emp?.managerId) await storage.notifyEmployee(emp.managerId, payload);
      await storage.notifyByRole(["hr_admin", "hr_executive"], payload);
    } catch {}
    res.json(req_);
  });

  app.put("/api/regularizations/:id", requireAuth, async (req, res) => {
    const { status, approvalNotes } = req.body;
    const viewer = req.currentUser!;
    const managerAndAbove = ["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"];
    if (!managerAndAbove.includes(viewer.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const allRegs = await storage.getRegularizationRequests(undefined, undefined);
    const reg = allRegs.find(r => r.id === req.params.id);
    if (!reg) return res.status(404).json({ error: "Request not found" });

    if (viewer.role === "manager" && viewer.employeeId) {
      const directReports = await storage.getEmployeesByManager(viewer.employeeId);
      const isDirectReport = directReports.some(e => e.id === reg.employeeId);
      if (!isDirectReport) {
        return res.status(403).json({ error: "Can only approve requests from your direct reports" });
      }
    }

    const updated = await storage.updateRegularizationRequest(req.params.id, {
      status,
      approvalNotes,
      approvedBy: req.currentUser!.id,
    });

    // If approved, update attendance
    if (status === "approved" && reg) {
      await storage.upsertAttendance({
        employeeId: reg.employeeId,
        date: reg.attendanceDate,
        checkIn: reg.requestedCheckIn ?? undefined,
        checkOut: reg.requestedCheckOut ?? undefined,
        status: reg.requestedStatus || "present",
        source: "admin_override",
        overrideBy: req.currentUser!.id,
        overrideReason: `Regularization approved by ${req.currentUser!.username}`,
      });
    }

    // Notify employee of decision
    if (["approved", "rejected"].includes(status) && reg) {
      try {
        const empUser = (await storage.getAllUsers()).find(u => u.employeeId === reg.employeeId);
        if (empUser) {
          await storage.createNotification({
            userId: empUser.id,
            type: `regularization_${status}`,
            title: `Attendance Regularization ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            body: `Your attendance regularization request for ${reg.attendanceDate} has been ${status}.${approvalNotes ? ` Note: ${approvalNotes}` : ""}`,
            link: "/attendance",
          });
        }
      } catch {}
    }

    res.json(updated);
  });

  // ===== LEAVE TYPES =====
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
    const empId = (employeeId as string) || req.currentUser!.employeeId || "";
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
    const empId = req.body.employeeId || req.currentUser!.employeeId;
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
    const request = await storage.createLeaveRequest(parsed.data as any);

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
    const empId = (employeeId as string) || req.currentUser!.employeeId || "";
    if (!empId) return res.status(400).json({ error: "Employee ID required" });
    res.json(await storage.getLeaveLedger(empId, leaveTypeId as string));
  });

  // ===== HOLIDAYS =====
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
    res.json(await storage.updatePayslip(req.params.id, req.body));
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
  app.get("/api/announcements", requireAuth, async (req, res) => {
    res.json(await storage.getAnnouncements());
  });

  app.post("/api/announcements", requireAuth, requireHR, async (req, res) => {
    const body: any = { ...req.body, publishedBy: req.currentUser!.id };
    if (body.expiresAt) { try { body.expiresAt = new Date(body.expiresAt); } catch { delete body.expiresAt; } }
    const parsed = insertAnnouncementSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid announcement data: " + Object.entries(parsed.error.flatten().fieldErrors).map(([f, e]) => `${f}: ${(e as string[]).join(", ")}`).join("; ") });
    const ann = await storage.createAnnouncement(parsed.data);
    try {
      const recipients = (await storage.getAllUsers()).filter((u: any) => u.isActive && u.id !== req.currentUser!.id);
      for (const u of recipients) await storage.notifyUser(u.id, { type: "announcement_posted", title: "New Announcement", body: ann.title, link: "/announcements" });
    } catch {}
    res.json(ann);
  });

  app.delete("/api/announcements/:id", requireAuth, requireHR, async (req, res) => {
    await storage.deleteAnnouncement(req.params.id);
    res.json({ success: true });
  });

  // ===== ASSETS =====
  app.get("/api/assets", requireAuth, async (req, res) => {
    const { employeeId } = req.query;
    res.json(await storage.getAssets(employeeId as string));
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
  app.get("/api/audit-logs", requireAuth, requireAdmin, async (req, res) => {
    const { entityType, entityId } = req.query;
    res.json(await storage.getAuditLogs(entityType as string, entityId as string));
  });

  // ===== DASHBOARD =====
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    res.json(await storage.getDashboardStats());
  });

  // ===== USERS =====
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
    const updated = await storage.updateUser(req.params.id, { role, isActive });
    await log(req, "UPDATE_USER", "user", req.params.id, { role: old?.role }, { role });
    res.json({ ...updated, password: undefined });
  });

  // ===== PERFORMANCE: RATING SCALES =====
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
  app.get("/api/notifications", requireAuth, async (req, res) => {
    res.json(await storage.getUserNotifications(req.currentUser!.id));
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    const count = await storage.getUnreadNotificationCount(req.currentUser!.id);
    res.json({ count });
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    const n = await storage.markNotificationRead(req.params.id, req.currentUser!.id);
    res.json(n);
  });

  app.put("/api/notifications/read-all", requireAuth, async (req, res) => {
    await storage.markAllNotificationsRead(req.currentUser!.id);
    res.json({ success: true });
  });

  // ===== SHIFTS =====
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
    const hrRoles = ["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"];
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
  app.get("/api/employees/:id/history", requireAuth, async (req, res) => {
    const allowedRoles = ["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"];
    if (!allowedRoles.includes(req.currentUser!.role) && req.currentUser!.employeeId !== req.params.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.getEmploymentHistory(req.params.id));
  });

  // ===== ONBOARDING =====
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

  // ===== WORKSPACE MIDDLEWARE =====
  const WORKSPACE_ROLES = ["super_admin", "hr_admin", "hr_executive", "recruiter", "hr_ops", "office_admin", "ceo_approver"];
  const CEO_ROLES = ["super_admin", "ceo_approver"];

  function requireWorkspace(req: any, res: any, next: any) {
    if (!WORKSPACE_ROLES.includes(req.currentUser?.role)) return res.status(403).json({ error: "Workspace access denied" });
    next();
  }
  function requireCEO(req: any, res: any, next: any) {
    if (!CEO_ROLES.includes(req.currentUser?.role)) return res.status(403).json({ error: "CEO/Admin access required" });
    next();
  }

  // ===== APPROVAL ENGINE =====
  app.get("/api/workspace/approvals/pending", requireAuth, requireCEO, async (req, res) => {
    const { entityType } = req.query;
    const pending = await storage.getPendingApprovals(entityType as string);

    const enriched = await Promise.all(pending.map(async (a: any) => {
      let entityDetails: any = null;
      let submitterName: string | null = null;

      try {
        if (a.entityType === "travel_request") entityDetails = await storage.getTravelRequest(a.entityId);
        else if (a.entityType === "purchase_request") entityDetails = await storage.getPurchaseRequest(a.entityId);
        else if (a.entityType === "requisition") entityDetails = await storage.getJobRequisition(a.entityId);
        else if (a.entityType === "offer") entityDetails = await storage.getOffer(a.entityId);
        else if (a.entityType === "payment") {
          const pays = await storage.getWorkspacePayments();
          entityDetails = (pays as any[]).find((p: any) => p.id === a.entityId) || null;
        }
      } catch {}

      try {
        const submitterUser = await storage.getUser(a.createdBy);
        if (submitterUser) {
          const emp = submitterUser.employeeId ? await storage.getEmployee(submitterUser.employeeId) : null;
          submitterName = emp ? `${emp.firstName} ${emp.lastName}` : submitterUser.username;
        }
      } catch {}

      return { ...a, entityDetails, submitterName };
    }));

    res.json(enriched);
  });

  app.post("/api/workspace/approvals/:id/decide", requireAuth, requireCEO, async (req, res) => {
    const { decision, comment } = req.body;
    if (!["approved", "rejected", "changes_requested"].includes(decision)) return res.status(400).json({ error: "Invalid decision" });
    if (["rejected", "changes_requested"].includes(decision) && !comment) return res.status(400).json({ error: "Comment required for reject/changes" });
    const approvalReq = await storage.getApprovalRequest(req.params.id);
    if (!approvalReq) return res.status(404).json({ error: "Not found" });

    const dec = await storage.createApprovalDecision({
      approvalRequestId: req.params.id,
      actorUserId: req.currentUser!.id,
      decision,
      comment,
    });

    const resolvedStatus = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "changes_requested";
    await storage.updateApprovalRequest(req.params.id, {
      status: resolvedStatus,
      resolvedAt: new Date(),
    });

    // Update entity status based on decision
    const { entityType, entityId } = approvalReq;
    if (entityType === "requisition") {
      await storage.updateJobRequisition(entityId, { status: decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "draft" });
    } else if (entityType === "offer") {
      await storage.updateOffer(entityId, { status: decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "draft" });
    } else if (entityType === "purchase_request") {
      await storage.updatePurchaseRequest(entityId, { status: decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "draft" });
    } else if (entityType === "travel_request") {
      await storage.updateTravelRequest(entityId, { status: decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "draft" });
    } else if (entityType === "payment") {
      await storage.updateWorkspacePayment(entityId, { status: decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "requested" });
    }

    // Notify creator
    try {
      const creatorLink = (entityType === "purchase_request" || entityType === "travel_request") ? "/my-requests" : "/workspace/approvals";
      await storage.createNotification({
        userId: approvalReq.createdBy,
        type: `approval_${resolvedStatus}`,
        title: `${entityType.replace(/_/g, " ")} ${resolvedStatus}`,
        body: `Your ${entityType.replace(/_/g, " ")} has been ${resolvedStatus}.${comment ? ` Comment: ${comment}` : ""}`,
        link: creatorLink,
      });
    } catch {}

    // Notify HR Admin / Ops when CEO approves so they can take action
    if (decision === "approved") {
      try {
        const allUsers = await storage.getAllUsers();
        const entityLabel = entityType.replace(/_/g, " ");
        let recipientRoles: string[] = [];
        let actionLink = "/workspace/office";

        if (entityType === "requisition" || entityType === "offer") {
          recipientRoles = ["hr_admin", "recruiter", "super_admin"];
          actionLink = "/workspace/ats";
        } else if (entityType === "purchase_request" || entityType === "travel_request" || entityType === "payment") {
          recipientRoles = ["hr_admin", "office_admin", "super_admin"];
          actionLink = "/workspace/office";
        }

        const recipients = allUsers.filter((u: any) => recipientRoles.includes(u.role) && u.id !== approvalReq.createdBy);
        for (const recipient of recipients) {
          await storage.createNotification({
            userId: recipient.id,
            type: "action_required",
            title: `CEO Approved: ${entityLabel}`,
            body: `A ${entityLabel} has been approved by CEO and requires your action.`,
            link: actionLink,
          });
        }
      } catch {}
    }

    res.json({ decision: dec, approvalRequest: approvalReq });
  });

  app.get("/api/workspace/approvals/:entityType/:entityId", requireAuth, requireWorkspace, async (req, res) => {
    const req_ = await storage.getApprovalRequestByEntity(req.params.entityType, req.params.entityId);
    if (!req_) return res.json(null);
    const decisions = await storage.getApprovalDecisions(req_.id);
    res.json({ ...req_, decisions });
  });

  // ===== RECRUITMENT AGENCIES =====
  app.get("/api/workspace/agencies", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getRecruitmentAgencies());
  });
  app.post("/api/workspace/agencies", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.createRecruitmentAgency(req.body));
  });
  app.put("/api/workspace/agencies/:id", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.updateRecruitmentAgency(req.params.id, req.body));
  });

  // ===== PIPELINE STAGES =====
  app.get("/api/workspace/pipeline-stages", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getPipelineStages());
  });

  // ===== JOB REQUISITIONS =====
  app.get("/api/workspace/requisitions", requireAuth, requireWorkspace, async (req, res) => {
    const { status } = req.query;
    res.json(await storage.getJobRequisitions(status as string));
  });
  app.get("/api/workspace/requisitions/:id", requireAuth, requireWorkspace, async (req, res) => {
    const req_ = await storage.getJobRequisition(req.params.id);
    if (!req_) return res.status(404).json({ error: "Not found" });
    res.json(req_);
  });
  app.post("/api/workspace/requisitions", requireAuth, requireWorkspace, async (req, res) => {
    const req_ = await storage.createJobRequisition({ ...req.body, createdBy: req.currentUser!.id });
    res.json(req_);
  });
  app.put("/api/workspace/requisitions/:id", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.updateJobRequisition(req.params.id, req.body));
  });
  app.post("/api/workspace/requisitions/:id/submit", requireAuth, requireWorkspace, async (req, res) => {
    const req_ = await storage.getJobRequisition(req.params.id);
    if (!req_) return res.status(404).json({ error: "Not found" });
    await storage.updateJobRequisition(req.params.id, { status: "submitted" });
    const wf = await storage.getDefaultWorkflow("requisition");
    const approval = await storage.createApprovalRequest({ entityType: "requisition", entityId: req.params.id, workflowId: wf?.id, createdBy: req.currentUser!.id });
    // Notify CEO
    try {
      const ceoUsers = (await storage.getAllUsers()).filter((u: any) => ["ceo_approver", "super_admin"].includes(u.role));
      for (const ceo of ceoUsers) {
        await storage.createNotification({ userId: ceo.id, type: "approval_pending", title: "New Requisition for Approval", body: `Requisition "${req_.title}" submitted for approval.`, link: "/workspace/approvals" });
      }
    } catch {}
    res.json({ approval });
  });

  // ===== CANDIDATES =====
  app.get("/api/workspace/candidates", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getCandidates(req.query.q as string));
  });
  app.get("/api/workspace/candidates/:id", requireAuth, requireWorkspace, async (req, res) => {
    const c = await storage.getCandidate(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    const apps = await storage.getApplications(undefined, req.params.id);
    res.json({ ...c, applications: apps });
  });
  app.post("/api/workspace/candidates", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.createCandidate(req.body));
  });
  app.put("/api/workspace/candidates/:id", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.updateCandidate(req.params.id, req.body));
  });

  // ===== APPLICATIONS =====
  app.get("/api/workspace/applications", requireAuth, requireWorkspace, async (req, res) => {
    const { requisitionId, candidateId } = req.query;
    res.json(await storage.getApplications(requisitionId as string, candidateId as string));
  });
  app.get("/api/workspace/applications/:id", requireAuth, requireWorkspace, async (req, res) => {
    const app_ = await storage.getApplication(req.params.id);
    if (!app_) return res.status(404).json({ error: "Not found" });
    const [timeline, interviewList] = await Promise.all([
      storage.getApplicationTimeline(req.params.id),
      storage.getInterviews(req.params.id),
    ]);
    res.json({ ...app_, timeline, interviews: interviewList });
  });
  app.post("/api/workspace/applications", requireAuth, requireWorkspace, async (req, res) => {
    const app_ = await storage.createApplication(req.body);
    await storage.addApplicationTimeline({ applicationId: app_.id, actorUserId: req.currentUser!.id, action: "application_created", comment: "Application created" });
    res.json(app_);
  });
  app.put("/api/workspace/applications/:id", requireAuth, requireWorkspace, async (req, res) => {
    const prev = await storage.getApplication(req.params.id);
    const updated = await storage.updateApplication(req.params.id, req.body);
    if (req.body.pipelineStageId && prev?.pipelineStageId !== req.body.pipelineStageId) {
      await storage.addApplicationTimeline({ applicationId: req.params.id, actorUserId: req.currentUser!.id, action: "stage_changed", comment: req.body.comment || "Stage updated" });
    }
    res.json(updated);
  });

  // ===== INTERVIEWS =====
  app.get("/api/workspace/interviews", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getInterviews(req.query.applicationId as string));
  });
  app.post("/api/workspace/interviews", requireAuth, requireWorkspace, async (req, res) => {
    const interview = await storage.createInterview(req.body);
    await storage.addApplicationTimeline({ applicationId: req.body.applicationId, actorUserId: req.currentUser!.id, action: "interview_scheduled", comment: `${req.body.roundName} scheduled` });
    res.json(interview);
  });
  app.put("/api/workspace/interviews/:id", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.updateInterview(req.params.id, req.body));
  });

  app.post("/api/workspace/interviews/:id/feedback", requireAuth, async (req, res) => {
    const f = await storage.createInterviewFeedback({ ...req.body, interviewId: req.params.id, interviewerUserId: req.currentUser!.id, submittedAt: new Date() });
    res.json(f);
  });
  app.get("/api/workspace/interviews/:id/feedback", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getInterviewFeedback(req.params.id));
  });

  // ===== OFFERS =====
  app.get("/api/workspace/offers", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getOffers(req.query.applicationId as string, req.query.status as string));
  });
  app.post("/api/workspace/offers", requireAuth, requireWorkspace, async (req, res) => {
    const offer = await storage.createOffer({ ...req.body, createdBy: req.currentUser!.id });
    res.json(offer);
  });
  app.put("/api/workspace/offers/:id", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.updateOffer(req.params.id, req.body));
  });
  app.post("/api/workspace/offers/:id/submit", requireAuth, requireWorkspace, async (req, res) => {
    const offer = await storage.getOffer(req.params.id);
    if (!offer) return res.status(404).json({ error: "Not found" });
    await storage.updateOffer(req.params.id, { status: "submitted_for_approval" });
    const wf = await storage.getDefaultWorkflow("offer");
    const approval = await storage.createApprovalRequest({ entityType: "offer", entityId: req.params.id, workflowId: wf?.id, createdBy: req.currentUser!.id });
    try {
      const ceoUsers = (await storage.getAllUsers()).filter((u: any) => ["ceo_approver", "super_admin"].includes(u.role));
      for (const ceo of ceoUsers) {
        await storage.createNotification({ userId: ceo.id, type: "approval_pending", title: "New Offer for Approval", body: `Offer for "${offer.offeredRole}" submitted for approval.`, link: "/workspace/approvals" });
      }
    } catch {}
    res.json({ approval });
  });

  // ===== VENDORS =====
  app.get("/api/workspace/vendors", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getVendors(req.query.category as string));
  });
  app.post("/api/workspace/vendors", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.createVendor(req.body));
  });
  app.put("/api/workspace/vendors/:id", requireAuth, requireWorkspace, async (req, res) => {
    const roles = ["super_admin", "hr_admin", "office_admin", "finance"];
    if (!roles.includes(req.currentUser!.role)) return res.status(403).json({ error: "Access denied" });
    res.json(await storage.updateVendor(req.params.id, req.body));
  });

  // ===== PURCHASE REQUESTS =====
  app.get("/api/workspace/purchase-requests", requireAuth, requireWorkspace, async (req, res) => {
    const { status } = req.query;
    res.json(await storage.getPurchaseRequests(undefined, status as string));
  });
  app.post("/api/workspace/purchase-requests", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.createPurchaseRequest({ ...req.body, requesterId: req.currentUser!.id }));
  });
  app.put("/api/workspace/purchase-requests/:id", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.updatePurchaseRequest(req.params.id, req.body));
  });
  app.post("/api/workspace/purchase-requests/:id/submit", requireAuth, requireWorkspace, async (req, res) => {
    const pr = await storage.getPurchaseRequest(req.params.id);
    if (!pr) return res.status(404).json({ error: "Not found" });
    await storage.updatePurchaseRequest(req.params.id, { status: "pending_ceo" });
    const wf = await storage.getDefaultWorkflow("purchase_request");
    const approval = await storage.createApprovalRequest({ entityType: "purchase_request", entityId: req.params.id, workflowId: wf?.id, createdBy: req.currentUser!.id });
    try {
      const ceoUsers = (await storage.getAllUsers()).filter((u: any) => ["ceo_approver", "super_admin"].includes(u.role));
      for (const ceo of ceoUsers) {
        await storage.createNotification({ userId: ceo.id, type: "approval_pending", title: "Purchase Request for Approval", body: `Purchase request "${pr.category}" submitted for approval.`, link: "/workspace/approvals" });
      }
    } catch {}
    res.json({ approval });
  });

  // ===== TRAVEL REQUESTS =====
  app.get("/api/workspace/travel-requests", requireAuth, requireWorkspace, async (req, res) => {
    const { status } = req.query;
    res.json(await storage.getTravelRequests(undefined, status as string));
  });
  app.post("/api/workspace/travel-requests", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.createTravelRequest({ ...req.body, requesterId: req.currentUser!.id }));
  });
  app.put("/api/workspace/travel-requests/:id", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.updateTravelRequest(req.params.id, req.body));
  });
  app.post("/api/workspace/travel-requests/:id/submit", requireAuth, requireWorkspace, async (req, res) => {
    const tr = await storage.getTravelRequest(req.params.id);
    if (!tr) return res.status(404).json({ error: "Not found" });
    await storage.updateTravelRequest(req.params.id, { status: "pending_ceo" });
    const wf = await storage.getDefaultWorkflow("travel_request");
    const approval = await storage.createApprovalRequest({ entityType: "travel_request", entityId: req.params.id, workflowId: wf?.id, createdBy: req.currentUser!.id });
    try {
      const ceoUsers = (await storage.getAllUsers()).filter((u: any) => ["ceo_approver", "super_admin"].includes(u.role));
      for (const ceo of ceoUsers) {
        await storage.createNotification({ userId: ceo.id, type: "approval_pending", title: "Travel Request for Approval", body: `Travel to ${tr.toCity} submitted for approval.`, link: "/workspace/approvals" });
      }
    } catch {}
    res.json({ approval });
  });

  app.post("/api/workspace/travel-requests/:id/assign", requireAuth, requireWorkspace, async (req, res) => {
    const { assignedTo } = req.body;
    if (!assignedTo) return res.status(400).json({ error: "assignedTo is required" });
    const tr = await storage.getTravelRequest(req.params.id);
    if (!tr) return res.status(404).json({ error: "Not found" });
    const assignee = await storage.getUser(assignedTo);
    if (!assignee) return res.status(404).json({ error: "Assignee user not found" });
    const assigneeName = assignee.username;
    const updated = await storage.updateTravelRequest(req.params.id, {
      assignedTo,
      assignedToName: assigneeName,
      assignedAt: new Date(),
    });
    try {
      await storage.createNotification({
        userId: assignedTo,
        type: "task_assigned",
        title: "Travel Booking Assigned to You",
        body: `You have been assigned to handle the travel booking: ${tr.fromCity} → ${tr.toCity} (${tr.purpose}).`,
        link: "/workspace/office",
      });
    } catch {}
    res.json(updated);
  });

  app.get("/api/workspace/travel-bookings/:travelRequestId", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getTravelBookings(req.params.travelRequestId));
  });
  app.post("/api/workspace/travel-bookings", requireAuth, requireWorkspace, async (req, res) => {
    const booking = await storage.createTravelBooking(req.body);

    try {
      const tr = await storage.getTravelRequest(req.body.travelRequestId);
      if (tr) {
        const requesterUser = await storage.getUser(tr.requesterId);
        const typeLabel = req.body.type === "flight" ? "Flight" : "Hotel";
        const providerName = req.body.providerName || "";
        const pnrOrTicket = req.body.pnrOrTicket || "";

        let detailLines: string[] = [];
        if (req.body.type === "flight") {
          if (providerName) detailLines.push(`Airline: ${providerName}`);
          if (pnrOrTicket) detailLines.push(`PNR / Ticket: ${pnrOrTicket}`);
          if (req.body.departureTime) detailLines.push(`Departure: ${req.body.departureTime}`);
          if (req.body.arrivalTime) detailLines.push(`Arrival: ${req.body.arrivalTime}`);
        } else {
          if (providerName) detailLines.push(`Hotel: ${providerName}`);
          if (pnrOrTicket) detailLines.push(`Booking Ref: ${pnrOrTicket}`);
          if (req.body.checkInDate) detailLines.push(`Check-in: ${req.body.checkInDate}`);
          if (req.body.checkOutDate) detailLines.push(`Check-out: ${req.body.checkOutDate}`);
        }
        if (req.body.cost) detailLines.push(`Cost: ₹${Number(req.body.cost).toLocaleString("en-IN")}`);
        if (req.body.notes) detailLines.push(`Notes: ${req.body.notes}`);

        const detailSummary = detailLines.join(" | ");
        const notifBody = `Your ${typeLabel} booking has been confirmed for ${tr.fromCity} → ${tr.toCity}. ${detailSummary}`;

        if (requesterUser) {
          await storage.createNotification({
            userId: requesterUser.id,
            type: "booking_confirmed",
            title: `${typeLabel} Booking Confirmed`,
            body: notifBody,
            link: "/my-requests",
          });

          const emp = requesterUser.employeeId ? await storage.getEmployee(requesterUser.employeeId) : null;
          const recipientEmail = emp?.email;
          if (recipientEmail && process.env.SENDGRID_API_KEY) {
            try {
              const sgMail = (await import("@sendgrid/mail")).default;
              sgMail.setApiKey(process.env.SENDGRID_API_KEY);
              const htmlDetails = detailLines.map(l => `<li>${l}</li>`).join("");
              await sgMail.send({
                to: recipientEmail,
                from: process.env.SENDGRID_FROM_EMAIL || "noreply@emoenergy.com",
                subject: `Your ${typeLabel} Booking is Confirmed — ${tr.fromCity} → ${tr.toCity}`,
                html: `<p>Dear ${emp?.firstName || "Team"},</p>
                  <p>Your <strong>${typeLabel} booking</strong> has been confirmed for your trip from <strong>${tr.fromCity}</strong> to <strong>${tr.toCity}</strong>.</p>
                  <ul>${htmlDetails}</ul>
                  <p>If you have any questions, please contact the Office Admin team.</p>
                  <p>Regards,<br/>EMO Energy Office Admin</p>`,
              });
            } catch (emailErr) {
              console.error("Email send failed:", emailErr);
            }
          }
        }
      }
    } catch (notifErr) {
      console.error("Post-booking notification failed:", notifErr);
    }

    res.json(booking);
  });

  // ===== WORKSPACE PAYMENTS =====
  app.get("/api/workspace/payments", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getWorkspacePayments(req.query.status as string));
  });
  app.post("/api/workspace/payments", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.createWorkspacePayment({ ...req.body, requestedBy: req.currentUser!.id }));
  });
  app.put("/api/workspace/payments/:id", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.updateWorkspacePayment(req.params.id, req.body));
  });
  app.post("/api/workspace/payments/:id/submit", requireAuth, requireWorkspace, async (req, res) => {
    const pay = await storage.getWorkspacePayments();
    const p = (pay as any[]).find((p: any) => p.id === req.params.id);
    await storage.updateWorkspacePayment(req.params.id, { status: "pending_ceo" });
    const wf = await storage.getDefaultWorkflow("payment");
    const approval = await storage.createApprovalRequest({ entityType: "payment", entityId: req.params.id, workflowId: wf?.id, createdBy: req.currentUser!.id });
    try {
      const ceoUsers = (await storage.getAllUsers()).filter((u: any) => ["ceo_approver", "super_admin"].includes(u.role));
      for (const ceo of ceoUsers) {
        await storage.createNotification({ userId: ceo.id, type: "approval_pending", title: "Payment for Approval", body: `Payment request submitted for approval.`, link: "/workspace/approvals" });
      }
    } catch {}
    res.json({ approval });
  });

  // ===== ADMIN HELPDESK =====
  app.get("/api/workspace/tickets", requireAuth, requireWorkspace, async (req, res) => {
    const { status } = req.query;
    res.json(await storage.getAdminTickets(undefined, status as string));
  });
  app.post("/api/workspace/tickets", requireAuth, async (req, res) => {
    res.json(await storage.createAdminTicket({ ...req.body, requesterId: req.currentUser!.id }));
  });
  app.put("/api/workspace/tickets/:id", requireAuth, requireWorkspace, async (req, res) => {
    const updated = await storage.updateAdminTicket(req.params.id, req.body);
    try {
      if (req.body.status && updated?.requesterId) {
        await storage.notifyUser(updated.requesterId, {
          type: ["resolved", "closed", "done"].includes(req.body.status) ? "ticket_resolved" : "ticket_updated",
          title: `Ticket ${req.body.status.replace(/_/g, " ")}`,
          body: `Your ticket "${updated.subject || "request"}" is now ${req.body.status.replace(/_/g, " ")}.`,
          link: "/my-requests?tab=tickets",
        });
      }
    } catch {}
    res.json(updated);
  });
  app.get("/api/workspace/tickets/:id/comments", requireAuth, async (req, res) => {
    res.json(await storage.getAdminTicketComments(req.params.id));
  });
  app.post("/api/workspace/tickets/:id/comments", requireAuth, async (req, res) => {
    res.json(await storage.addAdminTicketComment({ ticketId: req.params.id, authorId: req.currentUser!.id, content: req.body.content, isInternal: req.body.isInternal || false }));
  });

  // ===== HR TASKS =====
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

  // ===== COMPANY WORKSPACE — EMPLOYEE MY-REQUESTS =====

  // Helper: verify requester owns the record
  async function verifyOwner(requesterId: string, currentUserId: string, res: any) {
    if (requesterId !== currentUserId) {
      res.status(403).json({ error: "Access denied" });
      return false;
    }
    return true;
  }

  app.get("/api/my-requests/summary", requireAuth, async (req, res) => {
    const uid = req.currentUser!.id;
    const [prs, trs, tickets] = await Promise.all([
      storage.getMyPurchaseRequests(uid),
      storage.getMyTravelRequests(uid),
      storage.getMyTickets(uid),
    ]);
    res.json({
      purchases: { total: prs.length, pending: prs.filter((r: any) => ["draft","submitted","pending_ceo"].includes(r.status)).length },
      travels: { total: trs.length, pending: trs.filter((r: any) => ["draft","submitted","pending_ceo"].includes(r.status)).length },
      tickets: { total: tickets.length, open: tickets.filter((r: any) => ["open","in_progress","need_info"].includes(r.status)).length },
    });
  });

  // Purchase Requests (employee-facing)
  app.get("/api/my-requests/purchases", requireAuth, async (req, res) => {
    res.json(await storage.getMyPurchaseRequests(req.currentUser!.id, req.query.status as string));
  });

  app.post("/api/my-requests/purchases", requireAuth, async (req, res) => {
    const { category, items, estimatedCost, neededByDate, notes, department } = req.body;
    const pr = await storage.createPurchaseRequest({
      requesterId: req.currentUser!.id,
      category,
      items: items || [],
      estimatedCost: estimatedCost ? String(estimatedCost) : null,
      neededByDate: neededByDate || null,
      notes: notes || null,
      department: department || null,
      status: "draft",
    });
    res.json(pr);
  });

  app.put("/api/my-requests/purchases/:id", requireAuth, async (req, res) => {
    const pr = await storage.getPurchaseRequest(req.params.id);
    if (!pr) return res.status(404).json({ error: "Not found" });
    if (!await verifyOwner(pr.requesterId, req.currentUser!.id, res)) return;
    if (!["draft", "changes_requested"].includes(pr.status)) return res.status(400).json({ error: "Cannot edit in current status" });
    res.json(await storage.updatePurchaseRequest(req.params.id, req.body));
  });

  app.post("/api/my-requests/purchases/:id/submit", requireAuth, async (req, res) => {
    const pr = await storage.getPurchaseRequest(req.params.id);
    if (!pr) return res.status(404).json({ error: "Not found" });
    if (!await verifyOwner(pr.requesterId, req.currentUser!.id, res)) return;
    await storage.updatePurchaseRequest(req.params.id, { status: "pending_ceo" });
    const wf = await storage.getDefaultWorkflow("purchase_request");
    const approval = await storage.createApprovalRequest({ entityType: "purchase_request", entityId: req.params.id, workflowId: wf?.id, createdBy: req.currentUser!.id });
    try {
      const ceoUsers = (await storage.getAllUsers()).filter((u: any) => ["ceo_approver", "super_admin"].includes(u.role));
      for (const ceo of ceoUsers) {
        await storage.createNotification({ userId: ceo.id, type: "approval_pending", title: "Purchase Request for Approval", body: `A purchase request for "${pr.category}" has been submitted.`, link: "/workspace/approvals" });
      }
      await storage.createNotification({ userId: req.currentUser!.id, type: "request_submitted", title: "Purchase Request Submitted", body: `Your purchase request has been submitted for CEO approval.`, link: "/my-requests" });
    } catch {}
    res.json({ approval });
  });

  app.post("/api/my-requests/purchases/:id/revoke", requireAuth, async (req, res) => {
    const pr = await storage.getPurchaseRequest(req.params.id);
    if (!pr) return res.status(404).json({ error: "Not found" });
    if (!await verifyOwner(pr.requesterId, req.currentUser!.id, res)) return;
    if (["approved", "rejected", "fulfilled", "completed", "ordered", "cancelled"].includes(pr.status)) return res.status(400).json({ error: "This request can no longer be revoked." });
    res.json(await storage.updatePurchaseRequest(req.params.id, { status: "cancelled" }));
  });

  // Travel Requests (employee-facing)
  app.get("/api/my-requests/travels", requireAuth, async (req, res) => {
    res.json(await storage.getMyTravelRequests(req.currentUser!.id, req.query.status as string));
  });

  app.post("/api/my-requests/travels", requireAuth, async (req, res) => {
    const { purpose, fromCity, toCity, travelDate, returnDate, preferences, estimatedBudget } = req.body;
    const tr = await storage.createTravelRequest({
      requesterId: req.currentUser!.id,
      purpose,
      fromCity,
      toCity,
      travelDate: travelDate || null,
      returnDate: returnDate || null,
      preferences: preferences || null,
      estimatedBudget: estimatedBudget ? String(estimatedBudget) : null,
      status: "draft",
    });
    res.json(tr);
  });

  app.put("/api/my-requests/travels/:id", requireAuth, async (req, res) => {
    const tr = await storage.getTravelRequest(req.params.id);
    if (!tr) return res.status(404).json({ error: "Not found" });
    if (!await verifyOwner(tr.requesterId, req.currentUser!.id, res)) return;
    if (!["draft", "changes_requested"].includes(tr.status)) return res.status(400).json({ error: "Cannot edit in current status" });
    res.json(await storage.updateTravelRequest(req.params.id, req.body));
  });

  app.post("/api/my-requests/travels/:id/submit", requireAuth, async (req, res) => {
    const tr = await storage.getTravelRequest(req.params.id);
    if (!tr) return res.status(404).json({ error: "Not found" });
    if (!await verifyOwner(tr.requesterId, req.currentUser!.id, res)) return;
    await storage.updateTravelRequest(req.params.id, { status: "pending_ceo" });
    const wf = await storage.getDefaultWorkflow("travel_request");
    const approval = await storage.createApprovalRequest({ entityType: "travel_request", entityId: req.params.id, workflowId: wf?.id, createdBy: req.currentUser!.id });
    try {
      const ceoUsers = (await storage.getAllUsers()).filter((u: any) => ["ceo_approver", "super_admin"].includes(u.role));
      for (const ceo of ceoUsers) {
        await storage.createNotification({ userId: ceo.id, type: "approval_pending", title: "Travel Request for Approval", body: `Travel from ${tr.fromCity} to ${tr.toCity} submitted for approval.`, link: "/workspace/approvals" });
      }
      await storage.createNotification({ userId: req.currentUser!.id, type: "request_submitted", title: "Travel Request Submitted", body: `Your travel request to ${tr.toCity} has been submitted for CEO approval.`, link: "/my-requests" });
    } catch {}
    res.json({ approval });
  });

  app.post("/api/my-requests/travels/:id/revoke", requireAuth, async (req, res) => {
    const tr = await storage.getTravelRequest(req.params.id);
    if (!tr) return res.status(404).json({ error: "Not found" });
    if (!await verifyOwner(tr.requesterId, req.currentUser!.id, res)) return;
    if (["approved", "rejected", "booked", "completed", "cancelled"].includes(tr.status)) return res.status(400).json({ error: "This request can no longer be revoked." });
    res.json(await storage.updateTravelRequest(req.params.id, { status: "cancelled" }));
  });

  // Tickets (employee-facing)
  app.get("/api/my-requests/tickets", requireAuth, async (req, res) => {
    res.json(await storage.getMyTickets(req.currentUser!.id, req.query.status as string));
  });

  app.post("/api/my-requests/tickets", requireAuth, async (req, res) => {
    const { category, subject, description, priority } = req.body;
    const ticket = await storage.createAdminTicket({
      requesterId: req.currentUser!.id,
      category,
      subject,
      description: description || null,
      priority: priority || "medium",
      status: "open",
    });
    try {
      const adminUsers = (await storage.getAllUsers()).filter((u: any) => ["super_admin", "hr_admin", "office_admin"].includes(u.role));
      for (const admin of adminUsers) {
        await storage.createNotification({ userId: admin.id, type: "ticket_created", title: "New Helpdesk Ticket", body: `"${subject}" submitted.`, link: "/workspace/hr-ops" });
      }
    } catch {}
    res.json(ticket);
  });

  // Ticket comments (employee can comment on own tickets)
  app.get("/api/my-requests/tickets/:id/comments", requireAuth, async (req, res) => {
    const t = await storage.getAdminTicket(req.params.id);
    if (!t || t.requesterId !== req.currentUser!.id) return res.status(403).json({ error: "Access denied" });
    res.json(await storage.getAdminTicketComments(req.params.id));
  });

  app.post("/api/my-requests/tickets/:id/comments", requireAuth, async (req, res) => {
    const t = await storage.getAdminTicket(req.params.id);
    if (!t || t.requesterId !== req.currentUser!.id) return res.status(403).json({ error: "Access denied" });
    res.json(await storage.addAdminTicketComment({ ticketId: req.params.id, authorId: req.currentUser!.id, content: req.body.content, isInternal: false }));
  });

  app.post("/api/my-requests/tickets/:id/revoke", requireAuth, async (req, res) => {
    const t = await storage.getAdminTicket(req.params.id);
    if (!t) return res.status(404).json({ error: "Not found" });
    if (!await verifyOwner(t.requesterId, req.currentUser!.id, res)) return;
    if (["resolved", "done", "closed", "cancelled"].includes(t.status)) return res.status(400).json({ error: "This ticket can no longer be revoked." });
    res.json(await storage.updateAdminTicket(req.params.id, { status: "cancelled" }));
  });

  // ===== TEAM REQUESTS (Manager visibility) =====
  app.get("/api/team-requests", requireAuth, async (req, res) => {
    const user = req.currentUser!;
    const emp = await storage.getEmployeeByUserId(user.id);
    if (!emp) return res.status(404).json({ error: "Employee profile not found" });

    const MANAGER_ROLES = ["super_admin", "hr_admin", "manager", "hr_executive", "hr_ops"];
    if (!MANAGER_ROLES.includes(user.role)) return res.status(403).json({ error: "Manager access required" });

    const teamEmps = await storage.getEmployeesByManager(emp.id);
    const userIds = (teamEmps as any[]).map((e: any) => e.userId).filter(Boolean);

    if (userIds.length === 0) return res.json({ purchases: [], travels: [], tickets: [] });

    const [allPRs, allTRs, allTickets] = await Promise.all([
      Promise.all(userIds.map((uid: string) => storage.getMyPurchaseRequests(uid))),
      Promise.all(userIds.map((uid: string) => storage.getMyTravelRequests(uid))),
      Promise.all(userIds.map((uid: string) => storage.getMyTickets(uid))),
    ]);

    res.json({
      purchases: allPRs.flat().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      travels: allTRs.flat().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      tickets: allTickets.flat().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      teamMembers: teamEmps,
    });
  });

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

  return httpServer;
}

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

// A rejected WFH request is "not happening" — the UI hides it and it must NOT occupy the day
// (otherwise it blocks an approved-leave overlay from showing). Drop these from attendance payloads.
function isRejectedWfh(r: any): boolean {
  if (r?.status !== "wfh") return false;
  try { return JSON.parse(r.notes || "{}").approval === "rejected"; } catch { return false; }
}
function visibleAttendance(records: any[]): any[] {
  return (records || []).filter((r) => !isRejectedWfh(r));
}

// Expand approved leave requests into synthetic per-day attendance entries within [from, to].
// Weekends are skipped, and any day that already has a real attendance record is left untouched
// (the real record wins). This keeps the attendance calendar in sync with approved leaves without
// duplicating/persisting rows — so cancelling or rejecting a leave instantly removes it from view.
function expandApprovedLeaveDays(leaves: any[], from: string, to: string, existing: Set<string>) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const out: any[] = [];
  for (const lr of leaves) {
    const startStr = lr.startDate < from ? from : lr.startDate;
    const endStr = lr.endDate > to ? to : lr.endDate;
    const end = parse(endStr);
    for (let d = parse(startStr); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const wd = d.getDay();
      if (wd === 0 || wd === 6) continue; // leave doesn't mark weekends
      const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const key = `${lr.employeeId}|${date}`;
      if (existing.has(key)) continue; // explicit attendance record takes precedence
      existing.add(key);
      out.push({
        id: `leave-${lr.id}-${date}`,
        employeeId: lr.employeeId,
        date,
        status: lr.isHalfDay ? "half_day" : "leave",
        source: "leave",
        checkIn: null,
        checkOut: null,
        notes: lr.isHalfDay ? "Half-day leave" : "Approved leave",
        leaveRequestId: lr.id,
        createdAt: lr.createdAt ?? null,
        updatedAt: lr.updatedAt ?? null,
      });
    }
  }
  return out;
}

function countWeekends(month: number, year: number): number {
  let count = 0;
  const days = getDaysInMonth(month, year);
  for (let d = 1; d <= days; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day === 0 || day === 6) count++;
  }
  return count;
}
