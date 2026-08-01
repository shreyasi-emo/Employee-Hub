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

export function registerWorkspaceAtsRoutes(app: Express) {
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
}
