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

export function registerWorkspaceApprovalsRoutes(app: Express) {
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
    if (entityType === "purchase_request") {
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

        if (entityType === "purchase_request" || entityType === "travel_request" || entityType === "payment") {
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
}
