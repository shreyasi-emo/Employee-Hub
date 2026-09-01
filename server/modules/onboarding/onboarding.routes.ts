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
import { sendEmail } from "../../shared/email";
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
    const hrRoles = ["super_admin", "hr_admin", "hr_executive", "ceo_approver"];
    if (hrRoles.includes(req.currentUser!.role)) {
      res.json(await storage.getOnboardingInstances());
    } else {
      res.json(await storage.getOnboardingInstances(req.currentUser!.employeeId || ""));
    }
  });

  app.get("/api/onboarding/instances/:id/tasks", requireAuth, async (req, res) => {
    const hrRoles = ["super_admin", "hr_admin", "hr_executive", "ceo_approver"];
    if (!hrRoles.includes(req.currentUser!.role)) {
      const mine = await storage.getOnboardingInstances(req.currentUser!.employeeId || "");
      if (!mine.some((i: any) => i.id === req.params.id)) return res.status(403).json({ error: "Forbidden" });
    }
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

  // =========================================================================
  // CANDIDATE DOCUMENT COLLECTION (pre-onboarding) — HR triggers, candidate fills a tokenized public form
  // =========================================================================

  // HR: add a candidate (or reuse one) and generate + "send" a unique doc-collection link.
  app.post("/api/onboarding/doc-requests", requireAuth, requireHR, async (req, res) => {
    const { name, email, phone, position, department, candidateId } = req.body || {};
    let cid = candidateId;
    if (!cid) {
      if (!name?.trim() || !email?.trim()) return res.status(400).json({ error: "Candidate name and email are required." });
      if (name.trim().split(/\s+/).length < 2) return res.status(400).json({ error: "Candidate's first and last name are required." });
      const c = await storage.createCandidate({ name: name.trim(), email: email.trim(), phone: phone?.trim() || null });
      cid = c.id;
    }
    const token = crypto.randomBytes(24).toString("base64url"); // unguessable public token
    const request = await storage.createDocRequest({ candidateId: cid, token, position: position?.trim() || null, department: department?.trim() || null });
    const cand = await storage.getCandidate(cid);
    const link = `${req.protocol}://${req.get("host")}/onboard/${token}`;
    const emailResult = await sendEmail({
      to: cand?.email || "",
      subject: "Complete your onboarding documents — EMO Energy",
      text: `Hi ${cand?.name || ""},\n\nWelcome aboard! Please complete your onboarding by filling this secure form and uploading your documents:\n\n${link}\n\nThis link is unique to you.\n\n— EMO Energy HR`,
      html: `<p>Hi ${cand?.name || ""},</p><p>Welcome aboard! Please complete your onboarding by filling this secure form and uploading your documents:</p><p><a href="${link}">${link}</a></p><p>This link is unique to you.</p><p>— EMO Energy HR</p>`,
    });
    res.json({ ...request, candidateName: cand?.name, candidateEmail: cand?.email, link, email: emailResult });
  });

  // HR: list all doc requests with candidate + status.
  app.get("/api/onboarding/doc-requests", requireAuth, requireHR, async (_req, res) => {
    res.json(await storage.listDocRequests());
  });

  // Public (no login) — fetch the form for a token: prefill + status.
  app.get("/api/onboarding/collect/:token", async (req, res) => {
    const r = await storage.getDocRequestByToken(req.params.token);
    if (!r) return res.status(404).json({ error: "This link is invalid or has expired." });
    res.json({
      status: r.status,
      candidateName: r.candidateName,
      candidateEmail: r.candidateEmail,
      candidatePhone: r.candidatePhone,
      submittedAt: r.submittedAt,
    });
  });

  // Public (no login) — candidate submits their form + documents.
  app.post("/api/onboarding/collect/:token", async (req, res) => {
    const r = await storage.getDocRequestByToken(req.params.token);
    if (!r) return res.status(404).json({ error: "This link is invalid or has expired." });
    if (r.status === "submitted") return res.status(409).json({ error: "You have already submitted your documents." });
    const { formData, files } = req.body || {};
    if (!formData || typeof formData !== "object") return res.status(400).json({ error: "Missing form data." });
    await storage.submitDocRequest(req.params.token, { formData, files: files || {} });
    try {
      await storage.notifyByRole(["super_admin", "hr_admin", "hr_executive"], {
        type: "onboarding_docs_submitted",
        title: "Onboarding documents submitted",
        body: `${r.candidateName || "A candidate"} submitted their onboarding documents.`,
        link: "/onboarding",
      });
    } catch {}
    res.json({ success: true });
  });

  // HR: fetch one request with the submitted data + files (for the review / onboard screen).
  app.get("/api/onboarding/doc-requests/:id", requireAuth, requireHR, async (req, res) => {
    const r = await storage.getDocRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json(r);
  });

  // HR: set date of joining and/or upload the signed offer letter (gates onboarding).
  app.patch("/api/onboarding/doc-requests/:id", requireAuth, requireHR, async (req, res) => {
    const { joinDate, offerLetter } = req.body || {};
    const patch: any = {};
    if (joinDate !== undefined) patch.joinDate = joinDate || null;
    if (offerLetter !== undefined) patch.offerLetter = offerLetter || null;
    if (!Object.keys(patch).length) return res.status(400).json({ error: "Nothing to update." });
    res.json(await storage.updateDocRequest(req.params.id, patch));
  });

  // HR: onboard — assign an employee code, create the employee, and move the documents across.
  app.post("/api/onboarding/doc-requests/:id/onboard", requireAuth, requireHR, async (req, res) => {
    try {
      const result = await storage.onboardCandidateDocRequest(req.params.id, req.currentUser!.id);
      try {
        await storage.notifyByRole(["super_admin", "hr_admin", "hr_executive"], {
          type: "employee_onboarded", title: "New employee onboarded",
          body: `${result.employee.firstName} ${result.employee.lastName} onboarded as ${result.employeeCode}.`,
          link: `/employees/${result.employee.id}`,
        });
      } catch {}
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Could not onboard." });
    }
  });

}
