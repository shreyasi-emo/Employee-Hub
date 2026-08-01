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

export function registerMyRequestsRoutes(app: Express) {
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
}
