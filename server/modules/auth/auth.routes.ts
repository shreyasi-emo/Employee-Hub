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

export function registerAuthRoutes(app: Express) {
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
    // Double-locked: off in production AND unless ENABLE_DEV_LOGIN=true is explicitly set,
    // so a single NODE_ENV slip on a deploy can't expose this backdoor.
    if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEV_LOGIN !== "true") {
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
    if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEV_LOGIN !== "true") {
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
}
